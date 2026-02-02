'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'
import { ArrowRight, TrendingUp, Users, DollarSign, Wallet, ExternalLink } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function DashboardPage() {
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
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-red-400">Failed to load dashboard</p>
      </div>
    )
  }

  const totalReferrals = data.referrals?.length || 0
  const successfulConversions = data.referrals?.filter((r: any) => r.status === 'paid').length || 0
  const totalEarnings = data.balance || 0
  const availableBalance = totalEarnings
  const recentReferrals = data.referrals?.slice(0, 5) || []

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />

      <main className="lg:ml-64 p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {session?.user?.name}</h1>
          <p className="text-slate-400">Here's what's happening with your affiliate account</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-2xl shadow-xl border border-blue-500/20">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-blue-100" />
              <span className="text-blue-100 text-sm font-medium">Total</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{totalReferrals}</div>
            <div className="text-blue-100 text-sm">Referrals</div>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 p-6 rounded-2xl shadow-xl border border-green-500/20">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-green-100" />
              <span className="text-green-100 text-sm font-medium">Success</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{successfulConversions}</div>
            <div className="text-green-100 text-sm">Conversions</div>
          </div>

          <div className="bg-gradient-to-br from-orange-600 to-orange-700 p-6 rounded-2xl shadow-xl border border-orange-500/20">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-orange-100" />
              <span className="text-orange-100 text-sm font-medium">Total</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{formatCurrency(totalEarnings)}</div>
            <div className="text-orange-100 text-sm">Earnings</div>
          </div>

          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 rounded-2xl shadow-xl border border-emerald-500/20">
            <div className="flex items-center justify-between mb-4">
              <Wallet className="w-8 h-8 text-emerald-100" />
              <span className="text-emerald-100 text-sm font-medium">Available</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{formatCurrency(availableBalance)}</div>
            <div className="text-emerald-100 text-sm">Balance</div>
          </div>
        </div>

        {/* Featured Product */}
        <div className="mb-8">
          <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-blue-500/30 rounded-2xl p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="inline-block bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-3">
                  FEATURED PRODUCT
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Lead Capture System</h2>
                <p className="text-slate-400">Earn 30% commission (₦3,000 per sale)</p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard/products"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 hover:scale-105"
              >
                Generate Affiliate Link
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="https://leads.clintonstack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-lg backdrop-blur-sm border border-white/20 transition-all"
              >
                View Product
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Recent Referrals</h2>
            <Link
              href="/dashboard/referrals"
              className="text-blue-400 hover:text-blue-300 font-medium text-sm"
            >
              View All →
            </Link>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            {recentReferrals.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-400 mb-2">No referrals yet</h3>
                <p className="text-slate-500 mb-6">Start sharing your affiliate links to see referrals here</p>
                <Link
                  href="/dashboard/products"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-all"
                >
                  Generate Links
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Commission
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {recentReferrals.map((referral: any) => (
                      <tr key={referral.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-300">{referral.userEmail}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">{referral.productSlug}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-green-400">
                          {formatCurrency(referral.commissionAmount)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              referral.status === 'paid'
                                ? 'bg-green-900/30 text-green-400'
                                : 'bg-yellow-900/30 text-yellow-400'
                            }`}
                          >
                            {referral.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {new Date(referral.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
