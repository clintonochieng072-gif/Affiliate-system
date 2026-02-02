// Database types (from Prisma models)
import { Affiliate, AffiliateLink, Referral, Payout } from '@prisma/client'

// Re-export Prisma types
export type { Affiliate, AffiliateLink, Referral, Payout }

// NextAuth session extension
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

// API request/response types
export interface ReferralWebhookPayload {
  referral_code: string
  user_email: string
  product_slug: string
  amount_paid: number
  payment_reference: string
  commission_rate?: number
}

export interface PayoutRequest {
  amount: number
}

export interface DashboardStats {
  totalReferrals: number
  totalEarnings: number
  availableBalance: number
  pendingEarnings: number
  totalLinks: number
}
