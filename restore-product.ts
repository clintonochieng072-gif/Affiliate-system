import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config({ path: '.env.local' })

const prisma = new PrismaClient()

async function restoreProduct() {
  try {
    console.log('🔄 Restoring product...\n')

    const product = await prisma.product.upsert({
      where: { slug: 'lead-capture-system' },
      update: {},
      create: {
        slug: 'lead-capture-system',
        name: 'Lead Capture System',
        description:
          'The #1 tool for capturing and converting leads. Beautiful customizable forms, automated follow-ups, real-time analytics, and CRM integrations.',
        url: 'https://leads.clintonstack.com',
        isHighlighted: true,
      },
    })

    console.log('✅ Product restored successfully:')
    console.log(`   Name: ${product.name}`)
    console.log(`   Slug: ${product.slug}`)
    console.log(`   URL: ${product.url}`)
    console.log(`   Highlighted: ${product.isHighlighted}\n`)

    const allProducts = await prisma.product.findMany()
    console.log(`📦 Total products in database: ${allProducts.length}`)

  } finally {
    await prisma.$disconnect()
  }
}

restoreProduct()
