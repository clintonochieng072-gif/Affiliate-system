import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const affiliateColumns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `select column_name from information_schema.columns where table_schema='public' and table_name='affiliates'`
  )

  const hasTotalEarned = affiliateColumns.some((col) => col.column_name === 'totalEarned')
  const earningsColumn = hasTotalEarned ? 'totalEarned' : 'totalEarnings'

  const affiliates = await prisma.$queryRawUnsafe<Array<any>>(
    `select "id", "name", "email", "level", "totalReferralsIndividual", "totalReferralsProfessional", "${earningsColumn}" as "totalEarnings", "createdAt"
     from "affiliates"
      where lower("role"::text) = 'affiliate'
     order by "${earningsColumn}" desc, "createdAt" asc
     limit 10`
  )

  console.log(JSON.stringify({
    count: affiliates.length,
    topPerformers: affiliates.map((affiliate, index) => ({
      rank: index + 1,
      id: affiliate.id,
      name: affiliate.name,
      email: affiliate.email,
      totalEarnings: Number(affiliate.totalEarnings || 0),
      totalReferrals: Number(affiliate.totalReferralsIndividual || 0) + Number(affiliate.totalReferralsProfessional || 0),
    })),
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
