import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Commission API Endpoint
 * 
 * Secure endpoint for external SaaS products (like Lead Capture System) to record commissions
 * Features:
 * - Request validation with shared secret
 * - Idempotency (prevents duplicate commissions)
 * - Modular design (supports multiple SaaS products)
 * - Comprehensive logging
 * - Transaction safety
 */

interface CommissionPayload {
  referrer_id: string       // Affiliate's referral code
  user_email: string         // New user's email
  amount: number             // Commission amount in minor units (e.g., kobo)
  reference: string          // Unique transaction reference (for idempotency)
  product_slug?: string      // Optional: specific product identifier
  metadata?: Record<string, any> // Optional: additional data
}

interface CommissionResponse {
  success: boolean
  commission?: {
    id: string
    affiliateId: string
    userEmail: string
    amount: number
    reference: string
    status: string
    createdAt: string
  }
  message?: string
  error?: string
}

/**
 * POST /api/commission
 * Records a commission for an affiliate when a referral converts
 */
export async function POST(request: NextRequest): Promise<NextResponse<CommissionResponse>> {
  const startTime = Date.now()
  
  try {
    // Step 1: Validate webhook secret
    const authHeader = request.headers.get('authorization')
    const webhookSecret = process.env.WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error('❌ WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (!authHeader || authHeader !== `Bearer ${webhookSecret}`) {
      console.warn('⚠️ Unauthorized commission request attempt', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        authHeader: authHeader ? 'present (invalid)' : 'missing',
      })
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Step 2: Parse and validate request body
    let body: CommissionPayload
    try {
      body = await request.json()
    } catch (error) {
      console.error('❌ Invalid JSON payload')
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    const { referrer_id, user_email, amount, reference, product_slug = 'default', metadata } = body

    // Validate required fields
    if (!referrer_id || !user_email || !amount || !reference) {
      console.warn('⚠️ Missing required fields', { body })
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: referrer_id, user_email, amount, reference' 
        },
        { status: 400 }
      )
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      console.warn('⚠️ Invalid amount', { amount })
      return NextResponse.json(
        { success: false, error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(user_email)) {
      console.warn('⚠️ Invalid email format', { user_email })
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    console.log('📥 Commission request received', {
      referrer_id,
      user_email,
      amount,
      reference,
      product_slug,
    })

    // Step 3: Check for duplicate transaction (idempotency)
    const existingReferral = await prisma.referral.findUnique({
      where: { paymentReference: reference },
      select: { 
        id: true, 
        affiliateId: true, 
        status: true,
        createdAt: true,
      },
    })

    if (existingReferral) {
      console.log('⚠️ Duplicate commission request detected', {
        reference,
        existingReferralId: existingReferral.id,
        existingAffiliateId: existingReferral.affiliateId,
      })
      
      return NextResponse.json(
        {
          success: true,
          message: 'Commission already processed (idempotent)',
          commission: {
            id: existingReferral.id,
            affiliateId: existingReferral.affiliateId,
            userEmail: user_email,
            amount: amount,
            reference: reference,
            status: existingReferral.status,
            createdAt: existingReferral.createdAt.toISOString(),
          },
        },
        { status: 200 }
      )
    }

    // Step 4: Find affiliate by referrer_id (referral code)
    const affiliateLink = await prisma.affiliateLink.findUnique({
      where: { referralCode: referrer_id },
      include: { 
        affiliate: {
          select: { id: true, email: true, name: true }
        }
      },
    })

    if (!affiliateLink) {
      console.warn('⚠️ Invalid referrer_id', { referrer_id })
      return NextResponse.json(
        { success: false, error: 'Referrer ID not found' },
        { status: 404 }
      )
    }

    console.log('✅ Affiliate found', {
      affiliateId: affiliateLink.affiliateId,
      affiliateName: affiliateLink.affiliate.name,
      affiliateEmail: affiliateLink.affiliate.email,
    })

    // Step 5: Create commission record in database
    const commission = await prisma.referral.create({
      data: {
        affiliateId: affiliateLink.affiliateId,
        userEmail: user_email,
        productSlug: product_slug,
        amountPaid: amount,
        commissionAmount: amount, // Full amount goes to affiliate
        paymentReference: reference,
        status: 'paid', // Mark as paid for LCS completed registrations
      },
    })

    const duration = Date.now() - startTime

    console.log('✅ Commission recorded successfully', {
      commissionId: commission.id,
      affiliateId: commission.affiliateId,
      userEmail: commission.userEmail,
      amount: parseFloat(commission.commissionAmount.toString()),
      reference: commission.paymentReference,
      duration: `${duration}ms`,
    })

    // Step 6: Return success response
    return NextResponse.json(
      {
        success: true,
        commission: {
          id: commission.id,
          affiliateId: commission.affiliateId,
          userEmail: commission.userEmail,
          amount: parseFloat(commission.commissionAmount.toString()),
          reference: commission.paymentReference,
          status: commission.status,
          createdAt: commission.createdAt.toISOString(),
        },
      },
      { status: 200 }
    )

  } catch (error: any) {
    const duration = Date.now() - startTime
    
    console.error('❌ Commission processing error', {
      error: error.message,
      code: error.code,
      duration: `${duration}ms`,
      stack: error.stack,
    })

    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      // Unique constraint violation (shouldn't happen due to idempotency check)
      return NextResponse.json(
        { success: false, error: 'Duplicate transaction reference' },
        { status: 409 }
      )
    }

    if (error.code === 'P2003') {
      // Foreign key constraint violation
      return NextResponse.json(
        { success: false, error: 'Invalid affiliate reference' },
        { status: 400 }
      )
    }

    // Generic error response
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/commission
 * Health check and documentation endpoint
 */
export async function GET() {
  return NextResponse.json({
    service: 'Affiliate Commission API',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      POST: {
        description: 'Record a commission for an affiliate',
        authentication: 'Bearer token (WEBHOOK_SECRET)',
        payload: {
          referrer_id: 'string (required) - Affiliate referral code',
          user_email: 'string (required) - New user email',
          amount: 'number (required) - Commission amount',
          reference: 'string (required) - Unique transaction reference',
          product_slug: 'string (optional) - Product identifier',
          metadata: 'object (optional) - Additional data',
        },
        responses: {
          200: 'Commission recorded successfully',
          400: 'Invalid request payload',
          401: 'Unauthorized (invalid secret)',
          404: 'Referrer ID not found',
          409: 'Duplicate transaction',
          500: 'Server error',
        },
      },
    },
    features: [
      'Secure authentication with Bearer token',
      'Idempotency (duplicate prevention)',
      'Comprehensive logging',
      'Transaction safety',
      'Multi-product support',
    ],
  })
}
