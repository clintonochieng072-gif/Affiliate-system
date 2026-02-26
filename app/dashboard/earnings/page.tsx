'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const payload = await response.json()

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || 'Request failed')
  }

  return payload
}

const PAGE_SIZE = 15

export default function EarningsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const { data, error, isLoading } = useSWR(session ? '/api/dashboard' : null, fetcher, {
    refreshInterval: 15000,
  })

  const earningsHistory = useMemo(() => (Array.isArray(data?.referralHistory) ? data.referralHistory : []), [data])
  const totalPages = Math.max(1, Math.ceil(earningsHistory.length / PAGE_SIZE))
  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return earningsHistory.slice(start, start + PAGE_SIZE)
  }, [earningsHistory, page])

  const summary = data?.summary || {
    totalSalesEarnings: 0,
    availableSalesEarnings: 0,
    pendingSalesEarnings: 0,
  }

  if (status === 'loading' || isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading earnings...</div>
  }

  if (error || !data) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">Failed to load earnings</div>
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />
      <main className="lg:ml-64 p-4 sm:p-6 lg:p-8 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Earnings</h1>
          <p className="text-slate-400 text-sm">A simple view of your earnings, available balance, and pending balance.</p>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card title="Total Earnings" value={formatCurrency(summary.totalSalesEarnings)} />
          <Card title="Available Balance" value={formatCurrency(summary.availableSalesEarnings)} />
          <Card title="Pending Balance" value={formatCurrency(summary.pendingSalesEarnings)} />
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-white font-semibold mb-3">Recent Commissions</h2>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">Client</th>
                  <th className="px-3 py-2 text-left">Plan</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Commission</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item: any) => (
                  <tr key={item.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-white">{item.clientName}</td>
                    <td className="px-3 py-2 text-slate-300">{item.planType}</td>
                    <td className="px-3 py-2 text-slate-400">{new Date(item.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-emerald-400">{formatCurrency(item.commission)}</td>
                    <td className="px-3 py-2 text-slate-300">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {pagedItems.map((item: any) => (
              <div key={item.id} className="border border-slate-800 rounded-lg p-3 bg-slate-800/30">
                <div className="text-white font-medium">{item.clientName}</div>
                <div className="text-xs text-slate-300">{item.planType} • {new Date(item.date).toLocaleDateString()}</div>
                <div className="text-sm text-emerald-400 mt-1">{formatCurrency(item.commission)}</div>
                <div className="text-xs text-slate-400 mt-1">Status: {item.status}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-slate-300 mt-4">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 disabled:opacity-40">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 disabled:opacity-40">Next</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="text-xs text-slate-400">{title}</div>
      <div className="text-xl font-semibold text-white mt-1">{value}</div>
    </div>
  )
}
