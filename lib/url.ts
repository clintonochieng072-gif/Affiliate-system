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
 * Generate the sales link that agents share with clients.
 * Format: https://affiliate.clintonstack.com/s/{code}
 * Redirects to the target Lead Capture SaaS product with ?ref tracking param.
 */
export function getSalesTrackingUrl(code: string, _request?: Request): string {
  const salesDomain = process.env.NEXT_PUBLIC_SITE_URL || 'https://affiliate.clintonstack.com'
  return `${salesDomain}/s/${code}`
}

/**
 * Legacy alias for backwards compatibility
 * @deprecated Use getSalesTrackingUrl instead
 */
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
    return process.env.NEXT_PUBLIC_SITE_URL || 'https://affiliate.clintonstack.com'
  }
  return getBaseUrl()
}

/**
 * Client-side function to build a sales URL
 * Use this in React components to display sales links
 * 
 * @param code - The sales tracking code
 * @returns Full sales URL in format https://affiliate.clintonstack.com/s/{code}
 */
export function buildReferralUrl(code: string): string {
  return getSalesTrackingUrl(code)
}

/**
 * Build a sales tracking URL for sharing with clients
 * @param code - The unique sales tracking code
 * @returns Full sales URL
 */
export function buildSalesTrackingUrl(code: string): string {
  return getSalesTrackingUrl(code)
}
