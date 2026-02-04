/**
 * Fix User Balance Script
 * Updates clintonochieng072@gmail.com's referral commission from 1000 to 70 KES
 * 
 * Run with: npx tsx fix-user-balance.ts
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function fixUserBalance() {
  try {
    console.log('🔍 Finding user and their referrals...')
    
    // Find the affiliate
    const affiliate = await prisma.affiliate.findUnique({
      where: { email: 'clintonochieng072@gmail.com' },
      include: {
        referrals: true,
      },
    })

    if (!affiliate) {
      console.log('❌ User not found')
      return
    }

    console.log(`✅ Found affiliate: ${affiliate.name} (${affiliate.email})`)
    console.log(`📊 Current referrals: ${affiliate.referrals.length}`)

    // Update all referrals with incorrect commission amounts
    let updatedCount = 0
    for (const referral of affiliate.referrals) {
      const currentAmount = parseFloat(referral.commissionAmount.toString())
      
      if (currentAmount !== 70) {
        console.log(`\n📝 Updating referral ${referral.id}:`)
        console.log(`   Old commission: ${currentAmount} KES`)
        console.log(`   New commission: 70 KES`)
        
        await prisma.referral.update({
          where: { id: referral.id },
          data: {
            commissionAmount: 70,
          },
        })
        
        updatedCount++
      }
    }

    console.log(`\n✅ Updated ${updatedCount} referral(s)`)
    
    // Calculate new balance
    const totalReferrals = affiliate.referrals.length
    const newBalance = totalReferrals * 70
    
    console.log(`\n💰 New balance calculation:`)
    console.log(`   Total referrals: ${totalReferrals}`)
    console.log(`   Commission per referral: 70 KES`)
    console.log(`   Total balance: ${newBalance} KES`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixUserBalance()
