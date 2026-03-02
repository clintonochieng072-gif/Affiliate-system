import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config({ path: '.env.local' })

const prisma = new PrismaClient()

async function check() {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: 'lead-capture-system' }
    })
    console.log('✅ Product restored:', product)
    
    const plans = await prisma.plan.findMany()
    console.log('\n✅ Plans:')
    plans.forEach(p => console.log(`   - ${p.planType}: ${p.name}`))
    
    const rules = await prisma.commissionRule.count()
    console.log(`\n✅ Commission Rules: ${rules}`)
    
  } finally {
    await prisma.$disconnect()
  }
}

check()
