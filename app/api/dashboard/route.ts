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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    signedInEmail = session.user.email
    signedInName = session.user.name || 'Sales Partner'

    await ensureDefaultCommissionMatrix(prisma)

    // First try to find the affiliate
    let affiliate = await prisma.affiliate.findUnique({
      where: { email: session.user.email },
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

    // If affiliate doesn't exist, create it (defensive upsert)
    // This ensures SaaS auto-provisioning even if signIn callback failed
    if (!affiliate) {
      console.warn('⚠️ Affiliate missing - auto-provisioning on dashboard access:', {
        email: signedInEmail,
        timestamp: new Date().toISOString(),
      })

      try {
        affiliate = await prisma.affiliate.create({
          data: {
            email: session.user.email,
            name: signedInName || session.user.email,
            role: 'AFFILIATE',
          },
          include: {
            links: true,
            referrals: true,
            withdrawals: true,
            notifications: true,
          },
        })

        console.log('✅ Affiliate auto-provisioned on dashboard access:', {
          email: affiliate.email,
          name: affiliate.name,
        })
      } catch (createError) {
        const errMsg = createError instanceof Error ? createError.message : String(createError)
        console.error('❌ Failed to auto-provision affiliate:', {
          email: signedInEmail,
          error: errMsg,
        })
        // Fall back to graceful error that suggests retry
        // This is the only time we return an error on dashboard route
        return NextResponse.json(
          {
            error: 'Affiliate initialization failed',
            details: 'Unable to initialize your affiliate account. Please try refreshing or signing in again.',
          },
          { status: 500 }
        )
      }
    }

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
        where: { role: 'AFFILIATE' },
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
          planType: rule.plan.planType,
          rewardAmount: decimalToNumber(rule.rewardAmount),
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

    const availableSalesEarnings = decimalToNumber(affiliate.availableBalance)
    const pendingSalesEarnings = decimalToNumber(affiliate.pendingBalance)
    const totalSalesEarnings = decimalToNumber(affiliate.totalEarned)

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
        name: partner.name,
        email: partner.email,
        displayName: String(partner.name || '').trim() || partner.email,
        phone: String(partner.phone || '').trim() || 'Not provided',
        level: partner.level,
        totalReferrals: partner.totalReferralsIndividual + partner.totalReferralsProfessional,
        totalEarnings: decimalToNumber(partner.totalEarned),
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
        clientEmail: referral.userEmail,
        planType: referral.planType,
        commission: decimalToNumber(referral.commissionAmount),
        status: referral.status,
        reference: referral.reference,
        date: referral.createdAt.toISOString(),
      })),
      payoutHistory: affiliate.withdrawals.map(withdrawal => ({
        id: withdrawal.id,
        amount: decimalToNumber(withdrawal.amount),
        status: withdrawal.status,
        mpesaNumber: withdrawal.mpesaNumber,
        failureReason: withdrawal.failureReason,
        providerReference: withdrawal.providerReference,
        requestedDate: withdrawal.createdAt.toISOString(),
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
        userEmail: referral.userEmail,
        planType: referral.planType,
        productSlug: referral.planType,
        subscriptionValue: null,
        salesEarnings: decimalToNumber(referral.commissionAmount),
        paymentReference: referral.reference,
        reference: referral.reference,
        status: referral.status,
        createdAt: referral.createdAt.toISOString(),
      })),
      salesAgent: {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        createdAt: affiliate.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('❌ Dashboard API critical error:', {
      email: signedInEmail,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    })

    try {
      if (!signedInEmail) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const affiliateColumns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        `select column_name from information_schema.columns where table_schema='public' and table_name='affiliates'`
      )
      const referralColumns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        `select column_name from information_schema.columns where table_schema='public' and table_name='referrals'`
      )

      const hasTotalEarned = affiliateColumns.some((col) => col.column_name === 'totalEarned')
      const earningsColumn = hasTotalEarned ? 'totalEarned' : 'totalEarnings'
      const hasUserEmail = referralColumns.some((col) => col.column_name === 'userEmail')
      const referralEmailColumn = hasUserEmail ? 'userEmail' : 'clientEmail'

      const affiliateRows = await prisma.$queryRawUnsafe<Array<any>>(
        `select
          "id",
          "email",
          "name",
          "phone",
          "level",
          "role",
          "isFrozen",
          "totalReferralsIndividual",
          "totalReferralsProfessional",
          "pendingBalance",
          "availableBalance",
          "${earningsColumn}" as "totalSalesEarnings",
          "level4EligibleAt",
          "createdAt"
         from "affiliates"
         where "email" = $1
         limit 1`,
        signedInEmail
      )

      const affiliate = affiliateRows[0]
      
      // If affiliate missing in error path, create it now
      if (!affiliate) {
        console.warn('⚠️ [Dashboard Fallback] Affiliate missing - auto-provisioning now:', {
          email: signedInEmail,
          timestamp: new Date().toISOString(),
        })
        
        try {
          const newAffiliate = await prisma.affiliate.create({
            data: {
              email: signedInEmail,
              name: signedInName || signedInEmail,
              role: 'AFFILIATE',
            },
          })
          
          console.log('✅ Affiliate auto-provisioned in error handler:', {
            email: newAffiliate.email,
            name: newAffiliate.name,
          })
          
          // Redirect to dashboard to reload with the new affiliate
          return NextResponse.json(
            {
              success: true,
              message: 'Sales record created. Please refresh your dashboard.',
              redirectTo: '/dashboard',
            },
            { status: 201 }
          )
        } catch (createErr) {
          const errMsg = createErr instanceof Error ? createErr.message : String(createErr)
          console.error('❌ Failed to create affiliate in fallback:', {
            email: signedInEmail,
            error: errMsg,
          })
          
          return NextResponse.json(
            {
              error: 'Unable to initialize sales record',
              details: 'Please refresh and try again.',
            },
            { status: 500 }
          )
        }
      }

      const currentLevel = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4'].includes(String(affiliate.level))
        ? (affiliate.level as 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4')
        : 'LEVEL_1'

      const progress = computeProgressToNextLevel(
        currentLevel,
        Number(affiliate.totalReferralsIndividual || 0),
        Number(affiliate.totalReferralsProfessional || 0)
      )

      const [currentLevelCommission, allCommissionRules] = await Promise.all([
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
      ])

      const roadmap = Object.entries(LEVEL_PROGRESS_REQUIREMENTS).map(([level, cfg]) => {
        const levelKey = level as 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4'
        const commissionByLevel = allCommissionRules
          .filter((rule) => rule.affiliateLevel === levelKey && rule.plan.isActive)
          .map((rule) => ({
            planType: rule.plan.planType,
            rewardAmount: decimalToNumber(rule.rewardAmount),
          }))

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

      const [leaderboardRows, linksRows, referralRows, withdrawalRows, notificationRows] = await Promise.all([
        prisma.$queryRawUnsafe<Array<any>>(
          `select "id", "name", "email", "phone", "level", "${earningsColumn}" as "totalEarnings", "totalReferralsIndividual", "totalReferralsProfessional", "createdAt"
           from "affiliates"
            where lower("role"::text) = 'affiliate'
           order by "${earningsColumn}" desc, "createdAt" asc
           limit 10`
        ),
        prisma.$queryRawUnsafe<Array<any>>(
          `select "id", "productSlug", "referralCode", "createdAt"
           from "affiliate_links"
           where "affiliateId" = $1
           order by "createdAt" desc`,
          affiliate.id
        ),
        prisma.$queryRawUnsafe<Array<any>>(
          `select "id", "clientName", "${referralEmailColumn}" as "clientEmail", "planType", "commissionAmount", "status", "reference", "createdAt"
           from "referrals"
           where "affiliateId" = $1
           order by "createdAt" desc
           limit 200`,
          affiliate.id
        ),
        prisma.$queryRawUnsafe<Array<any>>(
          `select "id", "amount", "status", "mpesaNumber", "failureReason", "providerReference", "createdAt", "completedAt"
           from "withdrawals"
           where "affiliateId" = $1
           order by "createdAt" desc
           limit 50`,
          affiliate.id
        ),
        prisma.$queryRawUnsafe<Array<any>>(
          `select "id", "type", "title", "message", "isRead", "createdAt"
           from "notifications"
           where "affiliateId" = $1 and "roleTarget"::text = 'AFFILIATE'
           order by "createdAt" desc
           limit 10`,
          affiliate.id
        ),
      ])

      const availableSalesEarnings = Number(affiliate.availableBalance || 0)
      const pendingSalesEarnings = Number(affiliate.pendingBalance || 0)
      const totalSalesEarnings = Number(affiliate.totalSalesEarnings || 0)
      const totalReferrals =
        Number(affiliate.totalReferralsIndividual || 0) + Number(affiliate.totalReferralsProfessional || 0)

      return NextResponse.json({
        affiliate: {
          id: affiliate.id,
          email: affiliate.email,
          name: affiliate.name,
          phone: affiliate.phone,
          level: currentLevel,
          levelLabel: getLevelLabel(currentLevel),
          levelTitle: getSalesLevelTitle(currentLevel),
          levelDisplayName: getSalesLevelDisplayName(currentLevel),
          isFrozen: Boolean(affiliate.isFrozen),
          role: affiliate.role || 'AFFILIATE',
          isProfileComplete: Boolean(affiliate.name && affiliate.phone),
          level4EligibleForInterview: currentLevel === 'LEVEL_4',
          level4EligibleAt: affiliate.level4EligibleAt ? new Date(affiliate.level4EligibleAt).toISOString() : null,
          createdAt: new Date(affiliate.createdAt).toISOString(),
        },
        summary: {
          totalReferrals,
          totalReferralsIndividual: Number(affiliate.totalReferralsIndividual || 0),
          totalReferralsProfessional: Number(affiliate.totalReferralsProfessional || 0),
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
        leaderboardPreview: leaderboardRows.map((partner, index) => ({
          rank: index + 1,
          id: partner.id,
          name: partner.name,
          email: partner.email,
          displayName: String(partner.name || '').trim() || partner.email,
          phone: String(partner.phone || '').trim() || 'Not provided',
          level: partner.level,
          totalReferrals: Number(partner.totalReferralsIndividual || 0) + Number(partner.totalReferralsProfessional || 0),
          totalEarnings: Number(partner.totalEarnings || 0),
        })),
        salesTrackingLinks: linksRows.map((link) => ({
          id: link.id,
          productSlug: link.productSlug,
          agentCode: link.referralCode,
          createdAt: new Date(link.createdAt).toISOString(),
        })),
        referralHistory: referralRows.map((referral) => ({
          id: referral.id,
          clientName: referral.clientName || 'Unknown Client',
          clientEmail: referral.clientEmail,
          planType: referral.planType,
          commission: Number(referral.commissionAmount || 0),
          status: referral.status,
          reference: referral.reference,
          date: new Date(referral.createdAt).toISOString(),
        })),
        payoutHistory: withdrawalRows.map((withdrawal) => ({
          id: withdrawal.id,
          amount: Number(withdrawal.amount || 0),
          status: withdrawal.status,
          mpesaNumber: withdrawal.mpesaNumber,
          failureReason: withdrawal.failureReason,
          providerReference: withdrawal.providerReference,
          requestedDate: new Date(withdrawal.createdAt).toISOString(),
          completedDate: withdrawal.completedAt ? new Date(withdrawal.completedAt).toISOString() : null,
        })),
        notifications: notificationRows.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          message: item.message,
          isRead: Boolean(item.isRead),
          createdAt: new Date(item.createdAt).toISOString(),
        })),
        totalSalesEarnings,
        availableSalesEarnings,
        pendingSalesEarnings,
        salesActivity: referralRows.map((referral) => ({
          id: referral.id,
          userEmail: referral.clientEmail,
          planType: referral.planType,
          productSlug: referral.planType,
          subscriptionValue: null,
          salesEarnings: Number(referral.commissionAmount || 0),
          paymentReference: referral.reference,
          reference: referral.reference,
          status: referral.status,
          createdAt: new Date(referral.createdAt).toISOString(),
        })),
        salesAgent: {
          id: affiliate.id,
          name: affiliate.name,
          email: affiliate.email,
          createdAt: new Date(affiliate.createdAt).toISOString(),
        },
        _meta: {
          degraded: true,
          message: 'Served by compatibility fallback due to schema mismatch',
        },
      })
    } catch (compatError) {
      console.error('Dashboard compatibility fallback error:', compatError)
    }

    return NextResponse.json(
      {
        error: 'Dashboard failed to load',
        details: 'Backend data query failed',
      },
      { status: 500 }
    )
  }
}
