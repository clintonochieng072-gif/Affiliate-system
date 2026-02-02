import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

/**
 * Referral redirect page
 * Validates referral code and redirects to target product
 * Code is logged for tracking when payment webhook arrives
 */
export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  
  // Verify the referral code exists
  const affiliateLink = await prisma.affiliateLink.findUnique({
    where: { referralCode: code },
    select: { id: true, productSlug: true },
  })

  // Even if code doesn't exist, still redirect to target
  // This prevents revealing valid vs invalid codes
  const targetUrl = process.env.TARGET_PRODUCT_URL || 'https://example.com'
  
  // If valid link exists, append referral code to URL as query param
  if (affiliateLink) {
    const url = new URL(targetUrl)
    url.searchParams.set('ref', code)
    redirect(url.toString())
  }

  // Invalid code - redirect without ref param
  redirect(targetUrl)
}
