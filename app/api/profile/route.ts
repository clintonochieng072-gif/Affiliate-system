import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  let signedInEmail = ''

  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    signedInEmail = session.user.email

    const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `select column_name from information_schema.columns where table_schema='public' and table_name='affiliates'`
    )
    const hasProfileCompleted = columns.some((col) => col.column_name === 'profileCompleted')

    const affiliateRows = await prisma.$queryRawUnsafe<Array<any>>(
      `select "id", "email", "name", "phone", "level", "role"${
        hasProfileCompleted ? ', "profileCompleted"' : ''
      } from "affiliates" where "email" = $1 limit 1`,
      session.user.email
    )

    const affiliate = affiliateRows[0]

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
    }

    const hasName = Boolean(String(affiliate.name || '').trim())
    const hasPhone = Boolean(String(affiliate.phone || '').trim())
    const profileCompleted = hasProfileCompleted
      ? Boolean(affiliate.profileCompleted)
      : hasName && hasPhone

    return NextResponse.json({
      profile: {
        ...affiliate,
        profileCompleted,
      },
    })
  } catch (error) {
    return NextResponse.json({
      profile: {
        id: '',
        email: signedInEmail,
        name: '',
        phone: '',
        level: 'LEVEL_1',
        role: 'AFFILIATE',
        profileCompleted: false,
      },
      _meta: {
        degraded: true,
        message: 'Profile fallback response due to backend data error',
      },
    })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const name = String(body?.name || '').trim()
    const phone = String(body?.phone || '').trim()

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
    }

    const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `select column_name from information_schema.columns where table_schema='public' and table_name='affiliates'`
    )
    const hasProfileCompleted = columns.some((col) => col.column_name === 'profileCompleted')

    if (hasProfileCompleted) {
      await prisma.$executeRawUnsafe(
        `update "affiliates" set "name" = $1, "phone" = $2, "profileCompleted" = true where "email" = $3`,
        name,
        phone,
        session.user.email
      )
    } else {
      await prisma.$executeRawUnsafe(
        `update "affiliates" set "name" = $1, "phone" = $2 where "email" = $3`,
        name,
        phone,
        session.user.email
      )
    }

    const updatedRows = await prisma.$queryRawUnsafe<Array<any>>(
      `select "id", "email", "name", "phone", "level" from "affiliates" where "email" = $1 limit 1`,
      session.user.email
    )
    const updated = updatedRows[0]

    if (!updated) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      profile: {
        ...updated,
        profileCompleted: true,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
