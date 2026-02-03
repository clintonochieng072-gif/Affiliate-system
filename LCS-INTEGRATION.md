# Lead Capture System Integration Guide

## Overview

The Affiliate System receives Paystack webhook events **forwarded from the Lead Capture System** (LCS), not directly from Paystack.

## Architecture

```
Paystack → Lead Capture System → Affiliate System
         (webhook)           (internal API)
```

## Webhook Forwarding Setup

### 1. In Lead Capture System

When you receive a Paystack webhook for transfer events, forward it to the Affiliate System:

**Endpoint**: `POST https://affiliate.clintonstack.com/api/internal/paystack-webhook`

**Headers**:
```javascript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer LW5DXRnrilmzB4FIwhH0jab1tYcPG27s'
}
```

**Payload** (forward Paystack data):
```javascript
{
  "event": "transfer.success", // or "transfer.failed"
  "data": {
    "reference": "withdrawal-uuid",
    "transfer_code": "TRF_xxxxx",
    "amount": 24000,
    "reason": "Optional failure reason",
    "status": "success" // or "failed"
  }
}
```

### 2. Example Implementation (Node.js/Express)

```javascript
// In your LCS Paystack webhook handler
app.post('/webhooks/paystack', async (req, res) => {
  // Your existing Paystack signature verification
  const signature = req.headers['x-paystack-signature']
  if (!verifyPaystackSignature(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const webhook = req.body
  const { event, data } = webhook

  // Forward transfer events to Affiliate System
  if (event === 'transfer.success' || event === 'transfer.failed') {
    try {
      const response = await fetch('https://affiliate.clintonstack.com/api/internal/paystack-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer LW5DXRnrilmzB4FIwhH0jab1tYcPG27s'
        },
        body: JSON.stringify({
          event: event,
          data: {
            reference: data.reference,
            transfer_code: data.transfer_code,
            amount: data.amount,
            reason: data.reason,
            status: event === 'transfer.success' ? 'success' : 'failed'
          }
        })
      })

      if (!response.ok) {
        console.error('Failed to forward webhook to Affiliate System:', await response.text())
      } else {
        console.log('✅ Webhook forwarded to Affiliate System')
      }
    } catch (error) {
      console.error('Error forwarding webhook:', error)
    }
  }

  // Your other webhook handling...
  res.json({ received: true })
})
```

### 3. Events to Forward

**transfer.success**
- Withdrawal completed successfully
- M-PESA payment sent to affiliate

**transfer.failed**
- Transfer failed (insufficient balance, invalid recipient, etc.)
- Affiliate's balance will be available for retry

## Security

### API Secret

Store in LCS environment variables:
```env
AFFILIATE_API_SECRET=LW5DXRnrilmzB4FIwhH0jab1tYcPG27s
```

Use in Authorization header:
```
Authorization: Bearer LW5DXRnrilmzB4FIwhH0jab1tYcPG27s
```

## Testing

### Test Success Webhook

```bash
curl -X POST https://affiliate.clintonstack.com/api/internal/paystack-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer LW5DXRnrilmzB4FIwhH0jab1tYcPG27s" \
  -d '{
    "event": "transfer.success",
    "data": {
      "reference": "test-withdrawal-uuid",
      "transfer_code": "TRF_test123",
      "amount": 24000,
      "status": "success"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Withdrawal marked as completed",
  "withdrawalId": "test-withdrawal-uuid",
  "status": "completed"
}
```

### Test Failure Webhook

```bash
curl -X POST https://affiliate.clintonstack.com/api/internal/paystack-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer LW5DXRnrilmzB4FIwhH0jab1tYcPG27s" \
  -d '{
    "event": "transfer.failed",
    "data": {
      "reference": "test-withdrawal-uuid",
      "transfer_code": "TRF_test123",
      "amount": 24000,
      "reason": "Insufficient funds",
      "status": "failed"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Withdrawal marked as failed, balance available for retry",
  "withdrawalId": "test-withdrawal-uuid",
  "status": "failed",
  "reason": "Insufficient funds"
}
```

## Error Handling

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```
**Fix**: Check Authorization header and API secret

### 404 Not Found
```json
{
  "error": "Withdrawal not found"
}
```
**Fix**: Verify the reference matches a withdrawal ID in Affiliate System

### 400 Bad Request
```json
{
  "error": "Invalid webhook payload"
}
```
**Fix**: Ensure event and data.reference are present

## Monitoring

### What to Log in LCS

```javascript
console.log('Forwarding Paystack webhook to Affiliate System:', {
  event: event,
  reference: data.reference,
  amount: data.amount,
  timestamp: new Date().toISOString()
})
```

### Check Affiliate System Logs

The Affiliate System logs:
- ✅ Successful withdrawals
- ❌ Failed withdrawals with reasons
- Webhook processing errors

## Production Checklist

- [ ] Store `AFFILIATE_API_SECRET` in LCS environment variables
- [ ] Verify webhook forwarding code is in LCS Paystack webhook handler
- [ ] Test with real Paystack transfer events
- [ ] Monitor logs for successful forwarding
- [ ] Set up alerts for forwarding failures
- [ ] Verify withdrawals update correctly in Affiliate System database

## Troubleshooting

### Webhook Not Forwarded

1. Check LCS logs for errors
2. Verify API secret is correct
3. Test with curl command above
4. Check network connectivity between systems

### Withdrawal Status Not Updating

1. Verify reference ID matches withdrawal ID
2. Check Affiliate System logs
3. Verify Authorization header is correct
4. Test internal webhook endpoint directly

### Balance Not Refunded on Failure

The balance refund is automatic - failed withdrawals don't count as "withdrawn" when calculating available balance. No manual refund needed.

## Support

- **Affiliate System Repo**: github.com/clintonochieng072-gif/Affiliate-system
- **Documentation**: See MPESA-WITHDRAWAL.md
- **API Endpoint**: `https://affiliate.clintonstack.com/api/internal/paystack-webhook`

---

**Summary**: LCS receives Paystack webhooks, verifies signatures, and forwards transfer events to Affiliate System's internal API for processing.
