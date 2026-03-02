'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'
import { dashboardFetcher } from '@/lib/dashboard-fetcher'

const MIN_WITHDRAWAL_AMOUNT = 600

export default function WithdrawalsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [amountInput, setAmountInput] = useState('')
  const [mpesaNumber, setMpesaNumber] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [optimisticDelta, setOptimisticDelta] = useState(0)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const { data, error, isLoading, mutate } = useSWR(session ? '/api/dashboard' : null, dashboardFetcher, {
    refreshInterval: 10000,
  })

  const baseAvailableBalance = Number(data?.summary?.availableSalesEarnings || 0)
  const availableBalance = Math.max(0, baseAvailableBalance - optimisticDelta)

  const withdrawals = useMemo(() => (Array.isArray(data?.payoutHistory) ? data.payoutHistory : []), [data])

  const requestWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage(null)

    const amount = Number(amountInput)
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
      setMessage({ type: 'error', text: `Minimum withdrawal amount is KSh ${MIN_WITHDRAWAL_AMOUNT}.` })
      return
    }

    if (amount > availableBalance) {
      setMessage({ type: 'error', text: 'You cannot request more than your available balance.' })
      return
    }

    const cleanedNumber = mpesaNumber.replace(/\D/g, '')
    if (!/^\d{9,15}$/.test(cleanedNumber)) {
      setMessage({ type: 'error', text: 'Enter a valid mobile money number with 9-15 digits.' })
      return
    }

    setRequesting(true)
    setOptimisticDelta(prev => prev + amount)

    try {
      const response = await fetch('/api/withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, mpesaNumber }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.details || payload.error || 'Failed to request withdrawal')
      }

      setMessage({ type: 'success', text: 'Withdrawal submitted. Status will update from pending to processing and then completed or failed.' })
      setAmountInput('')
      setMpesaNumber('')
      setOptimisticDelta(0)
      await mutate()
    } catch (requestError: any) {
      setOptimisticDelta(prev => Math.max(0, prev - amount))
      setMessage({ type: 'error', text: requestError.message || 'Request failed' })
    } finally {
      setRequesting(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading withdrawals...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">
        Failed to load withdrawals
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />
      <main className="lg:ml-64 p-4 sm:p-6 lg:p-8 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Withdrawals</h1>
          <p className="text-slate-400 text-sm">Request payouts and track each status update.</p>
        </div>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="text-sm text-slate-300">Minimum withdrawal: KSh 600</div>
          <div className="text-2xl font-bold text-white">Available Balance: {formatCurrency(availableBalance)}</div>

          <form onSubmit={requestWithdrawal} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Amount</label>
              <input
                type="number"
                min={MIN_WITHDRAWAL_AMOUNT}
                max={availableBalance}
                step="1"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                placeholder="Enter amount"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">M-PESA Number</label>
              <input
                value={mpesaNumber}
                onChange={(e) => setMpesaNumber(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                placeholder="07XXXXXXXX"
                required
              />
            </div>

            <button
              type="submit"
              disabled={requesting || availableBalance < MIN_WITHDRAWAL_AMOUNT}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {requesting ? 'Submitting...' : 'Request Withdrawal'}
            </button>
          </form>

          {message && (
            <div className={`text-sm rounded-lg p-3 ${message.type === 'success' ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-600/30' : 'bg-red-900/30 text-red-300 border border-red-600/30'}`}>
              {message.text}
            </div>
          )}
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-white font-semibold mb-3">Withdrawal History</h2>
          <div className="space-y-2">
            {withdrawals.length === 0 ? (
              <div className="text-slate-400 text-sm">No withdrawals yet.</div>
            ) : (
              withdrawals.map((withdrawal: any) => {
                const amount = Number(withdrawal.amount || 0)
                const createdAt = withdrawal.requestedDate || withdrawal.createdAt
                const status = String(withdrawal.status || '').toLowerCase()

                return (
                  <div key={withdrawal.id} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-white font-medium">{formatCurrency(amount)}</div>
                      <span className={`text-xs px-2 py-1 rounded-full ${status === 'completed' ? 'bg-emerald-900/40 text-emerald-300' : status === 'failed' ? 'bg-red-900/40 text-red-300' : status === 'processing' ? 'bg-blue-900/40 text-blue-300' : 'bg-yellow-900/40 text-yellow-300'}`}>
                        {status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Requested: {new Date(createdAt).toLocaleString()}</div>
                    {withdrawal.failureReason && <div className="text-xs text-red-300 mt-1">Reason: {withdrawal.failureReason}</div>}
                  </div>
                )
              })
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
