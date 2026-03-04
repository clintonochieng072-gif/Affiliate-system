import { prisma } from '@/lib/prisma'
import {
  ensureDefaultCommissionMatrix,
  getCommissionForPlanAndLevel,
  getPromotionTarget,
} from '@/lib/commission'

async function main() {
  const demoEmail = 'clintonochieng072@gmail.com'

  // Ensure plans and commission rules exist
  await ensureDefaultCommissionMatrix(prisma)

  // Upsert demo affiliate
  const affiliate = await prisma.affiliate.upsert({
    where: { email: demoEmail },
    update: { isDemoAccount: true, name: 'Demo Account' },
    create: { email: demoEmail, name: 'Demo Account', isDemoAccount: true },
  })

  // Ensure a demo product exists (used for affiliate links)
  const demoProduct = await prisma.product.upsert({
    where: { slug: 'demo-product' },
    update: { name: 'Demo Product', description: 'Demo product for testing', url: 'https://example.com' },
    create: {
      slug: 'demo-product',
      name: 'Demo Product',
      description: 'Demo product for testing',
      url: 'https://example.com',
      isHighlighted: false,
    },
  })

  // Ensure an affiliate link for the demo affiliate
  const affiliateLink = await prisma.affiliateLink.upsert({
    where: { referralCode: `DEMO-${affiliate.id.slice(0, 8)}` },
    update: { productId: demoProduct.id },
    create: {
      affiliateId: affiliate.id,
      productId: demoProduct.id,
      productSlug: demoProduct.slug,
      referralCode: `DEMO-${affiliate.id.slice(0, 8)}`,
    },
  })

  // Prepare referrals to create: 2 Professional, 5 Individual
  const referralPlanTypes: string[] = []
  for (let i = 0; i < 2; i++) referralPlanTypes.push('Professional')
  for (let i = 0; i < 5; i++) referralPlanTypes.push('Individual')

  // Process each referral using the same transaction pattern as the commission webhook
  for (const [idx, planType] of referralPlanTypes.entries()) {
    const reference = `demo-ref-${Date.now()}-${idx}`

    const commissionLookup = await getCommissionForPlanAndLevel(prisma, planType, affiliate.level)
    if (!commissionLookup.plan || commissionLookup.rewardAmount === null) {
      console.warn(`Skipping referral creation: missing plan or commission for ${planType}`)
      continue
    }

    const rewardAmount = commissionLookup.rewardAmount

    await prisma.$transaction(async (tx) => {
      const referral = await tx.referral.create({
        data: {
          affiliateId: affiliate.id,
          planId: commissionLookup.plan!.id,
          planType: commissionLookup.plan!.planType,
          clientName: `Demo Client ${idx + 1}`,
          userEmail: `demo+${idx + 1}@example.com`,
          commissionAmount: rewardAmount,
          reference,
          status: 'active',
        },
      })

      const planTypeNormalized = commissionLookup.plan!.planType.toLowerCase()
      const isProfessionalPlan = planTypeNormalized === 'professional'

      const updatedAffiliate = await tx.affiliate.update({
        where: { id: affiliate.id },
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

      // Promotion loop (same logic as commission route)
      let currentLevel = updatedAffiliate.level
      let levelChanged = false
      while (true) {
        const targetLevel = getPromotionTarget(
          currentLevel,
          updatedAffiliate.totalReferralsIndividual,
          updatedAffiliate.totalReferralsProfessional
        )

        if (!targetLevel) break

        currentLevel = targetLevel
        levelChanged = true
      }

      if (levelChanged && currentLevel !== updatedAffiliate.level) {
        await tx.affiliate.update({
          where: { id: updatedAffiliate.id },
          data: {
            level: currentLevel,
            promotedAt: new Date(),
            level4EligibleAt: currentLevel === 'LEVEL_4' ? new Date() : undefined,
          },
        })
      }

      return { referral, updatedAffiliate }
    })
  }

  // After creating referrals, set totalWithdrawn = 4000 and recompute availableBalance = max(0, totalEarned - totalWithdrawn)
  const fresh = await prisma.affiliate.findUnique({ where: { id: affiliate.id } })
  const totalEarned = Number(fresh?.totalEarned ?? 0)
  const desiredTotalWithdrawn = 4000
  const newAvailable = Math.max(0, totalEarned - desiredTotalWithdrawn)

  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: {
      totalWithdrawn: desiredTotalWithdrawn,
      availableBalance: newAvailable,
      isDemoAccount: true,
    },
  })

  const final = await prisma.affiliate.findUnique({ where: { id: affiliate.id } })
  console.log('Demo account seeded:')
  console.log('  email:', demoEmail)
  console.log('  totalEarned:', Number(final?.totalEarned ?? 0))
  console.log('  totalWithdrawn:', Number(final?.totalWithdrawn ?? 0))
  console.log('  availableBalance:', Number(final?.availableBalance ?? 0))
  console.log('  isDemoAccount:', final?.isDemoAccount)
}

main()
  .then(() => {
    console.log('Seeding complete')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Seeding failed', err)
    process.exit(1)
  })
