import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

/**
 * Sales Link Redirect Page
 * Format: https://affiliate.clintonstack.com/s/{uniqueUserCode}
 * 
 * Tracks Lead Capture SaaS sales for authenticated users.
 */
export default async function SalesLinkRedirectPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  
  // Verify the sales code exists
  const trackingLink = await prisma.affiliateLink.findUnique({
    where: { referralCode: code },
    select: { id: true, productSlug: true },
  })

  // Target product URL - Lead Capture SaaS
  const targetUrl = process.env.TARGET_PRODUCT_URL || 'https://leads.clintonstack.com'
  
  // If valid sales link exists, append tracking code to URL as query param
  if (trackingLink) {
    const url = new URL(targetUrl)
    url.searchParams.set('ref', code)
    redirect(url.toString())
  }

  // Invalid code - redirect without ref param
  redirect(targetUrl)
}
