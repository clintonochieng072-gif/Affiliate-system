import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Internal Paystack Webhook Handler
 * 
 * This endpoint receives Paystack webhook events forwarded from the Lead Capture System.
 * It does NOT receive webhooks directly from Paystack.
 * 
 * Security: Protected by AFFILIATE_API_SECRET
 * Events: transfer.success, transfer.failed
 */

const AFFILIATE_API_SECRET = process.env.AFFILIATE_API_SECRET

interface WebhookPayload {
  event: 'transfer.success' | 'transfer.failed'
  data: {
    reference: string
    transfer_code?: string
    amount: number
    reason?: string
    status?: string
  }
}

/**
 * POST /api/internal/paystack-webhook
 * Handle forwarded Paystack transfer status notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    if (token !== AFFILIATE_API_SECRET) {
      console.error('Invalid API secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse webhook payload
    const payload: WebhookPayload = await request.json()
    const { event, data } = payload

    console.log(`[Internal Webhook] Received event: ${event}`, {
      reference: data.reference,
      amount: data.amount,
    })

    if (!event || !data?.reference) {
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      )
    }

    // Handle transfer events
    if (event === 'transfer.success' || event === 'transfer.failed') {
      const reference = data.reference
      const isSuccess = event === 'transfer.success'

      // Find withdrawal by reference (our withdrawal ID)
      const withdrawal = await prisma.withdrawal.findFirst({
        where: {
          OR: [
            { id: reference },
            { paystackReference: data.transfer_code || '' }
          ]
        },
        include: {
          affiliate: true
        }
      })

      if (!withdrawal) {
        console.error(`[Internal Webhook] Withdrawal not found for reference: ${reference}`)
        return NextResponse.json(
          { error: 'Withdrawal not found' },
          { status: 404 }
        )
      }

      if (isSuccess) {
        // ✅ TRANSFER SUCCESS - Mark as completed
        await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: 'completed',
            failureReason: null,
          },
        })

        console.log(`✅ [Withdrawal Success] ID: ${withdrawal.id}, Amount: KES ${withdrawal.payoutAmount}, Phone: ${withdrawal.mpesaNumber}`)

        return NextResponse.json({
          success: true,
          message: 'Withdrawal marked as completed',
          withdrawalId: withdrawal.id,
          status: 'completed',
        })

      } else {
        // ❌ TRANSFER FAILED - Refund balance to affiliate
        const failureReason = data.reason || 'Transfer failed'

        // Atomic transaction: Update withdrawal status + Refund balance
        await prisma.$transaction(async (tx) => {
          // Mark withdrawal as failed
          await tx.withdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: 'failed',
              failureReason: failureReason,
            },
          })

          // Note: Balance refund is handled by checking withdrawal status
          // when calculating available balance. Failed withdrawals don't count
          // as withdrawn, so balance is automatically "refunded"
        })

        console.log(`❌ [Withdrawal Failed] ID: ${withdrawal.id}, Reason: ${failureReason}`)

        return NextResponse.json({
          success: true,
          message: 'Withdrawal marked as failed, balance available for retry',
          withdrawalId: withdrawal.id,
          status: 'failed',
          reason: failureReason,
        })
      }
    }

    // Unhandled event type
    console.log(`[Internal Webhook] Unhandled event: ${event}`)
    return NextResponse.json({ received: true, message: 'Event acknowledged but not processed' })

  } catch (error: any) {
    console.error('[Internal Webhook] Error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    )
  }
}
