import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getCommissionForPlanAndLevel } from '@/lib/commission'

interface CommissionPayload {
  agent_code?: string
  user_email?: string
  plan_type?: string
  reference?: string
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const webhookSecret = process.env.WEBHOOK_SECRET

    if (!webhookSecret) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (!authHeader || authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let body: CommissionPayload
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }
    const { agent_code, user_email, plan_type, reference } = body

    if (!agent_code || !user_email || !plan_type || !reference) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: agent_code, user_email, plan_type, reference',
        },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(user_email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const existingReferral = await prisma.referral.findUnique({
      where: { reference },
      select: {
        id: true,
        affiliateId: true,
        planType: true,
        commissionAmount: true,
        status: true,
        createdAt: true,
      },
    })

    if (existingReferral) {
      return NextResponse.json(
        {
          success: true,
          message: 'Activation already processed (idempotent)',
          commission: {
            id: existingReferral.id,
            affiliateId: existingReferral.affiliateId,
            planType: existingReferral.planType,
            amount: Number(existingReferral.commissionAmount),
            reference,
            status: existingReferral.status,
            createdAt: existingReferral.createdAt.toISOString(),
          },
        },
        { status: 200 }
      )
    }

    const affiliateLink = await prisma.affiliateLink.findUnique({
      where: { referralCode: agent_code },
      include: {
        affiliate: {
          select: {
            id: true,
            level: true,
          },
        },
      },
    })

    if (!affiliateLink) {
      return NextResponse.json(
        { success: false, error: 'Agent code not found' },
        { status: 404 }
      )
    }

    const commissionLookup = await getCommissionForPlanAndLevel(
      prisma,
      plan_type,
      affiliateLink.affiliate.level
    )

    if (!commissionLookup.plan) {
      return NextResponse.json(
        { success: false, error: 'Plan type not found' },
        { status: 422 }
      )
    }

    if (commissionLookup.rewardAmount === null) {
      return NextResponse.json(
        { success: false, error: 'No commission rule configured for this affiliate level and plan' },
        { status: 422 }
      )
    }

    const rewardAmount = commissionLookup.rewardAmount

    const created = await prisma.$transaction(async (tx) => {
      const referral = await tx.referral.create({
        data: {
          affiliateId: affiliateLink.affiliate.id,
          planId: commissionLookup.plan!.id,
          planType: commissionLookup.plan!.planType,
          userEmail: user_email,
          commissionAmount: rewardAmount,
          reference,
          status: 'pending',
        },
      })

      const updatedAffiliate = await tx.affiliate.update({
        where: { id: affiliateLink.affiliate.id },
        data: {
          pendingBalance: { increment: rewardAmount },
          totalEarned: { increment: rewardAmount },
        },
        select: {
          pendingBalance: true,
          availableBalance: true,
          totalEarned: true,
        },
      })

      return { referral, updatedAffiliate }
    })

    return NextResponse.json({
      success: true,
      message: 'Activation processed and commission queued to pending balance',
      commission: {
        id: created.referral.id,
        affiliateId: created.referral.affiliateId,
        planType: created.referral.planType,
        amount: Number(created.referral.commissionAmount),
        reference: created.referral.reference,
        status: created.referral.status,
        createdAt: created.referral.createdAt.toISOString(),
      },
      balances: {
        pendingBalance: Number(created.updatedAffiliate.pendingBalance),
        availableBalance: Number(created.updatedAffiliate.availableBalance),
        totalEarned: Number(created.updatedAffiliate.totalEarned),
      },
    })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: true, message: 'Activation already processed (idempotent)' },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Commission Activation API',
    version: '2.0.0',
    authentication: 'Bearer token (WEBHOOK_SECRET)',
    payload: {
      agent_code: 'string (required)',
      user_email: 'string (required)',
      plan_type: 'string (required)',
      reference: 'string (required, idempotency key)',
    },
    notes: [
      'Do not send monetary amounts from LCS',
      'Commission is computed inside Affiliate System from plan + affiliate level',
      'Rewards are credited to pendingBalance first',
    ],
  })
}
