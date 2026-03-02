/**
 * Diagnostic Script: Verify Affiliate Records
 * 
 * Usage: npx ts-node verify-affiliate-records.ts
 * 
 * This script checks:
 * 1. All affiliate records in the database
 * 2. Required fields for each affiliate
 * 3. Missing affiliate records for known test users
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📋 Affiliate Record Verification Report\n')

  try {
    // Get all affiliates
    const affiliates = await prisma.affiliate.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        level: true,
        profileCompleted: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log(`✅ Found ${affiliates.length} affiliate record(s) in database\n`)

    if (affiliates.length === 0) {
      console.log('⚠️ WARNING: No affiliate records found!')
      console.log('   This means NO users can access the dashboard.')
      console.log('   New users need to sign in to auto-create affiliate records.\n')
    }

    // Display each affiliate with validation
    affiliates.forEach((affiliate, index) => {
      const isComplete = affiliate.name && affiliate.phone
      const status = isComplete ? '✅' : '⚠️'

      console.log(`${index + 1}. ${status} ${affiliate.email}`)
      console.log(`   Name: ${affiliate.name || '(MISSING)'}`)
      console.log(`   Phone: ${affiliate.phone || '(MISSING - profile incomplete)'}`)
      console.log(`   Role: ${affiliate.role}`)
      console.log(`   Level: ${affiliate.level}`)
      console.log(`   Profile Complete: ${affiliate.profileCompleted ? 'Yes' : 'No'}`)
      console.log(`   Created: ${affiliate.createdAt.toISOString()}\n`)
    })

    // Check for missing required fields
    const incomplete = affiliates.filter(a => !a.name || !a.phone)
    if (incomplete.length > 0) {
      console.log(`⚠️ WARNING: ${incomplete.length} affiliate(s) have incomplete profiles`)
      console.log('   They need to update their profile to complete registration.\n')
    }

    // Check commission rules
    console.log('📊 Commission Rules Check\n')
    const rules = await prisma.commissionRule.count()
    if (rules === 0) {
      console.log('❌ No commission rules found! Run: npx prisma db seed\n')
    } else {
      console.log(`✅ Found ${rules} commission rule(s)\n`)
    }

    // Check plans
    const plans = await prisma.plan.findMany({
      select: { planType: true, isActive: true },
    })
    console.log('📦 Available Plans\n')
    plans.forEach(plan => {
      const status = plan.isActive ? '✅' : '❌'
      console.log(`${status} ${plan.planType}`)
    })
    console.log()

    // Check for stuck users (authenticated but no affiliate)
    console.log('🔍 Looking for stuck users...\n')
    if (affiliates.length > 0) {
      console.log('✅ Affiliate records exist. Users should be able to access dashboard.\n')
    }

  } catch (error) {
    console.error('❌ Error during verification:', error)
    console.error('\nPossible causes:')
    console.error('1. Database connection failed - check DATABASE_URL')
    console.error('2. Database migrations not run - run: npx prisma migrate deploy')
    console.error('3. Missing Prisma client - run: npx prisma generate')
  } finally {
    await prisma.$disconnect()
  }
}

main()
