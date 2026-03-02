/**
 * Referral Code Utility
 * Generates unique alphanumeric codes for affiliate referral links
 */

/**
 * Generate a unique referral code
 * Format: 10-character alphanumeric string (uppercase)
 * Example: "DKp8xYzQwR"
 */
export function generateReferralCode(length: number = 10): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return code
}

/**
 * Validate referral code format
 * @param code The code to validate
 * @returns true if valid, false otherwise
 */
export function isValidReferralCode(code: string): boolean {
  return /^[A-Z0-9]{10}$/.test(code)
}
