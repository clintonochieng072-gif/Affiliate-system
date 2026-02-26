import { AffiliateLevel, PrismaClient } from '@prisma/client'

export const LEVEL_PROGRESS_REQUIREMENTS: Record<
  AffiliateLevel,
  { nextLevel: AffiliateLevel | null; individualRequired: number; professionalRequired: number }
> = {
  LEVEL_1: { nextLevel: 'LEVEL_2', individualRequired: 10, professionalRequired: 5 },
  LEVEL_2: { nextLevel: 'LEVEL_3', individualRequired: 25, professionalRequired: 12 },
  LEVEL_3: { nextLevel: 'LEVEL_4', individualRequired: 50, professionalRequired: 25 },
  LEVEL_4: { nextLevel: null, individualRequired: 0, professionalRequired: 0 },
}

export function getLevelLabel(level: AffiliateLevel) {
  return level.replace('LEVEL_', 'Level ')
}

export function getPromotionTarget(
  currentLevel: AffiliateLevel,
  totalReferralsIndividual: number,
  totalReferralsProfessional: number
) {
  const config = LEVEL_PROGRESS_REQUIREMENTS[currentLevel]

  if (!config.nextLevel) {
    return null
  }

  const qualifies =
    totalReferralsIndividual >= config.individualRequired ||
    totalReferralsProfessional >= config.professionalRequired

  if (!qualifies) {
    return null
  }

  return config.nextLevel
}

export function computeProgressToNextLevel(
  currentLevel: AffiliateLevel,
  totalReferralsIndividual: number,
  totalReferralsProfessional: number
) {
  const config = LEVEL_PROGRESS_REQUIREMENTS[currentLevel]
  if (!config.nextLevel) {
    return {
      nextLevel: null,
      progressPercent: 100,
      individualProgressPercent: 100,
      professionalProgressPercent: 100,
    }
  }

  const individualProgressPercent = Math.min(
    100,
    Math.round((totalReferralsIndividual / config.individualRequired) * 100)
  )
  const professionalProgressPercent = Math.min(
    100,
    Math.round((totalReferralsProfessional / config.professionalRequired) * 100)
  )

  return {
    nextLevel: config.nextLevel,
    progressPercent: Math.max(individualProgressPercent, professionalProgressPercent),
    individualProgressPercent,
    professionalProgressPercent,
  }
}

export async function getCommissionForPlanAndLevel(
  prisma: PrismaClient,
  planType: string,
  affiliateLevel: AffiliateLevel
) {
  const normalizedPlanType = planType.trim()

  const plan = await prisma.plan.findFirst({
    where: {
      planType: {
        equals: normalizedPlanType,
        mode: 'insensitive',
      },
    },
    select: { id: true, planType: true, isActive: true },
  })

  if (!plan || !plan.isActive) {
    return { plan: null, rewardAmount: null as null | number }
  }

  const rule = await prisma.commissionRule.findUnique({
    where: {
      affiliateLevel_planId: {
        affiliateLevel,
        planId: plan.id,
      },
    },
    select: {
      rewardAmount: true,
    },
  })

  if (!rule) {
    return { plan, rewardAmount: null as null | number }
  }

  return { plan, rewardAmount: Number(rule.rewardAmount) }
}
