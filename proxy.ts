import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/',
  },
})

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/sales-dashboard/:path*', '/sales-portal/:path*']
}
