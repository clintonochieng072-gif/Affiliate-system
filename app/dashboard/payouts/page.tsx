'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'
import { Wallet, CreditCard, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const PLATFORM_FEE_PER_BLOCK = 30 // KES per 140 block
const WITHDRAWAL_BLOCK = 140 // KES

export default function PayoutsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [payoutAmount, setPayoutAmount] = useState('')
  const [mpesaNumber, setMpesaNumber] = useState('')
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
    // Allow 10 KES for testing + multiples of 140 for normal withdrawals
    const isTestAmount = amount === 10
    const isValidMultiple = amount >= 140 && amount % 140 === 0
    
    if (isNaN(amount) || amount < 10) {
      setMessage({ type: 'error', text: 'Minimum withdrawal amount is KSh 10' })
      return
    }

    if (!isTestAmount && !isValidMultiple) {
      setMessage({ type: 'error', text: 'Withdrawal amount must be KSh 10 (test) or multiples of KSh 140' })
      return
    }

    if (amount > availableBalance) {
      setMessage({ type: 'error', text: 'Insufficient balance' })
      return
    }

    // Validate mobile money number (basic check - Paystack will do final validation)
    const cleanedMpesa = mpesaNumber.replace(/[\s\-\+]/g, '')
    
    // Accept any number with 9-15 digits (covers all African mobile money formats)
    const isValidNumber = /^\d{9,15}$/.test(cleanedMpesa)
    
    if (!isValidNumber) {
      setMessage({ type: 'error', text: 'Invalid account number. Please enter a valid mobile money number (9-15 digits).' })
      return
    }

    setRequesting(true)

    try {
      const response = await fetch('/api/withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: amount,
          mpesaNumber: mpesaNumber
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // Show detailed error information
        const errorMsg = data.details || data.error || 'Failed to request withdrawal'
        console.error('Withdrawal error:', data)
        throw new Error(errorMsg)
      }

      setMessage({ type: 'success', text: 'Withdrawal requested successfully! Funds will be sent via M-PESA within 24 hours.' })
      setPayoutAmount('')
      setMpesaNumber('')
      mutate() // Refresh data
    } catch (error: any) {
      console.error('Withdrawal request failed:', error)
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
          <h1 className="text-3xl font-bold text-white mb-2">Withdraw</h1>
          <p className="text-slate-400">Request withdrawals and track withdrawal history</p>
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
            Minimum withdrawal: KSh 10 (test) or KSh 140+ • Funds sent via M-PESA within 24 hours
          </p>
        </div>

        {/* Request Payout Form */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-400" />
            Request Withdrawal
          </h2>

          <form onSubmit={handleRequestPayout} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Amount (KSh)
              </label>
              <input
                type="number"
                min="10"
                step="10"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="Enter 10 (test) or multiples of 140"
                className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                M-PESA Number
              </label>
              <input
                type="text"
                value={mpesaNumber}
                onChange={(e) => setMpesaNumber(e.target.value)}
                placeholder="07XXXXXXXX, 01XXXXXXXX, or 254XXXXXXXXX"
                className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter your mobile money number (supports 07, 01, and international formats)
              </p>
            </div>

            {/* Fee Breakdown */}
            {payoutAmount && parseFloat(payoutAmount) >= 140 && parseFloat(payoutAmount) % 140 === 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-300">
                    <span>Requested Amount:</span>
                    <span className="font-semibold">{formatCurrency(parseFloat(payoutAmount))}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Platform Fee:</span>
                    <span className="font-semibold text-red-400">
                      -{formatCurrency(Math.floor(parseFloat(payoutAmount) / WITHDRAWAL_BLOCK) * PLATFORM_FEE_PER_BLOCK)}
                    </span>
                  </div>
                  <div className="border-t border-slate-700 pt-2 mt-2 flex justify-between text-white font-bold">
                    <span>You Receive:</span>
                    <span className="text-green-400">
                      {formatCurrency(parseFloat(payoutAmount) - Math.floor(parseFloat(payoutAmount) / WITHDRAWAL_BLOCK) * PLATFORM_FEE_PER_BLOCK)}
                    </span>
                  </div>
                </div>
              </div>
            )}

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
              disabled={requesting || availableBalance < 10}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {requesting ? 'Processing...' : 'Request Withdrawal'}
            </button>

            {availableBalance < 10 && (
              <p className="text-sm text-yellow-400 text-center">
                You need at least KSh 10 to request a withdrawal. Current balance: {formatCurrency(availableBalance)}
              </p>
            )}
          </form>
        </div>

        {/* Withdrawal History */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-xl font-bold text-white">Withdrawal History</h2>
          </div>

          {payouts.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-400 mb-2">No withdrawals yet</h3>
              <p className="text-slate-500">Your withdrawal requests will appear here</p>
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
            Withdrawal Information
          </h3>
          <ul className="space-y-2 text-slate-300 text-sm">
            <li>• Minimum withdrawal amount is KSh 140 (2 referrals)</li>
            <li>• Withdrawals must be in multiples of KSh 140</li>
            <li>• Platform fee: KSh 30 per KSh 140 block (you receive KSh 110)</li>
            <li>• Withdrawals are processed within 24 hours</li>
            <li>• Funds are sent via M-PESA mobile money transfer</li>
            <li>• Provide a valid M-PESA number (format: 07XX XXX XXX)</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
