'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect } from 'react'
import {
  Menu,
  X,
  LayoutDashboard,
  Users,
  Trophy,
  UserCog,
  LogOut,
  Wallet,
  TrendingUp,
  BarChart3,
} from 'lucide-react'

export default function DashboardNav() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const [profile, setProfile] = useState<{ name: string; phone: string } | null>(null)
  const [isProfileModalMounted, setIsProfileModalMounted] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  // Only check profile once per session using sessionStorage to persist across page navigations
  useEffect(() => {
    // Check if we've already verified the profile in this session
    const profileChecked = sessionStorage.getItem('profileChecked')
    if (profileChecked === 'true') {
      return
    }

    let isActive = true

    const loadProfile = async () => {
      try {
        const response = await fetch('/api/profile')
        if (!response.ok) {
          return
        }

        const payload = await response.json()
        const currentName = String(payload?.profile?.name || '').trim()
        const currentPhone = String(payload?.profile?.phone || '').trim()
        const hasName = Boolean(currentName)
        const hasPhone = Boolean(currentPhone)

        console.log('[DashboardNav] Profile check:', { hasName, hasPhone, name: currentName, phone: currentPhone })

        if (!isActive) {
          return
        }

        setProfile({ name: currentName, phone: currentPhone })

        // Only show modal if profile is incomplete
        if (!hasName || !hasPhone) {
          setIsProfileModalMounted(true)
          requestAnimationFrame(() => setIsProfileModalOpen(true))
          setProfileName(currentName)
          setProfilePhone(currentPhone)
        } else {
          // Profile is complete, mark as checked so modal never shows again
          sessionStorage.setItem('profileChecked', 'true')
          console.log('[DashboardNav] Profile complete, modal will not show')
        }
      } catch {
        // Even on error, don't keep showing the modal
        sessionStorage.setItem('profileChecked', 'true')
      }
    }

    loadProfile()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!isProfileModalOpen) {
      return
    }

    // Prevent background scrolling while the modal is open.
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = ''
    }
  }, [isProfileModalOpen])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  const closeProfileModal = () => {
    // Close animation runs before unmounting the modal overlay.
    setIsProfileModalOpen(false)
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = window.setTimeout(() => {
      setIsProfileModalMounted(false)
    }, 200)
  }

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setProfileError(null)

    const trimmedName = profileName.trim()
    const trimmedPhone = profilePhone.trim()
    const phoneDigits = trimmedPhone.replace(/\D/g, '')

    if (trimmedName.length < 2) {
      setProfileError('Please enter your full name.')
      return
    }

    if (phoneDigits.length < 7) {
      setProfileError('Please enter a valid phone number.')
      return
    }

    setIsSavingProfile(true)

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, phone: trimmedPhone }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update profile')
      }

      console.log('[DashboardNav] Profile saved successfully:', payload?.profile)

      setProfile({ name: payload?.profile?.name || trimmedName, phone: payload?.profile?.phone || trimmedPhone })
      
      // Mark profile as complete so modal never appears again
      sessionStorage.setItem('profileChecked', 'true')
      
      closeProfileModal()
    } catch (error: any) {
      console.error('[DashboardNav] Error saving profile:', error)
      setProfileError(error.message || 'Unable to save profile details.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { href: '/dashboard/referrals', icon: Users, label: 'My Clients' },
    { href: '/dashboard/earnings', icon: BarChart3, label: 'Earnings' },
    { href: '/dashboard/growth-level', icon: TrendingUp, label: 'Growth & Level' },
    { href: '/dashboard/leaderboard', icon: Trophy, label: 'Leaderboard' },
    { href: '/dashboard/withdrawals', icon: Wallet, label: 'Withdrawals' },
    { href: '/dashboard/profile', icon: UserCog, label: 'Profile Settings' },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href
    }

    return pathname?.startsWith(href)
  }

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-xl font-bold text-white">
            ClintonStack
          </Link>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-slate-300 hover:text-white p-2"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 bg-slate-900 border-b border-slate-800 shadow-xl">
            <nav className="px-4 py-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive(item.href)
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-all w-full"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed top-0 left-0 h-screen w-64 bg-slate-900 border-r border-slate-800 z-40">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-800">
            <Link href="/dashboard" className="text-2xl font-bold text-white">
              ClintonStack
            </Link>
            <p className="text-sm text-slate-400 mt-1">Sales Partner Network</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive(item.href)
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Sign Out Button */}
          <div className="p-4 border-t border-slate-800">
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-all w-full"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Spacer for fixed elements */}
      <div className="lg:hidden h-16"></div>
      <div className="hidden lg:block w-64"></div>

      {isProfileModalMounted && (
        <div
          className={`fixed inset-0 z-[60] flex items-center justify-center px-4 sm:px-6 transition-opacity duration-200 ${
            isProfileModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden={!isProfileModalOpen}
        >
          {/* Modal overlay ensures the dashboard stays visible behind it. */}
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />

          <div
            className={`relative w-[90%] max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl transition-all duration-200 ${
              isProfileModalOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
          >
            <div>
              <h2 id="profile-modal-title" className="text-lg font-semibold text-white">
                Complete your profile
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Add your name and phone to unlock the dashboard tools.
              </p>
            </div>

            <form onSubmit={handleProfileSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Name</label>
                <input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Phone</label>
                <input
                  value={profilePhone}
                  onChange={(event) => setProfilePhone(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  placeholder="Enter your mobile number"
                  autoComplete="tel"
                  required
                />
              </div>

              {profileError && (
                <div className="text-sm rounded-lg p-3 bg-red-900/30 text-red-300 border border-red-600/30">
                  {profileError}
                </div>
              )}

              <div className="flex items-center justify-between">
                {profile && (
                  <span className="text-xs text-slate-400">
                    Current: {profile.name || 'Missing name'} • {profile.phone || 'Missing phone'}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                >
                  {isSavingProfile ? 'Saving...' : 'Save details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
