/**
 * Debug endpoint to verify configuration
 * DELETE THIS FILE in production
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    environment: {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✅ Set (length: ' + process.env.GOOGLE_CLIENT_ID.length + ')' : '❌ Not set',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✅ Set (length: ' + process.env.GOOGLE_CLIENT_SECRET.length + ')' : '❌ Not set',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || '❌ Not set',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ Set (length: ' + process.env.NEXTAUTH_SECRET.length + ')' : '❌ Not set',
      DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ Not set',
    },
    urls: {
      expected_redirect_uri: 'http://localhost:3000/api/auth/callback/google',
      current_base_url: process.env.NEXTAUTH_URL,
    },
    note: 'DELETE /app/api/debug/route.ts in production'
  })
}
