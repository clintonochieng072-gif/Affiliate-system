const INTASEND_BASE_URL = process.env.INTASEND_ENV === 'sandbox'
  ? 'https://sandbox.intasend.com/api/v1/send-money/initiate/'
  : 'https://api.intasend.com/api/v1/send-money/initiate/'
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
    provider: 'M-PESA',
  }

  const response = await fetch(INTASEND_BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${INTASEND_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  const raw = await response.text() // Get text first
  let parsedRaw: any
  try {
    parsedRaw = JSON.parse(raw)
  } catch {
    parsedRaw = { rawResponse: raw }
  }

  if (!response.ok) {
    const message = parsedRaw?.message || parsedRaw?.error || `IntaSend request failed with status ${response.status}`
    throw new Error(`IntaSend payout error: ${message}`)
  }

  const transactionId = String(parsedRaw?.transaction_id || parsedRaw?.id || '')
  const status = String(parsedRaw?.status || parsedRaw?.status_code || 'unknown')

  return {
    transactionId,
    status,
    raw: parsedRaw,
  }
}
