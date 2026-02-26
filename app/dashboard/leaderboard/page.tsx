'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
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

export default function LeaderboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showFull, setShowFull] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const endpoint = showFull ? '/api/leaderboard?full=true' : '/api/leaderboard'
  const { data, error, isLoading } = useSWR(session ? endpoint : null, fetcher, {
    refreshInterval: 15000,
  })

  if (status === 'loading' || isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading leaderboard...</div>
  }

  if (error || !data) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">Failed to load leaderboard</div>
  }

  const performers = data.topPerformers || []

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />
      <main className="lg:ml-64 p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
            <p className="text-slate-400 text-sm">Top performing Sales Partners by earnings and client count.</p>
          </div>
          <button
            onClick={() => setShowFull(v => !v)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {showFull ? 'Show Top 10' : 'View Full List'}
          </button>
        </div>

        <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Level</th>
                  <th className="px-4 py-3 text-left">Total Referrals</th>
                  <th className="px-4 py-3 text-left">Total Earnings</th>
                </tr>
              </thead>
              <tbody>
                {performers.map((item: any) => (
                  <tr key={item.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-400">{item.rank}</td>
                    <td className="px-4 py-3 text-white">{item.name || item.email}</td>
                    <td className="px-4 py-3 text-slate-300">{item.level.replace('LEVEL_', 'Level ')}</td>
                    <td className="px-4 py-3 text-slate-300">{item.totalReferrals}</td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">{formatCurrency(item.totalEarnings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:hidden space-y-3">
          {performers.map((item: any) => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-1">
              <div className="text-white font-medium">#{item.rank} {item.name || item.email}</div>
              <div className="text-sm text-slate-300">Level: {item.level.replace('LEVEL_', 'Level ')}</div>
              <div className="text-sm text-slate-300">Total Referrals: {item.totalReferrals}</div>
              <div className="text-sm text-emerald-400 font-semibold">Total Earnings: {formatCurrency(item.totalEarnings)}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
