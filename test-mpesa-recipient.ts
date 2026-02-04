/**
 * Test creating an M-PESA recipient with Paystack
 * Run: npx tsx test-mpesa-recipient.ts
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

async function testCreateRecipient() {
  if (!PAYSTACK_SECRET_KEY) {
    console.error('❌ PAYSTACK_SECRET_KEY not found')
    process.exit(1)
  }

  const testNumbers = [
    '254745408764',  // Your actual number in international format
    '0745408764',    // Local format
    '745408764',     // Without leading zero
  ]

  for (const number of testNumbers) {
    console.log(`\n🧪 Testing with number: ${number}`)
    console.log('─'.repeat(50))

    try {
      const response = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'mobile_money',
          name: 'Test User',
          account_number: number,
          bank_code: 'MPESA',
          currency: 'KES',
        }),
      })

      const data = await response.json()

      if (data.status) {
        console.log('✅ SUCCESS!')
        console.log('   Recipient Code:', data.data.recipient_code)
        console.log('   Details:', data.data.details)
      } else {
        console.log('❌ FAILED')
        console.log('   Message:', data.message)
        if (data.meta) {
          console.log('   Meta:', data.meta)
        }
      }
    } catch (error: any) {
      console.log('❌ ERROR:', error.message)
    }
  }

  console.log('\n' + '─'.repeat(50))
  console.log('💡 If all formats fail, the issue might be:')
  console.log('   1. Mobile Money transfers require Live account with balance')
  console.log('   2. Your Paystack account needs KYC verification')
  console.log('   3. The phone number may need to be registered with M-PESA')
  console.log('   4. Paystack Kenya may have restrictions on test transactions')
}

testCreateRecipient()
