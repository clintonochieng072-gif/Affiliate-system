/**
 * Test script to check available Paystack banks/mobile money providers for Kenya
 * Run: npx tsx test-paystack-banks.ts
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

async function testPaystackBanks() {
  if (!PAYSTACK_SECRET_KEY) {
    console.error('❌ PAYSTACK_SECRET_KEY not found in environment')
    process.exit(1)
  }

  console.log('🔍 Fetching Paystack banks for Kenya...\n')

  try {
    const response = await fetch('https://api.paystack.co/bank?currency=KES', {
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    })

    const data = await response.json()

    if (!data.status) {
      console.error('❌ Error:', data.message)
      return
    }

    console.log(`✅ Found ${data.data.length} banks/providers for KES:\n`)

    // Look for M-PESA specifically
    const mpesaProviders = data.data.filter((bank: any) => 
      bank.name.toLowerCase().includes('mpesa') || 
      bank.name.toLowerCase().includes('m-pesa') ||
      bank.name.toLowerCase().includes('safaricom')
    )

    if (mpesaProviders.length > 0) {
      console.log('📱 M-PESA Providers Found:')
      mpesaProviders.forEach((bank: any) => {
        console.log(`  - ${bank.name} (Code: ${bank.code}, Type: ${bank.type})`)
      })
      console.log()
    } else {
      console.log('⚠️ No M-PESA providers found. Available options:\n')
      data.data.slice(0, 10).forEach((bank: any) => {
        console.log(`  - ${bank.name} (Code: ${bank.code}, Type: ${bank.type})`)
      })
      console.log(`  ... and ${data.data.length - 10} more\n`)
    }

    // Check for mobile money type
    const mobileMoney = data.data.filter((bank: any) => bank.type === 'mobile_money')
    if (mobileMoney.length > 0) {
      console.log('📲 Mobile Money Providers:')
      mobileMoney.forEach((bank: any) => {
        console.log(`  - ${bank.name} (Code: ${bank.code})`)
      })
    } else {
      console.log('❌ No mobile_money type providers found for Kenya')
      console.log('💡 Paystack Kenya may only support bank transfers\n')
    }

  } catch (error: any) {
    console.error('❌ Error fetching banks:', error.message)
  }
}

testPaystackBanks()
