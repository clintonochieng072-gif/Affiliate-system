import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { decimalToNumber } from '@/lib/utils'

/**
 * M-PESA Withdrawal System
 * - 70 KES per active subscription
 * - Withdrawals in multiples of 140 KES
 * - 30 KES platform fee per 140 block (stays in Paystack)
 * - 110 KES payout per 140 block (sent to sales agent)
 * - Paystack transfer fees: 1-1,500 = 20 KES, 1,501-20,000 = 40 KES (paid by system)
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const COMMISSION_PER_REFERRAL = 70 // KES
const WITHDRAWAL_BLOCK_SIZE = 140 // KES (2 active subscriptions)
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
    // Accept any reasonable phone number format (9-15 digits)
    // Paystack will do final validation for M-PESA compatibility
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

    // Format for Paystack Kenya M-PESA
    // IMPORTANT: Paystack M-PESA requires LOCAL format (07XX or 01XX), NOT international (254XX)
    let formattedNumber = cleanedNumber
    
    if (/^254[17]\d{8}$/.test(cleanedNumber)) {
      // 254XXXXXXXXX -> 0XXXXXXXXX (convert international to local)
      formattedNumber = '0' + cleanedNumber.substring(3)
      console.log('📱 Converted international to local format:', formattedNumber)
    } else if (/^[17]\d{8}$/.test(cleanedNumber)) {
      // 7XXXXXXXX or 1XXXXXXXX -> 07XXXXXXXX or 01XXXXXXXX
      formattedNumber = '0' + cleanedNumber
      console.log('📱 Added leading zero:', formattedNumber)
    } else if (/^0[17]\d{8}$/.test(cleanedNumber)) {
      // Already in correct format 07XXXXXXXX or 01XXXXXXXX
      formattedNumber = cleanedNumber
      console.log('📱 Already in correct local format:', formattedNumber)
    } else {
      console.log('⚠️ Number format may not be Kenyan M-PESA compatible:', formattedNumber)
    }
    
    console.log('📞 Final number to send to Paystack:', formattedNumber, '(Length:', formattedNumber.length, ')')

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
    
    const paystackTransferFee = calculatePaystackTransferFee(payoutAmount)  // Paid by system

    // Create withdrawal record with PENDING status and deduct balance atomically
    // Balance is deducted immediately to prevent double withdrawals
    const withdrawal = await prisma.withdrawal.create({
      data: {
        affiliateId: salesAgent.id,
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

    // Create transfer recipient for M-PESA
    // Paystack supports M-PESA Kenya with type: 'mobile_money' and bank_code: 'MPESA'
    // Account number should be in format: 254XXXXXXXXX (12 digits)
    const recipientPayload = {
      type: 'mobile_money',
      name: salesAgent.name,
      account_number: formattedNumber,
      bank_code: 'MPESA',
      currency: 'KES',
    }

    console.log('🚀 Creating Paystack recipient:', {
      name: salesAgent.name,
      account_number: formattedNumber,
      bank_code: 'MPESA',
      currency: 'KES',
      type: 'mobile_money'
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

    console.log('📥 Paystack recipient response:', {
      status: recipientData.status,
      message: recipientData.message,
      data: recipientData.data,
      fullResponse: recipientData
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
    // IMPORTANT: We only send payoutAmount to sales agent, NOT the full requested amount
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
        reason: `Sales earnings withdrawal - ${numberOfBlocks} blocks (Platform fee: ${platformFee} KES retained)`,
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
