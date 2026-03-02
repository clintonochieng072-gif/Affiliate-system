'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useCallback } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'
import { dashboardFetcher } from '@/lib/dashboard-fetcher'
import { BadgeCheck, TrendingUp, Copy, Check, ExternalLink } from 'lucide-react'

export default function DashboardOverviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const { data, error, isLoading } = useSWR(session ? '/api/dashboard' : null, dashboardFetcher, {
    refreshInterval: 15000,
  })

  const currentCommission = useMemo(() => {
    const matrix = Array.isArray(data?.currentCommissionMatrix) ? data.currentCommissionMatrix : []
    const individual = matrix.find((item: any) => String(item.planType).toLowerCase() === 'individual')
    const professional = matrix.find((item: any) => String(item.planType).toLowerCase() === 'professional')

    if (data && matrix.length === 0) {
      console.warn('[Overview] Commission matrix is empty – commission_rules table may not be seeded.')
    }

    return {
      individual: individual?.rewardAmount ?? null,
      professional: professional?.rewardAmount ?? null,
      hasData: matrix.length > 0,
    }
  }, [data])

  const salesLinks = Array.isArray(data?.salesTrackingLinks) ? data.salesTrackingLinks : []
  const firstLink = salesLinks.length > 0 ? salesLinks[0] : null
  const referralUrl = firstLink
    ? `https://affiliate.clintonstack.com/s/${firstLink.agentCode}`
    : null

  const [copiedLink, setCopiedLink] = useState(false)
  const copyReferralLink = useCallback(async () => {
    if (!referralUrl) return
    try {
      await navigator.clipboard.writeText(referralUrl)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = referralUrl
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }, [referralUrl])

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
  const welcomeName = String(data?.affiliate?.name || session?.user?.name || 'Sales Partner').trim() || 'Sales Partner'

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />

      <main className="lg:ml-64 p-4 sm:p-6 lg:p-8 space-y-5">
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <h1 className="text-2xl font-bold text-white mb-2">Overview</h1>
          <p className="text-blue-300 font-medium text-sm mb-2">Welcome {welcomeName}</p>
          <p className="text-slate-300 text-sm leading-6">
            Welcome to your Sales Partner dashboard. This page shows your current Sales Level, your active commission rates,
            and your progress to the next stage. Add new clients, stay active, and your level can move up automatically as your
            client count grows.
          </p>
        </section>

        {/* WhatsApp Sales Group Banner */}
        <section className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/50 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-white font-semibold flex items-center gap-2">
              💰 <span>Want More Sales?</span>
            </h2>
            <p className="text-slate-300 text-sm">
              Join our Sales WhatsApp Group for winning strategies, live updates, and exclusive sales tips.
            </p>
          </div>
          <a
            href="https://chat.whatsapp.com/LrRoGo2MTa1Fe9UDhsJTtz?mode=gi_t"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-lg font-semibold text-sm transition-all shrink-0 bg-green-600 hover:bg-green-500 text-white whitespace-nowrap"
          >
            Join Sales WhatsApp Group
          </a>
        </section>

        {/* Your Sales Link */}
        {referralUrl ? (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
            <h2 className="text-white font-semibold mb-2 inline-flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-blue-400" />
              Your Sales Link
            </h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-blue-300 font-mono break-all select-all">
                {referralUrl}
              </div>
              <button
                onClick={copyReferralLink}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all shrink-0 bg-blue-600 hover:bg-blue-500 text-white"
              >
                {copiedLink ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Share this sales link with potential clients. When they subscribe via your link, you earn commission. 
              Visit{' '}
              <Link href="/dashboard/products" className="text-blue-300 hover:text-blue-200 underline">Products to Promote</Link>{' '}
              for product details and additional sales links.
            </p>
          </section>
        ) : (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
            <h2 className="text-white font-semibold mb-2 inline-flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-blue-400" />
              Your Sales Link
            </h2>
            <p className="text-slate-400 text-sm">
              You haven&apos;t generated a sales link yet.{' '}
              <Link href="/dashboard/products" className="text-blue-300 hover:text-blue-200 underline">Go to Products to Promote</Link>{' '}
              to create one.
            </p>
          </section>
        )}

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
            {currentCommission.hasData ? (
              <p className="text-slate-300 text-sm leading-6">
                You earn:
                <br />- {formatCurrency(currentCommission.individual ?? 0)} per Individual Client
                <br />- {formatCurrency(currentCommission.professional ?? 0)} per Professional Client
              </p>
            ) : (
              <p className="text-sm text-orange-300 bg-orange-900/20 border border-orange-600/30 rounded-lg p-3">
                Commission data is not yet configured.
              </p>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <SummaryCard title="Individual Clients" value={summary.totalReferralsIndividual} />
          <SummaryCard title="Professional Clients" value={summary.totalReferralsProfessional} />
          <SummaryCard title="Total Earnings" value={formatCurrency(summary.totalSalesEarnings)} />
          <SummaryCard title="Available Balance" value={formatCurrency(summary.availableSalesEarnings)} />
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
              const commissionEntries = Array.isArray(item.commissionByLevel) ? item.commissionByLevel : []
              const individualCommission = commissionEntries.find((entry: any) => String(entry.planType).toLowerCase() === 'individual')?.rewardAmount
              const professionalCommission = commissionEntries.find((entry: any) => String(entry.planType).toLowerCase() === 'professional')?.rewardAmount
              const hasCommissionData = commissionEntries.length > 0

              return (
                <div
                  key={item.level}
                  className={`rounded-lg p-3 border ${item.reached ? 'border-emerald-500/40 bg-emerald-900/10' : 'border-slate-700 bg-slate-800/40'}`}
                >
                  <div className="text-white font-semibold">{item.displayName}</div>
                  <div className="text-xs text-slate-300 mt-2">Commission:</div>
                  {hasCommissionData ? (
                    <>
                      <div className="text-xs text-slate-400">Individual: {formatCurrency(individualCommission ?? 0)}</div>
                      <div className="text-xs text-slate-400">Professional: {formatCurrency(professionalCommission ?? 0)}</div>
                    </>
                  ) : (
                    <div className="text-xs text-orange-300 mt-1">Not configured</div>
                  )}
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
                  <div className="text-white text-sm">#{item.rank} {item.displayName || item.name || item.email}</div>
                  <div className="text-xs text-slate-400">{item.phone || 'Not provided'}</div>
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
