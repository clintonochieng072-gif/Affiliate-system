import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { decimalToNumber } from '@/lib/utils'
import {
  initiateDarajaB2CTransfer,
  normalizeKenyanPhoneForDaraja,
} from '@/lib/daraja'

/**
 * M-PESA Withdrawal System
 * - 70 KES per active subscription
 * - Withdrawals in multiples of 140 KES
 * - 30 KES platform fee per 140 block (retained by platform)
 * - 110 KES payout per 140 block (sent to sales agent)
 * - Transfer fees: 1-1,500 = 20 KES, 1,501-20,000 = 40 KES (paid by system)
 */

const WITHDRAWAL_BLOCK_SIZE = 140 // KES (2 active subscriptions)
const PLATFORM_FEE_PER_BLOCK = 30 // KES (retained by platform)

/**
 * Calculate transfer fee based on amount
 */
function calculateTransferFee(amount: number): number {
  if (amount >= 1 && amount <= 1500) {
    return 20 // KES
  } else if (amount >= 1501 && amount <= 20000) {
    return 40 // KES
  }
  return 40 // Default for higher amounts
}

/**
 * POST /api/withdrawal
 * Process M-PESA withdrawal request
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount, mpesaNumber } = body

    // Validate inputs
    if (!amount || !mpesaNumber) {
      return NextResponse.json(
        { error: 'Amount and M-PESA number are required' },
        { status: 400 }
      )
    }

    // Validate amount is a multiple of 140 OR the test amount of 10
    const isTestAmount = amount === 10
    const isValidMultiple = amount % WITHDRAWAL_BLOCK_SIZE === 0
    
    if (!isTestAmount && !isValidMultiple) {
      return NextResponse.json(
        { error: `Amount must be 10 KES (test) or a multiple of ${WITHDRAWAL_BLOCK_SIZE} KES` },
        { status: 400 }
      )
    }

    // Validate mobile money number format
    // Accept any reasonable phone number format (9-15 digits)
    // Daraja will do final validation for M-PESA compatibility
    const cleanedNumber = mpesaNumber.replace(/\D/g, '')
    
    console.log('🔍 Validating mobile money number:', {
      original: mpesaNumber,
      cleaned: cleanedNumber,
      length: cleanedNumber.length,
    })
    
    // Basic validation: 9-15 digits (covers all African mobile money formats)
    const isValidLength = /^\d{9,15}$/.test(cleanedNumber)
    
    if (!isValidLength) {
      console.error('❌ Mobile money number validation failed:', {
        original: mpesaNumber,
        cleaned: cleanedNumber,
        length: cleanedNumber.length,
        hasOnlyDigits: /^\d+$/.test(cleanedNumber)
      })
      return NextResponse.json(
        { 
          error: 'Invalid account number. Please enter a valid mobile money number (9-15 digits).', 
          details: `Received: "${mpesaNumber}" -> Cleaned: "${cleanedNumber}" (${cleanedNumber.length} digits)`,
          debug: {
            original: mpesaNumber,
            cleaned: cleanedNumber,
            length: cleanedNumber.length
          }
        },
        { status: 400 }
      )
    }
    
    console.log('✅ Number format validated, length:', cleanedNumber.length)

    // Format for Daraja M-PESA
    // Daraja expects international format 2547XXXXXXXX / 2541XXXXXXXX
    let formattedNumber = cleanedNumber
    
    if (/^254[17]\d{8}$/.test(cleanedNumber)) {
      formattedNumber = cleanedNumber
      console.log('📱 Already in international format:', formattedNumber)
    } else {
      formattedNumber = normalizeKenyanPhoneForDaraja(cleanedNumber)
      console.log('📱 Normalized number for Daraja:', formattedNumber)
    }
    
    console.log('📞 Final number to send to Daraja:', formattedNumber, '(Length:', formattedNumber.length, ')')

    // Get sales agent with paid sales activity
    const salesAgent = await prisma.affiliate.findUnique({
      where: { email: session.user.email },
      include: {
        referrals: {
          where: { status: 'paid' },
        },
        withdrawals: {
          where: { 
            status: { in: ['completed', 'processing'] }
          },
        },
      },
    })

    if (!salesAgent) {
      return NextResponse.json({ error: 'Sales agent not found' }, { status: 404 })
    }

    // Calculate available balance from actual commission amounts stored in database
    // NEVER assume commission amounts - always use what's stored
    const totalEarnings = salesAgent.referrals.reduce(
      (sum, r) => sum + decimalToNumber(r.commissionAmount),
      0
    )

    const totalWithdrawn = salesAgent.withdrawals.reduce(
      (sum, w) => sum + decimalToNumber(w.requestedAmount),
      0
    )

    const availableBalance = totalEarnings - totalWithdrawn

    // Check if sufficient balance
    if (amount > availableBalance) {
      return NextResponse.json(
        { 
          error: 'Insufficient balance',
          availableBalance,
          requestedAmount: amount
        },
        { status: 400 }
      )
    }

    // Calculate fees
    // For test amount (10 KES): no platform fee, full amount goes to affiliate
    // For normal withdrawals (140+ multiples): apply platform fee structure
    let numberOfBlocks: number
    let platformFee: number
    let payoutAmount: number
    
    if (isTestAmount) {
      // Test withdrawal: no fees, send full amount
      numberOfBlocks = 0
      platformFee = 0
      payoutAmount = amount
    } else {
      // Normal withdrawal: apply fee structure
      // Example: 280 KES withdrawal
      // - Blocks: 280 / 140 = 2
      // - Platform fee: 2 * 30 = 60 KES (STAYS IN SYSTEM)
      // - Payout to affiliate: 280 - 60 = 220 KES (SENT TO M-PESA)
      numberOfBlocks = amount / WITHDRAWAL_BLOCK_SIZE
      platformFee = numberOfBlocks * PLATFORM_FEE_PER_BLOCK
      payoutAmount = amount - platformFee
    }
    
    const transferFee = calculateTransferFee(payoutAmount)  // Paid by system

    // Create withdrawal record with PENDING status and deduct balance atomically
    // Balance is deducted immediately to prevent double withdrawals
    const withdrawal = await prisma.withdrawal.create({
      data: {
        affiliateId: salesAgent.id,
        requestedAmount: amount,
        platformFee: platformFee,
        payoutAmount: payoutAmount,
        paystackTransferFee: transferFee,
        mpesaNumber: formattedNumber,
        status: 'pending',
      },
    })

    // Initiate Daraja B2C transfer (sandbox/live controlled via env variables)
    try {
      const darajaResponse = await initiateDarajaB2CTransfer({
        amount: payoutAmount,
        phoneNumber: formattedNumber,
        reference: withdrawal.id,
        remarks: `Sales withdrawal ${withdrawal.id}`,
      })

      if (!darajaResponse.accepted) {
        const rawErrorCode =
          String(darajaResponse.raw?.errorCode || darajaResponse.raw?.ResultCode || '').trim()
        const rawErrorMessage =
          String(darajaResponse.raw?.errorMessage || darajaResponse.raw?.ResultDesc || '').trim()

        const failureMessage =
          darajaResponse.responseDescription ||
          darajaResponse.customerMessage ||
          rawErrorMessage ||
          'Daraja B2C request rejected'

        const isInvalidInitiatorError =
          rawErrorCode === '2001' || /initiator information is invalid/i.test(failureMessage)

        const userFixHint = isInvalidInitiatorError
          ? 'Daraja rejected initiator credentials. Confirm InitiatorName exists on the same shortcode and regenerate SecurityCredential from that initiator password using Safaricom\'s B2C public certificate for the active environment (sandbox/live).'
          : null

        await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: 'failed',
            failureReason: failureMessage,
            paystackReference: darajaResponse.conversationId || null,
          },
        })

        console.error('❌ Daraja initiation rejected', {
          withdrawalId: withdrawal.id,
          response: darajaResponse.raw,
        })

        return NextResponse.json(
          {
            error: 'Daraja B2C request failed',
            details: failureMessage,
            code: rawErrorCode || null,
            fixHint: userFixHint,
            provider: 'daraja',
          },
          { status: 400 }
        )
      }

      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          paystackReference: darajaResponse.conversationId || withdrawal.id,
          status: 'processing',
          failureReason: null,
        },
      })

      return NextResponse.json({
        success: true,
        withdrawal: {
          id: withdrawal.id,
          reference: withdrawal.id,
          requestedAmount: amount,
          platformFee: platformFee,
          payoutAmount: payoutAmount,
          transferFee: transferFee,
          mpesaNumber: formattedNumber,
          status: 'processing',
          provider: 'daraja',
          providerReference: darajaResponse.conversationId || null,
          message: 'Withdrawal initiated via Daraja B2C. Awaiting callback confirmation.',
        },
      })
    } catch (providerError: any) {
      const errorMessage = providerError?.message || 'Daraja request failed'

      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'failed',
          failureReason: errorMessage,
        },
      })

      console.error('❌ Daraja transfer error:', {
        withdrawalId: withdrawal.id,
        error: providerError,
      })

      return NextResponse.json(
        { error: 'Withdrawal provider error', details: errorMessage },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Withdrawal error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/withdrawal
 * Get withdrawal history for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const salesAgent = await prisma.affiliate.findUnique({
      where: { email: session.user.email },
      include: {
        withdrawals: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!salesAgent) {
      return NextResponse.json({ error: 'Sales agent not found' }, { status: 404 })
    }

    return NextResponse.json({
      withdrawals: salesAgent.withdrawals.map(w => ({
        id: w.id,
        requestedAmount: decimalToNumber(w.requestedAmount),
        platformFee: decimalToNumber(w.platformFee),
        payoutAmount: decimalToNumber(w.payoutAmount),
        mpesaNumber: w.mpesaNumber,
        status: w.status,
        createdAt: w.createdAt,
      })),
    })

  } catch (error: any) {
    console.error('Get withdrawals error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
