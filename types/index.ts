// Database types (from Prisma models)
import { Affiliate, AffiliateLink, Referral, Payout } from '@prisma/client'

// Re-export Prisma types
export type { Affiliate, AffiliateLink, Referral, Payout }

// NextAuth session extension
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'affiliate' | 'admin'
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'affiliate' | 'admin'
  }
}

// API request/response types
export interface SalesWebhookPayload {
  agent_code: string
  user_email: string
  plan_type: string
  reference: string
}

export interface PayoutRequest {
  amount: number
  mpesaNumber: string
}

export interface DashboardStats {
  totalSales: number
  totalSalesEarnings: number
  availableSalesEarnings: number
  pendingSalesEarnings: number
  totalSalesTrackingLinks: number
}
