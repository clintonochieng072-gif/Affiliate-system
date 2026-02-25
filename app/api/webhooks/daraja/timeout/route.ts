import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

interface DarajaTimeoutPayload {
  ConversationID?: string
  OriginatorConversationID?: string
}

/**
 * POST /api/webhooks/daraja/timeout
 * Timeout callback is acknowledged without changing state.
 * Final transitions are handled by result callbacks/webhooks only.
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
          { providerReference: conversationId || '' },
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

    if (conversationId && conversationId !== withdrawal.providerReference) {
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          providerReference: conversationId,
          failureReason: withdrawal.failureReason || 'Daraja callback timeout: awaiting final status',
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
