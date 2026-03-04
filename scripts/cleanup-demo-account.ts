import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const email = 'clintonochieng072@gmail.com'
  const affiliate = await prisma.affiliate.findUnique({ where: { email } })

  if (!affiliate) {
    console.log('Affiliate not found:', email)
    process.exit(0)
  }

  console.log('Cleaning demo data for affiliate id:', affiliate.id)

  try {
    await prisma.$transaction(async (tx) => {
      // Remove referrals created by the demo seeding pattern
      await tx.referral.deleteMany({
        where: {
          affiliateId: affiliate.id,
          OR: [
            { reference: { startsWith: 'demo-ref-' } },
            { userEmail: { contains: 'demo+' } },
            { clientName: { contains: 'Demo Client' } },
          ],
        },
      })

      // Remove affiliate links associated with demo affiliate or demo referral codes
      await tx.affiliateLink.deleteMany({
        where: {
          OR: [{ affiliateId: affiliate.id }, { referralCode: { startsWith: 'DEMO-' } }],
        },
      })

      // Remove demo product if it exists
      await tx.product.deleteMany({ where: { slug: 'demo-product' } })

      // Remove notifications tied to the affiliate (safe cleanup)
      await tx.notification.deleteMany({ where: { affiliateId: affiliate.id } })

      // Reset numeric fields and demo flag
      await tx.affiliate.update({
        where: { id: affiliate.id },
        data: {
          availableBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
          totalReferralsIndividual: 0,
          totalReferralsProfessional: 0,
          isDemoAccount: false,
        },
      })
    })

    const fresh = await prisma.affiliate.findUnique({ where: { id: affiliate.id } })
    console.log('Cleanup complete. Affiliate state:')
    console.log('  email:', fresh?.email)
    console.log('  availableBalance:', String(fresh?.availableBalance ?? '0'))
    console.log('  totalEarned:', String(fresh?.totalEarned ?? '0'))
    console.log('  totalWithdrawn:', String(fresh?.totalWithdrawn ?? '0'))
    console.log('  isDemoAccount:', String(fresh?.isDemoAccount ?? false))
  } catch (err) {
    console.error('Cleanup failed', err)
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
