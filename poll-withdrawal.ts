import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const id = '65c7caaa-1f13-48f1-ba9f-7b13152a4ad9'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  for (let i = 0; i < 24; i++) {
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `select "id", "status", "failureReason", "providerReference", "completedAt", "updatedAt" from "withdrawals" where "id"=$1 limit 1`,
      id
    )

    const row = rows[0] || null
    console.log(new Date().toISOString(), JSON.stringify(row))

    if (row && (row.status === 'completed' || row.status === 'failed')) {
      break
    }

    await sleep(5000)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
