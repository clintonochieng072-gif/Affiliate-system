import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Load environment variables from .env.local
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create Lead Capture System product
  const leadCaptureProduct = await prisma.product.upsert({
    where: { slug: 'lead-capture-system' },
    update: {},
    create: {
      slug: 'lead-capture-system',
      name: 'Lead Capture System',
      description: 'The #1 tool for capturing and converting leads. Beautiful customizable forms, automated follow-ups, real-time analytics, and CRM integrations.',
      url: 'https://leads.clintonstack.com',
      isHighlighted: true,
    },
  })

  console.log('✅ Created product:', leadCaptureProduct.name)

  // You can add more products here in the future
  /*
  const anotherProduct = await prisma.product.create({
    data: {
      slug: 'another-product',
      name: 'Another Product',
      description: 'Description of another product',
      url: 'https://example.com',
      isHighlighted: false,
    },
  })
  console.log('✅ Created product:', anotherProduct.name)
  */

  console.log('🎉 Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
