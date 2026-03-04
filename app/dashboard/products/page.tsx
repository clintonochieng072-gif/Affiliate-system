'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import DashboardNav from '@/components/DashboardNav'
import { formatCurrency } from '@/lib/utils'
import { dashboardFetcher } from '@/lib/dashboard-fetcher'
import { Copy, Check, ExternalLink, ShoppingBag } from 'lucide-react'

export default function ProductsToPromotePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  // Fetch products
  const { data: productsData, error: productsError, isLoading: productsLoading } = useSWR(
    session ? '/api/products' : null,
    dashboardFetcher,
  )

  // Fetch dashboard to get existing links and commission info
  const { data: dashboardData, error: dashboardError, isLoading: dashboardLoading, mutate: mutateDashboard } = useSWR(
    session ? '/api/dashboard' : null,
    dashboardFetcher,
    { refreshInterval: 30000 },
  )

  const currentCommission = useMemo(() => {
    const matrix = Array.isArray(dashboardData?.currentCommissionMatrix) ? dashboardData.currentCommissionMatrix : []
    const individual = matrix.find((item: any) => String(item.planType).toLowerCase() === 'individual')
    const professional = matrix.find((item: any) => String(item.planType).toLowerCase() === 'professional')

    return {
      individual: individual?.rewardAmount ?? null,
      professional: professional?.rewardAmount ?? null,
      hasData: matrix.length > 0,
    }
  }, [dashboardData])

  // Map existing links by productSlug for quick lookup
  const existingLinks = useMemo(() => {
    const links = Array.isArray(dashboardData?.salesTrackingLinks) ? dashboardData.salesTrackingLinks : []
    const map: Record<string, { agentCode: string }> = {}
    for (const link of links) {
      map[link.productSlug] = link
    }
    return map
  }, [dashboardData])

  const generateLink = useCallback(async (productId: string) => {
    setGeneratingFor(productId)
    try {
      const response = await fetch('/api/link/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload?.error || 'Failed to generate link')
      }

      // Refresh dashboard data to get new link
      await mutateDashboard()
    } catch (error) {
      console.error('Error generating sales link:', error)
    } finally {
      setGeneratingFor(null)
    }
  }, [mutateDashboard])

  const buildTrackingUrl = (code: string) => {
    return `https://affiliate.clintonstack.com/s/${code}`
  }

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }, [])

  const isLoading = status === 'loading' || productsLoading || dashboardLoading

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Loading products...</p>
      </div>
    )
  }

  if (productsError || dashboardError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-red-400">Failed to load products data</p>
      </div>
    )
  }

  const products = Array.isArray(productsData?.products) ? productsData.products : []

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />

      <main className="lg:ml-64 p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Page Header */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Products to Promote</h1>
          </div>
          <p className="text-slate-300 text-sm leading-6">
            Generate your unique sales link for each product below. Share your link with potential clients —
            when they subscribe through your link, you earn commission based on your current Sales Level.
          </p>
        </section>

        {/* Commission Reminder */}
        <section className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 sm:p-5">
          <h2 className="text-blue-300 font-semibold mb-1">Your Commission</h2>
          {currentCommission.hasData ? (
            <p className="text-slate-300 text-sm leading-6">
              You earn commission based on your current Sales Level:
          {/* Demo product description for affiliates - collapsible read more */}
          <div className="mt-4">
            <details className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <summary className="text-sm text-blue-300 font-semibold cursor-pointer">Read More</summary>
              <div className="mt-3 text-slate-300 text-sm leading-6 whitespace-pre-line">
{`What Is the Lead Capture System? (For Affiliates)
              <br />• <span className="text-white font-medium">{formatCurrency(currentCommission.individual ?? 0)}</span> per Individual plan subscription (Ksh 3,700/month)
              <br />• <span className="text-white font-medium">{formatCurrency(currentCommission.professional ?? 0)}</span> per Professional plan subscription (Ksh 7,600/month)
            </p>
          ) : (
            <p className="text-sm text-orange-300">
              You earn commission based on your current Sales Level. Commission rates will appear once configured by the administrator.
            </p>
          )}
        </section>

        {/* Products List */}
        {products.length === 0 ? (
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
            <p className="text-slate-400">No products available for promotion yet. Check back soon.</p>
          </section>
        ) : (
          <div className="space-y-4">
            {products.map((product: any) => {
              const link = existingLinks[product.slug]
              const trackingUrl = link ? buildTrackingUrl(link.agentCode) : null
              const isGenerating = generatingFor === product.id

              return (
                <section
                  key={product.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4"
                >
                  {/* Product Info */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h2 className="text-lg font-semibold text-white">{product.name}</h2>
                      {product.isHighlighted && (
                        <span className="text-xs bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          Featured
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 text-sm leading-6 mb-3">
                      {product.description}
                    </p>

                    {/* Plan Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                        <div className="text-white font-medium text-sm">Individual Plan</div>
                        <div className="text-xl font-bold text-white mt-1">Ksh 3,700<span className="text-xs text-slate-400 font-normal">/month</span></div>
                        <div className="text-xs text-slate-400 mt-1">Perfect for solo professionals and freelancers</div>
                      </div>
                      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                        <div className="text-white font-medium text-sm">Professional Plan</div>
                        <div className="text-xl font-bold text-white mt-1">Ksh 7,600<span className="text-xs text-slate-400 font-normal">/month</span></div>
                        <div className="text-xs text-slate-400 mt-1">For teams and growing businesses</div>
                      </div>
                    </div>
                  </div>

                  {/* Sales Link Section */}
                  <div className="border-t border-slate-800 pt-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Your Unique Sales Link</h3>

                    {trackingUrl ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-blue-300 font-mono break-all select-all">
                          {trackingUrl}
                        </div>
                        <button
                          onClick={() => copyToClipboard(trackingUrl, product.id)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all shrink-0 bg-blue-600 hover:bg-blue-500 text-white"
                        >
                          {copiedId === product.id ? (
                            <>
                              <Check className="w-4 h-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy Link
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => generateLink(product.id)}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-60"
                      >
                        {isGenerating ? (
                          'Generating...'
                        ) : (
                          <>
                            <ExternalLink className="w-4 h-4" />
                            Generate Sales Link
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
              </div>
            </details>
          </div>
  )
}
