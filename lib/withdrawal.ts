import { WithdrawalStatus } from '@prisma/client'

const allowedTransitions: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  pending: ['processing'],
  processing: ['completed', 'failed'],
  completed: [],
  failed: [],
}

export function canTransitionWithdrawal(
  from: WithdrawalStatus,
  to: WithdrawalStatus
): boolean {
  return allowedTransitions[from].includes(to)
}
