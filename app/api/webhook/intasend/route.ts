import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canTransitionWithdrawal } from '@/lib/withdrawal'
import { completeWithdrawal, failWithdrawal, findWithdrawalByReferenceOrId } from '@/lib/withdrawal-service'

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const WEBHOOK_HEADER = 'x-webhook-secret'

function normalizeWebhookStatus(rawStatus: unknown) {
  const status = String(rawStatus || '').trim().toLowerCase()
  if (status === 'success' || status === 'successful' || status === 'completed') {
    return 'successful'
  }

  if (status === 'fail' || status === 'failed' || status === 'error') {
    return 'failed'
  }

  return status
}

export async function POST(request: NextRequest) {
  try {
    const headerSecret = request.headers.get(WEBHOOK_HEADER)
    if (!WEBHOOK_SECRET || headerSecret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
    }

    const payload = await request.json().catch(() => null)
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
    }

    const transactionId = String(payload.transaction_id || payload.transactionId || payload.id || '')
    const status = normalizeWebhookStatus(payload.status || payload.transaction_status || payload.state)
    const reference = String(payload.reference || payload.metadata?.reference || '')
    const failureReason = String(payload.error || payload.reason || payload.message || '')
    const timestamp = new Date(payload.timestamp || payload.created_at || payload.createdAt || Date.now())

    const lookupReference = transactionId || reference
    if (!lookupReference) {
      return NextResponse.json({ error: 'Missing reference or transaction ID in webhook payload' }, { status: 400 })
    }

    const withdrawal = await findWithdrawalByReferenceOrId(lookupReference)
    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    if (status === 'successful') {
      if (withdrawal.status === 'completed') {
        return NextResponse.json({ received: true, idempotent: true })
      }

      if (!canTransitionWithdrawal(withdrawal.status, 'completed')) {
        return NextResponse.json(
          { error: `Invalid transition from ${withdrawal.status} to completed` },
          { status: 409 }
        )
      }

      await completeWithdrawal({
        withdrawalId: withdrawal.id,
        providerReference: transactionId || withdrawal.providerReference || withdrawal.id,
      })

      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          updatedAt: timestamp,
        },
      })

      return NextResponse.json({ received: true, status: 'completed' })
    }

    if (status === 'failed') {
      if (withdrawal.status === 'failed') {
        return NextResponse.json({ received: true, idempotent: true })
      }

      if (!canTransitionWithdrawal(withdrawal.status, 'failed')) {
        return NextResponse.json(
          { error: `Invalid transition from ${withdrawal.status} to failed` },
          { status: 409 }
        )
      }

      await failWithdrawal({
        withdrawalId: withdrawal.id,
        providerReference: transactionId || withdrawal.providerReference || withdrawal.id,
        failureReason: failureReason || 'IntaSend payout failed',
      })

      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          updatedAt: timestamp,
        },
      })

      return NextResponse.json({ received: true, status: 'failed' })
    }

    return NextResponse.json({ received: true, status: 'ignored' })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error?.message || 'unknown error' },
      { status: 500 }
    )
  }
}
