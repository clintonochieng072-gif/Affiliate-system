import { config } from 'dotenv'
import { AffiliateLevel, PrismaClient } from '@prisma/client'

config({ path: '.env.local' })

const prisma = new PrismaClient()

async function upsertPlan(planType: string, name: string, monthlyPrice: number) {
  const monthlyPriceColumn = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'plans'
        AND column_name = 'monthlyPrice'
    )
  `

  if (monthlyPriceColumn[0]?.exists) {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "plans" ("id", "planType", "name", "monthlyPrice", "isActive", "createdAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, true, now())
        ON CONFLICT ("planType")
        DO UPDATE SET "name" = EXCLUDED."name", "monthlyPrice" = EXCLUDED."monthlyPrice", "isActive" = true
      `,
      planType,
      name,
      monthlyPrice
    )

    const plan = await prisma.plan.findUnique({
      where: { planType },
    })

    if (!plan) {
      throw new Error(`Failed to upsert plan ${planType}`)
    }

    return plan
  }

  return prisma.plan.upsert({
    where: { planType },
    update: { name, isActive: true },
    create: {
      planType,
      name,
      isActive: true,
    },
  })
}

async function main() {
  console.log('🌱 Seeding database...')

  const leadCaptureProduct = await prisma.product.upsert({
    where: { slug: 'lead-capture-system' },
    update: {},
    create: {
      slug: 'lead-capture-system',
      name: 'Lead Capture System',
      description:
        'The #1 tool for capturing and converting leads. Beautiful customizable forms, automated follow-ups, real-time analytics, and CRM integrations.',
      url: 'https://leads.clintonstack.com',
      isHighlighted: true,
    },
  })

  const individualPlan = await upsertPlan('Individual', 'Individual Plan', 3700)
  const professionalPlan = await upsertPlan('Professional', 'Professional Plan', 7600)

  await prisma.commissionRule.upsert({
    where: {
      affiliateLevel_planId: {
        affiliateLevel: AffiliateLevel.LEVEL_1,
        planId: individualPlan.id,
      },
    },
    update: { rewardAmount: 300 },
    create: {
      affiliateLevel: AffiliateLevel.LEVEL_1,
      planId: individualPlan.id,
      rewardAmount: 300,
    },
  })

  await prisma.commissionRule.upsert({
    where: {
      affiliateLevel_planId: {
        affiliateLevel: AffiliateLevel.LEVEL_1,
        planId: professionalPlan.id,
      },
    },
    update: { rewardAmount: 800 },
    create: {
      affiliateLevel: AffiliateLevel.LEVEL_1,
      planId: professionalPlan.id,
      rewardAmount: 800,
    },
  })

  await prisma.commissionRule.upsert({
    where: {
      affiliateLevel_planId: {
        affiliateLevel: AffiliateLevel.LEVEL_2,
        planId: individualPlan.id,
      },
    },
    update: { rewardAmount: 400 },
    create: {
      affiliateLevel: AffiliateLevel.LEVEL_2,
      planId: individualPlan.id,
      rewardAmount: 400,
    },
  })

  await prisma.commissionRule.upsert({
    where: {
      affiliateLevel_planId: {
        affiliateLevel: AffiliateLevel.LEVEL_2,
        planId: professionalPlan.id,
      },
    },
    update: { rewardAmount: 1000 },
    create: {
      affiliateLevel: AffiliateLevel.LEVEL_2,
      planId: professionalPlan.id,
      rewardAmount: 1000,
    },
  })

  await prisma.commissionRule.upsert({
    where: {
      affiliateLevel_planId: {
        affiliateLevel: AffiliateLevel.LEVEL_3,
        planId: individualPlan.id,
      },
    },
    update: { rewardAmount: 500 },
    create: {
      affiliateLevel: AffiliateLevel.LEVEL_3,
      planId: individualPlan.id,
      rewardAmount: 500,
    },
  })

  await prisma.commissionRule.upsert({
    where: {
      affiliateLevel_planId: {
        affiliateLevel: AffiliateLevel.LEVEL_3,
        planId: professionalPlan.id,
      },
    },
    update: { rewardAmount: 1300 },
    create: {
      affiliateLevel: AffiliateLevel.LEVEL_3,
      planId: professionalPlan.id,
      rewardAmount: 1300,
    },
  })

  await prisma.commissionRule.upsert({
    where: {
      affiliateLevel_planId: {
        affiliateLevel: AffiliateLevel.LEVEL_4,
        planId: individualPlan.id,
      },
    },
    update: { rewardAmount: 600 },
    create: {
      affiliateLevel: AffiliateLevel.LEVEL_4,
      planId: individualPlan.id,
      rewardAmount: 600,
    },
  })

  await prisma.commissionRule.upsert({
    where: {
      affiliateLevel_planId: {
        affiliateLevel: AffiliateLevel.LEVEL_4,
        planId: professionalPlan.id,
      },
    },
    update: { rewardAmount: 1500 },
    create: {
      affiliateLevel: AffiliateLevel.LEVEL_4,
      planId: professionalPlan.id,
      rewardAmount: 1500,
    },
  })

  console.log('✅ Product seeded:', leadCaptureProduct.name)
  console.log('✅ Plans and commission matrix seeded')
  console.log('🎉 Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
