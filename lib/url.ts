/**
 * URL Utility Functions
 * Automatically detects environment and returns the correct base URL
 */

/**
 * Get the base URL for the application
 * Works in both server and client environments
 * 
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL (set in .env)
 * 2. VERCEL_URL (automatically set by Vercel)
 * 3. Request headers (for server-side)
 * 4. window.location (for client-side)
 * 5. Fallback to localhost:3000
 */
export function getBaseUrl(request?: Request): string {
  // 1. Check for explicit NEXT_PUBLIC_SITE_URL (highest priority)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  // 2. Fallback to the sales partner dashboard domain
  return 'https://sales.clintonstack.com'
}

/**
 * The target product URL where referred clients land.
 * Uses TARGET_PRODUCT_URL env var, falls back to leads.clintonstack.com.
 */
export function getProductBaseUrl(): string {
  return process.env.TARGET_PRODUCT_URL || 'https://leads.clintonstack.com'
}

/**
 * Generate the referral link agents share with potential clients.
 * Points directly to the target product with ?ref=CODE.
 */
export function getSalesTrackingUrl(code: string, _request?: Request): string {
  const productUrl = getProductBaseUrl()
  const url = new URL(productUrl)
  url.searchParams.set('ref', code)
  return url.toString()
}

export const getReferralUrl = getSalesTrackingUrl

/**
 * Get the current environment name
 * Useful for debugging and conditional logic
 */
export function getEnvironment(): 'production' | 'staging' | 'development' {
  if (process.env.VERCEL_ENV === 'production') {
    return 'production'
  }
  if (process.env.VERCEL_ENV === 'preview') {
    return 'staging'
  }
  return 'development'
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production'
}

/**
 * Client-side hook to get the base URL
 * Use this in React components
 * 
 * @returns The current base URL
 */
export function useBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_SITE_URL || 'https://sales.clintonstack.com'
  }
  return getBaseUrl()
}

/**
 * Client-side function to build a referral URL
 * Use this in React components to display referral links
 * 
 * @param code - The affiliate referral code
 * @returns Full referral URL
 */
export function buildReferralUrl(code: string): string {
  return getSalesTrackingUrl(code)
}

export function buildSalesTrackingUrl(code: string): string {
  return getSalesTrackingUrl(code)
}
