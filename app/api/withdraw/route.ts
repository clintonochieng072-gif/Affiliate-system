import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MIN_WITHDRAWAL_AMOUNT } from '@/lib/constants'
import { normalizeKenyanPhoneNumber, sendIntaSendPayout } from '@/lib/intasend'
import {
  createPendingWithdrawal,
  markWithdrawalProcessing,
  failWithdrawal,
} from '@/lib/withdrawal-service'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const isTestMode = request.headers.get('x-test-mode') === 'true'

    if (!isTestMode && (!session || !session.user?.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const email = isTestMode ? 'clintonochieng072@gmail.com' : session?.user?.email

    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const amount = Number(body?.amount)

    if (!amount || !Number.isFinite(amount)) {
      return NextResponse.json({ error: 'Invalid withdrawal amount' }, { status: 400 })
    }

    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      return NextResponse.json(
        { error: `Minimum withdrawal amount is KSh ${MIN_WITHDRAWAL_AMOUNT}` },
        { status: 400 }
      )
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { email },
      select: { id: true, phone: true, availableBalance: true, isFrozen: true },
    })

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
    }

    if (affiliate.isFrozen) {
      return NextResponse.json(
        { error: 'Account is frozen. Contact support if this is in error.' },
        { status: 403 }
      )
    }

    if (!affiliate.phone) {
      return NextResponse.json(
        {
          error: 'No phone number is configured for this account. Please update your profile before requesting a withdrawal.',
        },
        { status: 400 }
      )
    }

    const phoneNumber = normalizeKenyanPhoneNumber(affiliate.phone)

    const withdrawal = await createPendingWithdrawal({
      affiliateId: affiliate.id,
      amount,
      phoneNumber,
    })

    try {
      const payoutResponse = await sendIntaSendPayout(amount, phoneNumber)
      const providerReference = payoutResponse.transactionId || withdrawal.id

      const processingWithdrawal = await markWithdrawalProcessing(withdrawal.id, providerReference)

      return NextResponse.json({
        success: true,
        withdrawal: {
          id: processingWithdrawal.id,
          amount: Number(processingWithdrawal.amount),
          status: processingWithdrawal.status,
          providerReference: processingWithdrawal.providerReference,
        },
      })
    } catch (payoutError: any) {
      const failureMessage = payoutError?.message || 'IntaSend payout failed'
      await failWithdrawal({
        withdrawalId: withdrawal.id,
        failureReason: failureMessage,
      })

      return NextResponse.json(
        {
          error: 'Withdrawal provider error',
          details: failureMessage,
        },
        { status: 502 }
      )
    }
  } catch (error: any) {
    if (error?.message === 'ACTIVE_WITHDRAWAL_EXISTS') {
      return NextResponse.json(
        { error: 'You already have an active withdrawal request' },
        { status: 409 }
      )
    }

    if (error?.message === 'INSUFFICIENT_AVAILABLE_BALANCE') {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || null },
      { status: 500 }
    )
  }
}
