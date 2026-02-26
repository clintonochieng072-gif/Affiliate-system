'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'
import { BadgeCheck, TrendingUp } from 'lucide-react'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const payload = await response.json()

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || 'Request failed')
  }

  return payload
}

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

  useEffect(() => {
    if (data?.affiliate && !data.affiliate.isProfileComplete) {
      router.push('/dashboard/profile?required=1')
    }
  }, [data, router])

  const currentCommission = useMemo(() => {
    const matrix = Array.isArray(data?.currentCommissionMatrix) ? data.currentCommissionMatrix : []
    const individual = matrix.find((item: any) => String(item.planType).toLowerCase() === 'individual')
    const professional = matrix.find((item: any) => String(item.planType).toLowerCase() === 'professional')

    return {
      individual: individual?.rewardAmount ?? 0,
      professional: professional?.rewardAmount ?? 0,
    }
  }, [data])

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

  const summary = data.summary || {
    totalReferralsIndividual: 0,
    totalReferralsProfessional: 0,
    totalSalesEarnings: 0,
    availableSalesEarnings: 0,
    pendingSalesEarnings: 0,
  }

  const progress = data.progress || {
    currentLevelDisplayName: 'Level 1 – Sales Associate',
    nextLevelDisplayName: 'Level 2 – Senior Sales Associate',
    progressPercent: 0,
  }

  const roadmap = Array.isArray(data.roadmap) ? data.roadmap : []
  const leaderboardPreview = Array.isArray(data.leaderboardPreview) ? data.leaderboardPreview : []

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />

      <main className="lg:ml-64 p-4 sm:p-6 lg:p-8 space-y-5">
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <h1 className="text-2xl font-bold text-white mb-2">Overview</h1>
          <p className="text-slate-300 text-sm leading-6">
            Welcome to your Sales Partner dashboard. This page shows your current Sales Level, your active commission rates,
            and your progress to the next stage. Add new clients, stay active, and your level can move up automatically as your
            client count grows.
          </p>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-white font-semibold text-lg">Current Sales Level</h2>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 text-sm font-medium">
                <BadgeCheck className="w-4 h-4" />
                Active
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white mb-2">{progress.currentLevelDisplayName}</div>
            <p className="text-slate-400 text-sm">
              Next target: {progress.nextLevelDisplayName || 'Top level reached'}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-2">Commission per Active Client</h2>
            <p className="text-slate-300 text-sm leading-6">
              You earn:
              <br />- {formatCurrency(currentCommission.individual)} per Individual Client
              <br />- {formatCurrency(currentCommission.professional)} per Professional Client
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <SummaryCard title="Individual Clients" value={summary.totalReferralsIndividual} />
          <SummaryCard title="Professional Clients" value={summary.totalReferralsProfessional} />
          <SummaryCard title="Total Earnings" value={formatCurrency(summary.totalSalesEarnings)} />
          <SummaryCard title="Available Balance" value={formatCurrency(summary.availableSalesEarnings)} />
          <SummaryCard title="Pending Balance" value={formatCurrency(summary.pendingSalesEarnings)} />
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-300">Progress to next level</span>
            <span className="text-slate-400">{progress.progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
            <div className="h-3 bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${progress.progressPercent}%` }} />
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <h2 className="text-white font-semibold mb-3 inline-flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Level Roadmap
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {roadmap.map((item: any) => {
              const individualCommission = item.commissionByLevel?.find((entry: any) => String(entry.planType).toLowerCase() === 'individual')?.rewardAmount ?? 0
              const professionalCommission = item.commissionByLevel?.find((entry: any) => String(entry.planType).toLowerCase() === 'professional')?.rewardAmount ?? 0

              return (
                <div
                  key={item.level}
                  className={`rounded-lg p-3 border ${item.reached ? 'border-emerald-500/40 bg-emerald-900/10' : 'border-slate-700 bg-slate-800/40'}`}
                >
                  <div className="text-white font-semibold">{item.displayName}</div>
                  <div className="text-xs text-slate-300 mt-2">Commission:</div>
                  <div className="text-xs text-slate-400">Individual: {formatCurrency(individualCommission)}</div>
                  <div className="text-xs text-slate-400">Professional: {formatCurrency(professionalCommission)}</div>
                  {item.nextLevel ? (
                    <div className="text-xs text-slate-400 mt-2">
                      Move up with {item.individualRequired} Individual Clients or {item.professionalRequired} Professional Clients.
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-300 mt-2">
                      You qualify for an interview review with ClintonStack for potential permanent employment.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">Top 10 Sales Partners</h2>
            <Link href="/dashboard/leaderboard" className="text-sm text-blue-300 hover:text-blue-200">
              View full leaderboard →
            </Link>
          </div>
          <div className="space-y-2">
            {leaderboardPreview.map((item: any) => (
              <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-800/40 p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-white text-sm">#{item.rank} {item.name || item.email}</div>
                  <div className="text-xs text-slate-400">{item.level.replace('LEVEL_', 'Level ')} • {item.totalReferrals} clients</div>
                </div>
                <div className="text-sm font-semibold text-emerald-400">{formatCurrency(item.totalEarnings)}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function SummaryCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 sm:p-4">
      <div className="text-xs text-slate-400">{title}</div>
      <div className="text-lg sm:text-xl text-white font-semibold mt-1">{value}</div>
    </div>
  )
}
