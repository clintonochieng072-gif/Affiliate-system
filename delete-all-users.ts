/**
 * Delete ALL users and data from the system
 * WARNING: This will permanently delete all data!
 */

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables from .env.local
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function deleteAllData() {
  try {
    console.log('⚠️  WARNING: This will delete ALL data from the database!')
    console.log('🗑️  Starting deletion process...\n')

    // Delete in order to respect foreign key constraints
    // Delete child records first, then parent records

    // 1. Delete all withdrawals
    const deletedWithdrawals = await prisma.withdrawal.deleteMany({})
    console.log(`✅ Deleted ${deletedWithdrawals.count} withdrawal(s)`)

    // 2. Delete all referrals
    const deletedReferrals = await prisma.referral.deleteMany({})
    console.log(`✅ Deleted ${deletedReferrals.count} referral(s)`)

    // 3. Delete all payouts
    const deletedPayouts = await prisma.payout.deleteMany({})
    console.log(`✅ Deleted ${deletedPayouts.count} payout(s)`)

    // 4. Delete all affiliate links
    const deletedLinks = await prisma.affiliateLink.deleteMany({})
    console.log(`✅ Deleted ${deletedLinks.count} affiliate link(s)`)

    // 5. Delete all affiliates (users)
    const deletedAffiliates = await prisma.affiliate.deleteMany({})
    console.log(`✅ Deleted ${deletedAffiliates.count} affiliate(s)`)

    // 6. Delete all products (optional - you may want to keep these)
    const deletedProducts = await prisma.product.deleteMany({})
    console.log(`✅ Deleted ${deletedProducts.count} product(s)`)

    console.log('\n🎉 All data deleted successfully!')
    console.log('\n📊 Summary:')
    console.log(`   - Affiliates: ${deletedAffiliates.count}`)
    console.log(`   - Affiliate Links: ${deletedLinks.count}`)
    console.log(`   - Referrals: ${deletedReferrals.count}`)
    console.log(`   - Withdrawals: ${deletedWithdrawals.count}`)
    console.log(`   - Payouts: ${deletedPayouts.count}`)
    console.log(`   - Products: ${deletedProducts.count}`)
    console.log('\n✨ Database is now empty and ready for fresh start!')

  } catch (error) {
    console.error('❌ Error deleting data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the deletion
deleteAllData()
