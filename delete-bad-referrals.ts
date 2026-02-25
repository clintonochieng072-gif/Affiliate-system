/**
 * Delete specific bad referral with 1000 KES
 */

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables from .env.local
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function deleteBadReferral() {
  try {
    console.log('🔍 Finding and deleting bad 1000 KES referral...\n')

    // Find all referrals with 1000 KES
    const badReferrals = await prisma.referral.findMany({
      where: {
        commissionAmount: 1000,
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

    if (badReferrals.length === 0) {
      console.log('✅ No bad referrals found!')
      return
    }

    console.log(`⚠️  Found ${badReferrals.length} referral(s) with 1000 KES:\n`)

    for (const ref of badReferrals) {
      console.log(`   - Affiliate: ${ref.affiliate.name} (${ref.affiliate.email})`)
      console.log(`     User: ${ref.userEmail}`)
      console.log(`     Amount: ${ref.commissionAmount.toString()} KES`)
      console.log(`     Reference: ${ref.reference}`)
      console.log(`     Status: ${ref.status}`)
      console.log(`     Created: ${ref.createdAt.toISOString()}\n`)
    }

    // Delete all bad referrals
    const result = await prisma.referral.deleteMany({
      where: {
        commissionAmount: 1000,
      },
    })

    console.log(`✅ Deleted ${result.count} bad referral(s) with 1000 KES`)
    console.log('\n🎉 Database cleaned! Only 70 KES commissions should remain.')

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

deleteBadReferral()
