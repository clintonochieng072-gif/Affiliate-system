/**
 * Dashboard API Route
 * Returns affiliate stats, referral links, and recent referrals
 * PostgreSQL + Prisma for Neon serverless database
 */

import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { decimalToNumber } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user using NextAuth
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get affiliate with relations
    const affiliate = await prisma.affiliate.findUnique({
      where: { email: session.user.email },
      include: {
        links: {
          orderBy: { createdAt: 'desc' },
        },
        referrals: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      )
    }

    // Calculate total earnings (all paid referrals)
    const paidReferrals = affiliate.referrals.filter(r => r.status === 'paid')
    const totalEarnings = paidReferrals.reduce(
      (sum, r) => sum + decimalToNumber(r.commissionAmount),
      0
    )

    // Calculate pending earnings
    const pendingReferrals = affiliate.referrals.filter(r => r.status === 'pending')
    const pendingEarnings = pendingReferrals.reduce(
      (sum, r) => sum + decimalToNumber(r.commissionAmount),
      0
    )

    // Calculate total payouts
    const payouts = await prisma.payout.findMany({
      where: {
        affiliateId: affiliate.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const paidPayouts = payouts.filter(p => p.status === 'paid')
    const totalPayouts = paidPayouts.reduce(
      (sum, p) => sum + decimalToNumber(p.amount),
      0
    )

    // Available balance = total earnings - total payouts
    const availableBalance = totalEarnings - totalPayouts

    // Prepare response
    const response = {
      affiliate: {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        createdAt: affiliate.createdAt.toISOString(),
      },
      balance: availableBalance,
      links: affiliate.links.map(link => ({
        id: link.id,
        productSlug: link.productSlug,
        referralCode: link.referralCode,
        createdAt: link.createdAt.toISOString(),
      })),
      referrals: affiliate.referrals.map(r => ({
        id: r.id,
        userEmail: r.userEmail,
        productSlug: r.productSlug,
        amountPaid: decimalToNumber(r.amountPaid),
        commissionAmount: decimalToNumber(r.commissionAmount),
        paymentReference: r.paymentReference,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      payouts: payouts.map(p => ({
        id: p.id,
        amount: decimalToNumber(p.amount),
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
