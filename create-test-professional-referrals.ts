import { config } from 'dotenv'
import { AffiliateLevel, PrismaClient } from '@prisma/client'
import { ensureDefaultCommissionMatrix, getCommissionForPlanAndLevel } from './lib/commission'

config({ path: '.env.local' })

const prisma = new PrismaClient()

const TEST_EMAIL = 'clintonochieng072@gmail.com'

function sanitizeRefPart(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

async function main() {
  const earningsColumnRows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `select column_name from information_schema.columns where table_schema='public' and table_name='affiliates' and column_name in ('totalEarned','totalEarnings')`
  )

  const earningsColumn = earningsColumnRows.some((row) => row.column_name === 'totalEarnings')
    ? 'totalEarnings'
    : 'totalEarned'

  const affiliateRows = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      email: string
      name: string
      level: string
      availableBalance: number
      totalReferralsProfessional: number
    }>
  >(
    `select "id", "email", "name", "level", "availableBalance", "totalReferralsProfessional" from "affiliates" where "email" = $1 limit 1`,
    TEST_EMAIL
  )

  const affiliate = affiliateRows[0]

  if (!affiliate) {
    throw new Error(`Affiliate not found for email ${TEST_EMAIL}`)
  }

  if (!Object.values(AffiliateLevel).includes(affiliate.level as AffiliateLevel)) {
    throw new Error(`Unsupported affiliate level value: ${affiliate.level}`)
  }

  const affiliateLevel = affiliate.level as AffiliateLevel

  await ensureDefaultCommissionMatrix(prisma)

  const commissionLookup = await getCommissionForPlanAndLevel(prisma, 'Professional', affiliateLevel)
  if (!commissionLookup.plan || commissionLookup.rewardAmount === null) {
    throw new Error(`Professional commission rule not found for level ${affiliate.level}`)
  }

  const rewardAmount = commissionLookup.rewardAmount
  const refSeed = sanitizeRefPart(TEST_EMAIL)
  const references = [
    `TEST-PRO-${refSeed}-1`,
    `TEST-PRO-${refSeed}-2`,
  ]

  let createdCount = 0

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < references.length; index++) {
      const reference = references[index]
      const existingRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `select "id" from "referrals" where "reference" = $1 limit 1`,
        reference
      )

      if (existingRows.length > 0) {
        continue
      }

      await tx.$executeRawUnsafe(
        `insert into "referrals" ("id", "affiliateId", "planId", "planType", "clientName", "userEmail", "commissionAmount", "reference", "status", "referralDate", "createdAt") values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8::"ReferralStatus", now(), now())`,
        affiliate.id,
        commissionLookup.plan!.id,
        'Professional',
        `Test Professional Client ${index + 1}`,
        `test-prof-${index + 1}-${refSeed}@example.com`,
        rewardAmount,
        reference,
        'active'
      )

      createdCount += 1
    }

    if (createdCount > 0) {
      const increment = rewardAmount * createdCount
      await tx.$executeRawUnsafe(
        `update "affiliates" set "totalReferralsProfessional" = "totalReferralsProfessional" + $1, "availableBalance" = "availableBalance" + $2, "${earningsColumn}" = "${earningsColumn}" + $2 where "id" = $3`,
        createdCount,
        increment,
        affiliate.id
      )
    }
  })

  const updatedRows = await prisma.$queryRawUnsafe<
    Array<{
      email: string
      availableBalance: number
      totalReferralsProfessional: number
      totalEarnings: number | null
      totalEarned: number | null
    }>
  >(
    `select "email", "availableBalance", "totalReferralsProfessional", ${
      earningsColumn === 'totalEarnings' ? '"totalEarnings" as "totalEarnings", null::numeric as "totalEarned"' : 'null::numeric as "totalEarnings", "totalEarned" as "totalEarned"'
    } from "affiliates" where "id" = $1 limit 1`,
    affiliate.id
  )

  const updated = updatedRows[0]

  console.log('✅ Test referral provisioning completed')
  console.log({
    affiliate: updated?.email,
    createdProfessionalReferrals: createdCount,
    professionalCommissionPerReferral: rewardAmount,
    totalReferralsProfessional: Number(updated?.totalReferralsProfessional ?? 0),
    availableBalance: Number(updated?.availableBalance ?? 0),
    totalEarned: Number(updated?.totalEarnings ?? updated?.totalEarned ?? 0),
  })
}

main()
  .catch((error) => {
    console.error('❌ Failed to create test referrals:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
