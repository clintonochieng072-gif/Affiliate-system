const INTASEND_BASE_URL = 'https://api.intasend.com/api/v1/payouts/'
const INTASEND_SECRET_KEY = process.env.INTASEND_SECRET_KEY

export interface IntaSendPayoutResponse {
  transactionId: string
  status: string
  raw: any
}

export function normalizeKenyanPhoneNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '')

  if (/^2547\d{8}$/.test(digits) || /^2541\d{8}$/.test(digits)) {
    return digits
  }

  if (/^07\d{8}$/.test(digits)) {
    return `254${digits.slice(1)}`
  }

  if (/^7\d{8}$/.test(digits)) {
    return `254${digits}`
  }

  throw new Error('Invalid Kenyan phone number')
}

export async function sendIntaSendPayout(amount: number, phoneNumber: string): Promise<IntaSendPayoutResponse> {
  if (!INTASEND_SECRET_KEY) {
    throw new Error('INTASEND_SECRET_KEY is not configured')
  }

  const requestBody = {
    currency: 'KES',
    amount,
    phone_number: phoneNumber,
  }

  const response = await fetch(INTASEND_BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${INTASEND_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  const raw = await response.json().catch(() => null)

  if (!response.ok) {
    const message = raw?.message || raw?.error || `IntaSend request failed with status ${response.status}`
    throw new Error(`IntaSend payout error: ${message}`)
  }

  const transactionId = String(raw?.transaction_id || raw?.id || '')
  const status = String(raw?.status || raw?.status_code || 'unknown')

  return {
    transactionId,
    status,
    raw,
  }
}
