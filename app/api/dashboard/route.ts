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

type RawColumn = { column_name: string }

type RawReferral = {
  id: string
  userEmail: string
  planType: string | null
  reference: string | null
  status: string
  commissionAmount: string | number
  createdAt: Date
}

type RawWithdrawal = {
  id: string
  amount: string | number
  mpesaNumber: string
  status: string
  failureReason: string | null
  providerReference: string | null
  createdAt: Date
}

async function getTableColumns(tableName: string) {
  const rows = await prisma.$queryRawUnsafe<RawColumn[]>(
    'SELECT column_name FROM information_schema.columns WHERE table_schema = \'' +
      'public' +
      '\' AND table_name = $1',
    tableName
  )

  return new Set(rows.map(row => row.column_name))
}

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
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    })

    if (!salesAgent) {
      return NextResponse.json(
        { error: 'Sales agent not found' },
        { status: 404 }
      )
    }

    const [affiliateColumns, referralColumns, withdrawalColumns] = await Promise.all([
      getTableColumns('affiliates'),
      getTableColumns('referrals'),
      getTableColumns('withdrawals'),
    ])

    const links = await prisma.affiliateLink.findMany({
      where: { affiliateId: salesAgent.id },
      orderBy: { createdAt: 'desc' },
    })

    const hasBalanceColumns =
      affiliateColumns.has('availableBalance') &&
      affiliateColumns.has('pendingBalance') &&
      affiliateColumns.has('totalEarned')

    let availableSalesEarnings = 0
    let pendingSalesEarnings = 0
    let totalSalesEarnings = 0

    if (hasBalanceColumns) {
      const balances = await prisma.$queryRawUnsafe<Array<{ availableBalance: string | number; pendingBalance: string | number; totalEarned: string | number }>>(
        'SELECT "availableBalance", "pendingBalance", "totalEarned" FROM "affiliates" WHERE id = $1 LIMIT 1',
        salesAgent.id
      )

      if (balances[0]) {
        availableSalesEarnings = decimalToNumber(balances[0].availableBalance)
        pendingSalesEarnings = decimalToNumber(balances[0].pendingBalance)
        totalSalesEarnings = decimalToNumber(balances[0].totalEarned)
      }
    }

    const referralPlanColumn = referralColumns.has('planType')
      ? '"planType"'
      : referralColumns.has('productSlug')
      ? '"productSlug"'
      : 'NULL'

    const referralReferenceColumn = referralColumns.has('reference')
      ? '"reference"'
      : referralColumns.has('paymentReference')
      ? '"paymentReference"'
      : 'NULL'

    const referrals = await prisma.$queryRawUnsafe<RawReferral[]>(
      `
        SELECT
          id,
          "userEmail",
          ${referralPlanColumn} as "planType",
          ${referralReferenceColumn} as "reference",
          status,
          "commissionAmount",
          "createdAt"
        FROM "referrals"
        WHERE "affiliateId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 20
      `,
      salesAgent.id
    )

    if (!hasBalanceColumns) {
      pendingSalesEarnings = referrals
        .filter(r => r.status !== 'paid')
        .reduce((sum, r) => sum + decimalToNumber(r.commissionAmount), 0)

      availableSalesEarnings = referrals
        .filter(r => r.status === 'paid')
        .reduce((sum, r) => sum + decimalToNumber(r.commissionAmount), 0)

      totalSalesEarnings = pendingSalesEarnings + availableSalesEarnings
    }

    const withdrawalAmountColumn = withdrawalColumns.has('amount')
      ? '"amount"'
      : withdrawalColumns.has('requestedAmount')
      ? '"requestedAmount"'
      : '0'

    const withdrawalProviderRefColumn = withdrawalColumns.has('providerReference')
      ? '"providerReference"'
      : withdrawalColumns.has('paystackReference')
      ? '"paystackReference"'
      : 'NULL'

    const withdrawals = await prisma.$queryRawUnsafe<RawWithdrawal[]>(
      `
        SELECT
          id,
          ${withdrawalAmountColumn} as amount,
          "mpesaNumber",
          status::text as status,
          "failureReason",
          ${withdrawalProviderRefColumn} as "providerReference",
          "createdAt"
        FROM "withdrawals"
        WHERE "affiliateId" = $1
        ORDER BY "createdAt" DESC
      `,
      salesAgent.id
    )

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
      salesTrackingLinks: links.map(link => ({
        id: link.id,
        productSlug: link.productSlug,
        agentCode: link.referralCode,
        createdAt: link.createdAt.toISOString(),
      })),
      salesActivity: referrals.map(r => ({
        id: r.id,
        userEmail: r.userEmail,
        planType: r.planType || 'Unknown',
        productSlug: r.planType || 'Unknown',
        subscriptionValue: null,
        salesEarnings: decimalToNumber(r.commissionAmount),
        paymentReference: r.reference || '',
        reference: r.reference || '',
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      payoutHistory: withdrawals.map(w => ({
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
