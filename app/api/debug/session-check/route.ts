import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🔍 Session check diagnostic...')
    
    const session = await getServerSession(authOptions)
    
    if (!session) {
      console.warn('⚠️ No session found')
      return NextResponse.json(
        {
          status: 'NO_SESSION',
          message: 'Not authenticated'
        },
        { status: 401 }
      )
    }
    
    console.log('✅ Session found:', {
      email: session.user?.email,
      name: session.user?.name
    })
    
    return NextResponse.json({
      status: 'OK',
      session: {
        email: session.user?.email,
        name: session.user?.name,
        image: session.user?.image ? '(present)' : '(none)'
      }
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    
    console.error('❌ Session check failed:', msg)
    
    return NextResponse.json(
      {
        status: 'ERROR',
        error: msg
      },
      { status: 500 }
    )
  }
}
