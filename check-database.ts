/**
 * Check current database state
 */

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables from .env.local
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function checkDatabase() {
  try {
    console.log('🔍 Checking database state...\n')

    // Get all affiliates
    const affiliates = await prisma.affiliate.findMany({
      include: {
        referrals: true,
        links: true,
      },
    })

    console.log(`📊 Found ${affiliates.length} affiliate(s)\n`)

    for (const affiliate of affiliates) {
      console.log(`\n👤 Affiliate: ${affiliate.name} (${affiliate.email})`)
      console.log(`   ID: ${affiliate.id}`)
      console.log(`   Created: ${affiliate.createdAt.toISOString()}`)
      console.log(`   Links: ${affiliate.links.length}`)
      
      if (affiliate.referrals.length > 0) {
        console.log(`\n   💰 Referrals (${affiliate.referrals.length}):`)
        for (const ref of affiliate.referrals) {
          console.log(`      - User: ${ref.userEmail}`)
          console.log(`        Plan Type: ${ref.planType}`)
          console.log(`        Commission: ${ref.commissionAmount.toString()} KES`)
          console.log(`        Status: ${ref.status}`)
          console.log(`        Reference: ${ref.reference}`)
          console.log(`        Created: ${ref.createdAt.toISOString()}`)
          console.log('')
        }

        const totalEarnings = parseFloat((affiliate.totalEarned ?? 0).toString())
        const pendingBalance = parseFloat((affiliate.pendingBalance ?? 0).toString())
        const availableBalance = parseFloat((affiliate.availableBalance ?? 0).toString())
        
        console.log(`   📈 Total Earnings: ${totalEarnings} KES`)
        console.log(`   ⏳ Pending Balance: ${pendingBalance} KES`)
        console.log(`   💵 Available Balance: ${availableBalance} KES`)
      } else {
        console.log(`   ℹ️  No referrals yet`)
      }
    }

    // Check products
    const products = await prisma.product.findMany()
    console.log(`\n\n📦 Products (${products.length}):`)
    for (const product of products) {
      console.log(`   - ${product.name} (${product.slug})`)
      console.log(`     URL: ${product.url}`)
      console.log(`     Highlighted: ${product.isHighlighted}`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()
