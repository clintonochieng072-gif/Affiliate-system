/**
 * Delete Affiliate API
 * Admin-only endpoint to delete an affiliate and all related records
 */

import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ADMIN_EMAIL } from '@/lib/constants'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ affiliateId: string }> }
) {
  try {
    const { affiliateId } = await params
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


    // 3. Verify affiliate exists
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
    }

    // Prevent deletion of admin accounts
    if (affiliate.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Cannot delete admin accounts' },
        { status: 403 }
      )
    }

    // 4. Get referral count for logging
    const referralCount = await prisma.referral.count({
      where: { affiliateId },
    })

    // 5. Delete affiliate (cascade delete handles related records)
    // Due to Prisma cascade delete constraints, related records are deleted automatically:
    // - affiliate_links
    // - referrals
    // - withdrawals
    // - notifications
    // - payouts (if any)
    const deleted = await prisma.affiliate.delete({
      where: { id: affiliateId },
    })

    // 6. Log the action
    console.log('🗑️  Admin Affiliate Deletion:', {
      timestamp: new Date().toISOString(),
      adminEmail: session.user?.email,
      deletedAffiliateId: affiliate.id,
      deletedAffiliateEmail: affiliate.email,
      deletedAffiliateName: affiliate.name,
      referralsDeleted: referralCount,
    })

    return NextResponse.json({
      success: true,
      message: 'Affiliate deleted successfully',
      deleted: {
        id: deleted.id,
        email: deleted.email,
        name: deleted.name,
        referralsRemoved: referralCount,
      },
    })
  } catch (error) {
    console.error('❌ Affiliate deletion failed:', error)

    return NextResponse.json(
      {
        error: 'Failed to delete affiliate',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
