import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Legacy payout route has been replaced. Use /api/withdraw.',
    },
    { status: 410 }
  )
}

export async function GET() {
  return NextResponse.json({
    service: 'Legacy payout endpoint',
    status: 'deprecated',
    replacement: '/api/withdraw',
  })
}
