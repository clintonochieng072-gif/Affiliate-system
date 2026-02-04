'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect from old /dashboard/withdraw to new /dashboard/payouts
 * This page is deprecated - use /dashboard/payouts (labeled as "Withdraw")
 */
export default function WithdrawRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/payouts')
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mx-auto mb-4"></div>
        <p className="text-slate-400">Redirecting...</p>
      </div>
    </div>
  )
}
