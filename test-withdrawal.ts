import { config } from 'dotenv'
import fetch from 'node-fetch'

config({ path: '.env.local' })

const BASE_URL = 'http://localhost:3000'

async function testWithdrawal() {
  try {
    console.log('🧪 Testing IntaSend withdrawal endpoint...')

    // First, get CSRF token and session
    const authResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!authResponse.ok) {
      console.log('❌ Auth endpoint not accessible, server might not be ready')
      return
    }

    // For testing, we'll assume the user is logged in via Google OAuth
    // In a real test, you'd need to authenticate first
    console.log('⚠️  Note: This test assumes you are logged in as clintonochieng072@gmail.com')
    console.log('   If not, please log in via the browser first')

    // Test the withdrawal endpoint
    const withdrawalResponse = await fetch(`${BASE_URL}/api/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-mode': 'true', // Enable test mode
      },
      body: JSON.stringify({
        amount: 100, // Test with minimum amount
      }),
    })

    const result = await withdrawalResponse.json()

    if (withdrawalResponse.ok) {
      console.log('✅ Withdrawal initiated successfully!')
      console.log('Response:', result)
    } else {
      console.log('❌ Withdrawal failed:', result)
    }
  } catch (error: any) {
    console.error('❌ Test error:', error?.message || error)
  }
}

testWithdrawal()