# Comprehensive Integration Requirements: LCS → Affiliate System

**Date:** February 3, 2026  
**Version:** 1.0  
**Audience:** Lead Capture System (LCS) Development Team

---

## Executive Summary

This document details **everything the Affiliate System expects from the Lead Capture System** to successfully award commissions when referrals convert. Following this specification will ensure 100% compatibility and reliable commission tracking.

---

## 1. API ENDPOINT(S)

### Primary Endpoint: Commission Recording

**URL:** `https://affiliate.clintonstack.com/api/commission`

**Method:** `POST`

**Purpose:** Records a commission when a referred user successfully registers/activates in LCS

**When to Call:** After a user completes registration AND payment/activation in LCS

---

## 2. PAYLOAD REQUIREMENTS

### Required Headers

```http
Content-Type: application/json
Authorization: Bearer LW5DXRnrilmzB4FIwhH0jab1tYcPG27s
```

### Required Payload Fields

| Field | Type | Required | Format/Rules | Example |
|-------|------|----------|--------------|---------|
| `referrer_id` | string | ✅ YES | Must be valid referral code from affiliate link | `"DKp8xYzQwR"` |
| `user_email` | string | ✅ YES | Valid email format (regex validated) | `"newuser@example.com"` |
| `amount` | number | ✅ YES | Positive integer/float > 0 | `70` |
| `reference` | string | ✅ YES | **Globally unique** transaction ID for idempotency | `"LCS_1738598400_user123"` |
| `product_slug` | string | ❌ NO | Product identifier (defaults to "default") | `"lead-capture-system"` |
| `metadata` | object | ❌ NO | Additional data (not validated, stored as-is) | `{"plan": "premium"}` |

### Field-Level Specifications

#### `referrer_id` (string)
- **What it is:** The affiliate's referral code from their unique link
- **Where to get it:** Extract from URL parameter when user lands on LCS
  - Example URL: `https://leads.clintonstack.com/?ref=DKp8xYzQwR`
  - Extract: `ref=DKp8xYzQwR` → use `"DKp8xYzQwR"`
- **Validation:** System checks if this referral code exists in `affiliate_links` table
- **Failure case:** Returns `404 Not Found` if code doesn't exist
- **Storage:** Must persist through entire signup flow (session/cookie/database)

#### `user_email` (string)
- **What it is:** Email address of the newly registered user
- **Validation:** Must match regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **Failure case:** Returns `400 Bad Request` if invalid format
- **Note:** Can be sent multiple times for same email (different referrers allowed)

#### `amount` (number)
- **What it is:** Commission amount to award affiliate (in KES)
- **Current Standard:** `70` KES per referral (fixed commission)
- **Validation:** Must be a positive number > 0
- **Format:** Can be integer or float: `70`, `70.0`, `70.50` all valid
- **Failure case:** Returns `400 Bad Request` if <= 0 or not a number
- **Usage:** Affiliate System stores this as `commissionAmount` in database

#### `reference` (string)
- **Critical:** This enables **idempotency** (prevents duplicate commissions)
- **Must be globally unique:** Never reuse references
- **Recommended format:** `LCS_{timestamp}_{userId}` or Paystack transaction reference
- **Examples:**
  - `"LCS_1738598400_user123"`
  - `"PAYSTACK_txn_abc123xyz"`
  - `"LCS_reg_67890_final"`
- **Behavior:** If same reference sent twice, second request returns success but doesn't create duplicate commission
- **Database:** Stored in `referrals.paymentReference` with unique constraint

#### `product_slug` (optional string)
- **Default value:** `"default"` if not provided
- **Purpose:** Identify which product the referral is for
- **Recommended value:** `"lead-capture-system"` or `"lcs"`
- **Not validated:** Any string accepted

#### `metadata` (optional object)
- **Purpose:** Store additional context (plan type, source, etc.)
- **Not validated:** Any valid JSON object accepted
- **Not required:** Can be omitted entirely
- **Example:**
  ```json
  {
    "plan": "premium",
    "source": "landing_page",
    "trial_days": 14
  }
  ```

### Complete Request Example

```json
POST https://affiliate.clintonstack.com/api/commission
Content-Type: application/json
Authorization: Bearer LW5DXRnrilmzB4FIwhH0jab1tYcPG27s

{
  "referrer_id": "DKp8xYzQwR",
  "user_email": "newuser@example.com",
  "amount": 70,
  "reference": "LCS_1738598400_user123",
  "product_slug": "lead-capture-system",
  "metadata": {
    "plan": "premium",
    "registration_source": "landing_page"
  }
}
```

