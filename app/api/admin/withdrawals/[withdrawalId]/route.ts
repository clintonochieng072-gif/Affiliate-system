import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canTransitionWithdrawal } from '@/lib/withdrawal'

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
  { params }: { params: Promise<{ withdrawalId: string }> }
) {
  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const { withdrawalId } = await params
    const body = await request.json()
    const action = String(body?.action || '').toLowerCase()

    if (!['approve', 'reject', 'mark_paid'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be approve, reject, or mark_paid' },
        { status: 400 }
      )
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      select: { id: true, affiliateId: true, amount: true, status: true },
    })

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })
    }

    if (action === 'approve') {
      if (!canTransitionWithdrawal(withdrawal.status, 'processing')) {
        return NextResponse.json(
          { error: `Cannot move withdrawal from ${withdrawal.status} to processing` },
          { status: 409 }
        )
      }

      const updated = await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: 'processing' },
      })

      return NextResponse.json({ success: true, withdrawal: updated })
    }

    if (action === 'mark_paid') {
      if (!canTransitionWithdrawal(withdrawal.status, 'completed')) {
        return NextResponse.json(
          { error: `Cannot move withdrawal from ${withdrawal.status} to completed` },
          { status: 409 }
        )
      }

      const updated = await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          failureReason: null,
        },
      })

      return NextResponse.json({ success: true, withdrawal: updated })
    }

    if (withdrawal.status === 'completed' || withdrawal.status === 'failed') {
      return NextResponse.json(
        { error: 'Withdrawal already finalized' },
        { status: 409 }
      )
    }

    if (!canTransitionWithdrawal(withdrawal.status, 'failed')) {
      return NextResponse.json(
        { error: `Cannot move withdrawal from ${withdrawal.status} to failed` },
        { status: 409 }
      )
    }

    const reason = String(body?.reason || 'Rejected by admin')

    const updated = await prisma.$transaction(async tx => {
      const rejected = await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'failed',
          failureReason: reason,
        },
      })

      await tx.affiliate.update({
        where: { id: withdrawal.affiliateId },
        data: {
          availableBalance: {
            increment: withdrawal.amount,
          },
        },
      })

      return rejected
    })

    return NextResponse.json({ success: true, withdrawal: updated })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
