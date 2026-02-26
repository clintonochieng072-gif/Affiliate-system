import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { decimalToNumber } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
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
        phone: true,
        email: true,
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
        phone: affiliate.phone,
        email: affiliate.email,
        level: affiliate.level,
        totalReferrals: affiliate.totalReferralsIndividual + affiliate.totalReferralsProfessional,
        totalReferralsIndividual: affiliate.totalReferralsIndividual,
        totalReferralsProfessional: affiliate.totalReferralsProfessional,
        totalEarnings: decimalToNumber(affiliate.totalEarned),
      })),
      full,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
