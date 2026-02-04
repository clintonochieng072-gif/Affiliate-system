# Affiliate System - How It Works

## ✅ Commission Calculation (FIXED)

### The Only Formula That Matters

**Each successful referral = 70 KES fixed**

```
Total Earnings = Number of Referrals × 70 KES
```

### Examples:
- 1 referral → Total Earnings = 70 KES
- 2 referrals → Total Earnings = 140 KES
- 4 referrals → Total Earnings = 280 KES
- 10 referrals → Total Earnings = 700 KES

---

## 💰 Balance vs Total Earnings

### Total Earnings (Display Only)
- **Never decreases**
- Shows how much affiliate has earned historically
- Formula: `SUM(all paid commissions)`

### Balance (Real Withdrawable Money)
- **Decreases when affiliate withdraws**
- Shows actual money available for withdrawal
- Formula: `Total Earnings - Total Withdrawals`

### Example Flow:

```
First referral recorded:
  Total Earnings: 70 KES
  Balance: 70 KES

Second referral recorded:
  Total Earnings: 140 KES
  Balance: 140 KES

Third referral recorded:
  Total Earnings: 210 KES
  Balance: 210 KES

User withdraws 140 KES:
  Total Earnings: 210 KES (unchanged)
  Balance: 70 KES (210 - 140)

Fourth referral recorded:
  Total Earnings: 280 KES
  Balance: 140 KES (70 + 70)
```

---

## 🔄 How Referrals Work

### 1. Lead Capture System (LCS) Integration

**ONLY ONE ENDPOINT:** `/api/commission`

When someone completes registration through an affiliate link, LCS sends:

```json
POST https://affiliate.clintonstack.com/api/commission
Authorization: Bearer YOUR_WEBHOOK_SECRET

{
  "referrer_id": "ABC123456",
  "user_email": "newuser@example.com",
  "amount": 70,
  "reference": "LCS_REG_20260204_123456",
  "product_slug": "lead-capture-system"
}
```

### 2. System Records Commission

The system:
1. ✅ Finds affiliate by referral code
2. ✅ Records 70 KES commission
3. ✅ Updates Total Earnings (+70)
4. ✅ Updates Balance (+70)
5. ✅ Marks as 'paid' status

### 3. Affiliate Views Dashboard

Dashboard shows:
- **Balance**: Real money available for withdrawal
- **Total Earnings**: All-time earnings (never decreases)
- **Referrals List**: All successful referrals with amounts

---

## 💸 Withdrawal Process

### Rules
- Minimum withdrawal: **140 KES** (2 referrals)
- Must be multiples of 140 KES
- Test option: **10 KES** for testing only

### What Happens During Withdrawal

1. **User requests 140 KES**
2. **System checks balance** ≥ 140 KES
3. **System deducts from balance only**
4. **Total Earnings stays the same**
5. **M-PESA transfer sent via Paystack**

### Withdrawal Fee Structure
- Platform fee: 30 KES per 140 KES block
- Paystack transfer fee: ~20-40 KES (deducted from system account)

Example:
```
User requests: 140 KES
Platform fee: 30 KES (retained by system)
Sent to affiliate: 110 KES
```

---

## 📊 Database Tables

### `referrals` table
```typescript
{
  id: string
  affiliateId: string
  userEmail: string
  productSlug: string
  amountPaid: 70        // Always 70 KES
  commissionAmount: 70  // Always 70 KES
  paymentReference: string (unique)
  status: 'paid'
  createdAt: timestamp
}
```

### `withdrawals` table
```typescript
{
  id: string
  affiliateId: string
  requestedAmount: 140    // Amount user requested
  platformFee: 30         // Fee retained by system
  payoutAmount: 110       // Amount sent to affiliate
  mpesaNumber: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  paystackReference: string
  createdAt: timestamp
}
```

---

## ⚠️ REMOVED: /api/conversion

**This endpoint has been deleted** because it caused incorrect commission calculations.

**Before (WRONG):**
- LCS could send `amount_paid: 1000` + `commission_rate: 0.2`
- System would calculate: 1000 × 0.2 = 200 KES ❌

**Now (CORRECT):**
- LCS sends `amount: 70` directly to `/api/commission`
- System records exactly 70 KES ✅

---

## 🎯 Summary

### The Only Rules:

1. **One Commission Amount**: 70 KES per referral (no calculations, no percentages)
2. **One API Endpoint**: `/api/commission` (LCS sends 70 KES directly)
3. **Two Metrics**:
   - Total Earnings = display only, never decreases
   - Balance = real money, decreases on withdrawal
4. **Balance Formula**: `Total Commissions - Total Withdrawals`

### What Was Fixed:

✅ Removed `/api/conversion` endpoint (caused wrong calculations)
✅ Fixed balance calculation to use `withdrawals` instead of `payouts`
✅ Added validation to reject any commission amount ≠ 70 KES
✅ Database now only contains 70 KES commissions
✅ Total Earnings and Balance are now distinct and correct

---

## 🔧 For Developers

### Key Files:

- `app/api/commission/route.ts` - Records 70 KES commissions from LCS
- `app/api/dashboard/route.ts` - Calculates balance and total earnings
- `app/api/withdrawal/route.ts` - Processes M-PESA withdrawals
- `app/dashboard/page.tsx` - Displays balance and earnings

### Balance Calculation Code:

```typescript
// Get all paid commissions
const totalEarnings = referrals
  .filter(r => r.status === 'paid')
  .reduce((sum, r) => sum + r.commissionAmount, 0)

// Get all completed/processing withdrawals
const totalWithdrawn = withdrawals
  .filter(w => w.status === 'completed' || w.status === 'processing')
  .reduce((sum, w) => sum + w.requestedAmount, 0)

// Calculate available balance
const balance = totalEarnings - totalWithdrawn
```

### LCS Integration:

```javascript
// When user completes registration
await fetch('https://affiliate.clintonstack.com/api/commission', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_WEBHOOK_SECRET'
  },
  body: JSON.stringify({
    referrer_id: referralCode,
    user_email: userEmail,
    amount: 70,  // Always 70 KES
    reference: `LCS_REG_${userId}_${Date.now()}`,
    product_slug: 'lead-capture-system'
  })
})
```

---

**Last Updated:** February 4, 2026
**System Version:** Production-ready with all placeholder values removed
