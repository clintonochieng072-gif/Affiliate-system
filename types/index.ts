// Database types (from Prisma models)
import { Affiliate, AffiliateLink, Referral, Payout } from '@prisma/client'

// Re-export Prisma types
export type { Affiliate, AffiliateLink, Referral, Payout }

// NextAuth session extension
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'sales_agent'
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'sales_agent'
  }
}

// API request/response types
export interface SalesWebhookPayload {
  agent_code: string
  user_email: string
  product_slug: string
  amount_paid: number
  payment_reference: string
  sales_earning_rate?: number
}

export interface PayoutRequest {
  amount: number
}

export interface DashboardStats {
  totalSales: number
  totalSalesEarnings: number
  availableSalesEarnings: number
  pendingSalesEarnings: number
  totalSalesTrackingLinks: number
}
