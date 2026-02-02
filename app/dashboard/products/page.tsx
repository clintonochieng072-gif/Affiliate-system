'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import DashboardNav from '@/components/DashboardNav'
import { ArrowRight, Copy, Check, ExternalLink, Package } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function ProductsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState<string | null>(null)
  const [affiliateLinks, setAffiliateLinks] = useState<Record<string, string>>({})

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  const { data, error, isLoading } = useSWR('/api/products', fetcher)

  const handleGenerateLink = async (productId: string) => {
    setGeneratingLink(productId)
    try {
      const response = await fetch('/api/link/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      })

      if (!response.ok) throw new Error('Failed to generate link')

      const data = await response.json()
      setAffiliateLinks(prev => ({ ...prev, [productId]: data.referralUrl }))
    } catch (error) {
      alert('Failed to generate affiliate link')
    } finally {
      setGeneratingLink(null)
    }
  }

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading products...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-red-400">Failed to load products</p>
      </div>
    )
  }

  const products = data.products || []

  return (
    <div className="min-h-screen bg-slate-950">
      <DashboardNav />

      <main className="lg:ml-64 p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Products to Promote</h1>
          <p className="text-slate-400">Generate affiliate links and start earning commissions</p>
        </div>

        {products.length === 0 ? (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center">
            <Package className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">No products available</h3>
            <p className="text-slate-500">Check back soon for products to promote</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {products.map((product: any) => (
              <div
                key={product.id}
                className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-blue-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10"
              >
                {product.isHighlighted && (
                  <div className="inline-block bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-4">
                    FEATURED
                  </div>
                )}

                <h3 className="text-2xl font-bold text-white mb-3">{product.name}</h3>
                <p className="text-slate-400 mb-6 leading-relaxed">{product.description}</p>

                <div className="flex items-center gap-2 mb-6">
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
                  >
                    View Product
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {affiliateLinks[product.id] ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Your Affiliate Link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={affiliateLinks[product.id]}
                        readOnly
                        className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-mono"
                      />
                      <button
                        onClick={() => copyToClipboard(affiliateLinks[product.id])}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all flex items-center gap-2"
                      >
                        {copiedCode === affiliateLinks[product.id] ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleGenerateLink(product.id)}
                    disabled={generatingLink === product.id}
                    className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingLink === product.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        Generate Affiliate Link
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
