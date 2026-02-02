import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { decimalToNumber } from '@/lib/utils'

/**
 * M-PESA Withdrawal System
 * - 70 KES per referral
 * - Withdrawals in multiples of 140 KES
 * - 30 KES platform fee per 140 block
 * - Paystack transfer fees: 1-1,500 = 20 KES, 1,501-20,000 = 40 KES (paid by system)
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
const COMMISSION_PER_REFERRAL = 70 // KES
const WITHDRAWAL_BLOCK_SIZE = 140 // KES (2 referrals)
const PLATFORM_FEE_PER_BLOCK = 30 // KES

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

    // Validate amount is a multiple of 140
    if (amount % WITHDRAWAL_BLOCK_SIZE !== 0) {
      return NextResponse.json(
        { error: `Amount must be a multiple of ${WITHDRAWAL_BLOCK_SIZE} KES` },
        { status: 400 }
      )
    }

    // Validate M-PESA number format (Kenyan format: 254XXXXXXXXX or 07XXXXXXXX)
    const cleanedNumber = mpesaNumber.replace(/\s+/g, '')
    const isValidFormat = /^(254\d{9}|07\d{8}|7\d{8})$/.test(cleanedNumber)
    if (!isValidFormat) {
      return NextResponse.json(
        { error: 'Invalid M-PESA number format. Use 254XXXXXXXXX or 07XXXXXXXX' },
        { status: 400 }
      )
    }

    // Format to 254XXXXXXXXX
    let formattedNumber = cleanedNumber
    if (cleanedNumber.startsWith('0')) {
      formattedNumber = '254' + cleanedNumber.substring(1)
    } else if (cleanedNumber.startsWith('7')) {
      formattedNumber = '254' + cleanedNumber
    }

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

    // Calculate available balance (using new 70 KES per referral)
    const totalEarnings = affiliate.referrals.length * COMMISSION_PER_REFERRAL

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
    const numberOfBlocks = amount / WITHDRAWAL_BLOCK_SIZE
    const platformFee = numberOfBlocks * PLATFORM_FEE_PER_BLOCK
    const payoutAmount = amount - platformFee
    const paystackTransferFee = calculatePaystackTransferFee(payoutAmount)

    // Create withdrawal record
    const withdrawal = await prisma.withdrawal.create({
      data: {
        affiliateId: affiliate.id,
        requestedAmount: amount,
        platformFee: platformFee,
        payoutAmount: payoutAmount,
        paystackTransferFee: paystackTransferFee,
        mpesaNumber: formattedNumber,
        status: 'processing',
      },
    })

    // Send to Paystack Transfers API
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('Paystack secret key not configured')
    }

    // Create transfer recipient first
    const recipientResponse = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'mobile_money',
        name: affiliate.name,
        account_number: formattedNumber,
        bank_code: 'mpesa', // Paystack's M-PESA code for Kenya
        currency: 'KES',
      }),
    })

    const recipientData = await recipientResponse.json()

    if (!recipientData.status) {
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'failed',
          failureReason: recipientData.message || 'Failed to create recipient',
        },
      })

      return NextResponse.json(
        { error: 'Failed to create transfer recipient', details: recipientData.message },
        { status: 400 }
      )
    }

    // Initiate transfer
    const transferResponse = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(payoutAmount * 100), // Convert to cents
        recipient: recipientData.data.recipient_code,
        reason: `Affiliate commission withdrawal - ${numberOfBlocks} blocks`,
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
        status: 'processing', // Will be updated by webhook
      },
    })

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        requestedAmount: amount,
        platformFee: platformFee,
        payoutAmount: payoutAmount,
        transferFee: paystackTransferFee,
        mpesaNumber: formattedNumber,
        status: 'processing',
        message: 'Withdrawal initiated. You will receive M-PESA notification shortly.',
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
