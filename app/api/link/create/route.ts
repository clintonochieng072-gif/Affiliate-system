import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { getSalesTrackingUrl } from '@/lib/url'

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

    // Get sales agent by email
    const salesAgent = await prisma.affiliate.findUnique({
      where: { email: session.user.email }
    })

    if (!salesAgent) {
      return NextResponse.json({ error: 'Sales agent not found' }, { status: 404 })
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
          affiliateId: salesAgent.id,
          productId: productId
        }
      }
    })

    if (existingLink) {
      // Return existing link
      return NextResponse.json({
        link: existingLink,
        salesTrackingUrl: getSalesTrackingUrl(existingLink.referralCode, request)
      })
    }

    // Generate unique referral code
    const referralCode = nanoid(10)

    // Create new affiliate link
    const link = await prisma.affiliateLink.create({
      data: {
        affiliateId: salesAgent.id,
        productId: productId,
        productSlug: product.slug,
        referralCode: referralCode
      },
      include: {
        product: true
      }
    })

    return NextResponse.json({
      link,
      salesTrackingUrl: getSalesTrackingUrl(referralCode, request)
    })
  } catch (error) {
    console.error('Error creating sales tracking link:', error)
    return NextResponse.json({ error: 'Failed to create sales tracking link' }, { status: 500 })
  }
}
