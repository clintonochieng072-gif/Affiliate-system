/**
 * NextAuth Session Provider Wrapper
 * Required for client-side session access
 */

'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
