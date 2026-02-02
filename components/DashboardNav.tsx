'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Menu, X, LayoutDashboard, Package, Users, DollarSign, CreditCard, LogOut, Wallet } from 'lucide-react'

export default function DashboardNav() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/dashboard/products', icon: Package, label: 'Products' },
    { href: '/dashboard/referrals', icon: Users, label: 'Referrals' },
    { href: '/dashboard/earnings', icon: DollarSign, label: 'Earnings' },
    { href: '/dashboard/withdraw', icon: Wallet, label: 'Withdraw' },
    { href: '/dashboard/payouts', icon: CreditCard, label: 'Payouts' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-xl font-bold text-white">
            Clintonstack
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
              Clintonstack
            </Link>
            <p className="text-sm text-slate-400 mt-1">Affiliate Dashboard</p>
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
    </>
  )
}
