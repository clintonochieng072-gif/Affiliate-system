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
          include: {
            plan: {
              select: { planType: true, name: true },
            },
          },
        },
        withdrawals: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!salesAgent) {
      return NextResponse.json(
        { error: 'Sales agent not found' },
        { status: 404 }
      )
    }

    const availableSalesEarnings = decimalToNumber(salesAgent.availableBalance)
    const pendingSalesEarnings = decimalToNumber(salesAgent.pendingBalance)
    const totalSalesEarnings = decimalToNumber(salesAgent.totalEarned)

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
        planType: r.planType,
        productSlug: r.planType,
        subscriptionValue: null,
        salesEarnings: decimalToNumber(r.commissionAmount),
        paymentReference: r.reference,
        reference: r.reference,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      payoutHistory: salesAgent.withdrawals.map(w => ({
        id: w.id,
        requestedAmount: decimalToNumber(w.amount),
        amount: decimalToNumber(w.amount),
        mpesaNumber: w.mpesaNumber,
        status: w.status,
        failureReason: w.failureReason,
        providerReference: w.providerReference,
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
