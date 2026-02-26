import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AffiliateLevel } from '@prisma/client'

const ADMIN_EMAIL = 'clintonstack4@gmail.com'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const account = await prisma.affiliate.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })

  if (session.user.email !== ADMIN_EMAIL && account?.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { session }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ affiliateId: string }> }
) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { affiliateId } = await params
    const body = await request.json()

    const level = body?.level as AffiliateLevel | undefined
    const isFrozen = typeof body?.isFrozen === 'boolean' ? body.isFrozen : undefined

    if (!level && typeof isFrozen !== 'boolean') {
      return NextResponse.json({ error: 'No valid update payload provided' }, { status: 400 })
    }

    const updated = await prisma.affiliate.update({
      where: { id: affiliateId },
      data: {
        level,
        isFrozen,
        promotedAt: level ? new Date() : undefined,
        level4EligibleAt: level === 'LEVEL_4' ? new Date() : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        level: true,
        isFrozen: true,
      },
    })

    return NextResponse.json({ success: true, affiliate: updated })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