---

## 3. AUTHENTICATION

### Method: Bearer Token

**Header Format:**
```http
Authorization: Bearer LW5DXRnrilmzB4FIwhH0jab1tYcPG27s
```

### Secret Details

- **Environment Variable in LCS:** Store as `AFFILIATE_WEBHOOK_SECRET`
- **Value:** `LW5DXRnrilmzB4FIwhH0jab1tYcPG27s`
- **Never expose:** Keep in server-side code only (never in frontend)
- **Validation:** Must match exactly (case-sensitive)
- **Failure:** Returns `401 Unauthorized` if missing or incorrect

### Security Requirements

✅ **MUST:**
- Use HTTPS in production
- Store secret in environment variables
- Never log the secret
- Never commit secret to version control

❌ **NEVER:**
- Include secret in client-side code
- Send secret via query parameters
- Share secret via insecure channels

---

## 4. EXPECTED BEHAVIOR & BUSINESS RULES

### When to Send Commission Request

✅ **SEND commission when:**
- User successfully completes registration in LCS
- User activates their account (email verified, payment completed, etc.)
- User converts from trial to paid (if applicable)
- **After** payment confirmation (not before)

❌ **DO NOT send commission when:**
- User just visits landing page (only clicks are tracked)
- User abandons signup flow
- User's payment fails
- User account is flagged/suspended
- Testing/internal accounts

### Idempotency Rules

**Critical Feature:** The Affiliate System prevents duplicate commissions using the `reference` field.

**How it works:**
1. First request with reference `"LCS_123"` → Creates commission, returns 200
2. Second request with same reference `"LCS_123"` → Returns 200 but does NOT create duplicate
3. Response includes `message: "Commission already processed (idempotent)"`

**What this means for LCS:**
- ✅ Safe to retry failed requests with same reference
- ✅ Can resend on network timeout without creating duplicates
- ✅ Webhook can be replayed without side effects
- ⚠️ Must use unique reference for each new user/transaction

**Implementation example:**
```javascript
// ✅ CORRECT: Unique reference per transaction
const reference = `LCS_${Date.now()}_${newUserId}`;

// ✅ CORRECT: Use Paystack transaction reference
const reference = paystackTransaction.reference;

// ❌ WRONG: Reusing same reference
const reference = "LCS_COMMISSION"; // Will only work once!
```

### Timing Constraints

**No strict timing requirements:**
- Commission can be sent immediately after activation
- Commission can be sent days later (delayed activation)
- No expiration on referral codes
- System accepts "old" referrals (no time limit)

**Recommended flow:**
```
User clicks affiliate link
  ↓
User lands on LCS (store referrer_id)
  ↓
User signs up
  ↓
User pays/activates
  ↓
LCS confirms payment
  ↓
LCS sends commission request → Affiliate System
  ↓
Affiliate sees earnings update
```

### Multiple Referrals Rules

**Scenario:** What if same user referred by different affiliates?

**Current behavior:** System allows multiple commissions for same email from different referrers.

**Example:**
- User A referred by Affiliate 1 → Commission awarded
- Same User A referred by Affiliate 2 → Commission awarded again
- This is intentional (no duplicate checking on email, only on reference)

