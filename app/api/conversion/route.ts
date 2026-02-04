import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Referral Webhook API Route
 * Handles successful payment webhooks from SaaS payment system
 * Records referral and calculates commission
 */

interface ReferralWebhookPayload {
  referral_code: string
  user_email: string
  product_slug: string
  amount_paid: number
  payment_reference: string
  commission_rate?: number // Optional, defaults to 20%
}

export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret
    const authHeader = request.headers.get('authorization')
    const webhookSecret = process.env.WEBHOOK_SECRET

    if (!webhookSecret || authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body: ReferralWebhookPayload = await request.json()
    const { 
      referral_code, 
      user_email, 
      product_slug, 
      amount_paid, 
      payment_reference,
      commission_rate = 1.0 // Default 100% - full amount goes to affiliate (LCS sends commission amount directly)
    } = body

    // Validate required fields
    if (!referral_code || !user_email || !product_slug || !amount_paid || !payment_reference) {
      return NextResponse.json(
        { error: 'Missing required fields: referral_code, user_email, product_slug, amount_paid, payment_reference' },
        { status: 400 }
      )
    }

    // Calculate commission
    const commissionAmount = amount_paid * commission_rate

    // IMPORTANT: Validate commission amount is 70 KES (or 10 KES for test)
    if (commissionAmount !== 70 && commissionAmount !== 10) {
      console.error('⚠️ Invalid commission amount calculated', {
        amount_paid,
        commission_rate,
        commissionAmount,
        expected: '70 KES or 10 KES (test)',
      })
      return NextResponse.json(
        { error: `Invalid commission amount: ${commissionAmount} KES. Expected 70 KES per referral. Use /api/commission endpoint instead with amount=70` },
        { status: 400 }
      )
    }

    // Find affiliate link by referral code
    const affiliateLink = await prisma.affiliateLink.findUnique({
      where: { referralCode: referral_code },
      include: { affiliate: true },
    })

    if (!affiliateLink) {
      return NextResponse.json(
        { error: 'Referral code not found' },
        { status: 404 }
      )
    }

    // Create referral record with transaction safety
    const referral = await prisma.referral.create({
      data: {
        affiliateId: affiliateLink.affiliateId,
        userEmail: user_email,
        productSlug: product_slug,
        amountPaid: amount_paid,
        commissionAmount: commissionAmount,
        paymentReference: payment_reference,
        status: 'paid', // Mark as paid immediately for completed payments
      },
    })

    return NextResponse.json({
      success: true,
      referral: {
        id: referral.id,
        affiliateId: referral.affiliateId,
        userEmail: referral.userEmail,
        productSlug: referral.productSlug,
        amountPaid: parseFloat(referral.amountPaid.toString()),
        commissionAmount: parseFloat(referral.commissionAmount.toString()),
        paymentReference: referral.paymentReference,
        status: referral.status,
        createdAt: referral.createdAt,
      },
    })

  } catch (error: any) {
    console.error('Referral webhook error:', error)
    
    // Handle duplicate payment reference
    if (error.code === 'P2002' && error.meta?.target?.includes('paymentReference')) {
      return NextResponse.json(
        { error: 'Payment reference already processed' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
