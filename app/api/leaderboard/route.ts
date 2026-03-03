import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  let signedInEmail = ''

  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    signedInEmail = session.user.email

    const { searchParams } = new URL(request.url)
    const full = searchParams.get('full') === 'true'
    const take = full ? 200 : 10

    const affiliateColumns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `select column_name from information_schema.columns where table_schema='public' and table_name='affiliates'`
    )

    const hasTotalEarned = affiliateColumns.some((col) => col.column_name === 'totalEarned')
    const earningsColumn = hasTotalEarned ? 'totalEarned' : 'totalEarnings'

    const affiliates = await prisma.$queryRawUnsafe<Array<any>>(
      `select "id", "name", "email", "phone", "level", "totalReferralsIndividual", "totalReferralsProfessional", "${earningsColumn}" as "totalEarnings", "createdAt"
       from "affiliates"
       where lower("role"::text) = 'affiliate'
         and "${earningsColumn}" > 0
       order by "${earningsColumn}" desc, "createdAt" asc
       limit ${take}`
    )

    return NextResponse.json({
      topPerformers: affiliates.map((affiliate, index) => ({
        rank: index + 1,
        id: affiliate.id,
        displayName: String(affiliate.name || '').trim() || affiliate.email,
        phone: String(affiliate.phone || '').trim() || 'Not provided',
        name: affiliate.name,
        email: affiliate.email,
        level: affiliate.level,
        totalReferrals:
          Number(affiliate.totalReferralsIndividual || 0) + Number(affiliate.totalReferralsProfessional || 0),
        totalReferralsIndividual: Number(affiliate.totalReferralsIndividual || 0),
        totalReferralsProfessional: Number(affiliate.totalReferralsProfessional || 0),
        totalEarnings: Number(affiliate.totalEarnings || 0),
      })),
      full,
    })
  } catch (error) {
    try {
      if (!signedInEmail) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { searchParams } = new URL(request.url)
      const full = searchParams.get('full') === 'true'
      const take = full ? 200 : 10

      const affiliateColumns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        `select column_name from information_schema.columns where table_schema='public' and table_name='affiliates'`
      )

      const hasTotalEarned = affiliateColumns.some((col) => col.column_name === 'totalEarned')
      const earningsColumn = hasTotalEarned ? 'totalEarned' : 'totalEarnings'

      const affiliates = await prisma.$queryRawUnsafe<Array<any>>(
        `select "id", "name", "email", "phone", "level", "totalReferralsIndividual", "totalReferralsProfessional", "${earningsColumn}" as "totalEarnings", "createdAt"
         from "affiliates"
        where lower("role"::text) = 'affiliate'
          and "${earningsColumn}" > 0
         order by "${earningsColumn}" desc, "createdAt" asc
         limit ${take}`
      )

      return NextResponse.json({
        topPerformers: affiliates.map((affiliate, index) => ({
          rank: index + 1,
          id: affiliate.id,
          displayName: String(affiliate.name || '').trim() || affiliate.email,
          phone: String(affiliate.phone || '').trim() || 'Not provided',
          name: affiliate.name,
          email: affiliate.email,
          level: affiliate.level,
          totalReferrals:
            Number(affiliate.totalReferralsIndividual || 0) + Number(affiliate.totalReferralsProfessional || 0),
          totalReferralsIndividual: Number(affiliate.totalReferralsIndividual || 0),
          totalReferralsProfessional: Number(affiliate.totalReferralsProfessional || 0),
          totalEarnings: Number(affiliate.totalEarnings || 0),
        })),
        full,
        _meta: {
          degraded: true,
          message: 'Leaderboard served by compatibility fallback',
        },
      })
    } catch {
      return NextResponse.json(
        {
          error: 'Leaderboard failed to load',
          details: 'Backend data query failed',
        },
        { status: 500 }
      )
    }
  }
}
