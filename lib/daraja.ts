const DARAJA_SANDBOX_BASE_URL = 'https://sandbox.safaricom.co.ke'
const DARAJA_LIVE_BASE_URL = 'https://api.safaricom.co.ke'

import { constants, publicEncrypt } from 'crypto'

type DarajaEnvironment = 'sandbox' | 'live'

interface RetryOptions {
  retries?: number
  retryDelayMs?: number
}

export interface DarajaConfig {
  environment: DarajaEnvironment
  baseUrl: string
  consumerKey: string
  consumerSecret: string
  shortcode: string
  initiatorName: string
  securityCredential: string
  commandId: string
  resultUrl: string
  timeoutUrl: string
  callbackToken?: string
}

export interface DarajaB2CRequest {
  amount: number
  phoneNumber: string
  reference: string
  remarks: string
  occasion?: string
}

export interface DarajaB2CResponse {
  accepted: boolean
  conversationId?: string
  originatorConversationId?: string
  responseCode?: string
  responseDescription?: string
  customerMessage?: string
  raw: any
}

function normalizePemFromEnv(value: string): string {
  return value.replace(/\\n/g, '\n').trim()
}

function generateDarajaSecurityCredential(
  initiatorPassword: string,
  certificatePem: string
): string {
  const normalizedPem = normalizePemFromEnv(certificatePem)
  const encrypted = publicEncrypt(
    {
      key: normalizedPem,
      padding: constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(initiatorPassword, 'utf8')
  )

  return encrypted.toString('base64')
}

function getEnvValue(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]
    if (value && value.trim().length > 0) {
      return value.trim()
    }
  }
  return ''
}

function getDarajaEnvironment(): DarajaEnvironment {
  const raw = getEnvValue(['DARAJA_ENV', 'DARARA_ENV']).toLowerCase()
  return raw === 'live' ? 'live' : 'sandbox'
}

function ensureHttpsUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('https://') || url.startsWith('http://localhost')) {
    return url
  }
  if (url.startsWith('http://')) {
    return `https://${url.slice(7)}`
  }
  return `https://${url}`
}

function getDefaultCallbackBaseUrl(): string {
  const explicit = getEnvValue(['DARAJA_CALLBACK_BASE_URL', 'DARARA_CALLBACK_BASE_URL'])
  if (explicit) {
    return ensureHttpsUrl(explicit)
  }

  const appUrl = getEnvValue(['NEXTAUTH_URL'])
  if (appUrl) {
    return ensureHttpsUrl(appUrl)
  }

  const vercelUrl = getEnvValue(['VERCEL_URL'])
  if (vercelUrl) {
    return ensureHttpsUrl(vercelUrl)
  }

  return 'http://localhost:3000'
}

function withSuffix(env: DarajaEnvironment, baseKey: string): string[] {
  const suffix = env === 'live' ? 'LIVE' : 'SANDBOX'

  // NOTE: The DARARA_* aliases are supported for backward compatibility with
  // existing environment files that used the misspelled prefix.
  return [
    `${baseKey}_${suffix}`,
    `${baseKey}`,
    `${baseKey.replace('DARAJA_', 'DARARA_')}_${suffix}`,
    `${baseKey.replace('DARAJA_', 'DARARA_')}`,
  ]
}

