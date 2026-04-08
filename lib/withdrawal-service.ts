import { prisma } from '@/lib/prisma'
import { canTransitionWithdrawal } from '@/lib/withdrawal'
import { WithdrawalStatus } from '@prisma/client'

export async function createPendingWithdrawal({
  affiliateId,
  amount,
  phoneNumber,
}: {
  affiliateId: string
  amount: number
  phoneNumber: string
}) {
  return prisma.$transaction(async (tx) => {
    const activeWithdrawal = await tx.withdrawal.findFirst({
      where: {
        affiliateId,
        status: { in: ['pending', 'processing'] },
      },
      select: { id: true, status: true },
    })

    if (activeWithdrawal) {
      throw new Error('ACTIVE_WITHDRAWAL_EXISTS')
    }

    const affiliate = await tx.affiliate.findUnique({
      where: { id: affiliateId },
      select: { availableBalance: true },
    })

    if (!affiliate) {
      throw new Error('AFFILIATE_NOT_FOUND')
    }

    if (Number(affiliate.availableBalance) < amount) {
      throw new Error('INSUFFICIENT_AVAILABLE_BALANCE')
    }

    return tx.withdrawal.create({
      data: {
        affiliateId,
        amount,
        mpesaNumber: phoneNumber,
        status: 'pending',
      },
    })
  })
}

export async function markWithdrawalProcessing(withdrawalId: string, providerReference: string) {
  return prisma.withdrawal.update({
    where: { id: withdrawalId },
    data: {
      status: 'processing',
      providerReference,
      failureReason: null,
    },
  })
}

export async function completeWithdrawal({
  withdrawalId,
  providerReference,
}: {
  withdrawalId: string
  providerReference: string
}) {
  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({
      where: { id: withdrawalId },
    })

    if (!withdrawal) {
      throw new Error('WITHDRAWAL_NOT_FOUND')
    }

    if (!canTransitionWithdrawal(withdrawal.status, 'completed')) {
      throw new Error(`Invalid transition from ${withdrawal.status} to completed`)
    }

    const updatedAffiliate = await tx.affiliate.updateMany({
      where: {
        id: withdrawal.affiliateId,
        availableBalance: { gte: withdrawal.amount },
      },
      data: {
        availableBalance: {
          decrement: withdrawal.amount,
        },
      },
    })

    if (updatedAffiliate.count === 0) {
      throw new Error('INSUFFICIENT_AVAILABLE_BALANCE')
    }

    return tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        providerReference,
        failureReason: null,
      },
    })
  })
}

export async function failWithdrawal({
  withdrawalId,
  failureReason,
  providerReference,
}: {
  withdrawalId: string
  failureReason: string
  providerReference?: string
}) {
  return prisma.withdrawal.update({
    where: { id: withdrawalId },
    data: {
      status: 'failed',
      providerReference: providerReference || undefined,
      failureReason,
    },
  })
}

export async function findWithdrawalByReferenceOrId(reference: string) {
  return prisma.withdrawal.findFirst({
    where: {
      OR: [{ id: reference }, { providerReference: reference }],
    },
  })
}
