import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { canTransitionWithdrawal } from '@/lib/withdrawal'

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
          { providerReference: conversationId || '' },
        ],
      },
    })

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    const isSuccess = resultCode === 0

    if (isSuccess) {
      if (withdrawal.status === 'completed') {
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
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
          failureReason: null,
          providerReference: conversationId || withdrawal.providerReference,
        },
      })
    } else {
      if (withdrawal.status === 'failed') {
        return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
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
            failureReason: `Daraja error ${resultCode}: ${resultDesc}`,
            providerReference: conversationId || withdrawal.providerReference,
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
    }

    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: 'Accepted',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to process Daraja result callback', details: error.message },
      { status: 500 }
    )
  }
}
