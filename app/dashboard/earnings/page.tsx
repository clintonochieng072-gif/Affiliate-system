'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import useSWR from 'swr'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'
import { DollarSign, TrendingUp, Clock, CheckCircle2 } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function EarningsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const { data, error, isLoading } = useSWR(
    session ? '/api/dashboard' : null,
    fetcher,
    { refreshInterval: 10000 }
  )

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading earnings...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-red-400">Failed to load earnings</p>
      </div>
    )
  }

  const salesActivity = data.salesActivity || []

  // Calculate earnings
  const paidEarnings = salesActivity
    .filter((r: any) => r.status === 'paid')
    .reduce((sum: number, r: any) => sum + Number(r.salesEarnings), 0)

  const pendingEarnings = salesActivity
    .filter((r: any) => r.status === 'pending')
    .reduce((sum: number, r: any) => sum + Number(r.salesEarnings), 0)

  const totalEarnings = paidEarnings + pendingEarnings

  // Monthly breakdown
  const monthlyData: Record<string, { paid: number; pending: number }> = {}

  salesActivity.forEach((sale: any) => {
    const date = new Date(sale.createdAt)
    const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    if (!monthlyData[monthYear]) {
      monthlyData[monthYear] = { paid: 0, pending: 0 }
    }

    if (sale.status === 'paid') {
      monthlyData[monthYear].paid += Number(sale.salesEarnings)
    } else {
      monthlyData[monthYear].pending += Number(sale.salesEarnings)
    }
  })

  const monthlyBreakdown = Object.entries(monthlyData).reverse()

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />

      <main className="lg:ml-64 p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Monthly Sales Earnings</h1>
          <p className="text-slate-400">Track your sales earnings over time</p>
        </div>

        {/* Overview Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-2xl shadow-xl border border-blue-500/20">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-blue-100" />
              <TrendingUp className="w-5 h-5 text-blue-100" />
            </div>
            <div className="text-sm text-blue-100 mb-2">Total Earnings</div>
            <div className="text-3xl font-bold text-white">{formatCurrency(totalEarnings)}</div>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 p-6 rounded-2xl shadow-xl border border-green-500/20">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-100" />
            </div>
            <div className="text-sm text-green-100 mb-2">Paid Earnings</div>
            <div className="text-3xl font-bold text-white">{formatCurrency(paidEarnings)}</div>
          </div>

          <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 p-6 rounded-2xl shadow-xl border border-yellow-500/20">
            <div className="flex items-center justify-between mb-4">
              <Clock className="w-8 h-8 text-yellow-100" />
            </div>
            <div className="text-sm text-yellow-100 mb-2">Pending Earnings</div>
            <div className="text-3xl font-bold text-white">{formatCurrency(pendingEarnings)}</div>
          </div>
        </div>

        {/* Monthly Breakdown */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
          <h2 className="text-xl font-bold text-white mb-6">Monthly Breakdown</h2>

          {monthlyBreakdown.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-400 mb-2">No earnings yet</h3>
              <p className="text-slate-500">Start promoting products to see your earnings here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {monthlyBreakdown.map(([month, data]) => (
                <div
                  key={month}
                  className="bg-slate-800 rounded-xl p-5 hover:bg-slate-750 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">{month}</h3>
                    <div className="text-xl font-bold text-green-400">
                      {formatCurrency(data.paid + data.pending)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-1">Paid</div>
                      <div className="text-lg font-semibold text-green-400">
                        {formatCurrency(data.paid)}
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-1">Pending</div>
                      <div className="text-lg font-semibold text-yellow-400">
                        {formatCurrency(data.pending)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Earnings Info */}
        <div className="mt-8 bg-blue-950/30 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">How Earnings Work</h3>
          <ul className="space-y-2 text-slate-300 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span><strong>Pending:</strong> Sales earnings are recorded but payment has not been confirmed</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span><strong>Paid:</strong> Sales earnings are confirmed and added to your available balance</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span><strong>Minimum Withdrawal:</strong> Withdraw sales earnings starting at KSh 140 (2 active subscriptions)</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}
