'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import useSWR from 'swr'
import { formatCurrency } from '@/lib/utils'
import SignOutButton from '@/components/SignOutButton'
import { AlertCircle, Trash2 } from 'lucide-react'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const payload = await response.json()

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || 'Request failed')
  }

  return payload
}

interface ManualDeductionForm {
  affiliateId: string
  amount: number
  reason: string
}

interface DeleteConfirm {
  affiliateId: string
  affiliateEmail: string
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'affiliates' | 'withdrawals'>('overview')
  const [deductionForm, setDeductionForm] = useState<ManualDeductionForm>({
    affiliateId: '',
    amount: 0,
    reason: '',
  })
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  const handleManualDeduction = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!deductionForm.affiliateId || deductionForm.amount <= 0) {
      setMessage({ type: 'error', text: 'Please select an affiliate and enter a valid amount' })
      return
    }

    setBusyId(deductionForm.affiliateId)
    try {
      const response = await fetch('/api/admin/manual-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateId: deductionForm.affiliateId,
          amount: deductionForm.amount,
          reason: deductionForm.reason,
        }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        setMessage({ type: 'error', text: result.error || 'Deduction failed' })
        return
      }

      setMessage({ type: 'success', text: `Deducted ${formatCurrency(deductionForm.amount)} from ${result.affiliate.name}` })
      setDeductionForm({ affiliateId: '', amount: 0, reason: '' })
      mutate()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Deduction failed' })
    } finally {
      setBusyId(null)
    }
  }

  const handleDeleteAffiliate = async () => {
    if (!deleteConfirm) return

    setBusyId(deleteConfirm.affiliateId)
    try {
      const response = await fetch(`/api/admin/delete/${deleteConfirm.affiliateId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        setMessage({ type: 'error', text: result.error || 'Deletion failed' })
        return
      }

      setMessage({ type: 'success', text: `Deleted affiliate ${result.deleted.email}` })
      setDeleteConfirm(null)
      mutate()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Deletion failed' })
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

  const selectedAffiliateForDeduction = deductionForm.affiliateId
    ? data.affiliates.find((a: any) => a.id === deductionForm.affiliateId)
    : null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-xs text-slate-400">Sales Partner management and financial controls</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      {message && (
        <div className={`${message.type === 'success' ? 'bg-emerald-900/50 border-emerald-500' : 'bg-red-900/50 border-red-500'} border px-4 py-3 text-sm`}>
          {message.text}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800">
          {(['overview', 'affiliates', 'withdrawals'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Metric title="Total Sales Partners" value={data.stats.totalAffiliates} />
              <Metric title="Revenue" value={formatCurrency(data.stats.totalRevenueGenerated)} />
              <Metric title="Commissions" value={formatCurrency(data.stats.totalCommissionsPaid)} />
              <Metric title="Pending Withdrawals" value={data.stats.pendingWithdrawalsCount} />
              <Metric title="Net Profit Est." value={formatCurrency(data.stats.netProfitEstimate)} />
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

              <Panel title="Level 4 Interview Review Eligible">
                <ul className="space-y-2 text-sm">
                  {data.level4EligibleAffiliates.length === 0 ? (
                    <li className="text-slate-400">No Level 4 sales partners yet</li>
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
          </>
        )}

        {tab === 'affiliates' && (
          <>
            {/* Manual Balance Deduction Form */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-orange-400">Manual Balance Deduction</h3>
                  <p className="text-xs text-slate-400 mt-1">Admin-only: Deduct from available balance. Does NOT trigger Daraja payout.</p>
                </div>
              </div>

              <form onSubmit={handleManualDeduction} className="space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Select Affiliate</label>
                    <select
                      value={deductionForm.affiliateId}
                      onChange={e => setDeductionForm({ ...deductionForm, affiliateId: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-2 text-sm mt-1"
                      disabled={busyId !== null}
                    >
                      <option value="">Choose affiliate...</option>
                      {data.affiliates.map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.email}) - Avail: {formatCurrency(a.availableBalance)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">Amount (KES)</label>
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={deductionForm.amount}
                      onChange={e => setDeductionForm({ ...deductionForm, amount: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-2 text-sm mt-1"
                      placeholder="0"
                      disabled={busyId !== null}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400">Reason (optional)</label>
                    <input
                      type="text"
                      value={deductionForm.reason}
                      onChange={e => setDeductionForm({ ...deductionForm, reason: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-2 text-sm mt-1"
                      placeholder="e.g., chargeback, adjustment"
                      disabled={busyId !== null}
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={busyId !== null}
                      className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 px-3 py-2 rounded text-sm font-medium transition"
                    >
                      Deduct Balance
                    </button>
                  </div>
                </div>

                {selectedAffiliateForDeduction && (
                  <div className="text-xs text-slate-300 bg-slate-800/50 p-2 rounded">
                    Current balance: {formatCurrency(selectedAffiliateForDeduction.availableBalance)} →
                    After deduction: {formatCurrency(Math.max(0, selectedAffiliateForDeduction.availableBalance - deductionForm.amount))}
                  </div>
                )}
              </form>
            </section>

            {/* Affiliate Table */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <h2 className="font-semibold">All Sales Partners ({data.affiliates.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-right">Sales</th>
                      <th className="px-3 py-2 text-right">Total Earned</th>
                      <th className="px-3 py-2 text-right">Available</th>
                      <th className="px-3 py-2 text-right">Withdrawn</th>
                      <th className="px-3 py-2 text-left">Created</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.affiliates.map((affiliate: any) => (
                      <tr key={affiliate.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                        <td className="px-3 py-2 font-medium">{affiliate.name || '-'}</td>
                        <td className="px-3 py-2 text-slate-300">{affiliate.email}</td>
                        <td className="px-3 py-2 text-right">{affiliate.totalReferralsIndividual + affiliate.totalReferralsProfessional}</td>
                        <td className="px-3 py-2 text-right text-emerald-400">{formatCurrency(affiliate.totalEarned)}</td>
                        <td className="px-3 py-2 text-right text-blue-400">{formatCurrency(affiliate.availableBalance)}</td>
                        <td className="px-3 py-2 text-right text-orange-400">{formatCurrency(affiliate.totalWithdrawn)}</td>
                        <td className="px-3 py-2 text-slate-400 text-xs">{new Date(affiliate.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <select
                              className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs"
                              defaultValue={affiliate.level}
                              onChange={e => updateAffiliate(affiliate.id, { level: e.target.value })}
                              disabled={busyId === affiliate.id}
                            >
                              <option value="LEVEL_1">L1</option>
                              <option value="LEVEL_2">L2</option>
                              <option value="LEVEL_3">L3</option>
                              <option value="LEVEL_4">L4</option>
                            </select>
                            <button
                              onClick={() => updateAffiliate(affiliate.id, { isFrozen: !affiliate.isFrozen })}
                              disabled={busyId === affiliate.id}
                              className={`text-xs px-2 py-0.5 rounded transition ${affiliate.isFrozen ? 'bg-emerald-700/50 text-emerald-400' : 'bg-red-700/50 text-red-400'}`}
                            >
                              {affiliate.isFrozen ? '✓' : '✕'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ affiliateId: affiliate.id, affiliateEmail: affiliate.email })}
                              disabled={busyId === affiliate.id}
                              className="text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-red-700 transition"
                            >
                              <Trash2 className="w-3 h-3 inline" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {tab === 'withdrawals' && (
          <section className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="font-semibold">Pending Withdrawals</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left">Sales Partner</th>
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
                        <td className="px-3 py-2"><span className="bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded text-xs">{item.status}</span></td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button onClick={() => updateWithdrawal(item.id, 'approve')} disabled={busyId === item.id} className="bg-blue-700 hover:bg-blue-600 disabled:bg-slate-700 px-2 py-1 rounded text-xs transition">Approve</button>
                            <button onClick={() => updateWithdrawal(item.id, 'mark_paid')} disabled={busyId === item.id} className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 px-2 py-1 rounded text-xs transition">Paid</button>
                            <button onClick={() => updateWithdrawal(item.id, 'reject')} disabled={busyId === item.id} className="bg-red-700 hover:bg-red-600 disabled:bg-slate-700 px-2 py-1 rounded text-xs transition">Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-white mb-2">Delete Affiliate?</h3>
            <p className="text-slate-300 mb-4">
              This will permanently delete <strong>{deleteConfirm.affiliateEmail}</strong> and all related records.
              <br />
              <span className="text-xs text-red-400 mt-2 block">This action cannot be undone.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAffiliate}
                disabled={busyId === deleteConfirm.affiliateId}
                className="flex-1 bg-red-700 hover:bg-red-600 disabled:bg-slate-700 px-4 py-2 rounded transition font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
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
