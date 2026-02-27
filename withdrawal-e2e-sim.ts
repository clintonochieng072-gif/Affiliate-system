import { PrismaClient } from '@prisma/client'
import { initiateDarajaB2CTransfer, normalizeKenyanPhoneForDaraja } from './lib/daraja'

const prisma = new PrismaClient()
const TEST_EMAIL = 'clintonochieng072@gmail.com'
const TEST_PHONE = '254708374149'
const TEST_AMOUNT = 600

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const affiliateRows = await prisma.$queryRawUnsafe<Array<{
    id: string
    email: string
    availableBalance: string
    phone: string | null
  }>>(
    `select "id", "email", "availableBalance", "phone" from "affiliates" where "email" = $1 limit 1`,
    TEST_EMAIL
  )

  const affiliate = affiliateRows[0]
  if (!affiliate) {
    throw new Error(`Affiliate not found: ${TEST_EMAIL}`)
  }

  const availableBalance = Number(affiliate.availableBalance || 0)
  if (availableBalance < TEST_AMOUNT) {
    throw new Error(`Insufficient balance for test. Available ${availableBalance}, required ${TEST_AMOUNT}`)
  }

  const rawPhone = affiliate.phone || TEST_PHONE
  const formattedPhone = normalizeKenyanPhoneForDaraja(rawPhone)

  const activeWithdrawalRows = await prisma.$queryRawUnsafe<Array<{ id: string; status: string }>>(
    `select "id", "status" from "withdrawals" where "affiliateId" = $1 and "status" in ('pending'::"WithdrawalStatus", 'processing'::"WithdrawalStatus") limit 1`,
    affiliate.id
  )

  if (activeWithdrawalRows.length > 0) {
    throw new Error(`Active withdrawal exists (${activeWithdrawalRows[0].id}, ${activeWithdrawalRows[0].status}). Complete it before running E2E simulation.`)
  }

  const createdRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `insert into "withdrawals" ("id", "affiliateId", "amount", "mpesaNumber", "status", "createdAt", "updatedAt")
     values (gen_random_uuid()::text, $1, $2, $3, 'pending'::"WithdrawalStatus", now(), now())
     returning "id"`,
    affiliate.id,
    TEST_AMOUNT,
    formattedPhone
  )

  const withdrawalId = createdRows[0].id

  await prisma.$executeRawUnsafe(
    `update "affiliates" set "availableBalance" = "availableBalance" - $1 where "id" = $2`,
    TEST_AMOUNT,
    affiliate.id
  )

  const darajaResponse = await initiateDarajaB2CTransfer({
    amount: TEST_AMOUNT,
    phoneNumber: formattedPhone,
    reference: withdrawalId,
    remarks: `E2E withdrawal simulation ${withdrawalId}`,
  })

  if (!darajaResponse.accepted) {
    const failureMessage = darajaResponse.responseDescription || darajaResponse.customerMessage || String(darajaResponse.raw?.errorMessage || 'Daraja rejected')

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `update "withdrawals" set "status" = 'failed'::"WithdrawalStatus", "failureReason" = $1, "providerReference" = $2, "updatedAt" = now() where "id" = $3`,
        failureMessage,
        darajaResponse.conversationId || null,
        withdrawalId
      )

      await tx.$executeRawUnsafe(
        `update "affiliates" set "availableBalance" = "availableBalance" + $1 where "id" = $2`,
        TEST_AMOUNT,
        affiliate.id
      )
    })

    console.log(JSON.stringify({
      stage: 'daraja-rejected',
      withdrawalId,
      daraja: {
        httpStatus: darajaResponse.httpStatus,
        responseCode: darajaResponse.responseCode,
        responseDescription: darajaResponse.responseDescription,
        customerMessage: darajaResponse.customerMessage,
        raw: darajaResponse.raw,
      },
    }, null, 2))
    return
  }

  await prisma.$executeRawUnsafe(
    `update "withdrawals" set "status" = 'processing'::"WithdrawalStatus", "providerReference" = $1, "failureReason" = null, "updatedAt" = now() where "id" = $2`,
    darajaResponse.conversationId || withdrawalId,
    withdrawalId
  )

  let finalRow: any = null
  for (let i = 0; i < 12; i++) {
    await sleep(5000)
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `select "id", "status", "failureReason", "providerReference", "completedAt", "updatedAt" from "withdrawals" where "id" = $1 limit 1`,
      withdrawalId
    )

    finalRow = rows[0]
    if (!finalRow) break
    if (finalRow.status === 'completed' || finalRow.status === 'failed') {
      break
    }
  }

  console.log(JSON.stringify({
    stage: 'submitted',
    withdrawalId,
    affiliateEmail: affiliate.email,
    amount: TEST_AMOUNT,
    phone: formattedPhone,
    daraja: {
      httpStatus: darajaResponse.httpStatus,
      responseCode: darajaResponse.responseCode,
      responseDescription: darajaResponse.responseDescription,
      conversationId: darajaResponse.conversationId,
      originatorConversationId: darajaResponse.originatorConversationId,
    },
    withdrawalAfterPolling: finalRow,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ stage: 'script-error', error: error instanceof Error ? error.message : String(error) }, null, 2))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
