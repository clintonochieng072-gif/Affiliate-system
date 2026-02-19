/**
 * Dashboard API Route
 * Returns sales agent stats, sales tracking links, and recent sales activity
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

    const salesAgent = await prisma.affiliate.findUnique({
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

    if (!salesAgent) {
      return NextResponse.json(
        { error: 'Sales agent not found' },
        { status: 404 }
      )
    }

    // Calculate total earnings (all paid sales records)
    const paidSales = salesAgent.referrals.filter(r => r.status === 'paid')
    const totalSalesEarnings = paidSales.reduce(
      (sum, r) => sum + decimalToNumber(r.commissionAmount),
      0
    )

    // Calculate pending earnings
    const pendingSales = salesAgent.referrals.filter(r => r.status === 'pending')
    const pendingSalesEarnings = pendingSales.reduce(
      (sum, r) => sum + decimalToNumber(r.commissionAmount),
      0
    )

    // Calculate total withdrawals (completed and processing)
    const withdrawals = await prisma.withdrawal.findMany({
      where: {
        affiliateId: salesAgent.id,
        status: { in: ['completed', 'processing'] },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const totalWithdrawn = withdrawals.reduce(
      (sum, w) => sum + decimalToNumber(w.requestedAmount),
      0
    )

    // Available balance = total sales earnings - total withdrawals
    const availableSalesEarnings = totalSalesEarnings - totalWithdrawn

    // Prepare response
    const response = {
      salesAgent: {
        id: salesAgent.id,
        name: salesAgent.name,
        email: salesAgent.email,
        createdAt: salesAgent.createdAt.toISOString(),
      },
      availableSalesEarnings,
      totalSalesEarnings,
      pendingSalesEarnings,
      salesTrackingLinks: salesAgent.links.map(link => ({
        id: link.id,
        productSlug: link.productSlug,
        agentCode: link.referralCode,
        createdAt: link.createdAt.toISOString(),
      })),
      salesActivity: salesAgent.referrals.map(r => ({
        id: r.id,
        userEmail: r.userEmail,
        productSlug: r.productSlug,
        subscriptionValue: decimalToNumber(r.amountPaid),
        salesEarnings: decimalToNumber(r.commissionAmount),
        paymentReference: r.paymentReference,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      payoutHistory: withdrawals.map(w => ({
        id: w.id,
        requestedAmount: decimalToNumber(w.requestedAmount),
        payoutAmount: decimalToNumber(w.payoutAmount),
        platformFee: decimalToNumber(w.platformFee),
        mpesaNumber: w.mpesaNumber,
        status: w.status,
        createdAt: w.createdAt.toISOString(),
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