export function getDarajaConfig(): DarajaConfig {
  const environment = getDarajaEnvironment()
  const baseUrl = environment === 'live' ? DARAJA_LIVE_BASE_URL : DARAJA_SANDBOX_BASE_URL
  const callbackBaseUrl = getDefaultCallbackBaseUrl()

  const resultUrl =
    getEnvValue(withSuffix(environment, 'DARAJA_RESULT_URL')) ||
    `${callbackBaseUrl}/api/webhooks/daraja/result`

  const timeoutUrl =
    getEnvValue(withSuffix(environment, 'DARAJA_TIMEOUT_URL')) ||
    `${callbackBaseUrl}/api/webhooks/daraja/timeout`

  const configuredSecurityCredential = getEnvValue(withSuffix(environment, 'DARAJA_SECURITY_CREDENTIAL'))
  const initiatorPassword = getEnvValue(withSuffix(environment, 'DARAJA_INITIATOR_PASSWORD'))
  const certificatePem = getEnvValue(withSuffix(environment, 'DARAJA_PUBLIC_CERTIFICATE'))

  let securityCredential = configuredSecurityCredential

  if (!securityCredential && initiatorPassword && certificatePem) {
    try {
      securityCredential = generateDarajaSecurityCredential(initiatorPassword, certificatePem)
    } catch (error) {
      throw new Error(
        `Failed to generate Daraja security credential (${environment}): ${
          error instanceof Error ? error.message : 'Invalid certificate or initiator password'
        }`
      )
    }
  }

  const config: DarajaConfig = {
    environment,
    baseUrl,
    // NOTE: Swap SANDBOX -> LIVE credentials in env vars only; no code changes needed.
    consumerKey: getEnvValue(withSuffix(environment, 'DARAJA_CONSUMER_KEY')),
    consumerSecret: getEnvValue(withSuffix(environment, 'DARAJA_CONSUMER_SECRET')),
    shortcode: getEnvValue(withSuffix(environment, 'DARAJA_SHORTCODE')),
    initiatorName: getEnvValue(withSuffix(environment, 'DARAJA_INITIATOR_NAME')),
    securityCredential,
    commandId: getEnvValue(withSuffix(environment, 'DARAJA_COMMAND_ID')) || 'BusinessPayment',
    resultUrl,
    timeoutUrl,
    callbackToken: getEnvValue(withSuffix(environment, 'DARAJA_CALLBACK_TOKEN')) || undefined,
  }

  const required: Array<[string, string]> = [
    ['consumerKey', config.consumerKey],
    ['consumerSecret', config.consumerSecret],
    ['shortcode', config.shortcode],
    ['initiatorName', config.initiatorName],
    ['securityCredential', config.securityCredential],
  ]

  const missing = required.filter(([, value]) => !value).map(([name]) => name)
  if (missing.length > 0) {
    if (
      missing.includes('securityCredential') &&
      !configuredSecurityCredential &&
      !(initiatorPassword && certificatePem)
    ) {
      throw new Error(
        `Daraja configuration is incomplete (${environment}): missing securityCredential (set DARAJA_SECURITY_CREDENTIAL_${environment === 'live' ? 'LIVE' : 'SANDBOX'} OR both DARAJA_INITIATOR_PASSWORD_${environment === 'live' ? 'LIVE' : 'SANDBOX'} and DARAJA_PUBLIC_CERTIFICATE_${environment === 'live' ? 'LIVE' : 'SANDBOX'})`
      )
    }

    throw new Error(`Daraja configuration is incomplete (${environment}): missing ${missing.join(', ')}`)
  }

  return config
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const retries = options.retries ?? 2
  const retryDelayMs = options.retryDelayMs ?? 750

  let lastError: unknown = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, init)
      if (response.status >= 500 && attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1))
        continue
      }
      return response
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1))
        continue
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Network request failed')
}

export function normalizeKenyanPhoneForDaraja(rawPhone: string): string {
  const cleaned = rawPhone.replace(/\D/g, '')

  if (/^254[17]\d{8}$/.test(cleaned)) {
    return cleaned
  }

  if (/^0[17]\d{8}$/.test(cleaned)) {
    return `254${cleaned.slice(1)}`
  }

  if (/^[17]\d{8}$/.test(cleaned)) {
    return `254${cleaned}`
  }

  return cleaned
}

export async function getDarajaAccessToken(config: DarajaConfig): Promise<string> {
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64')
  const tokenUrl = `${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`

  const response = await fetchWithRetry(tokenUrl, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  })

  const body = await response.json()

  if (!response.ok || !body.access_token) {
    throw new Error(body.errorMessage || body.error_description || 'Failed to obtain Daraja access token')
  }

  return body.access_token as string
}

export async function initiateDarajaB2CTransfer(
  payload: DarajaB2CRequest
): Promise<DarajaB2CResponse> {
  const config = getDarajaConfig()
  const accessToken = await getDarajaAccessToken(config)
  const b2cUrl = `${config.baseUrl}/mpesa/b2c/v3/paymentrequest`

  const response = await fetchWithRetry(
    b2cUrl,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        OriginatorConversationID: payload.reference,
        InitiatorName: config.initiatorName,
        SecurityCredential: config.securityCredential,
        CommandID: config.commandId,
        Amount: Math.round(payload.amount),
        PartyA: config.shortcode,
        PartyB: payload.phoneNumber,
        Remarks: payload.remarks,
        QueueTimeOutURL: config.timeoutUrl,
        ResultURL: config.resultUrl,
        Occasion: payload.occasion || 'SalesAgentWithdrawal',
      }),
    },
    { retries: 2, retryDelayMs: 1000 }
  )

  const body = await response.json()

  const responseCode = body.ResponseCode as string | undefined
  const accepted = response.ok && responseCode === '0'

  return {
    accepted,
    conversationId: body.ConversationID,
    originatorConversationId: body.OriginatorConversationID,
    responseCode,
    responseDescription: body.ResponseDescription,
    customerMessage: body.CustomerMessage,
    raw: body,
  }
}
