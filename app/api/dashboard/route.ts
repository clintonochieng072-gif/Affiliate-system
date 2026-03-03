import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  computeProgressToNextLevel,
  ensureDefaultCommissionMatrix,
  getCommissionMatrixForLevel,
  getLevelLabel,
  getSalesLevelDisplayName,
  getSalesLevelTitle,
  LEVEL_PROGRESS_REQUIREMENTS,
} from '@/lib/commission'
import { decimalToNumber } from '@/lib/utils'

export async function GET(request: NextRequest) {
  let signedInEmail = ''
  let signedInName = 'Sales Partner'

  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
      console.warn('⚠️ Dashboard API: No session or email found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    signedInEmail = session.user.email
    signedInName = session.user.name || 'Sales Partner'
    
    // Validate email format
    if (!signedInEmail.includes('@')) {
      console.error('❌ Invalid email format:', signedInEmail)
      return NextResponse.json({ error: 'Invalid session email' }, { status: 401 })
    }

    console.log('📝 Dashboard API request started:', { email: signedInEmail, name: signedInName })

    // Ensure commission rules exist
    try {
      await ensureDefaultCommissionMatrix(prisma)
    } catch (matrixErr) {
      console.warn('⚠️ Commission matrix ensure failed (non-blocking):', matrixErr instanceof Error ? matrixErr.message : String(matrixErr))
    }

    // Use upsert to guarantee affiliate exists
    // Creates if missing, finds if exists - handles race conditions
    let affiliate
    try {
      affiliate = await prisma.affiliate.upsert({
        where: { email: session.user.email },
        update: {}, // No updates needed
        create: {
          email: session.user.email,
          name: signedInName || session.user.email,
          role: 'AFFILIATE',
        },
        include: {
          links: {
            orderBy: { createdAt: 'desc' },
          },
          referrals: {
            orderBy: { createdAt: 'desc' },
            take: 200,
          },
          withdrawals: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
          notifications: {
            where: { roleTarget: 'AFFILIATE' },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      })
      
      console.log('✅ Affiliate upserted:', {
        email: affiliate.email,
        id: affiliate.id,
        isNew: !affiliate.phone,
      })
    } catch (upsertErr) {
      const errMsg = upsertErr instanceof Error ? upsertErr.message : String(upsertErr)
      console.error('❌ Affiliate upsert failed:', {
        email: signedInEmail,
        error: errMsg,
      })
      throw new Error(`Affiliate upsert failed: ${errMsg}`)
    }

    if (!affiliate) {
      throw new Error('Affiliate upsert returned null')
    }

    console.log('✅ Dashboard API loaded with upsert:', {
      email: affiliate.email,
      affiliateId: affiliate.id,
      hasLinks: affiliate.links?.length ?? 0,
    })

    const currentLevel = affiliate.level
    const progress = computeProgressToNextLevel(
      currentLevel,
      affiliate.totalReferralsIndividual,
      affiliate.totalReferralsProfessional
    )

    const [currentLevelCommission, allCommissionRules, leaderboardPreview] = await Promise.all([
      getCommissionMatrixForLevel(prisma, currentLevel),
      prisma.commissionRule.findMany({
        include: {
          plan: {
            select: {
              planType: true,
              isActive: true,
            },
          },
        },
      }),
      prisma.affiliate.findMany({
        where: { role: 'AFFILIATE', totalEarned: { gt: 0 } },
        orderBy: [{ totalEarned: 'desc' }, { createdAt: 'asc' }],
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          level: true,
          totalEarned: true,
          totalReferralsIndividual: true,
          totalReferralsProfessional: true,
        },
      }),
    ])

    if (allCommissionRules.length === 0) {
      console.warn('⚠️ [Dashboard API] No commission rules found in database. Run prisma db seed to populate commission_rules table.')
    }

    if (currentLevelCommission.length === 0) {
      console.warn(`⚠️ [Dashboard API] No commission rules found for current level ${currentLevel}. Commission values will be empty.`)
    }

    const roadmap = Object.entries(LEVEL_PROGRESS_REQUIREMENTS).map(([level, cfg]) => {
      const levelKey = level as typeof affiliate.level
      const commissionByLevel = allCommissionRules
        .filter(rule => rule.affiliateLevel === levelKey && rule.plan.isActive)
        .map(rule => ({
          planType: rule.plan.planType || 'Unknown',
          rewardAmount: decimalToNumber(rule.rewardAmount ?? 0),
        }))

      if (commissionByLevel.length === 0) {
        console.warn(`⚠️ [Dashboard API] No commission rules for level ${level}. Roadmap card will show empty values.`)
      }

      return {
        level,
        label: getLevelLabel(levelKey),
        title: getSalesLevelTitle(levelKey),
        displayName: getSalesLevelDisplayName(levelKey),
        nextLevel: cfg.nextLevel,
        individualRequired: cfg.individualRequired,
        professionalRequired: cfg.professionalRequired,
        reached:
          level === 'LEVEL_1' ||
          (level === 'LEVEL_2' && ['LEVEL_2', 'LEVEL_3', 'LEVEL_4'].includes(currentLevel)) ||
          (level === 'LEVEL_3' && ['LEVEL_3', 'LEVEL_4'].includes(currentLevel)) ||
          (level === 'LEVEL_4' && currentLevel === 'LEVEL_4'),
        commissionByLevel,
      }
    })

    const availableSalesEarnings = decimalToNumber(affiliate.availableBalance ?? 0)
    const pendingSalesEarnings = decimalToNumber(affiliate.pendingBalance ?? 0)
    const totalSalesEarnings = decimalToNumber(affiliate.totalEarned ?? 0)

    const totalReferrals = affiliate.totalReferralsIndividual + affiliate.totalReferralsProfessional

    return NextResponse.json({
      affiliate: {
        id: affiliate.id,
        email: affiliate.email,
        name: affiliate.name,
        phone: affiliate.phone,
        level: affiliate.level,
        levelLabel: getLevelLabel(affiliate.level),
        levelTitle: getSalesLevelTitle(affiliate.level),
        levelDisplayName: getSalesLevelDisplayName(affiliate.level),
        isFrozen: affiliate.isFrozen,
        role: affiliate.role,
        isProfileComplete: Boolean(affiliate.name && affiliate.phone),
        level4EligibleForInterview: affiliate.level === 'LEVEL_4',
        level4EligibleAt: affiliate.level4EligibleAt?.toISOString() || null,
        createdAt: affiliate.createdAt.toISOString(),
      },
      summary: {
        totalReferrals,
        totalReferralsIndividual: affiliate.totalReferralsIndividual,
        totalReferralsProfessional: affiliate.totalReferralsProfessional,
        totalSalesEarnings,
        availableSalesEarnings,
        pendingSalesEarnings,
      },
      progress: {
        currentLevel,
        currentLevelLabel: getLevelLabel(currentLevel),
        currentLevelTitle: getSalesLevelTitle(currentLevel),
        currentLevelDisplayName: getSalesLevelDisplayName(currentLevel),
        nextLevel: progress.nextLevel,
        nextLevelLabel: progress.nextLevel ? getLevelLabel(progress.nextLevel) : null,
        nextLevelTitle: progress.nextLevel ? getSalesLevelTitle(progress.nextLevel) : null,
        nextLevelDisplayName: progress.nextLevel ? getSalesLevelDisplayName(progress.nextLevel) : null,
        progressPercent: progress.progressPercent,
        individualProgressPercent: progress.individualProgressPercent,
        professionalProgressPercent: progress.professionalProgressPercent,
      },
      roadmap,
      currentCommissionMatrix: currentLevelCommission,
      leaderboardPreview: leaderboardPreview.map((partner, index) => ({
        rank: index + 1,
        id: partner.id,
        name: partner.name || 'Unknown',
        email: partner.email || 'unknown@example.com',
        displayName: String(partner.name || '').trim() || partner.email || 'Unknown',
        phone: String(partner.phone || '').trim() || 'Not provided',
        level: partner.level,
        totalReferrals: (partner.totalReferralsIndividual ?? 0) + (partner.totalReferralsProfessional ?? 0),
        totalEarnings: decimalToNumber(partner.totalEarned ?? 0),
      })),
      salesTrackingLinks: affiliate.links.map(link => ({
        id: link.id,
        productSlug: link.productSlug,
        agentCode: link.referralCode,
        createdAt: link.createdAt.toISOString(),
      })),
      referralHistory: affiliate.referrals.map(referral => ({
        id: referral.id,
        clientName: referral.clientName || 'Unknown Client',
        clientEmail: referral.userEmail || 'unknown@example.com',
        planType: referral.planType || 'Unknown Plan',
        commission: decimalToNumber(referral.commissionAmount ?? 0),
        status: referral.status || 'pending',
        reference: referral.reference || 'N/A',
        date: referral.createdAt?.toISOString() || new Date().toISOString(),
      })),
      payoutHistory: affiliate.withdrawals.map(withdrawal => ({
        id: withdrawal.id,
        amount: decimalToNumber(withdrawal.amount ?? 0),
        status: withdrawal.status || 'pending',
        mpesaNumber: withdrawal.mpesaNumber || 'N/A',
        failureReason: withdrawal.failureReason || null,
        providerReference: withdrawal.providerReference || null,
        requestedDate: withdrawal.createdAt?.toISOString() || new Date().toISOString(),
        completedDate: withdrawal.completedAt?.toISOString() || null,
      })),
      notifications: affiliate.notifications.map(item => ({
        id: item.id,
        type: item.type,
        title: item.title,
        message: item.message,
        isRead: item.isRead,
        createdAt: item.createdAt.toISOString(),
      })),

      totalSalesEarnings,
      availableSalesEarnings,
      pendingSalesEarnings,
      salesActivity: affiliate.referrals.map(referral => ({
        id: referral.id,
        userEmail: referral.userEmail || 'unknown@example.com',
        planType: referral.planType || 'Unknown Plan',
        productSlug: referral.planType || 'Unknown',
        subscriptionValue: null,
        salesEarnings: decimalToNumber(referral.commissionAmount ?? 0),
        paymentReference: referral.reference || 'N/A',
        reference: referral.reference || 'N/A',
        status: referral.status || 'pending',
        createdAt: referral.createdAt?.toISOString() || new Date().toISOString(),
      })),
      salesAgent: {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        createdAt: affiliate.createdAt.toISOString(),
      },
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : ''
    
    console.error('❌ Dashboard API error:', {
      email: signedInEmail,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    })
    
    // Log full stack in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Stack trace:', errorStack)
    }

    // If not authenticated, return 401
    if (!signedInEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For any other error, return 500 with retry message
    // The user may retry after signIn callback creates the affiliate
    return NextResponse.json(
      {
        error: 'Dashboard temporarily unavailable',
        details: 'Please refresh your page. If the problem persists, try signing in again.',
      },
      { status: 500 }
    )
  }
}
