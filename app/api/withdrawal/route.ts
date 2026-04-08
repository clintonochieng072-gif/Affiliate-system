import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { POST as withdrawPOST } from '../withdraw/route'

export { withdrawPOST as POST }

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const affiliate = await prisma.affiliate.findUnique({
      where: { email: session.user.email },
      include: {
        withdrawals: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!affiliate) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
    }

    return NextResponse.json({
      withdrawals: affiliate.withdrawals.map((w) => ({
        id: w.id,
        amount: Number(w.amount),
        mpesaNumber: w.mpesaNumber,
        status: w.status,
        failureReason: w.failureReason,
        providerReference: w.providerReference,
        createdAt: w.createdAt,
        completedAt: w.completedAt,
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
