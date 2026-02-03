'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardNav from '@/components/DashboardNav'

interface WithdrawalOption {
  amount: number
  blocks: number
  platformFee: number
  payout: number
}

const WITHDRAWAL_BLOCK = 140 // KES
const PLATFORM_FEE_PER_BLOCK = 30 // KES
const COMMISSION_PER_REFERRAL = 70 // KES

export default function WithdrawalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [availableBalance, setAvailableBalance] = useState(0)
  const [selectedAmount, setSelectedAmount] = useState(0)
  const [mpesaNumber, setMpesaNumber] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [withdrawalHistory, setWithdrawalHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // Calculate withdrawal options based on available balance
  const getWithdrawalOptions = (): WithdrawalOption[] => {
    const maxBlocks = Math.floor(availableBalance / WITHDRAWAL_BLOCK)
    const options: WithdrawalOption[] = []

    for (let blocks = 1; blocks <= Math.min(maxBlocks, 20); blocks++) {
      const amount = blocks * WITHDRAWAL_BLOCK
      const platformFee = blocks * PLATFORM_FEE_PER_BLOCK
      const payout = amount - platformFee

      options.push({ amount, blocks, platformFee, payout })
    }

    return options
  }

  // Fetch available balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch('/api/dashboard')
        const data = await res.json()

        if (data.error) {
          setMessage({ type: 'error', text: data.error })
          return
        }

        // Calculate balance: total referrals * 70 KES - total withdrawn
        const totalEarnings = (data.stats?.totalReferrals || 0) * COMMISSION_PER_REFERRAL
        
        // Fetch withdrawals
        const withdrawalRes = await fetch('/api/withdrawal')
        const withdrawalData = await withdrawalRes.json()
        
        if (withdrawalData.withdrawals) {
          setWithdrawalHistory(withdrawalData.withdrawals)
          
          const totalWithdrawn = withdrawalData.withdrawals
            .filter((w: any) => w.status === 'completed' || w.status === 'processing')
            .reduce((sum: number, w: any) => sum + w.requestedAmount, 0)
          
          setAvailableBalance(totalEarnings - totalWithdrawn)
        } else {
          setAvailableBalance(totalEarnings)
        }

      } catch (error) {
        setMessage({ type: 'error', text: 'Failed to load balance' })
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()
  }, [])

  const handleWithdrawal = async () => {
    if (!selectedAmount) {
      setMessage({ type: 'error', text: 'Please select a withdrawal amount' })
      return
    }

    if (!mpesaNumber) {
      setMessage({ type: 'error', text: 'Please enter your M-PESA number' })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const res = await fetch('/api/withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedAmount,
          mpesaNumber: mpesaNumber,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Withdrawal failed' })
        return
      }

      setMessage({
        type: 'success',
        text: `Withdrawal initiated! KES ${data.withdrawal.payoutAmount} will be sent to ${data.withdrawal.mpesaNumber}`,
      })

      // Reset form
      setSelectedAmount(0)
      setMpesaNumber('')

      // Refresh balance after 2 seconds
      setTimeout(() => {
        window.location.reload()
      }, 2000)

    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const selectedOption = getWithdrawalOptions().find(opt => opt.amount === selectedAmount)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <DashboardNav />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-white text-center">Loading...</div>
        </div>
      </div>
    )
  }

  const withdrawalOptions = getWithdrawalOptions()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <DashboardNav />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">M-PESA Withdrawal</h1>
          <p className="text-slate-400">Withdraw your commissions directly to M-PESA</p>
        </div>

        {/* Available Balance Card */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl p-6 mb-8 shadow-xl">
          <div className="text-emerald-100 text-sm mb-1">Available Balance</div>
          <div className="text-4xl font-bold text-white mb-2">KES {availableBalance.toLocaleString()}</div>
          <div className="text-emerald-100 text-sm">
            {Math.floor(availableBalance / WITHDRAWAL_BLOCK)} withdrawable blocks • Each block = {WITHDRAWAL_BLOCK} KES
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Withdrawal Form */}
        {withdrawalOptions.length > 0 ? (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 mb-8">
            <h2 className="text-xl font-semibold text-white mb-6">Request Withdrawal</h2>

            {/* Amount Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Select Amount (multiples of {WITHDRAWAL_BLOCK} KES)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {withdrawalOptions.map((option) => (
                  <button
                    key={option.amount}
                    onClick={() => setSelectedAmount(option.amount)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedAmount === option.amount
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-bold text-lg">{option.amount}</div>
                    <div className="text-xs opacity-75">{option.blocks} blocks</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Fee Breakdown */}
            {selectedOption && (
              <div className="mb-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                <div className="text-sm text-slate-400 mb-3">Breakdown:</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-300">
                    <span>Withdrawal Amount:</span>
                    <span className="font-semibold">KES {selectedOption.amount}</span>
                  </div>
                  <div className="flex justify-between text-red-400">
                    <span>Platform Fee ({selectedOption.blocks} × {PLATFORM_FEE_PER_BLOCK}):</span>
                    <span className="font-semibold">- KES {selectedOption.platformFee}</span>
                  </div>
                  <div className="border-t border-slate-700 pt-2 mt-2"></div>
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>You Receive:</span>
                    <span className="text-lg">KES {selectedOption.payout}</span>
                  </div>
                </div>
              </div>
            )}

            {/* M-PESA Number Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                M-PESA Phone Number
              </label>
              <input
                type="tel"
                value={mpesaNumber}
                onChange={(e) => setMpesaNumber(e.target.value)}
                placeholder="254XXXXXXXXX or 07XXXXXXXX"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-2">
                Enter your M-PESA number in format: 254XXXXXXXXX or 07XXXXXXXX
              </p>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleWithdrawal}
              disabled={submitting || !selectedAmount || !mpesaNumber}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white py-4 rounded-xl font-semibold hover:from-emerald-500 hover:to-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
            >
              {submitting ? 'Processing...' : 'Withdraw to M-PESA'}
            </button>

            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-300">
                  <p className="font-semibold mb-1">How it works:</p>
                  <ul className="space-y-1 text-blue-300/80">
                    <li>• Withdrawals must be in multiples of {WITHDRAWAL_BLOCK} KES (2 referrals)</li>
                    <li>• Platform fee: {PLATFORM_FEE_PER_BLOCK} KES per {WITHDRAWAL_BLOCK} KES block</li>
                    <li>• You receive: {WITHDRAWAL_BLOCK - PLATFORM_FEE_PER_BLOCK} KES per block</li>
                    <li>• Funds arrive in your M-PESA within 5-30 minutes</li>
                    <li>• Transfer fees are covered by the platform</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 text-center">
            <div className="text-slate-400 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-semibold text-white mb-2">Insufficient Balance</h3>
              <p>You need at least KES {WITHDRAWAL_BLOCK} (2 referrals) to withdraw.</p>
              <p className="mt-2">Current balance: KES {availableBalance}</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-6 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-500 transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* Withdrawal History */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Withdrawal History</h2>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-emerald-400 hover:text-emerald-300 text-sm"
            >
              {showHistory ? 'Hide' : 'Show'}
            </button>
          </div>

          {showHistory && (
            <div className="space-y-3">
              {withdrawalHistory.length > 0 ? (
                withdrawalHistory.map((w) => (
                  <div
                    key={w.id}
                    className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-white font-semibold">KES {w.payoutAmount}</div>
                        <div className="text-xs text-slate-500">{new Date(w.createdAt).toLocaleDateString()}</div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          w.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : w.status === 'processing'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : w.status === 'failed'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {w.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      To: {w.mpesaNumber} • Fee: KES {w.platformFee}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-400 py-8">No withdrawals yet</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