**Note:** If you want to prevent this, implement in LCS (Affiliate System doesn't enforce)

### Commission Status

**All commissions start as:** `status: "paid"`

This means:
- Commission immediately counts toward affiliate's available balance
- No "pending" period or manual approval required
- Affiliate can withdraw as soon as they reach 140 KES (2 referrals)

---

## 5. RESPONSE FORMAT

### Success Response (200 OK)

```json
{
  "success": true,
  "commission": {
    "id": "uuid-v4-string",
    "affiliateId": "uuid-v4-string",
    "userEmail": "newuser@example.com",
    "amount": 70,
    "reference": "LCS_1738598400_user123",
    "status": "paid",
    "createdAt": "2026-02-03T12:00:00.000Z"
  }
}
```

**Field explanations:**
- `success`: Always `true` on 200 status
- `commission.id`: Unique UUID of commission record (for your records)
- `commission.affiliateId`: Internal affiliate UUID (not useful to LCS)
- `commission.userEmail`: Echo of email you sent
- `commission.amount`: Commission amount awarded
- `commission.reference`: Echo of your unique reference
- `commission.status`: Always `"paid"` (commission active)
- `commission.createdAt`: Timestamp when commission was recorded

### Idempotent Response (200 OK - Duplicate Request)

```json
{
  "success": true,
  "message": "Commission already processed (idempotent)",
  "commission": {
    "id": "uuid-v4-string",
    "affiliateId": "uuid-v4-string",
    "userEmail": "newuser@example.com",
    "amount": 70,
    "reference": "LCS_1738598400_user123",
    "status": "paid",
    "createdAt": "2026-02-03T12:00:00.000Z"
  }
}
```

**Key difference:** Includes `message` field indicating idempotent response.

**How to interpret:**
- Still treat as success (`success: true`)
- Commission data reflects the original commission
- No new commission was created
- Safe to continue (not an error)

### How LCS Should Interpret Success

```javascript
if (response.status === 200 && response.data.success === true) {
  // ✅ Commission successfully recorded (or already exists)
  console.log('Commission ID:', response.data.commission.id);
  
  // Check if idempotent
  if (response.data.message?.includes('already processed')) {
    console.log('Duplicate request detected (safe)');
  }
  
  // Mark in your database that commission was sent
  await markCommissionSent(userId, response.data.commission.id);
}
```

---

## 6. ERROR HANDLING

### Error Response Format

All errors follow this structure:
```json
{
  "success": false,
  "error": "Error message here"
}
```

### Complete Error Reference

| Status Code | Error Message | Cause | LCS Action |
|------------|---------------|-------|------------|
| **400** | `"Missing required fields: referrer_id, user_email, amount, reference"` | One or more required fields missing | Check payload, ensure all required fields present |
| **400** | `"Invalid email format"` | Email doesn't match regex | Validate email before sending |
| **400** | `"Amount must be a positive number"` | Amount is 0, negative, or not a number | Ensure amount is > 0 |
| **400** | `"Invalid JSON payload"` | Request body is not valid JSON | Check JSON syntax, ensure proper encoding |
| **401** | `"Unauthorized"` | Missing or invalid Bearer token | Check Authorization header, verify secret |
| **404** | `"Referrer ID not found"` | referrer_id doesn't exist in system | Validate referral code before storing, log error |
| **409** | `"Duplicate transaction reference"` | Rare edge case (shouldn't happen with idempotency check) | Use new unique reference, retry |
| **500** | `"Internal server error"` | Database or server issue on Affiliate System | Retry with exponential backoff |

### Error Handling Strategy

```javascript
async function sendCommission(data) {
  try {
    const response = await fetch('https://affiliate.clintonstack.com/api/commission', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AFFILIATE_WEBHOOK_SECRET}`
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (response.status === 200) {
      // ✅ Success
      return { success: true, data: result };
    }
    
    if (response.status === 400) {
      // ❌ Bad request - log and fix in LCS
      console.error('Invalid commission request:', result.error);
      return { success: false, error: result.error, retry: false };
    }
    
    if (response.status === 401) {
      // ❌ Auth error - critical, alert team
      console.error('CRITICAL: Invalid webhook secret');
      return { success: false, error: result.error, retry: false };
    }
    
    if (response.status === 404) {
      // ⚠️ Invalid referrer - log, may be expired/deleted link
      console.warn('Invalid referrer_id:', data.referrer_id);
      return { success: false, error: result.error, retry: false };
    }
    
    if (response.status === 500) {
      // ⚠️ Server error - retry later
      console.warn('Affiliate System error, will retry');
      return { success: false, error: result.error, retry: true };
    }
    
  } catch (networkError) {
    // ⚠️ Network failure - retry
    console.error('Network error:', networkError);
    return { success: false, error: 'Network error', retry: true };
  }
}
```

### Retry Logic (Recommended)

```javascript
async function sendCommissionWithRetry(data, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await sendCommission(data);
    
    if (result.success) {
      return result; // ✅ Success
    }
    
    if (!result.retry) {
      return result; // ❌ Non-retryable error (400, 401, 404)
    }
    
    if (attempt < maxRetries) {
      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, delay));
      console.log(`Retrying commission (attempt ${attempt + 1}/${maxRetries})`);
    }
  }
  
  // All retries failed
  console.error('All commission retries failed');
  return { success: false, error: 'Max retries exceeded' };
}
```

### What to Log in LCS

**On Success:**
```javascript
console.log('Commission sent successfully', {
  user_email: data.user_email,
  referrer_id: data.referrer_id,
  commission_id: response.commission.id,
  amount: data.amount,
  timestamp: new Date().toISOString()
});
```

**On Error:**
```javascript
console.error('Commission request failed', {
  user_email: data.user_email,
  referrer_id: data.referrer_id,
  error: response.error,
  status_code: response.status,
  attempt: attemptNumber,
  timestamp: new Date().toISOString()
});
```

---

## 7. OTHER INTEGRATION RULES

### Database Requirements (LCS Side)

**Store these fields when user lands with referral link:**
- `referrer_id` (affiliate code from URL)
- `landed_at` (timestamp)
- `referrer_link` (full URL for debugging)

**Track commission status:**
- `commission_sent` (boolean)
- `commission_sent_at` (timestamp)
- `commission_id` (from Affiliate System response)
- `commission_error` (if sending failed)

### URL Parameter Capture

**When user visits:**
```
https://leads.clintonstack.com/?ref=DKp8xYzQwR
```

**LCS must:**
1. Extract `ref` parameter
2. Store in session/cookie/database
3. Persist through entire signup flow (multi-step forms, OAuth, etc.)
4. Include in commission request after activation

**Storage options:**
```javascript
// Option 1: Session storage
sessionStorage.setItem('referrer_id', 'DKp8xYzQwR');

