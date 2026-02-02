/**
 * Admin Dashboard API Route
 * Returns all affiliates, referrals, and stats
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

    // TODO: Add admin role check
    // For now, any authenticated user can access

    // Get all affiliates
    const affiliates = await prisma.affiliate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        referrals: {
          where: { status: 'paid' },
        },
        payouts: {
          where: { status: 'paid' },
        },
      },
    })

    // Get all referrals
    const referrals = await prisma.referral.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        affiliate: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    // Calculate totals
    const totalRevenue = referrals.reduce(
      (sum, r) => sum + decimalToNumber(r.amountPaid),
      0
    )
    const totalCommissions = referrals
      .filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + decimalToNumber(r.commissionAmount), 0)

    // Prepare affiliate data with earnings
    const affiliatesData = affiliates.map(a => {
      const totalEarnings = a.referrals.reduce(
        (sum, r) => sum + decimalToNumber(r.commissionAmount),
        0
      )
      const totalPayouts = a.payouts.reduce(
        (sum, p) => sum + decimalToNumber(p.amount),
        0
      )
      const availableBalance = totalEarnings - totalPayouts

      return {
        id: a.id,
        name: a.name,
        email: a.email,
        totalReferrals: a.referrals.length,
        totalEarnings,
        availableBalance,
        createdAt: a.createdAt.toISOString(),
      }
    })

    // Prepare response
    const response = {
      stats: {
        totalAffiliates: affiliates.length,
        totalReferrals: referrals.length,
        totalRevenue,
        totalCommissions,
      },
      affiliates: affiliatesData,
      referrals: referrals.map(r => ({
        id: r.id,
        affiliateName: r.affiliate.name,
        affiliateEmail: r.affiliate.email,
        userEmail: r.userEmail,
        productSlug: r.productSlug,
        amountPaid: decimalToNumber(r.amountPaid),
        commissionAmount: decimalToNumber(r.commissionAmount),
        paymentReference: r.paymentReference,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Admin API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
