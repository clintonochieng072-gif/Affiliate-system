'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import useSWR from 'swr'
import { formatCurrency } from '@/lib/utils'
import SignOutButton from '@/components/SignOutButton'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const payload = await response.json()

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || 'Request failed')
  }

  return payload
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const { data, error, isLoading, mutate } = useSWR(session ? '/api/admin' : null, fetcher, {
    refreshInterval: 20000,
  })

  const updateAffiliate = async (affiliateId: string, payload: any) => {
    setBusyId(affiliateId)
    try {
      await fetch(`/api/admin/affiliate/${affiliateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      mutate()
    } finally {
      setBusyId(null)
    }
  }

  const updateWithdrawal = async (withdrawalId: string, action: 'approve' | 'reject' | 'mark_paid') => {
    setBusyId(withdrawalId)
    try {
      await fetch(`/api/admin/withdrawals/${withdrawalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: action === 'reject' ? 'Rejected by admin review' : undefined }),
      })
      mutate()
    } finally {
      setBusyId(null)
    }
  }

  if (status === 'loading' || isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">Loading admin dashboard...</div>
  }

  if (error || !data) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">Failed to load admin dashboard</div>
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-xs text-slate-400">Affiliate management and financial controls</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Metric title="Total Affiliates" value={data.stats.totalAffiliates} />
          <Metric title="Revenue" value={formatCurrency(data.stats.totalRevenueGenerated)} />
          <Metric title="Commissions" value={formatCurrency(data.stats.totalCommissionsPaid)} />
          <Metric title="Pending Withdrawals" value={data.stats.pendingWithdrawalsCount} />
          <Metric title="Net Profit Est." value={formatCurrency(data.stats.netProfitEstimate)} />
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Admin Notifications</h2>
          <div className="space-y-2 max-h-56 overflow-auto">
            {data.notifications.length === 0 ? (
              <p className="text-sm text-slate-400">No notifications yet</p>
            ) : (
              data.notifications.map((item: any) => (
                <div key={item.id} className="text-sm border border-slate-800 rounded p-2">
                  <div className="text-white font-medium">{item.title}</div>
                  <div className="text-slate-300">{item.message}</div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h2 className="font-semibold">Affiliate Management</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-left">Level</th>
                  <th className="px-3 py-2 text-left">Referrals</th>
                  <th className="px-3 py-2 text-left">Earnings</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.affiliates.map((affiliate: any) => (
                  <tr key={affiliate.id} className="border-t border-slate-800">
                    <td className="px-3 py-2">{affiliate.name}</td>
                    <td className="px-3 py-2 text-slate-300">{affiliate.email}</td>
                    <td className="px-3 py-2 text-slate-300">{affiliate.phone || '-'}</td>
                    <td className="px-3 py-2">{affiliate.level.replace('LEVEL_', 'L')}</td>
                    <td className="px-3 py-2">{affiliate.totalReferrals}</td>
                    <td className="px-3 py-2 text-emerald-400">{formatCurrency(affiliate.totalEarnings)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <select
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
                          defaultValue={affiliate.level}
                          onChange={e => updateAffiliate(affiliate.id, { level: e.target.value })}
                          disabled={busyId === affiliate.id}
                        >
                          <option value="LEVEL_1">Level 1</option>
                          <option value="LEVEL_2">Level 2</option>
                          <option value="LEVEL_3">Level 3</option>
                          <option value="LEVEL_4">Level 4</option>
                        </select>
                        <button
                          onClick={() => updateAffiliate(affiliate.id, { isFrozen: !affiliate.isFrozen })}
                          disabled={busyId === affiliate.id}
                          className={`text-xs px-2 py-1 rounded ${affiliate.isFrozen ? 'bg-emerald-700' : 'bg-red-700'}`}
                        >
                          {affiliate.isFrozen ? 'Unfreeze' : 'Freeze'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h2 className="font-semibold">Pending Withdrawals</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">Affiliate</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.pendingWithdrawals.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">No pending withdrawals</td></tr>
                ) : (
                  data.pendingWithdrawals.map((item: any) => (
                    <tr key={item.id} className="border-t border-slate-800">
                      <td className="px-3 py-2">{item.affiliateName} <span className="text-slate-400">({item.affiliateEmail})</span></td>
                      <td className="px-3 py-2 text-emerald-400">{formatCurrency(item.amount)}</td>
                      <td className="px-3 py-2">{item.status}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button onClick={() => updateWithdrawal(item.id, 'approve')} disabled={busyId === item.id} className="bg-blue-700 px-2 py-1 rounded text-xs">Approve</button>
                          <button onClick={() => updateWithdrawal(item.id, 'mark_paid')} disabled={busyId === item.id} className="bg-emerald-700 px-2 py-1 rounded text-xs">Mark Paid</button>
                          <button onClick={() => updateWithdrawal(item.id, 'reject')} disabled={busyId === item.id} className="bg-red-700 px-2 py-1 rounded text-xs">Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <Panel title="Top 20 Performers">
            <ul className="space-y-2 text-sm">
              {data.topPerformers.map((item: any) => (
                <li key={item.id} className="flex items-center justify-between border border-slate-800 rounded p-2">
                  <span>{item.rank}. {item.name} ({item.level.replace('LEVEL_', 'L')})</span>
                  <span className="text-emerald-400">{formatCurrency(item.totalEarnings)}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Level 4 Interview Eligible">
            <ul className="space-y-2 text-sm">
              {data.level4EligibleAffiliates.length === 0 ? (
                <li className="text-slate-400">No level 4 affiliates yet</li>
              ) : (
                data.level4EligibleAffiliates.map((item: any) => (
                  <li key={item.id} className="border border-slate-800 rounded p-2">
                    <div className="text-white font-medium">{item.name}</div>
                    <div className="text-slate-300">{item.email} • {item.phone || 'No phone'}</div>
                    <div className="text-emerald-400">{formatCurrency(item.totalEarnings)} • {item.totalReferrals} referrals</div>
                  </li>
                ))
              )}
            </ul>
          </Panel>
        </section>
      </main>
    </div>
  )
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
      <div className="text-xs text-slate-400">{title}</div>
      <div className="text-xl font-bold text-white mt-1">{value}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </div>
  )
}
