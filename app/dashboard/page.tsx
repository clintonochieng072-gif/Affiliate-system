'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'
import { ArrowRight, BadgeCheck, Wallet, Users, TrendingUp } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function DashboardOverviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const { data, error, isLoading } = useSWR(session ? '/api/dashboard' : null, fetcher, {
    refreshInterval: 15000,
  })

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Loading overview...</p>
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

  const affiliate = data.affiliate || {
    isProfileComplete: false,
  }
  const summary = data.summary || {
    totalReferrals: 0,
    totalReferralsIndividual: 0,
    totalReferralsProfessional: 0,
    totalSalesEarnings: 0,
    availableSalesEarnings: 0,
    pendingSalesEarnings: 0,
  }
  const progress = data.progress || {
    currentLevelLabel: 'Level 1',
    nextLevelLabel: 'Level 2',
    progressPercent: 0,
    individualProgressPercent: 0,
    professionalProgressPercent: 0,
  }
  const roadmap = Array.isArray(data.roadmap) ? data.roadmap : []

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />

      <main className="lg:ml-64 p-4 lg:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Affiliate Overview</h1>
            <p className="text-slate-400 text-sm">Track your level progression and commissions</p>
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 text-sm font-medium w-fit">
            <BadgeCheck className="w-4 h-4" />
            {progress.currentLevelLabel}
          </span>
        </div>

        {!affiliate.isProfileComplete && (
          <div className="bg-orange-950/30 border border-orange-500/40 rounded-lg p-4 flex items-center justify-between gap-3">
            <p className="text-orange-200 text-sm">Complete your profile with name and phone to improve leaderboard visibility.</p>
            <Link href="/dashboard/profile" className="text-orange-300 text-sm font-semibold hover:text-orange-200">
              Update Profile →
            </Link>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-300">Progress to {progress.nextLevelLabel || 'Top Level'}</span>
            <span className="text-slate-400">{progress.progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div className="h-2.5 bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${progress.progressPercent}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-800 rounded p-2 text-slate-300">
              Individual Progress: {progress.individualProgressPercent}%
            </div>
            <div className="bg-slate-800 rounded p-2 text-slate-300">
              Professional Progress: {progress.professionalProgressPercent}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">Individual Referrals</div>
            <div className="text-xl text-white font-semibold">{summary.totalReferralsIndividual}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">Professional Referrals</div>
            <div className="text-xl text-white font-semibold">{summary.totalReferralsProfessional}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">Total Earnings</div>
            <div className="text-xl text-white font-semibold">{formatCurrency(summary.totalSalesEarnings)}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">Available Balance</div>
            <div className="text-xl text-emerald-400 font-semibold">{formatCurrency(summary.availableSalesEarnings)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-2">Pending Balance</div>
            <div className="text-2xl font-bold text-yellow-400 mb-3">{formatCurrency(summary.pendingSalesEarnings)}</div>
            <Link
              href="/dashboard/payouts"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              <Wallet className="w-4 h-4" />
              Withdraw
            </Link>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-3">Growth Snapshot</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 inline-flex items-center gap-2"><Users className="w-4 h-4" /> Total Referrals</span>
                <span className="text-white font-semibold">{summary.totalReferrals}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300 inline-flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Level</span>
                <span className="text-white font-semibold">{progress.currentLevelLabel}</span>
              </div>
              <Link href="/dashboard/leaderboard" className="inline-flex mt-2 text-blue-400 hover:text-blue-300 font-medium text-sm items-center gap-1">
                View leaderboard <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h2 className="text-white font-semibold mb-3">Level Roadmap</h2>
          <div className="grid md:grid-cols-4 gap-3">
            {roadmap.map((item: any) => (
              <div
                key={item.level}
                className={`rounded-lg p-3 border ${item.reached ? 'border-emerald-500/40 bg-emerald-900/10' : 'border-slate-700 bg-slate-800/40'}`}
              >
                <div className="text-sm font-semibold text-white">{item.label}</div>
                {item.nextLevel ? (
                  <p className="text-xs text-slate-400 mt-1">
                    Next with {item.individualRequired} Individual or {item.professionalRequired} Professional
                  </p>
                ) : (
                  <p className="text-xs text-emerald-300 mt-1">Eligible for interview review</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
