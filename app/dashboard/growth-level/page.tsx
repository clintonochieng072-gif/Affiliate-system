'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import useSWR from 'swr'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const payload = await response.json()

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || 'Request failed')
  }

  return payload
}

export default function GrowthAndLevelPage() {
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
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading growth data...</div>
  }

  if (error || !data) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">Failed to load growth data</div>
  }

  const progress = data.progress
  const roadmap = Array.isArray(data.roadmap) ? data.roadmap : []

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />
      <main className="lg:ml-64 p-4 sm:p-6 lg:p-8 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Growth & Level</h1>
          <p className="text-slate-400 text-sm">See where you are now and what you need to move to the next Sales Level.</p>
        </div>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="text-white font-semibold text-lg">{progress.currentLevelDisplayName}</div>
          <div className="text-sm text-slate-300">
            You earn:
            <br />- {formatCurrency(currentCommission.individual)} per Individual Client
            <br />- {formatCurrency(currentCommission.professional)} per Professional Client
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">Progress to {progress.nextLevelDisplayName || 'top level'}</span>
            <span className="text-slate-400">{progress.progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
            <div className="h-3 bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${progress.progressPercent}%` }} />
          </div>
          <div className="text-xs text-slate-400">
            Individual progress: {progress.individualProgressPercent}% • Professional progress: {progress.professionalProgressPercent}%
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {roadmap.map((item: any) => {
            const individualCommission = item.commissionByLevel?.find((entry: any) => String(entry.planType).toLowerCase() === 'individual')?.rewardAmount ?? 0
            const professionalCommission = item.commissionByLevel?.find((entry: any) => String(entry.planType).toLowerCase() === 'professional')?.rewardAmount ?? 0

            return (
              <div key={item.level} className={`rounded-lg p-4 border ${item.reached ? 'border-emerald-500/40 bg-emerald-900/10' : 'border-slate-700 bg-slate-900'}`}>
                <div className="text-white font-semibold">{item.displayName}</div>
                <div className="text-xs text-slate-300 mt-2">Commission:</div>
                <div className="text-xs text-slate-400">Individual: {formatCurrency(individualCommission)}</div>
                <div className="text-xs text-slate-400">Professional: {formatCurrency(professionalCommission)}</div>
                {item.nextLevel ? (
                  <div className="text-xs text-slate-400 mt-2">Required referrals: {item.individualRequired} Individual or {item.professionalRequired} Professional</div>
                ) : (
                  <div className="text-xs text-emerald-300 mt-2">You qualify for an interview review with ClintonStack for potential permanent employment.</div>
                )}
                <div className={`text-xs mt-3 font-medium ${item.reached ? 'text-emerald-300' : 'text-slate-400'}`}>{item.reached ? 'Active' : 'Locked'}</div>
              </div>
            )
          })}
        </section>
      </main>
    </div>
  )
}
