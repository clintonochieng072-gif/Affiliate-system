/**
 * NextAuth Configuration and Utilities
 * PostgreSQL + Prisma for Neon serverless database
 */

import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from './prisma'

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
  
  // Enable debug mode to see detailed error logs
  debug: true,
  
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
      
      // On successful Google sign-in, create affiliate record if doesn't exist
      if (account?.provider === 'google' && user.email) {
        try {
          // Check if affiliate exists
          const existingAffiliate = await prisma.affiliate.findUnique({
            where: { email: user.email },
          })

          // Create affiliate if doesn't exist
          if (!existingAffiliate) {
            console.log('✨ Creating new affiliate for:', user.email)
            await prisma.affiliate.create({
              data: {
                name: user.name || user.email,
                email: user.email,
              },
            })
          } else {
            console.log('✅ Existing affiliate found:', user.email)
          }
        } catch (error) {
          console.error('❌ Error creating affiliate:', error)
          return false // Prevent sign-in on database error
        }
      }
      return true
    },
    
    async session({ session, token }) {
      // Add user ID to session
      if (session.user) {
        session.user.id = token.sub!
      }
      return session
    },
    
    async jwt({ token, user }) {
      // Add user ID to token
      if (user) {
        token.sub = user.id
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
