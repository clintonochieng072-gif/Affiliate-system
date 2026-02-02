'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'
import { Wallet, CreditCard, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function PayoutsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [payoutAmount, setPayoutAmount] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const { data, error, isLoading, mutate } = useSWR(
    session ? '/api/dashboard' : null,
    fetcher,
    { refreshInterval: 10000 }
  )

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const amount = parseFloat(payoutAmount)
    if (isNaN(amount) || amount < 5000) {
      setMessage({ type: 'error', text: 'Minimum payout amount is ₦5,000' })
      return
    }

    if (amount > availableBalance) {
      setMessage({ type: 'error', text: 'Insufficient balance' })
      return
    }

    setRequesting(true)

    try {
      const response = await fetch('/api/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to request payout')
      }

      setMessage({ type: 'success', text: 'Payout requested successfully! Funds will be sent within 24 hours.' })
      setPayoutAmount('')
      mutate() // Refresh data
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setRequesting(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading payouts...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-red-400">Failed to load payouts</p>
      </div>
    )
  }

  const availableBalance = data.balance || 0
  const payouts = data.payouts || []

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />

      <main className="lg:ml-64 p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Payouts</h1>
          <p className="text-slate-400">Request withdrawals and track payout history</p>
        </div>

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-8 rounded-2xl shadow-2xl mb-8 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-10 h-10 text-emerald-100" />
            <div>
              <div className="text-sm text-emerald-100">Available Balance</div>
              <div className="text-4xl font-bold text-white">{formatCurrency(availableBalance)}</div>
            </div>
          </div>
          <p className="text-emerald-100 text-sm">
            Minimum payout: ₦5,000 • Funds sent via Paystack within 24 hours
          </p>
        </div>

        {/* Request Payout Form */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-400" />
            Request Payout
          </h2>

          <form onSubmit={handleRequestPayout} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Amount (₦)
              </label>
              <input
                type="number"
                min="5000"
                step="100"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="Enter amount (min ₦5,000)"
                className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {message && (
              <div
                className={`p-4 rounded-lg border ${
                  message.type === 'success'
                    ? 'bg-green-950/30 border-green-500/30 text-green-400'
                    : 'bg-red-950/30 border-red-500/30 text-red-400'
                }`}
              >
                <div className="flex items-start gap-2">
                  {message.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="text-sm">{message.text}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={requesting || availableBalance < 5000}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {requesting ? 'Processing...' : 'Request Payout'}
            </button>

            {availableBalance < 5000 && (
              <p className="text-sm text-yellow-400 text-center">
                You need at least ₦5,000 to request a payout. Current balance: {formatCurrency(availableBalance)}
              </p>
            )}
          </form>
        </div>

        {/* Payout History */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-xl font-bold text-white">Payout History</h2>
          </div>

          {payouts.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-400 mb-2">No payouts yet</h3>
              <p className="text-slate-500">Your payout requests will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Requested On
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {payouts.map((payout: any) => (
                    <tr key={payout.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-white">
                        {formatCurrency(payout.amount)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${
                            payout.status === 'paid'
                              ? 'bg-green-900/30 text-green-400 border border-green-500/30'
                              : 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30'
                          }`}
                        >
                          {payout.status === 'paid' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {payout.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(payout.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-950/30 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-400" />
            Payout Information
          </h3>
          <ul className="space-y-2 text-slate-300 text-sm">
            <li>• Minimum payout amount is ₦5,000</li>
            <li>• Payouts are processed within 24 hours</li>
            <li>• Funds are sent directly to your bank account via Paystack</li>
            <li>• Make sure your bank details are correct in your profile</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
