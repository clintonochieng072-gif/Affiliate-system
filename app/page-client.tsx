/**
 * Landing Page Client Component
 * Premium landing page with hero, value props, how it works, featured product, testimonials
 */

'use client'

import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, DollarSign, Users, TrendingUp, CheckCircle, Star } from 'lucide-react'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (session) {
      router.push('/dashboard')
    }
  }, [session, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Check for OAuth errors in URL
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const authError = urlParams?.get('error')

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px]"></div>
        
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-3xl animate-pulse"></div>

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          {/* Error Message */}
          {authError && (
            <div className="mb-8 bg-red-950/50 border border-red-500/50 rounded-xl p-6 text-left max-w-2xl mx-auto">
              <div className="flex items-start gap-3">
                <div className="text-red-400 text-2xl">⚠️</div>
                <div className="flex-1">
                  <h3 className="text-red-400 font-bold text-lg mb-2">Google Sign-In Configuration Needed</h3>
                  <p className="text-red-300 text-sm mb-3">
                    The Google OAuth credentials need to be set up. Please follow these steps:
                  </p>
                  <ol className="text-red-300 text-sm space-y-1 ml-4 list-decimal">
                    <li>Go to Google Cloud Console</li>
                    <li>Create OAuth 2.0 credentials</li>
                    <li>Add redirect URI: <code className="bg-red-900/30 px-2 py-0.5 rounded">http://localhost:3000/api/auth/callback/google</code></li>
                    <li>Update your .env.local file with new credentials</li>
                  </ol>
                  <p className="text-red-300 text-sm mt-3">
                    📄 See <strong>GOOGLE-OAUTH-SETUP.md</strong> for detailed instructions
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2 text-green-400 text-sm font-medium">
            <Star className="w-4 h-4 fill-current" />
            <span>Join 1000+ Young African Affiliates</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-green-300 bg-clip-text text-transparent">
            Turn Your Influence into Income with Clintonstack Affiliates
          </h1>

          <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto">
            Join a community of young Africans earning from promoting our SaaS products. Simple. Transparent. Rewarding.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold px-8 py-4 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/50"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-lg backdrop-blur-sm border border-white/20 transition-all duration-300"
            >
              Learn How It Works
            </a>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-green-400 mb-2">KSh 2.5M+</div>
              <div className="text-slate-400">Paid to Affiliates</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400 mb-2">1000+</div>
              <div className="text-slate-400">Active Affiliates</div>
            </div>
            <div className="text-center col-span-2 md:col-span-1">
              <div className="text-4xl font-bold text-orange-400 mb-2">30%</div>
              <div className="text-slate-400">Commission Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="py-24 px-4 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Why Choose Clintonstack Affiliates?
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Everything you need to start earning from your network
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="group bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-green-500/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-green-500/20">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Earn Money Easily</h3>
              <p className="text-slate-400 leading-relaxed">
                Promote SaaS products to your network and get up to 30% commission on every successful referral. Get paid directly to your bank account.
              </p>
            </div>

            {/* Card 2 */}
            <div className="group bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-blue-500/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Trusted by Youth</h3>
              <p className="text-slate-400 leading-relaxed">
                Supporting young entrepreneurs across Africa with reliable income opportunities. Join thousands who are already earning.
              </p>
            </div>

            {/* Card 3 */}
            <div className="group bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-orange-500/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/20">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Transparent Dashboard</h3>
              <p className="text-slate-400 leading-relaxed">
                Track your referrals, earnings, and payouts in real-time. See exactly how much you're making and when you'll get paid.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-4 bg-gradient-to-b from-transparent via-blue-950/30 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Start earning in 4 simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl border border-slate-700 hover:border-blue-500/50 transition-all">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4">
                  1
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Sign Up with Google</h3>
                <p className="text-slate-400">
                  Quick and secure authentication. Get started in seconds.
                </p>
              </div>
              {/* Arrow */}
              <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-blue-500/30">
                <ArrowRight className="w-8 h-8" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl border border-slate-700 hover:border-green-500/50 transition-all">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4">
                  2
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Get Your Links</h3>
                <p className="text-slate-400">
                  Generate unique referral links for any product in seconds.
                </p>
              </div>
              <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-green-500/30">
                <ArrowRight className="w-8 h-8" />
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl border border-slate-700 hover:border-orange-500/50 transition-all">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4">
                  3
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Share & Earn</h3>
                <p className="text-slate-400">
                  Share your links and earn 30% commission on every sale.
                </p>
              </div>
              <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-orange-500/30">
                <ArrowRight className="w-8 h-8" />
              </div>
            </div>

            {/* Step 4 */}
            <div>
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl border border-slate-700 hover:border-green-500/50 transition-all">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4">
                  4
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Withdraw Earnings</h3>
                <p className="text-slate-400">
                  Request payout when you reach KSh 5,000. Get paid instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Product Section */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold px-4 py-1 rounded-full mb-4">
              FEATURED PRODUCT
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Lead Capture System
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              The #1 tool for capturing and converting leads. Help businesses grow and earn 30% commission.
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8 md:p-12 rounded-3xl border border-blue-500/30 shadow-2xl shadow-blue-500/20">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-3xl font-bold text-white mb-6">What It Does</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                    <span className="text-slate-300">Capture leads with beautiful, customizable forms</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                    <span className="text-slate-300">Automated follow-ups and email campaigns</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                    <span className="text-slate-300">Real-time analytics and conversion tracking</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                    <span className="text-slate-300">Integrations with popular CRMs</span>
                  </li>
                </ul>

                <div className="mt-8 p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="text-3xl font-bold text-green-400 mb-2">Earn KSh 3,000</div>
                  <div className="text-slate-300">Per successful referral (30% commission)</div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700">
                <div className="aspect-square bg-gradient-to-br from-blue-500/20 to-green-500/20 rounded-xl flex items-center justify-center mb-6">
                  <div className="text-6xl">📊</div>
                </div>
                <button
                  onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                  className="block w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold text-center py-4 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-green-500/50"
                >
                  Generate Affiliate Link
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 px-4 bg-gradient-to-b from-transparent via-slate-950/50 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Success Stories
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Hear from affiliates earning with Clintonstack
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-2xl border border-slate-700">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-300 mb-6 leading-relaxed">
                "I've earned over KSh 150,000 in just 3 months! The dashboard is so easy to use and payouts are always on time."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  CJ
                </div>
                <div>
                  <div className="font-semibold text-white">Chioma Johnson</div>
                  <div className="text-sm text-slate-400">Lagos, Nigeria</div>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-2xl border border-slate-700">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-300 mb-6 leading-relaxed">
                "As a student, this has been a game-changer. I share links on my WhatsApp status and earn consistently every month."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
                  EO
                </div>
                <div>
                  <div className="font-semibold text-white">Emmanuel Okafor</div>
                  <div className="text-sm text-slate-400">Abuja, Nigeria</div>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-2xl border border-slate-700">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-300 mb-6 leading-relaxed">
                "The transparency is amazing. I can see every click, every conversion, and exactly how much I've earned. Best affiliate program!"
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                  FA
                </div>
                <div>
                  <div className="font-semibold text-white">Fatima Abdullahi</div>
                  <div className="text-sm text-slate-400">Kano, Nigeria</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-blue-950 via-slate-900 to-green-950 p-12 md:p-16 rounded-3xl border border-blue-500/30 shadow-2xl shadow-blue-500/20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Start Earning?
            </h2>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Join thousands of young Africans building their financial freedom through affiliate marketing.
            </p>
            <button
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold px-10 py-5 rounded-lg text-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-green-500/50"
            >
              Get Started Free
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <h3 className="text-2xl font-bold text-white mb-4">Clintonstack Affiliates</h3>
              <p className="text-slate-400 mb-4">
                Empowering young Africans to earn from their influence. Join the movement today.
              </p>
              <button
                onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-all"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><a href="#how-it-works" className="text-slate-400 hover:text-white transition-colors">How It Works</a></li>
                <li><Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link href="/admin" className="text-slate-400 hover:text-white transition-colors">Admin</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 text-center text-slate-400">
            <p>&copy; {new Date().getFullYear()} Clintonstack. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
