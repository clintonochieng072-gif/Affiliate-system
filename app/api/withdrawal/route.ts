import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  initiateDarajaB2CTransfer,
  normalizeKenyanPhoneForDaraja,
} from '@/lib/daraja'

import { MIN_WITHDRAWAL_AMOUNT } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const amount = Number(body?.amount)
    const mpesaNumber = String(body?.mpesaNumber || '')

    if (!amount || !mpesaNumber) {
      return NextResponse.json(
        { error: 'Amount and M-PESA number are required' },
        { status: 400 }
      )
    }

    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
      return NextResponse.json(
        { error: `Minimum withdrawal amount is ${MIN_WITHDRAWAL_AMOUNT}` },
        { status: 400 }
      )
    }

    const cleanedNumber = mpesaNumber.replace(/\D/g, '')
    const isValidLength = /^\d{9,15}$/.test(cleanedNumber)
    if (!isValidLength) {
      return NextResponse.json(
        { error: 'Invalid account number. Please enter a valid mobile money number (9-15 digits).' },
        { status: 400 }
      )
    }

    const formattedNumber = /^254[17]\d{8}$/.test(cleanedNumber)
      ? cleanedNumber
      : normalizeKenyanPhoneForDaraja(cleanedNumber)

    const affiliate = await prisma.affiliate.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        availableBalance: true,
      },
    })

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
    }

    if (amount > Number(affiliate.availableBalance)) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          availableBalance: Number(affiliate.availableBalance),
          requestedAmount: amount,
        },
        { status: 400 }
      )
    }

    const withdrawal = await prisma.$transaction(async (tx) => {
      // Check for active withdrawals inside the transaction to prevent race conditions
      const activeWithdrawals = await tx.withdrawal.findMany({
        where: {
          affiliateId: affiliate.id,
          status: { in: ['pending', 'processing'] },
        },
        select: { id: true, status: true },
        take: 1,
      })

      if (activeWithdrawals.length > 0) {
        throw new Error('ACTIVE_WITHDRAWAL_EXISTS')
      }

      const balanceUpdate = await tx.affiliate.updateMany({
        where: {
          id: affiliate.id,
          availableBalance: {
            gte: amount,
          },
        },
        data: {
          availableBalance: {
            decrement: amount,
          },
        },
      })

      if (balanceUpdate.count === 0) {
        throw new Error('INSUFFICIENT_AVAILABLE_BALANCE')
      }

      return tx.withdrawal.create({
        data: {
          affiliateId: affiliate.id,
          amount,
          mpesaNumber: formattedNumber,
          status: 'pending',
        },
      })
    })

    try {
      const darajaResponse = await initiateDarajaB2CTransfer({
        amount,
        phoneNumber: formattedNumber,
        reference: withdrawal.id,
        remarks: `Affiliate withdrawal ${withdrawal.id}`,
      })

      if (!darajaResponse.accepted) {
        const failureMessage =
          darajaResponse.responseDescription ||
          darajaResponse.customerMessage ||
          String(darajaResponse.raw?.errorMessage || darajaResponse.raw?.ResultDesc || '') ||
          'Daraja B2C request rejected'

        await prisma.$transaction(async (tx) => {
          await tx.withdrawal.update({
            where: { id: withdrawal.id },
            data: {
              status: 'failed',
              failureReason: failureMessage,
              providerReference: darajaResponse.conversationId || null,
            },
          })

          await tx.affiliate.update({
            where: { id: affiliate.id },
            data: {
              availableBalance: {
                increment: amount,
              },
            },
          })
        })

        return NextResponse.json(
          {
            error: 'Withdrawal provider rejected request',
            details: failureMessage,
          },
          { status: 400 }
        )
      }

      const processingWithdrawal = await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'processing',
          providerReference: darajaResponse.conversationId || withdrawal.id,
          failureReason: null,
        },
      })

      return NextResponse.json({
        success: true,
        withdrawal: {
          id: processingWithdrawal.id,
          amount: Number(processingWithdrawal.amount),
          status: processingWithdrawal.status,
          provider: 'daraja',
          providerReference: processingWithdrawal.providerReference,
        },
      })
    } catch (providerError: any) {
      const message = providerError?.message || 'Daraja request failed'

      await prisma.$transaction(async (tx) => {
        await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: 'failed',
            failureReason: message,
          },
        })

        await tx.affiliate.update({
          where: { id: affiliate.id },
          data: {
            availableBalance: {
              increment: amount,
            },
          },
        })
      })

      return NextResponse.json(
        { error: 'Withdrawal provider error', details: message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    if (error?.message === 'INSUFFICIENT_AVAILABLE_BALANCE') {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      )
    }

    if (error?.message === 'ACTIVE_WITHDRAWAL_EXISTS') {
      return NextResponse.json(
        { error: 'You already have an active withdrawal request' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { email: session.user.email },
      include: {
        withdrawals: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
    }

    return NextResponse.json({
      withdrawals: affiliate.withdrawals.map((w) => ({
        id: w.id,
        amount: Number(w.amount),
        mpesaNumber: w.mpesaNumber,
        status: w.status,
        failureReason: w.failureReason,
        providerReference: w.providerReference,
        createdAt: w.createdAt,
        completedAt: w.completedAt,
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
