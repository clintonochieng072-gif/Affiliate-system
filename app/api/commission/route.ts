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
  agent_code?: string       // Sales agent code
  referrer_id?: string      // Legacy alias for backward compatibility
  user_email: string         // New user's email
  amount: number             // Sales earnings amount in KES (Kenya Shillings)
  reference: string          // Unique transaction reference (for idempotency)
  product_slug?: string      // Optional: specific product identifier
  metadata?: Record<string, any> // Optional: additional data
}

interface CommissionResponse {
  success: boolean
  salesEarning?: {
    id: string
    salesAgentId: string
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
 * Records a sales earning for a sales agent when a subscription converts
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

    const { agent_code, referrer_id, user_email, amount, reference, product_slug = 'default', metadata } = body
    const trackingCode = agent_code || referrer_id

    // Validate required fields
    if (!trackingCode || !user_email || !amount || !reference) {
      console.warn('⚠️ Missing required fields', { body })
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: agent_code, user_email, amount, reference' 
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
      agent_code: trackingCode,
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
          message: 'Sales earning already processed (idempotent)',
          salesEarning: {
            id: existingReferral.id,
            salesAgentId: existingReferral.affiliateId,
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

    // Step 4: Find sales agent by tracking code
    const affiliateLink = await prisma.affiliateLink.findUnique({
      where: { referralCode: trackingCode },
      include: { 
        affiliate: {
          select: { id: true, email: true, name: true }
        }
      },
    })

    if (!affiliateLink) {
      console.warn('⚠️ Invalid agent_code', { agent_code: trackingCode })
      return NextResponse.json(
        { success: false, error: 'Agent code not found' },
        { status: 404 }
      )
    }

    console.log('✅ Sales agent found', {
      salesAgentId: affiliateLink.affiliateId,
      salesAgentName: affiliateLink.affiliate.name,
      salesAgentEmail: affiliateLink.affiliate.email,
    })

    // Step 5: Create sales earning record in database
    const salesEarning = await prisma.referral.create({
      data: {
        affiliateId: affiliateLink.affiliateId,
        userEmail: user_email,
        productSlug: product_slug,
        amountPaid: amount,
        commissionAmount: amount, // Full amount goes to sales agent
        paymentReference: reference,
        status: 'paid', // Mark as paid for LCS completed registrations
      },
    })

    const duration = Date.now() - startTime

    console.log('✅ Sales earning recorded successfully', {
      salesEarningId: salesEarning.id,
      salesAgentId: salesEarning.affiliateId,
      userEmail: salesEarning.userEmail,
      amount: parseFloat(salesEarning.commissionAmount.toString()),
      reference: salesEarning.paymentReference,
      duration: `${duration}ms`,
    })

    // Step 6: Return success response
    return NextResponse.json(
      {
        success: true,
        salesEarning: {
          id: salesEarning.id,
          salesAgentId: salesEarning.affiliateId,
          userEmail: salesEarning.userEmail,
          amount: parseFloat(salesEarning.commissionAmount.toString()),
          reference: salesEarning.paymentReference,
          status: salesEarning.status,
          createdAt: salesEarning.createdAt.toISOString(),
        },
      },
      { status: 200 }
    )

  } catch (error: any) {
    const duration = Date.now() - startTime
    
    console.error('❌ Sales earning processing error', {
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
        { success: false, error: 'Invalid sales agent reference' },
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
    service: 'Sales Earnings API',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      POST: {
        description: 'Record a sales earning for a sales agent',
        authentication: 'Bearer token (WEBHOOK_SECRET)',
        payload: {
          agent_code: 'string (required) - Sales agent code',
          user_email: 'string (required) - New user email',
          amount: 'number (required) - Sales earnings amount',
          reference: 'string (required) - Unique transaction reference',
          product_slug: 'string (optional) - Product identifier',
          metadata: 'object (optional) - Additional data',
        },
        responses: {
          200: 'Sales earning recorded successfully',
          400: 'Invalid request payload',
          401: 'Unauthorized (invalid secret)',
          404: 'Agent code not found',
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
