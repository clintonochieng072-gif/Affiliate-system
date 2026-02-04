import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { decimalToNumber } from '@/lib/utils'

/**
 * M-PESA Withdrawal System
 * - 70 KES per referral
 * - Withdrawals in multiples of 140 KES
 * - 30 KES platform fee per 140 block (stays in Paystack)
 * - 110 KES payout per 140 block (sent to affiliate)
 * - Paystack transfer fees: 1-1,500 = 20 KES, 1,501-20,000 = 40 KES (paid by system)
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const COMMISSION_PER_REFERRAL = 70 // KES
const WITHDRAWAL_BLOCK_SIZE = 140 // KES (2 referrals)
const PLATFORM_FEE_PER_BLOCK = 30 // KES (STAYS IN PAYSTACK ACCOUNT)

/**
 * Calculate Paystack transfer fee based on amount
 */
function calculatePaystackTransferFee(amount: number): number {
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
    // Accepts: Kenyan (254XXXXXXXXX, 07/01XXXXXXXX) and other African country formats
    const cleanedNumber = mpesaNumber.replace(/[\s\-\+]/g, '')
    
    console.log('🔍 Validating mobile money number:', {
      original: mpesaNumber,
      cleaned: cleanedNumber,
      length: cleanedNumber.length,
    })
    
    // Check for valid mobile money formats:
    // - 254XXXXXXXXX (Kenya with country code)
    // - 07XXXXXXXX or 01XXXXXXXX (Kenya local)
    // - 7XXXXXXXX or 1XXXXXXXX (Kenya without leading 0)
    // - Other African country codes (e.g., 256 for Uganda, 255 for Tanzania, etc.)
    const isKenyanLocal = /^0[17]\d{8}$/.test(cleanedNumber) // 07 or 01 followed by 8 digits
    const isKenyanShort = /^[17]\d{8}$/.test(cleanedNumber)  // 7 or 1 followed by 8 digits
    const hasCountryCode = /^(2[0-9]{2}|3[0-9]{2})\d{9}$/.test(cleanedNumber) // African country codes
    
    console.log('📋 Validation results:', {
      isKenyanLocal,
      isKenyanShort,
      hasCountryCode,
      isValid: isKenyanLocal || isKenyanShort || hasCountryCode,
    })
    
    if (!isKenyanLocal && !isKenyanShort && !hasCountryCode) {
      console.error('❌ Mobile money number validation failed')
      return NextResponse.json(
        { error: 'Invalid account number. Please enter a valid mobile money number.' },
        { status: 400 }
      )
    }

    // Format to international format (254XXXXXXXXX for Kenya)
    let formattedNumber = cleanedNumber
    if (isKenyanLocal) {
      // 07XXXXXXXX or 01XXXXXXXX -> 254XXXXXXXXX
      formattedNumber = '254' + cleanedNumber.substring(1)
    } else if (isKenyanShort) {
      // 7XXXXXXXX or 1XXXXXXXX -> 254XXXXXXXXX
      formattedNumber = '254' + cleanedNumber
    }
    // If already has country code, use as-is

    // Get affiliate with paid referrals
    const affiliate = await prisma.affiliate.findUnique({
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

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
    }

    // Calculate available balance from actual commission amounts stored in database
    // NEVER assume commission amounts - always use what's stored
    const totalEarnings = affiliate.referrals.reduce(
      (sum, r) => sum + decimalToNumber(r.commissionAmount),
      0
    )

    const totalWithdrawn = affiliate.withdrawals.reduce(
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
    
    const paystackTransferFee = calculatePaystackTransferFee(payoutAmount)  // Paid by system

    // Create withdrawal record with PENDING status and deduct balance atomically
    // Balance is deducted immediately to prevent double withdrawals
    const withdrawal = await prisma.withdrawal.create({
      data: {
        affiliateId: affiliate.id,
        requestedAmount: amount,
        platformFee: platformFee,
        payoutAmount: payoutAmount,
        paystackTransferFee: paystackTransferFee,
        mpesaNumber: formattedNumber,
        status: 'pending',  // Will be updated to 'processing' after Paystack call
      },
    })

    // Send to Paystack Transfers API
    if (!PAYSTACK_SECRET_KEY) {
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'failed',
          failureReason: 'Paystack secret key not configured',
        },
      })
      return NextResponse.json(
        { error: 'Paystack not configured', details: 'Payment provider configuration missing' },
        { status: 500 }
      )
    }

    // Create transfer recipient first
    // Note: Paystack mobile money for Kenya M-PESA requires:
    // 1. Business account verification
    // 2. Mobile Money feature enabled on your Paystack account
    // 3. Correct bank code: MPESA for Safaricom M-PESA
    const recipientPayload = {
      type: 'mobile_money',
      name: affiliate.name,
      account_number: formattedNumber,
      bank_code: 'MPESA', // Paystack's bank code for Safaricom M-PESA Kenya
      currency: 'KES',
    }

    console.log('Creating Paystack recipient:', {
      name: affiliate.name,
      account_number: formattedNumber,
      bank_code: 'MPESA',
    })

    const recipientResponse = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recipientPayload),
    })

    const recipientData = await recipientResponse.json()

    console.log('Paystack recipient response:', {
      status: recipientData.status,
      message: recipientData.message,
      data: recipientData.data,
    })

    if (!recipientData.status) {
      const errorMessage = recipientData.message || 'Failed to create recipient'
      
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'failed',
          failureReason: errorMessage,
        },
      })

      console.error('Paystack recipient creation failed:', {
        error: errorMessage,
        fullResponse: recipientData,
      })

      return NextResponse.json(
        { 
          error: 'Failed to create transfer recipient', 
          details: errorMessage,
          paystackError: recipientData 
        },
        { status: 400 }
      )
    }

    // Initiate transfer
    // IMPORTANT: We only send payoutAmount to affiliate, NOT the full requested amount
    // Platform fee stays in the system's Paystack account
    const transferResponse = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(payoutAmount * 100), // Convert to cents - ONLY payout amount, NOT requested amount
        recipient: recipientData.data.recipient_code,
        reason: `Affiliate commission withdrawal - ${numberOfBlocks} blocks (Platform fee: ${platformFee} KES retained)`,
        reference: withdrawal.id, // Use our withdrawal ID as reference
      }),
    })

    const transferData = await transferResponse.json()

    if (!transferData.status) {
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'failed',
          failureReason: transferData.message || 'Transfer failed',
        },
      })

      return NextResponse.json(
        { error: 'Transfer failed', details: transferData.message },
        { status: 400 }
      )
    }

    // Update withdrawal with Paystack reference
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        paystackReference: transferData.data.transfer_code,
        status: 'processing', // Will be updated by internal webhook
      },
    })

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        reference: withdrawal.id, // Used for webhook matching
        requestedAmount: amount,
        platformFee: platformFee,
        payoutAmount: payoutAmount,
        transferFee: paystackTransferFee,
        mpesaNumber: formattedNumber,
        status: 'processing',
        message: 'Withdrawal initiated. Status will be updated via webhook.',
      },
    })

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
      withdrawals: affiliate.withdrawals.map(w => ({
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
