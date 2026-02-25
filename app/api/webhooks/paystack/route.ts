import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { canTransitionWithdrawal } from '@/lib/withdrawal'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

function verifyPaystackSignature(body: string, signature: string): boolean {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack secret key not configured')
  }

  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex')

  return hash === signature
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature provided' }, { status: 400 })
    }

    const isValid = verifyPaystackSignature(body, signature)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const webhook = JSON.parse(body)
    const { event, data } = webhook

    if (event !== 'transfer.success' && event !== 'transfer.failed') {
      return NextResponse.json({ received: true })
    }

    const reference = String(data?.reference || '')
    const transferCode = String(data?.transfer_code || '')
    const failureReason = String(data?.reason || 'Transfer failed')

    const withdrawal = await prisma.withdrawal.findFirst({
      where: {
        OR: [
          { id: reference },
          { providerReference: transferCode },
        ],
      },
    })

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    if (event === 'transfer.success') {
      if (withdrawal.status === 'completed') {
        return NextResponse.json({ received: true, idempotent: true })
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
          providerReference: transferCode || withdrawal.providerReference,
          failureReason: null,
        },
      })

      return NextResponse.json({ received: true, status: 'completed' })
    }

    if (withdrawal.status === 'failed') {
      return NextResponse.json({ received: true, idempotent: true })
    }

    if (!canTransitionWithdrawal(withdrawal.status, 'failed')) {
      return NextResponse.json(
        { error: `Invalid withdrawal transition from ${withdrawal.status} to failed` },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'failed',
          providerReference: transferCode || withdrawal.providerReference,
          failureReason,
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

    return NextResponse.json({ received: true, status: 'failed' })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    )
  }
}
