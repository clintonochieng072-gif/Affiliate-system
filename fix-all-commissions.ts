/**
 * Fix ALL commission amounts to 70 KES
 * This removes any 1000 KES placeholder values from the database
 */

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables from .env.local
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function fixAllCommissions() {
  try {
    console.log('🔍 Finding all referrals with incorrect commissions...\n')

    // Find all referrals with commission amounts that are not 70 or 10
    const incorrectReferrals = await prisma.referral.findMany({
      where: {
        AND: [
          { commissionAmount: { not: 70 } },
          { commissionAmount: { not: 10 } },
        ],
      },
      include: {
        affiliate: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (incorrectReferrals.length === 0) {
      console.log('✅ No incorrect commissions found. All good!')
      return
    }

    console.log(`⚠️  Found ${incorrectReferrals.length} referral(s) with incorrect commissions:\n`)

    // Display all incorrect referrals
    for (const referral of incorrectReferrals) {
      console.log(`   Affiliate: ${referral.affiliate.name} (${referral.affiliate.email})`)
      console.log(`   Current commission: ${referral.commissionAmount} KES`)
      console.log(`   User email: ${referral.userEmail}`)
      console.log(`   Status: ${referral.status}`)
      console.log(`   Created: ${referral.createdAt.toISOString()}`)
      console.log('')
    }

    // Update all incorrect commissions to 70 KES
    console.log('🔧 Updating all incorrect commissions to 70 KES...\n')

    const result = await prisma.referral.updateMany({
      where: {
        AND: [
          { commissionAmount: { not: 70 } },
          { commissionAmount: { not: 10 } },
        ],
      },
      data: {
        commissionAmount: 70,
      },
    })

    console.log(`✅ Updated ${result.count} referral(s) to 70 KES\n`)

    // Calculate new balances for affected affiliates
    const affectedAffiliates = [...new Set(incorrectReferrals.map(r => r.affiliateId))]

    console.log('💰 New balance calculations:\n')

    for (const affiliateId of affectedAffiliates) {
      const affiliate = await prisma.affiliate.findUnique({
        where: { id: affiliateId },
        include: {
          referrals: {
            where: { status: 'paid' },
          },
          withdrawals: {
            where: {
              status: {
                in: ['completed', 'processing'],
              },
            },
          },
        },
      })

      if (affiliate) {
        const totalEarnings = affiliate.referrals.reduce(
          (sum, ref) => sum + parseFloat(ref.commissionAmount.toString()),
          0
        )
        const totalWithdrawn = affiliate.withdrawals.reduce(
          (sum, w) => sum + parseFloat(w.requestedAmount.toString()),
          0
        )
        const availableBalance = totalEarnings - totalWithdrawn

        console.log(`   ${affiliate.name} (${affiliate.email}):`)
        console.log(`   - Total referrals: ${affiliate.referrals.length}`)
        console.log(`   - Total earnings: ${totalEarnings} KES`)
        console.log(`   - Total withdrawn: ${totalWithdrawn} KES`)
        console.log(`   - Available balance: ${availableBalance} KES`)
        console.log('')
      }
    }

    console.log('✅ All commissions fixed!')
    console.log('\n🎯 Next steps:')
    console.log('   1. Rebuild the app: npm run build')
    console.log('   2. Push to GitHub: git add . && git commit -m "Fix all commission amounts" && git push')
    console.log('   3. Check dashboard to verify balances are correct')

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixAllCommissions()
