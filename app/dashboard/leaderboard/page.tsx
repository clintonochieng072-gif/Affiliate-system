'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function LeaderboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showFull, setShowFull] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
  const selected = performers.find((item: any) => item.id === selectedId)

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />
      <main className="lg:ml-64 p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
            <p className="text-slate-400 text-sm">Top performing affiliates</p>
          </div>
          <button
            onClick={() => setShowFull(v => !v)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {showFull ? 'Show Top 10' : 'View Full Table'}
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
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
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`border-t border-slate-800 cursor-pointer hover:bg-slate-800/60 ${selectedId === item.id ? 'bg-slate-800/70' : ''}`}
                  >
                    <td className="px-4 py-3 text-slate-400">{item.rank}</td>
                    <td className="px-4 py-3 text-white">{item.name || item.email}</td>
                    <td className="px-4 py-3 text-slate-300">{item.level.replace('LEVEL_', 'L')}</td>
                    <td className="px-4 py-3 text-slate-300">{item.totalReferrals}</td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">{formatCurrency(item.totalEarnings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm">
            <div className="text-white font-semibold mb-2">Selected Performer</div>
            <div className="grid md:grid-cols-4 gap-3 text-slate-300">
              <div>Name: {selected.name || selected.email}</div>
              <div>Phone: {selected.phone || 'Not set'}</div>
              <div>Level: {selected.level}</div>
              <div>Total Referrals: {selected.totalReferrals}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
