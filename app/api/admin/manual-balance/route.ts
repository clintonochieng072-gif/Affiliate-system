/**
 * Manual Balance Deduction API
 * Admin-only endpoint to manually deduct from affiliate's available balance
 * This does NOT trigger Daraja payout logic - purely administrative adjustment
 */

import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ADMIN_EMAIL } from '@/lib/constants'

interface ManualDeductionPayload {
  affiliateId: string
  amount: number
  reason?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // 1. Verify authentication
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Verify admin access
    const adminAccount = await prisma.affiliate.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    })

    const isAdmin = session.user.email === ADMIN_EMAIL || adminAccount?.role === 'ADMIN'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // 3. Parse request
    const body: ManualDeductionPayload = await request.json()
    const { affiliateId, amount, reason } = body

    // 4. Validate inputs
    if (!affiliateId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: affiliateId, amount' },
        { status: 400 }
      )
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    // 5. Get current affiliate balance
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: {
        id: true,
        email: true,
        name: true,
        availableBalance: true,
        totalWithdrawn: true,
      },
    })

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
    }

    const currentBalance = Number(affiliate.availableBalance)

    // 6. Validate deduction won't create negative balance
    if (amount > currentBalance) {
      return NextResponse.json(
        {
          error: `Insufficient balance. Available: ${currentBalance}, Requested: ${amount}`,
          availableBalance: currentBalance,
        },
        { status: 422 }
      )
    }

    // 7. Execute transaction: deduct from available, add to withdrawn
    const updated = await prisma.$transaction(async (tx) => {
      const updatedAffiliate = await tx.affiliate.update({
        where: { id: affiliateId },
        data: {
          availableBalance: {
            decrement: amount,
          },
          totalWithdrawn: {
            increment: amount,
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          availableBalance: true,
          totalWithdrawn: true,
          totalEarned: true,
        },
      })

      // 8. Log the action for auditing
      console.log('📊 Admin Manual Balance Deduction:', {
        timestamp: new Date().toISOString(),
        adminEmail: session.user?.email,
        affiliateId: affiliate.id,
        affiliateEmail: affiliate.email,
        deductedAmount: amount,
        reason: reason || 'No reason provided',
        previousBalance: currentBalance,
        newBalance: Number(updatedAffiliate.availableBalance),
        totalWithdrawn: Number(updatedAffiliate.totalWithdrawn),
      })

      return updatedAffiliate
    })

    return NextResponse.json({
      success: true,
      message: 'Balance deduction successful',
      affiliate: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        availableBalance: Number(updated.availableBalance),
        totalWithdrawn: Number(updated.totalWithdrawn),
        totalEarned: Number(updated.totalEarned),
      },
    })
  } catch (error) {
    console.error('❌ Manual balance deduction failed:', error)

    return NextResponse.json(
      {
        error: 'Failed to process deduction',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
