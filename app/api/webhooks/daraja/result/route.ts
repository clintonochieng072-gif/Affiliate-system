import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

interface DarajaResultPayload {
  Result?: {
    ConversationID?: string
    OriginatorConversationID?: string
    ResultCode?: number
    ResultDesc?: string
  }
  ConversationID?: string
  OriginatorConversationID?: string
  ResultCode?: number
  ResultDesc?: string
}

/**
 * POST /api/webhooks/daraja/result
 * Daraja B2C result callback endpoint.
 *
 * NOTE: This route is provider-agnostic in terms of status transitions:
 * - ResultCode 0 => completed
 * - Any non-zero ResultCode => failed
 */
export async function POST(request: NextRequest) {
  try {
    const payload: DarajaResultPayload = await request.json()

    const resultNode = payload.Result || payload
    const conversationId = resultNode.ConversationID || payload.ConversationID
    const originatorConversationId =
      resultNode.OriginatorConversationID || payload.OriginatorConversationID
    const resultCode = Number(resultNode.ResultCode ?? payload.ResultCode ?? -1)
    const resultDesc = resultNode.ResultDesc || payload.ResultDesc || 'No description from Daraja'

    if (!originatorConversationId && !conversationId) {
      return NextResponse.json(
        { error: 'Missing withdrawal reference in Daraja callback' },
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
      console.error('Daraja result callback: withdrawal not found', {
        originatorConversationId,
        conversationId,
      })
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    const isSuccess = resultCode === 0

    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: isSuccess ? 'completed' : 'failed',
        failureReason: isSuccess ? null : `Daraja error ${resultCode}: ${resultDesc}`,
        paystackReference: conversationId || withdrawal.paystackReference,
      },
    })

    console.log('Daraja result callback processed', {
      withdrawalId: withdrawal.id,
      resultCode,
      resultDesc,
      status: isSuccess ? 'completed' : 'failed',
      conversationId,
      originatorConversationId,
    })

    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Accepted',
    })
  } catch (error: any) {
    console.error('Daraja result callback error:', error)
    return NextResponse.json(
      { error: 'Failed to process Daraja result callback', details: error.message },
      { status: 500 }
    )
  }
}
