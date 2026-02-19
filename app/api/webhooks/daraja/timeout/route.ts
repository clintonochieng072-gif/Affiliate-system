import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

interface DarajaTimeoutPayload {
  ConversationID?: string
  OriginatorConversationID?: string
}

/**
 * POST /api/webhooks/daraja/timeout
 * Daraja timeout callback endpoint.
 *
 * NOTE: Timeout means we have no final transfer verdict yet.
 * We keep the withdrawal in 'pending' for reconciliation/retry workflows.
 */
export async function POST(request: NextRequest) {
  try {
    const payload: DarajaTimeoutPayload = await request.json()
    const { ConversationID: conversationId, OriginatorConversationID: originatorConversationId } = payload

    if (!originatorConversationId && !conversationId) {
      return NextResponse.json(
        { error: 'Missing withdrawal reference in timeout callback' },
        { status: 400 }
      )
    }

    const withdrawal = await prisma.withdrawal.findFirst({
      where: {
        OR: [
          { id: originatorConversationId || '' },
          { paystackReference: conversationId || '' },
        ],
      },
    })

    if (!withdrawal) {
      console.error('Daraja timeout callback: withdrawal not found', {
        originatorConversationId,
        conversationId,
      })
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    if (withdrawal.status !== 'completed' && withdrawal.status !== 'failed') {
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'pending',
          failureReason: 'Daraja callback timeout: awaiting final status confirmation',
          paystackReference: conversationId || withdrawal.paystackReference,
        },
      })
    }

    console.log('Daraja timeout callback processed', {
      withdrawalId: withdrawal.id,
      conversationId,
      originatorConversationId,
      status: withdrawal.status,
    })

    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Accepted',
    })
  } catch (error: any) {
    console.error('Daraja timeout callback error:', error)
    return NextResponse.json(
      { error: 'Failed to process Daraja timeout callback', details: error.message },
      { status: 500 }
    )
  }
}
