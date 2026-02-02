'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'
import { Users, Search, Filter } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function ReferralsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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
          <p className="text-slate-400">Loading referrals...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-red-400">Failed to load referrals</p>
      </div>
    )
  }

  const referrals = data.referrals || []

  // Filter referrals
  const filteredReferrals = referrals.filter((referral: any) => {
    const matchesSearch = referral.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         referral.productSlug.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || referral.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />

      <main className="lg:ml-64 p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Referrals</h1>
          <p className="text-slate-400">Track all your referred customers and commissions</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by email or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-3 bg-slate-900 border border-slate-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Referrals Table */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          {filteredReferrals.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-400 mb-2">
                {searchTerm || statusFilter !== 'all' ? 'No matching referrals' : 'No referrals yet'}
              </h3>
              <p className="text-slate-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your filters' 
                  : 'Start sharing your affiliate links to see referrals here'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Customer Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Sale Amount
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
                  {filteredReferrals.map((referral: any) => (
                    <tr key={referral.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-300">{referral.userEmail}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{referral.productSlug}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {formatCurrency(referral.amountPaid)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-400">
                        {formatCurrency(referral.commissionAmount)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                            referral.status === 'paid'
                              ? 'bg-green-900/30 text-green-400 border border-green-500/30'
                              : 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30'
                          }`}
                        >
                          {referral.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {new Date(referral.createdAt).toLocaleDateString('en-US', {
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

        {/* Stats Summary */}
        {filteredReferrals.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">Total Referrals</div>
              <div className="text-2xl font-bold text-white">{filteredReferrals.length}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">Successful</div>
              <div className="text-2xl font-bold text-green-400">
                {filteredReferrals.filter((r: any) => r.status === 'paid').length}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-sm text-slate-400 mb-1">Total Commission</div>
              <div className="text-2xl font-bold text-green-400">
                {formatCurrency(
                  filteredReferrals.reduce((sum: number, r: any) => sum + Number(r.commissionAmount), 0)
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