// Option 2: Cookie (persists across sessions)
document.cookie = `referrer_id=DKp8xYzQwR; path=/; max-age=2592000`; // 30 days

// Option 3: Database (best for server-side)
await db.users.update({ id: userId, referrer_id: 'DKp8xYzQwR' });
```

### Testing Requirements

**Before going live, LCS must test:**
1. ✅ Valid referral link flow (end-to-end)
2. ✅ Commission recorded successfully
3. ✅ Idempotency (send same request twice, verify only one commission)
4. ✅ Invalid referrer_id (handle 404 gracefully)
5. ✅ Network failure (verify retry logic)
6. ✅ Affiliate sees commission in dashboard

**Test script provided:**
```powershell
# See test-commission.ps1 in Affiliate System repo
.\test-commission.ps1
```

### Monitoring & Alerting

**LCS should monitor:**
- Commission success rate (target: >99%)
- Average response time from Affiliate System
- Error rate by type (400, 401, 404, 500)
- Number of users with referral links (conversion tracking)

**Alert on:**
- Multiple 401 errors (auth issue)
- Multiple 500 errors (Affiliate System down)
- Success rate drops below 95%
- Referral parameter not being captured

### Rate Limiting

**No strict rate limits enforced by Affiliate System.**

However, for optimal performance:
- Batch requests if possible (though API doesn't support batch endpoint yet)
- Don't hammer API with retries instantly (use exponential backoff)
- Typical usage: <100 requests/minute should be fine

### Commission Amount Standard

**Current fixed rate:** 70 KES per referral

**Important:**
- Always send `amount: 70` in your requests
- This is hardcoded in current system
- If commission structure changes in future, we'll notify you
- For now, LCS doesn't need to calculate amount dynamically

### No Webhook from Affiliate System

**One-way communication:**
- LCS sends commission → Affiliate System
- Affiliate System does NOT send webhooks back to LCS
- Commission is processed synchronously (response tells you success/failure)

**This means:**
- LCS gets immediate confirmation
- No need to implement webhook receiver in LCS
- Simpler integration (fire and forget with response handling)

---

## 8. CURRENT LCS IMPLEMENTATION ANALYSIS

### ✅ What LCS Currently Has (Assumed)

Based on typical implementation:
- Referral parameter tracking (`?ref=`)
- User registration system
- Payment/activation flow
- Database for user records

### ⚠️ Potential Gaps to Address

| Area | Gap | Action Required |
|------|-----|-----------------|
| **Referral Persistence** | May not persist referrer_id through OAuth or multi-step signup | Implement session/cookie storage |
| **Commission Trigger** | May not have webhook after user activation | Add commission API call to activation flow |
| **Secret Management** | Webhook secret not yet configured | Add `AFFILIATE_WEBHOOK_SECRET` to .env |
| **Error Handling** | May not retry on network failures | Implement retry logic with exponential backoff |
| **Idempotency** | May not generate unique references | Use Paystack txn ref or timestamp-based ID |
| **Logging** | May not log commission attempts | Add comprehensive logging |
| **Testing** | May not have tested end-to-end | Perform full integration test |

### 🎯 Recommended Implementation Checklist

#### Phase 1: Setup (Day 1)
- [ ] Add `AFFILIATE_WEBHOOK_SECRET=LW5DXRnrilmzB4FIwhH0jab1tYcPG27s` to LCS .env
- [ ] Create helper function `sendCommission()`
- [ ] Add database fields: `referrer_id`, `commission_sent`, `commission_id`

#### Phase 2: Capture (Day 1-2)
- [ ] Implement referral parameter capture on landing
- [ ] Store in session/cookie
- [ ] Persist through entire signup flow
- [ ] Test: Verify referrer_id survives OAuth redirect

#### Phase 3: Integration (Day 2-3)
- [ ] Add commission API call after user activation
- [ ] Generate unique reference per transaction
- [ ] Handle all error responses
- [ ] Implement retry logic

#### Phase 4: Testing (Day 3-4)
- [ ] Test with valid referral link
- [ ] Test invalid referrer_id (404 handling)
- [ ] Test idempotency (send twice)
- [ ] Test network failure (retry logic)
- [ ] Verify commission appears in affiliate dashboard

#### Phase 5: Monitoring (Day 4-5)
- [ ] Add logging for all commission attempts
- [ ] Set up alerts for high error rates
- [ ] Monitor commission success rate
- [ ] Document integration in LCS codebase

---

## 9. COMPLETE INTEGRATION EXAMPLE (Node.js)

```javascript
// config/affiliate.js
module.exports = {
  apiUrl: 'https://affiliate.clintonstack.com/api/commission',
  secret: process.env.AFFILIATE_WEBHOOK_SECRET,
  commissionAmount: 70 // KES per referral
};

