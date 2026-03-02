'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'
import { dashboardFetcher } from '@/lib/dashboard-fetcher'

const PAGE_SIZE = 20

export default function MyClientsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const { data, error, isLoading } = useSWR(session ? '/api/referrals' : null, dashboardFetcher, {
    refreshInterval: 15000,
  })

  const referrals = useMemo(() => (Array.isArray(data?.referrals) ? data.referrals : []), [data])
  const totalPages = Math.max(1, Math.ceil(referrals.length / PAGE_SIZE))
  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return referrals.slice(start, start + PAGE_SIZE)
  }, [referrals, page])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  if (status === 'loading' || isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading clients...</div>
  }

  if (error || !data) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">Failed to load clients</div>
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />
      <main className="lg:ml-64 p-4 sm:p-6 lg:p-8 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">My Clients</h1>
          <p className="text-slate-400 text-sm">Track each client and the commission earned from their subscription.</p>
        </div>

        <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left">Client Name</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Commission</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No clients yet</td>
                  </tr>
                ) : (
                  pagedItems.map((referral: any) => (
                    <tr key={referral.id} className="border-t border-slate-800">
                      <td className="px-4 py-3 text-white">{referral.clientName}</td>
                      <td className="px-4 py-3 text-slate-300">{referral.plan}</td>
                      <td className="px-4 py-3 text-slate-400">{new Date(referral.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-emerald-400 font-medium">{formatCurrency(referral.commission)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${referral.status === 'active' ? 'bg-emerald-900/30 text-emerald-300' : 'bg-yellow-900/30 text-yellow-300'}`}>
                          {referral.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:hidden space-y-3">
          {pagedItems.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center text-slate-400">No clients yet</div>
          ) : (
            pagedItems.map((referral: any) => (
              <div key={referral.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
                <div className="text-white font-medium">{referral.clientName}</div>
                <div className="text-sm text-slate-300">Plan: {referral.plan}</div>
                <div className="text-sm text-slate-400">Date: {new Date(referral.date).toLocaleDateString()}</div>
                <div className="text-sm text-emerald-400 font-semibold">Commission: {formatCurrency(referral.commission)}</div>
                <div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${referral.status === 'active' ? 'bg-emerald-900/30 text-emerald-300' : 'bg-yellow-900/30 text-yellow-300'}`}>
                    {referral.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-slate-300">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
