/**
 * NextAuth Session Provider Wrapper
 * Required for client-side session access
 */

'use client'

import { SessionProvider } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import WhatsAppButton from '@/components/WhatsAppButton'

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isDashboard = pathname.startsWith('/dashboard')

  return (
    <SessionProvider>
      {children}
      {isDashboard && <WhatsAppButton />}
    </SessionProvider>
  )
}
