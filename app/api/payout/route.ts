import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { decimalToNumber } from '@/lib/utils'

/**
 * API endpoint to process affiliate payouts via Paystack
 * Uses new Referral/Payout schema with PostgreSQL
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user using NextAuth
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { amount } = body

    // Get affiliate with paid referrals and payouts
    const affiliate = await prisma.affiliate.findUnique({
      where: { email: session.user.email },
      include: {
        referrals: {
          where: { status: 'paid' },
        },
        payouts: {
          where: { status: 'paid' },
        },
      },
    })

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      )
    }

    // Calculate available balance
    const totalEarnings = affiliate.referrals.reduce(
      (sum, r) => sum + decimalToNumber(r.commissionAmount),
      0
    )
    const totalPayouts = affiliate.payouts.reduce(
      (sum, p) => sum + decimalToNumber(p.amount),
      0
    )
    const availableBalance = totalEarnings - totalPayouts

    // Validate payout amount
    const minPayout = 5000 // Minimum 5000 NGN
    if (amount < minPayout) {
      return NextResponse.json(
        { error: `Minimum payout is ${minPayout} NGN` },
        { status: 400 }
      )
    }

    if (amount > availableBalance) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      )
    }

    // TODO: Integrate with Paystack Transfer API
    // This is a placeholder for Paystack payout integration
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY
    
    if (!paystackSecretKey) {
      return NextResponse.json(
        { error: 'Paystack not configured' },
        { status: 500 }
      )
    }

    // Create payout record
    const payout = await prisma.payout.create({
      data: {
        affiliateId: affiliate.id,
        amount: amount,
        status: 'pending', // Mark as pending until Paystack confirms
      },
    })

    console.log('Payout request created:', {
      payout_id: payout.id,
      affiliate_id: affiliate.id,
      amount,
      email: affiliate.email,
    })

    // In production: initiate Paystack transfer here
    // For now, auto-mark as paid for testing
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: 'paid' },
    })

    return NextResponse.json({
      success: true,
      message: 'Payout request submitted',
      payout: {
        id: payout.id,
        amount: decimalToNumber(payout.amount),
        status: 'paid',
        createdAt: payout.createdAt.toISOString(),
      },
    })

  } catch (error) {
    console.error('Payout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
