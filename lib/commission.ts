import { AffiliateLevel, PrismaClient } from '@prisma/client'

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
