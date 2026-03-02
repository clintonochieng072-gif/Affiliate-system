import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🔍 Database diagnostic started...')
    
    // Test 1: Can we connect to the database?
    const testConnection = await prisma.$queryRaw`SELECT 1`
    console.log('✅ Database connection: OK')
    
    // Test 2: Does the affiliates table exist?
    const affiliatesCount = await prisma.affiliate.count()
    console.log('✅ Affiliates table: OK (count:', affiliatesCount, ')')
    
    // Test 3: Check table structure
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'affiliates' 
      ORDER BY ordinal_position
      LIMIT 5
    `
    console.log('✅ Table structure:', columns)
    
    // Test 4: Try a simple user lookup (without upsert)
    const testEmail = 'test-diagnostic@example.com'
    const existing = await prisma.affiliate.findUnique({
      where: { email: testEmail },
      select: { id: true, email: true }
    })
    console.log('✅ Read operation: OK (found existing:', !!existing, ')')
    
    return NextResponse.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      checks: {
        connection: 'OK',
        affiliatesTable: { count: affiliatesCount },
        readOperation: 'OK'
      }
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : ''
    
    console.error('❌ Diagnostic failed:', {
      error: msg,
      stack: stack
    })
    
    return NextResponse.json(
      {
        status: 'ERROR',
        error: msg,
        stack: process.env.NODE_ENV === 'development' ? stack : undefined
      },
      { status: 500 }
    )
  }
}
