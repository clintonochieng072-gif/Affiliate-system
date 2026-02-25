/**
 * Admin Dashboard API Route
 * Returns all sales agents, sales activity, and stats
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

    // Get all sales agents
    const salesAgents = await prisma.affiliate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        referrals: true,
      },
    })

    // Get all sales activity
    const salesActivity = await prisma.referral.findMany({
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
    const totalRevenue = salesActivity.reduce(
      (sum, r) => sum + decimalToNumber(r.commissionAmount),
      0
    )
    const totalSalesEarnings = salesActivity.reduce(
      (sum, r) => sum + decimalToNumber(r.commissionAmount),
      0
    )

    // Prepare sales agent data with earnings
    const salesAgentsData = salesAgents.map(a => {
      return {
        id: a.id,
        name: a.name,
        email: a.email,
        level: a.level,
        totalSalesCount: a.referrals.length,
        totalSalesEarnings: decimalToNumber(a.totalEarned),
        pendingSalesEarnings: decimalToNumber(a.pendingBalance),
        availableSalesEarnings: decimalToNumber(a.availableBalance),
        createdAt: a.createdAt.toISOString(),
      }
    })

    // Prepare response
    const response = {
      stats: {
        totalSalesAgents: salesAgents.length,
        totalSalesActivity: salesActivity.length,
        totalRevenue,
        totalSalesEarnings,
      },
      salesAgents: salesAgentsData,
      salesActivity: salesActivity.map(r => ({
        id: r.id,
        salesAgentName: r.affiliate.name,
        salesAgentEmail: r.affiliate.email,
        userEmail: r.userEmail,
        productSlug: r.planType,
        subscriptionValue: null,
        salesEarnings: decimalToNumber(r.commissionAmount),
        paymentReference: r.reference,
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
