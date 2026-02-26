import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { canTransitionWithdrawal } from '@/lib/withdrawal'

const AFFILIATE_API_SECRET = process.env.AFFILIATE_API_SECRET

interface WebhookPayload {
  event: 'transfer.success' | 'transfer.failed'
  data: {
    reference: string
    transfer_code?: string
    reason?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    if (!AFFILIATE_API_SECRET || token !== AFFILIATE_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload: WebhookPayload = await request.json()
    const { event, data } = payload

    if (!event || !data?.reference) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
    }

    const withdrawal = await prisma.withdrawal.findFirst({
      where: {
        OR: [
          { id: data.reference },
          { providerReference: data.transfer_code || '' },
        ],
      },
      include: {
        affiliate: {
          select: { id: true },
        },
      },
    })

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    if (event === 'transfer.success') {
      if (withdrawal.status === 'completed') {
        return NextResponse.json({ success: true, message: 'Already completed (idempotent)' })
      }

      if (!canTransitionWithdrawal(withdrawal.status, 'completed')) {
        return NextResponse.json(
          { error: `Invalid withdrawal transition from ${withdrawal.status} to completed` },
          { status: 409 }
        )
      }

      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          failureReason: null,
          providerReference: data.transfer_code || withdrawal.providerReference,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Withdrawal marked as completed',
        withdrawalId: withdrawal.id,
        status: 'completed',
      })
    }

    if (withdrawal.status === 'failed') {
      return NextResponse.json({ success: true, message: 'Already failed (idempotent)' })
    }

    if (!canTransitionWithdrawal(withdrawal.status, 'failed')) {
      return NextResponse.json(
        { error: `Invalid withdrawal transition from ${withdrawal.status} to failed` },
        { status: 409 }
      )
    }

    const failureReason = data.reason || 'Transfer failed'

    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'failed',
          failureReason,
          providerReference: data.transfer_code || withdrawal.providerReference,
        },
      })

      await tx.affiliate.update({
        where: { id: withdrawal.affiliateId },
        data: {
          availableBalance: {
            increment: withdrawal.amount,
          },
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Withdrawal marked as failed and amount refunded',
      withdrawalId: withdrawal.id,
      status: 'failed',
      reason: failureReason,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    )
  }
}
