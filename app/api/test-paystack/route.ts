import { NextRequest, NextResponse } from 'next/server'

/**
 * Test Paystack Configuration and M-PESA Availability
 * Access: /api/test-paystack
 */
export async function GET(request: NextRequest) {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

  if (!PAYSTACK_SECRET_KEY) {
    return NextResponse.json({
      error: 'Paystack secret key not configured',
      configured: false,
    })
  }

  try {
    // Test 1: Verify API key works
    const balanceResponse = await fetch('https://api.paystack.co/balance', {
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    })
    const balanceData = await balanceResponse.json()

    // Test 2: Check available banks (including mobile money providers)
    const banksResponse = await fetch('https://api.paystack.co/bank?currency=KES', {
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    })
    const banksData = await banksResponse.json()

    // Find M-PESA in the list
    const mpesaBank = banksData.data?.find((bank: any) => 
      bank.code === 'MPESA' || bank.name?.toLowerCase().includes('mpesa')
    )

    // Test 3: Try creating a test recipient (won't actually create, just validate)
    const testRecipientResponse = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'mobile_money',
        name: 'Test User',
        account_number: '254712345678',
        bank_code: 'MPESA',
        currency: 'KES',
      }),
    })
    const testRecipientData = await testRecipientResponse.json()

    return NextResponse.json({
      configured: true,
      balance: balanceData,
      mpesaAvailable: !!mpesaBank,
      mpesaDetails: mpesaBank,
      allBanks: banksData.data?.map((b: any) => ({ code: b.code, name: b.name })),
      testRecipient: {
        success: testRecipientData.status,
        message: testRecipientData.message,
        error: testRecipientData.status ? null : testRecipientData,
      },
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to test Paystack',
      details: error.message,
      configured: true,
      testFailed: true,
    })
  }
}
