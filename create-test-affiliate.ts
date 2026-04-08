import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config({ path: '.env.local' })

const prisma = new PrismaClient()

async function createTestAffiliate() {
  try {
    // Calculate balance: 2 Professional (7600 each) + 4 Individual (3700 each)
    const professionalEarnings = 2 * 7600 // 15200
    const individualEarnings = 4 * 3700   // 14800
    const totalBalance = professionalEarnings + individualEarnings // 30000

    const affiliate = await prisma.affiliate.upsert({
      where: { email: 'clintonochieng072@gmail.com' },
      update: {
        name: 'Clinton Ochieng',
        phone: '+254708374149', // Test phone number
        availableBalance: totalBalance,
        totalEarned: totalBalance,
        profileCompleted: true,
        role: 'AFFILIATE',
      },
      create: {
        email: 'clintonochieng072@gmail.com',
        name: 'Clinton Ochieng',
        phone: '+254708374149',
        availableBalance: totalBalance,
        totalEarned: totalBalance,
        profileCompleted: true,
        role: 'AFFILIATE',
      },
    })

    console.log('✅ Test affiliate created/updated:', {
      email: affiliate.email,
      availableBalance: affiliate.availableBalance,
      phone: affiliate.phone,
    })
  } catch (error) {
    console.error('❌ Error creating test affiliate:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestAffiliate()