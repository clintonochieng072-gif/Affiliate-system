/**
 * NextAuth Configuration and Utilities
 * PostgreSQL + Prisma for Neon serverless database
 */

import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from './prisma'
import { ADMIN_EMAIL } from './constants'

// Verify environment variables are loaded
if (!process.env.GOOGLE_CLIENT_ID) {
  console.error('❌ GOOGLE_CLIENT_ID is not defined in environment variables')
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  console.error('❌ GOOGLE_CLIENT_SECRET is not defined in environment variables')
}
if (!process.env.NEXTAUTH_URL) {
  console.error('❌ NEXTAUTH_URL is not defined in environment variables')
}
if (!process.env.NEXTAUTH_SECRET) {
  console.error('❌ NEXTAUTH_SECRET is not defined in environment variables')
}

export const authOptions: NextAuthOptions = {
  // Configure Google OAuth provider
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile',
          prompt: 'select_account',
        },
      },
    }),
  ],
  
  // Enable debug mode only in development
  debug: process.env.NODE_ENV === 'development',
  
  // Custom pages
  pages: {
    signIn: '/',
    error: '/auth/error', // Custom error page
  },
  
  // Session strategy - JWT only (no database sessions)
  session: {
    strategy: 'jwt',
  },
  
  // Callbacks for custom logic
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('🔐 SignIn callback triggered:', { user: user.email, provider: account?.provider })
      
      // On successful Google sign-in, create sales agent record if it doesn't exist
      if (account?.provider === 'google' && user.email) {
        try {
          // Validate required fields before creating affiliate
          if (!user.email || !user.name) {
            console.error('❌ Missing required fields for affiliate creation:', {
              email: user.email,
              name: user.name,
            })
            return false
          }

          // Only set role on update; never overwrite user-entered name
          const updateData: Record<string, unknown> = {}
          if (user.email === ADMIN_EMAIL) {
            updateData.role = 'ADMIN'
          }

          const affiliate = await prisma.affiliate.upsert({
            where: { email: user.email },
            update: updateData,
            create: {
              name: user.name || user.email,
              email: user.email,
              role: user.email === ADMIN_EMAIL ? 'ADMIN' : 'AFFILIATE',
            },
          })

          console.log('✅ Affiliate record ensured:', {
            email: affiliate.email,
            name: affiliate.name,
            role: affiliate.role,
            isNewUser: !updateData.role, // Simple heuristic for new user
          })
        } catch (error) {
          console.error('❌ CRITICAL: Error creating sales agent - login denied:', {
            email: user.email,
            provider: account?.provider,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          })
          // CRITICAL: Prevent login if affiliate cannot be created
          // New users MUST have an affiliate record for dashboard access
          return false
        }
      }
      return true
    },
    
    async session({ session, token }) {
      // Add user ID to session
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = (token.role as 'admin' | 'affiliate') || 'affiliate'
      }
      return session
    },
    
    async jwt({ token, user }) {
      // Add user ID to token
      if (user?.id) {
        token.sub = user.id
      }

      token.role = token.email === ADMIN_EMAIL ? 'admin' : 'affiliate'

      if (token.email) {
        try {
          const affiliate = await prisma.affiliate.findUnique({
            where: { email: token.email },
            select: { role: true },
          })

          token.role = affiliate?.role === 'ADMIN' ? 'admin' : 'affiliate'
        } catch (error) {
          console.error('❌ Error resolving JWT role:', error)
        }
      }

      return token
    },
  },
  
  // Event handlers for debugging
  events: {
    async signIn({ user, account, isNewUser }) {
      console.log('✅ User signed in successfully:', user.email)
    },
  },
  
  // Logger for detailed debugging
  logger: {
    error(code, metadata) {
      console.error('❌ NextAuth Error:', code, metadata)
    },
    warn(code) {
      console.warn('⚠️ NextAuth Warning:', code)
    },
    debug(code, metadata) {
      console.log('🐛 NextAuth Debug:', code, metadata)
    },
  },
  
  // Secret for JWT encryption
  secret: process.env.NEXTAUTH_SECRET,
}
