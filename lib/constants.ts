/**
 * Shared application constants
 * Centralizes values that were previously hardcoded across multiple files
 */

/** Admin email – checked against session during auth and API route guards */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'clintonstack4@gmail.com'

/** Plan subscription prices (KES) – used in admin revenue calculations */
export const PLAN_PRICES: Record<string, number> = {
  Individual: 3700,
  Professional: 7600,
}

/** Minimum withdrawal amount (KES) */
export const MIN_WITHDRAWAL_AMOUNT = 600
