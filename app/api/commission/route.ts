import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { ensureDefaultCommissionMatrix, getCommissionForPlanAndLevel } from '@/lib/commission'
import { getPromotionTarget, getLevelLabel } from '@/lib/commission'
import { AffiliateLevel } from '@prisma/client'
import crypto from 'crypto'

interface CommissionPayload {
  agent_code?: string
  client_name?: string
  user_email?: string
  plan_type?: string
  reference?: string
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const webhookSecret = process.env.WEBHOOK_SECRET

    if (!webhookSecret) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const providedToken = authHeader.slice(7)
    const expectedToken = webhookSecret

    // Timing-safe comparison to prevent timing attacks
    let isValid = false
    try {
      isValid =
        providedToken.length === expectedToken.length &&
        crypto.timingSafeEqual(
          Buffer.from(providedToken, 'utf8'),
          Buffer.from(expectedToken, 'utf8')
        )
    } catch {
      isValid = false
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let body: CommissionPayload
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }
    const { agent_code, client_name, user_email, plan_type, reference } = body

    await ensureDefaultCommissionMatrix(prisma)

    if (!agent_code || !user_email || !plan_type || !reference) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: agent_code, user_email, plan_type, reference',
        },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(user_email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const existingReferral = await prisma.referral.findUnique({
      where: { reference },
      select: {
        id: true,
        affiliateId: true,
        planType: true,
        commissionAmount: true,
        status: true,
        createdAt: true,
      },
    })

    if (existingReferral) {
      return NextResponse.json(
        {
          success: true,
          message: 'Activation already processed (idempotent)',
          commission: {
            id: existingReferral.id,
            affiliateId: existingReferral.affiliateId,
            planType: existingReferral.planType,
            amount: Number(existingReferral.commissionAmount),
            reference,
            status: existingReferral.status,
            createdAt: existingReferral.createdAt.toISOString(),
          },
        },
        { status: 200 }
      )
    }

    const affiliateLink = await prisma.affiliateLink.findUnique({
      where: { referralCode: agent_code },
      include: {
        affiliate: {
          select: {
            id: true,
            level: true,
            isFrozen: true,
            totalReferralsIndividual: true,
            totalReferralsProfessional: true,
          },
        },
      },
    })

    if (!affiliateLink) {
      return NextResponse.json(
        { success: false, error: 'Agent code not found' },
        { status: 404 }
      )
    }

    if (affiliateLink.affiliate.isFrozen) {
      return NextResponse.json(
        { success: false, error: 'Affiliate account is frozen' },
        { status: 403 }
      )
    }

    const commissionLookup = await getCommissionForPlanAndLevel(
      prisma,
      plan_type,
      affiliateLink.affiliate.level
    )

    if (!commissionLookup.plan) {
      return NextResponse.json(
        { success: false, error: 'Plan type not found' },
        { status: 422 }
      )
    }

    if (commissionLookup.rewardAmount === null) {
      return NextResponse.json(
        { success: false, error: 'No commission rule configured for this affiliate level and plan' },
        { status: 422 }
      )
    }

    const rewardAmount = commissionLookup.rewardAmount

    const created = await prisma.$transaction(async (tx) => {
      const referral = await tx.referral.create({
        data: {
          affiliateId: affiliateLink.affiliate.id,
          planId: commissionLookup.plan!.id,
          planType: commissionLookup.plan!.planType,
          clientName: client_name || null,
          userEmail: user_email,
          commissionAmount: rewardAmount,
          reference,
          status: 'active',
        },
      })

      const planTypeNormalized = commissionLookup.plan!.planType.toLowerCase()
      const isProfessionalPlan = planTypeNormalized === 'professional'

      const updatedAffiliate = await tx.affiliate.update({
        where: { id: affiliateLink.affiliate.id },
        data: {
          availableBalance: { increment: rewardAmount },
          totalEarned: { increment: rewardAmount },
          totalReferralsIndividual: isProfessionalPlan
            ? undefined
            : { increment: 1 },
          totalReferralsProfessional: isProfessionalPlan
            ? { increment: 1 }
            : undefined,
        },
        select: {
          id: true,
          level: true,
          totalReferralsIndividual: true,
          totalReferralsProfessional: true,
          pendingBalance: true,
          availableBalance: true,
          totalEarned: true,
        },
      })

      let currentLevel: AffiliateLevel = updatedAffiliate.level
      let levelChanged = false

      while (true) {
        const targetLevel = getPromotionTarget(
          currentLevel,
          updatedAffiliate.totalReferralsIndividual,
          updatedAffiliate.totalReferralsProfessional
        )

        if (!targetLevel) {
          break
        }

        currentLevel = targetLevel
        levelChanged = true
      }

      let promotedToLevel: AffiliateLevel | null = null

      if (levelChanged && currentLevel !== updatedAffiliate.level) {
        promotedToLevel = currentLevel
        await tx.affiliate.update({
          where: { id: updatedAffiliate.id },
          data: {
            level: currentLevel,
            promotedAt: new Date(),
            level4EligibleAt: currentLevel === 'LEVEL_4' ? new Date() : undefined,
          },
        })

        await tx.notification.create({
          data: {
            affiliateId: updatedAffiliate.id,
            roleTarget: 'AFFILIATE',
            type: 'promotion',
            title: 'Promotion unlocked',
            message: `Congratulations! You have been promoted to ${getLevelLabel(currentLevel)}.`,
          },
        })
      }

      await tx.notification.create({
        data: {
          roleTarget: 'ADMIN',
          type: 'referral_success',
          title: 'Successful referral recorded',
          message: `Affiliate ${affiliateLink.affiliate.id} converted ${user_email} on ${commissionLookup.plan!.planType}.`,
        },
      })

      return { referral, updatedAffiliate, promotedToLevel }
    })

    return NextResponse.json({
      success: true,
      message: 'Activation processed and commission credited',
      commission: {
        id: created.referral.id,
        affiliateId: created.referral.affiliateId,
        planType: created.referral.planType,
        amount: Number(created.referral.commissionAmount),
        reference: created.referral.reference,
        status: created.referral.status,
        createdAt: created.referral.createdAt.toISOString(),
      },
      balances: {
        pendingBalance: Number(created.updatedAffiliate.pendingBalance),
        availableBalance: Number(created.updatedAffiliate.availableBalance),
        totalEarned: Number(created.updatedAffiliate.totalEarned),
      },
      promotion: created.promotedToLevel
        ? {
            promoted: true,
            newLevel: created.promotedToLevel,
            label: getLevelLabel(created.promotedToLevel),
          }
        : {
            promoted: false,
          },
    })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: true, message: 'Activation already processed (idempotent)' },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Commission Activation API',
    status: 'operational',
  })
}
