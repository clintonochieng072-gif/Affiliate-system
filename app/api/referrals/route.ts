import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { decimalToNumber } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
    }

    const referrals = await prisma.referral.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        clientName: true,
        userEmail: true,
        planType: true,
        commissionAmount: true,
        status: true,
        createdAt: true,
        reference: true,
      },
    })

    return NextResponse.json({
      referrals: referrals.map(item => ({
        id: item.id,
        clientName: item.clientName || 'Unknown Client',
        clientEmail: item.userEmail,
        plan: item.planType,
        commission: decimalToNumber(item.commissionAmount),
        status: item.status,
        date: item.createdAt.toISOString(),
        reference: item.reference,
      })),
    })
  } catch (error) {
    return NextResponse.json({
      referrals: [],
      _meta: {
        degraded: true,
        message: 'Referral fallback response due to backend data error',
      },
    })
  }
}
