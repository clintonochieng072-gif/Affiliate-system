import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'clintonstack4@gmail.com'

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  // Redirect unauthenticated users to sign-in
  if (!token) {
    const signInUrl = new URL('/', request.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Protect admin routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const isAdmin = token.email === ADMIN_EMAIL || token.role === 'admin'
    if (!isAdmin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/api/dashboard/:path*',
    '/api/admin/:path*',
    '/api/profile/:path*',
    '/api/referrals/:path*',
    '/api/leaderboard/:path*',
    '/api/products/:path*',
    '/api/link/:path*',
    '/api/withdrawal/:path*',
    '/api/payout/:path*',
  ],
}
