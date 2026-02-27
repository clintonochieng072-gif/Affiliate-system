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

    const { searchParams } = new URL(request.url)
    const full = searchParams.get('full') === 'true'
    const take = full ? 200 : 10

    const affiliates = await prisma.affiliate.findMany({
      where: { role: 'AFFILIATE' },
      orderBy: [{ totalEarned: 'desc' }, { createdAt: 'asc' }],
      take,
      select: {
        id: true,
        name: true,
        level: true,
        totalEarned: true,
        totalReferralsIndividual: true,
        totalReferralsProfessional: true,
      },
    })

    return NextResponse.json({
      topPerformers: affiliates.map((affiliate, index) => ({
        rank: index + 1,
        id: affiliate.id,
        name: affiliate.name,
        level: affiliate.level,
        totalReferrals: affiliate.totalReferralsIndividual + affiliate.totalReferralsProfessional,
        totalReferralsIndividual: affiliate.totalReferralsIndividual,
        totalReferralsProfessional: affiliate.totalReferralsProfessional,
        totalEarnings: decimalToNumber(affiliate.totalEarned),
      })),
      full,
    })
  } catch (error) {
    return NextResponse.json({
      topPerformers: [],
      full: false,
      _meta: {
        degraded: true,
        message: 'Leaderboard fallback response due to backend data error',
      },
    })
  }
}
