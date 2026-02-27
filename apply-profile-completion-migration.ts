import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "profileCompleted" BOOLEAN NOT NULL DEFAULT false`
  )

  await prisma.$executeRawUnsafe(
    `UPDATE "affiliates" SET "profileCompleted" = true WHERE COALESCE(TRIM("name"), '') <> '' AND COALESCE(TRIM("phone"), '') <> ''`
  )

  const rows = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int as count_completed FROM "affiliates" WHERE "profileCompleted" = true`
  )

  console.log(rows)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
