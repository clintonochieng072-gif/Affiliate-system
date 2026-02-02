/**
 * Landing Page Server Component
 * Wraps client component with SessionProvider
 */

import { Providers } from './providers'
import PageClient from './page-client'

export default function Home() {
  return (
    <Providers>
      <PageClient />
    </Providers>
  )
}
