# Commission API Integration Guide

## Overview

The Commission API allows external SaaS products (like Lead Capture System) to record affiliate commissions when users register or activate accounts using referral links.

## Features

✅ **Secure Authentication** - Bearer token validation  
✅ **Idempotency** - Prevents duplicate commissions for the same transaction  
✅ **Multi-Product Support** - Works with any SaaS product  
✅ **Comprehensive Logging** - Full audit trail of all events  
✅ **Transaction Safety** - Database-level consistency  

---

## API Endpoint

### POST /api/commission

Records a commission for an affiliate when a referral converts.

**URL:** `https://your-domain.com/api/commission`

**Method:** `POST`

**Authentication:** Bearer token (shared secret)

---

## Request Format

### Headers

```http
Content-Type: application/json
Authorization: Bearer YOUR_WEBHOOK_SECRET
```

### Payload

```json
{
  "referrer_id": "AFF123",           // Required: Affiliate's referral code
  "user_email": "newuser@mail.com",  // Required: New user's email
  "amount": 5000,                    // Required: Commission amount (in minor units)
  "reference": "PAYSTACK_TX_REF",    // Required: Unique transaction reference
  "product_slug": "lcs",             // Optional: Product identifier
  "metadata": {                      // Optional: Additional data
    "plan": "premium",
    "source": "landing_page"
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `referrer_id` | string | Yes | The affiliate's referral code (from their referral link) |
| `user_email` | string | Yes | Email of the user who registered |
| `amount` | number | Yes | Commission amount in minor units (e.g., kobo for NGN) |
| `reference` | string | Yes | Unique transaction reference (used for idempotency) |
| `product_slug` | string | No | Product identifier (defaults to "default") |
| `metadata` | object | No | Additional data to store with the commission |

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "commission": {
    "id": "uuid-here",
    "affiliateId": "uuid-here",
    "userEmail": "newuser@mail.com",
    "amount": 5000,
    "reference": "PAYSTACK_TX_REF",
    "status": "paid",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Idempotent Response (200 OK)

If the same `reference` is sent again:

```json
{
  "success": true,
  "message": "Commission already processed (idempotent)",
  "commission": {
    "id": "uuid-here",
    "affiliateId": "uuid-here",
    "userEmail": "newuser@mail.com",
    "amount": 5000,
    "reference": "PAYSTACK_TX_REF",
    "status": "paid",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Error Responses

#### 400 Bad Request - Missing Fields
```json
{
  "success": false,
  "error": "Missing required fields: referrer_id, user_email, amount, reference"
}
```

#### 400 Bad Request - Invalid Email
```json
{
  "success": false,
  "error": "Invalid email format"
}
```

#### 400 Bad Request - Invalid Amount
```json
{
  "success": false,
  "error": "Amount must be a positive number"
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

#### 404 Not Found - Invalid Referrer
```json
{
  "success": false,
  "error": "Referrer ID not found"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Integration Steps

### 1. Get Your Webhook Secret

The webhook secret is configured in your affiliate system's `.env.local` file:

```env
WEBHOOK_SECRET=your-secret-key-here
```

**Share this secret securely with the Lead Capture System (LCS) team.**

### 2. Capture Referral Code

When a user visits your LCS landing page with a referral link:

```
https://leads.clintonstack.com/?ref=AFF123
```

Store the `ref` parameter (AFF123) in:
- Session storage
- Cookie
- URL parameter throughout signup flow

### 3. Send Commission Request

After successful registration/payment in LCS, send the commission request:

**Node.js Example:**
```javascript
const axios = require('axios');

async function recordCommission(referrerId, userEmail, amount, txReference) {
  try {
    const response = await axios.post(
      'https://affiliate.clintonstack.com/api/commission',
      {
        referrer_id: referrerId,
        user_email: userEmail,
        amount: amount,
        reference: txReference,
        product_slug: 'lead-capture-system',
        metadata: {
          plan: 'premium',
          source: 'lcs'
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AFFILIATE_WEBHOOK_SECRET}`
        }
      }
    );

    console.log('Commission recorded:', response.data);
    return response.data;
  } catch (error) {
    console.error('Commission error:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
await recordCommission(
  'AFF123',
  'newuser@example.com',
  5000,
  'PAYSTACK_TX_12345'
);
```

**PHP Example:**
```php
<?php

function recordCommission($referrerId, $userEmail, $amount, $reference) {
    $url = 'https://affiliate.clintonstack.com/api/commission';
    $secret = getenv('AFFILIATE_WEBHOOK_SECRET');
    
    $data = [
        'referrer_id' => $referrerId,
        'user_email' => $userEmail,
        'amount' => $amount,
        'reference' => $reference,
        'product_slug' => 'lead-capture-system'
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $secret
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        return json_decode($response, true);
    } else {
        throw new Exception("Commission failed: " . $response);
    }
}

// Usage
recordCommission('AFF123', 'newuser@example.com', 5000, 'PAYSTACK_TX_12345');
?>
```

**Python Example:**
```python
import requests
import os

def record_commission(referrer_id, user_email, amount, reference):
    url = 'https://affiliate.clintonstack.com/api/commission'
    secret = os.getenv('AFFILIATE_WEBHOOK_SECRET')
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {secret}'
    }
    
    payload = {
        'referrer_id': referrer_id,
        'user_email': user_email,
        'amount': amount,
        'reference': reference,
        'product_slug': 'lead-capture-system'
    }
    
    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    
    return response.json()

# Usage
record_commission('AFF123', 'newuser@example.com', 5000, 'PAYSTACK_TX_12345')
```

### 4. Handle Responses

Always check the response status:

```javascript
if (response.success) {
  // Commission recorded successfully
  console.log('Commission ID:', response.commission.id);
} else {
  // Handle error
  console.error('Commission failed:', response.error);
}
```

### 5. Implement Retry Logic (Optional but Recommended)

```javascript
async function recordCommissionWithRetry(data, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await recordCommission(data);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

---

## Testing

### Test Locally

1. **Get a referral code** from your dashboard at http://localhost:3000/dashboard

2. **Run the test script:**
   ```powershell
   .\test-commission.ps1
   ```

3. **Or test with curl:**
   ```bash
   curl -X POST http://localhost:3000/api/commission \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
     -d '{
       "referrer_id": "AFF123",
       "user_email": "test@example.com",
       "amount": 5000,
       "reference": "TEST_TX_123"
     }'
   ```

### Verify in Dashboard

After sending a commission request, check:
1. Dashboard shows updated earnings
2. Referral appears in recent conversions
3. Commission amount is correct

---

## Best Practices

### 1. Use Unique References
Always use unique transaction references to enable idempotency:
```javascript
const reference = `LCS_${Date.now()}_${userId}`;
```

### 2. Store Referral Code Securely
Don't lose the referral code during signup:
- Store in session immediately on landing
- Include in all form submissions
- Persist through OAuth flows

### 3. Send Commissions After Payment
Only send commission requests after:
- Payment is confirmed
- Account is activated
- Free trial is converted (if applicable)

### 4. Log Everything
Keep logs of:
- When commission requests are sent
- Response status codes
- Any errors encountered

### 5. Handle Network Failures
Implement retry logic with exponential backoff for network failures.

### 6. Monitor Commission Rates
Track what percentage of signups have referral codes to optimize your program.

---

## Security Considerations

1. **Never expose the webhook secret** in client-side code
2. **Use HTTPS** in production (enforce in LCS)
3. **Validate referral codes** before storing them
4. **Rate limit** commission requests to prevent abuse
5. **Log suspicious activity** (e.g., same user_email with different referrer_ids)

---

## Troubleshooting

### Commission not appearing in dashboard

**Check:**
1. Referral code is valid (test at `/r/{code}` redirect)
2. Webhook secret matches exactly
3. Server logs show successful processing
4. Database has the referral record

### Getting 404 errors

**Cause:** Invalid `referrer_id`

**Solution:** Verify the referral code exists in the affiliate system

### Getting 401 errors

**Cause:** Wrong or missing webhook secret

**Solution:** Check the `Authorization` header format: `Bearer {secret}`

### Duplicate commissions

**Cause:** Not using unique references

**Solution:** Ensure each transaction has a unique `reference` value

---

## Support

For integration help:
- Email: support@clintonstack.com
- Docs: Check TESTING.md for more examples
- Dashboard: https://affiliate.clintonstack.com

---

## Changelog

**v1.0.0** (2024-01-01)
- Initial release
- POST /api/commission endpoint
- Idempotency support
- Multi-product support
- Comprehensive logging
