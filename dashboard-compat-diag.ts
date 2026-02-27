import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const email = 'clintonochieng072@gmail.com'

async function runStep<T>(name: string, fn: () => Promise<T>) {
  try {
    const result = await fn()
    console.log(`✅ ${name}`)
    return result
  } catch (error) {
    console.error(`❌ ${name}`)
    console.error(error)
    throw error
  }
}

async function main() {
  const affiliateColumns = await runStep('affiliate columns', () =>
    prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `select column_name from information_schema.columns where table_schema='public' and table_name='affiliates'`
    )
  )

  const referralColumns = await runStep('referral columns', () =>
    prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `select column_name from information_schema.columns where table_schema='public' and table_name='referrals'`
    )
  )

  const hasTotalEarned = affiliateColumns.some((col) => col.column_name === 'totalEarned')
  const earningsColumn = hasTotalEarned ? 'totalEarned' : 'totalEarnings'
  const hasUserEmail = referralColumns.some((col) => col.column_name === 'userEmail')
  const referralEmailColumn = hasUserEmail ? 'userEmail' : 'clientEmail'

  const affiliateRows = await runStep('affiliate row', () =>
    prisma.$queryRawUnsafe<Array<any>>(
      `select
        "id","email","name","phone","level","role","isFrozen",
        "totalReferralsIndividual","totalReferralsProfessional","pendingBalance","availableBalance",
        "${earningsColumn}" as "totalSalesEarnings","level4EligibleAt","createdAt"
      from "affiliates" where "email"=$1 limit 1`,
      email
    )
  )

  const affiliate = affiliateRows[0]

  await runStep('leaderboard query', () =>
    prisma.$queryRawUnsafe<Array<any>>(
      `select "id", "name", "email", "level", "${earningsColumn}" as "totalEarnings", "totalReferralsIndividual", "totalReferralsProfessional", "createdAt"
       from "affiliates"
       where "role"::text = 'AFFILIATE'
       order by "${earningsColumn}" desc, "createdAt" asc
       limit 10`
    )
  )

  await runStep('links query', () =>
    prisma.$queryRawUnsafe<Array<any>>(
      `select "id", "productSlug", "referralCode", "createdAt" from "affiliate_links" where "affiliateId" = $1 order by "createdAt" desc`,
      affiliate.id
    )
  )

  await runStep('referrals query', () =>
    prisma.$queryRawUnsafe<Array<any>>(
      `select "id", "clientName", "${referralEmailColumn}" as "clientEmail", "planType", "commissionAmount", "status", "reference", "createdAt"
       from "referrals" where "affiliateId" = $1 order by "createdAt" desc limit 200`,
      affiliate.id
    )
  )

  await runStep('withdrawals query', () =>
    prisma.$queryRawUnsafe<Array<any>>(
      `select "id", "amount", "status", "mpesaNumber", "failureReason", "providerReference", "createdAt", "completedAt"
       from "withdrawals" where "affiliateId" = $1 order by "createdAt" desc limit 50`,
      affiliate.id
    )
  )

  await runStep('notifications query', () =>
    prisma.$queryRawUnsafe<Array<any>>(
      `select "id", "type", "title", "message", "isRead", "createdAt"
       from "notifications"
       where "affiliateId" = $1 and "roleTarget"::text = 'AFFILIATE'
       order by "createdAt" desc limit 10`,
      affiliate.id
    )
  )

  console.log('✅ compatibility diagnostics complete')
}

main().catch(() => process.exit(1)).finally(async () => prisma.$disconnect())
