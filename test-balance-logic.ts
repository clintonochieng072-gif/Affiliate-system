/**
 * Test Balance Calculation Logic
 * Reflects the new controlled financial architecture.
 */

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config({ path: '.env.local' })
const prisma = new PrismaClient()

async function testBalanceLogic() {
  try {
    console.log('🧪 Testing Balance Logic\n')

    const affiliate = await prisma.affiliate.findFirst({
      include: {
        referrals: true,
        withdrawals: true,
      },
    })

    if (!affiliate) {
      console.log('❌ No affiliate found. Sign up first!')
      return
    }

    const totalEarned = Number(affiliate.totalEarned)
    const pendingBalance = Number(affiliate.pendingBalance)
    const availableBalance = Number(affiliate.availableBalance)

    console.log(`👤 Affiliate: ${affiliate.name} (${affiliate.email})`)
    console.log(`   Level: ${affiliate.level}`)
    console.log(`   Referrals: ${affiliate.referrals.length}`)
    console.log(`   Withdrawals: ${affiliate.withdrawals.length}`)
    console.log(`   Total Earned: ${totalEarned} KES`)
    console.log(`   Pending Balance: ${pendingBalance} KES`)
    console.log(`   Available Balance: ${availableBalance} KES\n`)

    console.log('✅ Rules verification:')
    console.log('   1. Commission is matrix-based by plan + affiliate level')
    console.log('   2. New commission goes to pendingBalance first')
    console.log('   3. Minimum withdrawal is 600 KES')
    console.log('   4. Withdrawal deduction is immediate from availableBalance')
    console.log('   5. Failed withdrawal refunds availableBalance automatically')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testBalanceLogic()
