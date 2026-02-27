import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ role: string | null; cnt: number }>>(
    `select "role"::text as role, count(*)::int as cnt from "affiliates" group by "role"::text order by cnt desc`
  )
  console.log(JSON.stringify(rows, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
