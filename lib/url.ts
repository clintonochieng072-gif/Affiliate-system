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

  // 2. Check for VERCEL_URL (auto-set in Vercel deployments)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // 3. Server-side: derive from request headers
  if (request) {
    const host = request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    if (host) {
      return `${protocol}://${host}`
    }
  }

  // 4. Client-side: use window.location
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  // 5. Fallback to localhost for development
  return 'http://localhost:3000'
}

/**
 * Generate a referral URL with the affiliate code
 * 
 * @param code - The affiliate referral code
 * @param request - Optional request object for server-side URL generation
 * @returns Full referral URL
 */
export function getReferralUrl(code: string, request?: Request): string {
  const baseUrl = getBaseUrl(request)
  return `${baseUrl}/r/${code}`
}

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
    // Server-side rendering fallback
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
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
  const baseUrl = useBaseUrl()
  return `${baseUrl}/r/${code}`
}
