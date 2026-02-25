/**
 * Delete ALL referrals from the database
 * WARNING: This will permanently delete all referral records
 * Use with caution!
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

import { prisma } from './lib/prisma'

async function deleteAllReferrals() {
  try {
    console.log('⚠️  WARNING: This will delete ALL referrals from the database!\n')
    console.log('🔍 Checking current referrals...\n')

    // Count referrals before deletion
    const count = await prisma.referral.count()
    
    if (count === 0) {
      console.log('✅ No referrals found in the database.')
      return
    }

    console.log(`Found ${count} referral(s) in the database.\n`)

    // Get summary before deletion
    const referrals = await prisma.referral.findMany({
      include: {
        affiliate: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log('📋 Referrals to be deleted:\n')
    referrals.forEach((ref, index) => {
      console.log(`${index + 1}. ${ref.affiliate.name} (${ref.affiliate.email})`)
      console.log(`   User: ${ref.userEmail}`)
      console.log(`   Commission: ${ref.commissionAmount} KES`)
      console.log(`   Reference: ${ref.reference}`)
      console.log(`   Status: ${ref.status}`)
      console.log(`   Created: ${ref.createdAt.toLocaleString()}`)
      console.log('')
    })

    // Calculate total commission amount
    const totalCommission = referrals.reduce(
      (sum, ref) => sum + parseFloat(ref.commissionAmount.toString()),
      0
    )
    
    console.log(`💰 Total commission amount to be deleted: ${totalCommission} KES\n`)
    console.log('🗑️  Deleting all referrals...\n')

    // Delete all referrals
    const result = await prisma.referral.deleteMany({})

    console.log(`✅ Successfully deleted ${result.count} referral(s)`)
    console.log('\n⚠️  Note: Affiliate balances are NOT automatically updated.')
    console.log('⚠️  You may need to recalculate balances or reset them manually.\n')

  } catch (error) {
    console.error('❌ Error deleting referrals:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
deleteAllReferrals()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
