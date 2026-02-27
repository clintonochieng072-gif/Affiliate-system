import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { decimalToNumber } from '@/lib/utils'
import { ADMIN_EMAIL, PLAN_PRICES } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminAccount = await prisma.affiliate.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    })

    const isAdmin = session.user.email === ADMIN_EMAIL || adminAccount?.role === 'ADMIN'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [
      affiliates,
      referrals,
      pendingWithdrawals,
      topPerformers,
      notifications,
      level4Candidates,
    ] = await Promise.all([
      prisma.affiliate.findMany({
        where: { role: 'AFFILIATE' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          level: true,
          isFrozen: true,
          totalReferralsIndividual: true,
          totalReferralsProfessional: true,
          totalEarned: true,
          availableBalance: true,
          pendingBalance: true,
          createdAt: true,
        },
      }),
      prisma.referral.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          id: true,
          affiliateId: true,
          clientName: true,
          userEmail: true,
          planType: true,
          commissionAmount: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.withdrawal.findMany({
        where: { status: { in: ['pending', 'processing'] } },
        orderBy: { createdAt: 'desc' },
        include: {
          affiliate: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      }),
      prisma.affiliate.findMany({
        where: { role: 'AFFILIATE' },
        orderBy: [{ totalEarned: 'desc' }, { createdAt: 'asc' }],
        take: 20,
        select: {
          id: true,
          name: true,
          phone: true,
          level: true,
          totalReferralsIndividual: true,
          totalReferralsProfessional: true,
          totalEarned: true,
        },
      }),
      prisma.notification.findMany({
        where: { roleTarget: 'ADMIN' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.affiliate.findMany({
        where: { level: 'LEVEL_4', role: 'AFFILIATE' },
        orderBy: { level4EligibleAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          level: true,
          level4EligibleAt: true,
          totalReferralsIndividual: true,
          totalReferralsProfessional: true,
          totalEarned: true,
        },
      }),
    ])

    const totalRevenueGenerated = referrals.reduce((sum, referral) => {
      const planRevenue = PLAN_PRICES[referral.planType] || 0
      return sum + planRevenue
    }, 0)

    const totalCommissionsPaid = referrals.reduce(
      (sum, referral) => sum + decimalToNumber(referral.commissionAmount),
      0
    )

    const netProfitEstimate = totalRevenueGenerated - totalCommissionsPaid

    return NextResponse.json({
      stats: {
        totalAffiliates: affiliates.length,
        totalRevenueGenerated,
        totalCommissionsPaid,
        pendingWithdrawalsCount: pendingWithdrawals.length,
        netProfitEstimate,
      },
      notifications: notifications.map(item => ({
        id: item.id,
        type: item.type,
        title: item.title,
        message: item.message,
        isRead: item.isRead,
        createdAt: item.createdAt.toISOString(),
      })),
      affiliates: affiliates.map(affiliate => ({
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        phone: affiliate.phone,
        level: affiliate.level,
        isFrozen: affiliate.isFrozen,
        totalReferrals:
          affiliate.totalReferralsIndividual + affiliate.totalReferralsProfessional,
        totalReferralsIndividual: affiliate.totalReferralsIndividual,
        totalReferralsProfessional: affiliate.totalReferralsProfessional,
        totalEarnings: decimalToNumber(affiliate.totalEarned),
        availableBalance: decimalToNumber(affiliate.availableBalance),
        pendingBalance: decimalToNumber(affiliate.pendingBalance),
        registrationDate: affiliate.createdAt.toISOString(),
      })),
      recentReferrals: referrals.map(referral => ({
        id: referral.id,
        affiliateId: referral.affiliateId,
        clientName: referral.clientName || 'Unknown Client',
        clientEmail: referral.userEmail,
        planType: referral.planType,
        commission: decimalToNumber(referral.commissionAmount),
        status: referral.status,
        date: referral.createdAt.toISOString(),
      })),
      pendingWithdrawals: pendingWithdrawals.map(withdrawal => ({
        id: withdrawal.id,
        affiliateId: withdrawal.affiliateId,
        affiliateName: withdrawal.affiliate.name,
        affiliateEmail: withdrawal.affiliate.email,
        affiliatePhone: withdrawal.affiliate.phone,
        amount: decimalToNumber(withdrawal.amount),
        status: withdrawal.status,
        requestedDate: withdrawal.createdAt.toISOString(),
        providerReference: withdrawal.providerReference,
      })),
      topPerformers: topPerformers.map((affiliate, index) => ({
        rank: index + 1,
        id: affiliate.id,
        name: affiliate.name,
        phone: affiliate.phone,
        level: affiliate.level,
        totalReferrals:
          affiliate.totalReferralsIndividual + affiliate.totalReferralsProfessional,
        totalEarnings: decimalToNumber(affiliate.totalEarned),
      })),
      level4EligibleAffiliates: level4Candidates.map(affiliate => ({
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        phone: affiliate.phone,
        level: affiliate.level,
        eligibleSince: affiliate.level4EligibleAt?.toISOString() || null,
        totalReferrals:
          affiliate.totalReferralsIndividual + affiliate.totalReferralsProfessional,
        totalEarnings: decimalToNumber(affiliate.totalEarned),
      })),
    })
  } catch (error) {
    console.error('Admin API error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      stats: {
        totalAffiliates: 0,
        totalRevenueGenerated: 0,
        totalCommissionsPaid: 0,
        pendingWithdrawalsCount: 0,
        netProfitEstimate: 0,
      },
      notifications: [],
      affiliates: [],
      recentReferrals: [],
      pendingWithdrawals: [],
      topPerformers: [],
      level4EligibleAffiliates: [],
      _meta: {
        degraded: true,
        message: 'Admin fallback response due to backend data error',
      },
    }, { status: 500 })
  }
}
