import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productId } = await request.json()

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    // Get affiliate by email
    const affiliate = await prisma.affiliate.findUnique({
      where: { email: session.user.email }
    })

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
    }

    // Get product
    const product = await prisma.product.findUnique({
      where: { id: productId }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check if link already exists
    const existingLink = await prisma.affiliateLink.findUnique({
      where: {
        affiliateId_productId: {
          affiliateId: affiliate.id,
          productId: productId
        }
      }
    })

    if (existingLink) {
      // Return existing link
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      return NextResponse.json({
        link: existingLink,
        referralUrl: `${siteUrl}/r/${existingLink.referralCode}`
      })
    }

    // Generate unique referral code
    const referralCode = nanoid(10)

    // Create new affiliate link
    const link = await prisma.affiliateLink.create({
      data: {
        affiliateId: affiliate.id,
        productId: productId,
        productSlug: product.slug,
        referralCode: referralCode
      },
      include: {
        product: true
      }
    })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    return NextResponse.json({
      link,
      referralUrl: `${siteUrl}/r/${referralCode}`
    })
  } catch (error) {
    console.error('Error creating affiliate link:', error)
    return NextResponse.json({ error: 'Failed to create affiliate link' }, { status: 500 })
  }
}
