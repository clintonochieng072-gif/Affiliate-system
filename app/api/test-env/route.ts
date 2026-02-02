import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    envVars: {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET (' + process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...)' : 'UNDEFINED',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'SET (GOCSPX-...)' : 'UNDEFINED',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'UNDEFINED',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'UNDEFINED',
    }
  })
}