// services/affiliateService.js
const axios = require('axios');
const config = require('../config/affiliate');

class AffiliateService {
  
  /**
   * Send commission to Affiliate System
   */
  async sendCommission(data) {
    const { referrerId, userEmail, userId } = data;
    
    // Generate unique reference
    const reference = `LCS_${Date.now()}_${userId}`;
    
    const payload = {
      referrer_id: referrerId,
      user_email: userEmail,
      amount: config.commissionAmount,
      reference: reference,
      product_slug: 'lead-capture-system',
      metadata: {
        user_id: userId,
        source: 'lcs_signup'
      }
    };
    
    try {
      const response = await axios.post(config.apiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.secret}`
        },
        timeout: 10000 // 10 second timeout
      });
      
      console.log('✅ Commission sent successfully', {
        user_email: userEmail,
        commission_id: response.data.commission.id,
        reference: reference
      });
      
      return {
        success: true,
        commissionId: response.data.commission.id,
        reference: reference
      };
      
    } catch (error) {
      console.error('❌ Commission failed', {
        user_email: userEmail,
        error: error.response?.data?.error || error.message,
        status: error.response?.status
      });
      
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        shouldRetry: error.response?.status === 500 || !error.response
      };
    }
  }
  
  /**
   * Send commission with retry logic
   */
  async sendCommissionWithRetry(data, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.sendCommission(data);
      
      if (result.success) {
        return result;
      }
      
      if (!result.shouldRetry) {
        return result; // Non-retryable error
      }
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Retrying commission in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return { success: false, error: 'Max retries exceeded' };
  }
}

module.exports = new AffiliateService();

// controllers/authController.js (or wherever user activation happens)
const affiliateService = require('../services/affiliateService');
const User = require('../models/User');

async function activateUser(userId) {
  try {
    // Your existing activation logic
    const user = await User.findById(userId);
    user.isActive = true;
    await user.save();
    
    // Send commission if user has referrer_id
    if (user.referrer_id) {
      console.log('🎯 User has referrer, sending commission...');
      
      const result = await affiliateService.sendCommissionWithRetry({
        referrerId: user.referrer_id,
        userEmail: user.email,
        userId: user.id
      });
      
      if (result.success) {
        // Update user record
        user.commission_sent = true;
        user.commission_id = result.commissionId;
        user.commission_reference = result.reference;
        await user.save();
        
        console.log('✅ Commission recorded for user activation');
      } else {
        console.error('❌ Failed to send commission, will retry later');
        // Schedule background job to retry
      }
    }
    
    return user;
  } catch (error) {
    console.error('User activation error:', error);
    throw error;
  }
}

// middleware/captureReferral.js (Express middleware)
function captureReferralMiddleware(req, res, next) {
  const referrerId = req.query.ref;
  
  if (referrerId) {
    // Store in session
    req.session.referrer_id = referrerId;
    
    // Also store in cookie (backup)
    res.cookie('referrer_id', referrerId, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
    
    console.log('📎 Captured referral:', referrerId);
  }
  
  next();
}

module.exports = captureReferralMiddleware;

// app.js (Express app setup)
const captureReferral = require('./middleware/captureReferral');

app.use(captureReferral); // Apply to all routes

// When user registers
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  
  // Get referrer from session or cookie
  const referrerId = req.session.referrer_id || req.cookies.referrer_id;
  
  const user = await User.create({
    email,
    password,
    referrer_id: referrerId // Store for later
  });
  
  // Commission will be sent when user activates
  res.json({ success: true, user });
});
```

---

## 10. SUMMARY & RECOMMENDATIONS

### Critical Requirements

| Requirement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Store webhook secret | 🔴 Critical | Low | Day 1 |
| Capture referrer_id | 🔴 Critical | Medium | Day 1-2 |
| Send commission after activation | 🔴 Critical | Medium | Day 2-3 |
| Generate unique references | 🔴 Critical | Low | Day 2 |
| Handle 404 errors | 🟡 Important | Low | Day 3 |
| Implement retry logic | 🟡 Important | Medium | Day 3-4 |
| Add logging | 🟢 Nice-to-have | Low | Day 4 |

### Key Integration Points

1. **Landing Page:** Capture `?ref=` parameter
2. **Registration:** Persist referrer_id with user record
3. **Activation:** Send commission API request
4. **Error Handling:** Retry on network failures, log errors
5. **Monitoring:** Track success rate

### What Makes a Successful Integration

✅ **Success criteria:**
- Referral links tracked 100% of time
- Commissions sent after user activation
- >99% success rate
- Idempotency working (no duplicates)
- Affiliates see commissions in dashboard
- Error alerts working

### Next Steps for LCS Team

1. **Read this document fully**
2. **Set up test environment** with Affiliate System API
3. **Implement referral capture** on landing pages
4. **Add commission webhook** to activation flow
5. **Test end-to-end** with real referral link
6. **Deploy to staging** and validate
7. **Deploy to production** with monitoring
8. **Coordinate launch** with Affiliate System team

---

## 11. TESTING CHECKLIST

### Pre-Integration Testing

- [ ] Can access `https://affiliate.clintonstack.com/api/commission`
- [ ] Have webhook secret stored securely
- [ ] Can generate test referral code from Affiliate dashboard
- [ ] Referral link redirects to LCS correctly

### Integration Testing

- [ ] Referrer parameter captured on landing
- [ ] Referrer persists through signup flow
- [ ] Commission request sent after activation
- [ ] Response 200 received with commission ID
- [ ] Commission appears in affiliate dashboard
- [ ] Duplicate request returns idempotent response
- [ ] Invalid referrer_id returns 404 (handled gracefully)
- [ ] Network failure triggers retry logic

### Production Testing

- [ ] Real user signup with referral link works
- [ ] Commission amount correct (70 KES)
- [ ] Logs show successful commission recording
- [ ] Alerts fire if errors exceed threshold
- [ ] Multiple referrals work for same affiliate
- [ ] Different affiliates tracked separately

---

## 12. SUPPORT & CONTACT

**For technical questions:**
- GitHub: [Affiliate System Repo](https://github.com/clintonochieng072-gif/Affiliate-system)
- Documentation: See `COMMISSION-API.md`, `TESTING.md`

**For urgent issues:**
- Check system status: `https://affiliate.clintonstack.com/api/commission` (GET request)
- Review logs in Affiliate System
- Contact via email: support@clintonstack.com

---

## APPENDIX A: Quick Reference Table

| What | Value |
|------|-------|
| **API URL** | `https://affiliate.clintonstack.com/api/commission` |
| **Method** | `POST` |
| **Auth Header** | `Authorization: Bearer LW5DXRnrilmzB4FIwhH0jab1tYcPG27s` |
| **Required Fields** | `referrer_id`, `user_email`, `amount`, `reference` |
| **Commission Amount** | `70` (KES) |
| **Success Status** | `200` with `success: true` |
| **Idempotency** | Via `reference` field (must be unique) |
| **Retry on** | 500 errors, network failures |
| **Don't retry on** | 400, 401, 404 errors |

---

**Document Version:** 1.0  
**Last Updated:** February 3, 2026  
**Author:** Affiliate System Development Team  
**Status:** ✅ Ready for Implementation
