async function main() {
  const key = process.env.DARAJA_CONSUMER_KEY_SANDBOX || ''
  const secret = process.env.DARAJA_CONSUMER_SECRET_SANDBOX || ''
  const securityCredential = process.env.DARAJA_SECURITY_CREDENTIAL_SANDBOX || ''
  const initiator = process.env.DARAJA_INITIATOR_NAME_SANDBOX || 'testapi'
  const shortcode = process.env.DARAJA_SHORTCODE_SANDBOX || '600000'
  const resultUrl = process.env.DARAJA_RESULT_URL_SANDBOX || 'https://affiliate.clintonstack.com/api/webhooks/daraja/result'
  const timeoutUrl = process.env.DARAJA_TIMEOUT_URL_SANDBOX || 'https://affiliate.clintonstack.com/api/webhooks/daraja/timeout'
  const partyB = process.env.DARAJA_TEST_MSISDN || '254708374149'

  if (!key || !secret || !securityCredential) {
    throw new Error('Missing one of DARAJA_CONSUMER_KEY_SANDBOX, DARAJA_CONSUMER_SECRET_SANDBOX, DARAJA_SECURITY_CREDENTIAL_SANDBOX')
  }

  const basic = Buffer.from(`${key}:${secret}`).toString('base64')
  const tokenResp = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    method: 'GET',
    headers: {
      Authorization: `Basic ${basic}`,
    },
  })

  const tokenBody = await tokenResp.json().catch(() => ({}))

  if (!tokenResp.ok || !tokenBody?.access_token) {
    console.log(JSON.stringify({
      stage: 'token',
      ok: false,
      httpStatus: tokenResp.status,
      body: tokenBody,
    }, null, 2))
    process.exit(1)
  }

  const payload = {
    OriginatorConversationID: `diag-${Date.now()}`,
    InitiatorName: initiator,
    SecurityCredential: securityCredential.trim(),
    CommandID: 'BusinessPayment',
    Amount: 10,
    PartyA: shortcode,
    PartyB: partyB,
    Remarks: 'Withdrawal diagnostic',
    QueueTimeOutURL: timeoutUrl,
    ResultURL: resultUrl,
    Occasion: 'WithdrawalDiagnostic',
  }

  const b2cResp = await fetch('https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenBody.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const b2cBody = await b2cResp.json().catch(() => ({}))

  console.log(JSON.stringify({
    stage: 'b2c',
    tokenHttpStatus: tokenResp.status,
    b2cHttpStatus: b2cResp.status,
    accepted: b2cResp.ok && b2cBody?.ResponseCode === '0',
    responseCode: b2cBody?.ResponseCode,
    responseDescription: b2cBody?.ResponseDescription,
    customerMessage: b2cBody?.CustomerMessage,
    conversationId: b2cBody?.ConversationID,
    originatorConversationId: b2cBody?.OriginatorConversationID,
    raw: b2cBody,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ stage: 'script', ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
