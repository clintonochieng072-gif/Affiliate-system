import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

/**
 * Verify Paystack webhook signature
 */
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

/**
 * POST /api/webhooks/paystack
 * Handle Paystack transfer status notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      )
    }

    // Verify signature
    const isValid = verifyPaystackSignature(body, signature)
    if (!isValid) {
      console.error('Invalid Paystack webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse webhook data
    const webhook = JSON.parse(body)
    const { event, data } = webhook

    console.log('Paystack webhook received:', event, data)

    // Handle transfer events
    if (event === 'transfer.success' || event === 'transfer.failed') {
      const reference = data.reference // This is our withdrawal ID
      const transferCode = data.transfer_code
      const status = event === 'transfer.success' ? 'completed' : 'failed'

      // Find withdrawal by our reference (withdrawal ID)
      let withdrawal = await prisma.withdrawal.findFirst({
        where: {
          OR: [
            { id: reference },
            { paystackReference: transferCode }
          ]
        },
        include: {
          affiliate: true
        }
      })

      if (!withdrawal) {
        console.error('Withdrawal not found for reference:', reference, transferCode)
        return NextResponse.json(
          { error: 'Withdrawal not found' },
          { status: 404 }
        )
      }

      // Update withdrawal status
      const updatedWithdrawal = await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: status,
          failureReason: event === 'transfer.failed' ? data.reason || 'Transfer failed' : null,
        },
      })

      console.log(`Withdrawal ${updatedWithdrawal.id} updated to ${status}`)

      // TODO: Send notification to affiliate
      // You can implement email/SMS notification here
      if (status === 'completed') {
        console.log(`✅ Withdrawal successful: KES ${updatedWithdrawal.payoutAmount} sent to ${updatedWithdrawal.mpesaNumber}`)
      } else {
        console.log(`❌ Withdrawal failed: ${updatedWithdrawal.failureReason}`)
      }

      return NextResponse.json({ received: true })
    }

    // Other events we don't handle yet
    console.log('Unhandled Paystack event:', event)
    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('Paystack webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    )
  }
}
