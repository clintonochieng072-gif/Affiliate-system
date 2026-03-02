# Sales Record Auto-Provisioning & Product-Specific Sales Links

**Updated: March 2, 2026**

## Overview

This document describes the new SaaS auto-provisioning flow for the Lead Capture System. New users can now sign in via Google and automatically get a sales record created if one doesn't exist.

---

## 📋 Changes Made

### 1. **NextAuth Sign-In Callback** (`lib/auth.ts`)

✅ **Already Implemented**: The `signIn` callback now:
- Detects Google authentication
- Checks if a sales record (affiliate) exists for the user's email
- **Automatically creates a new sales record** if missing
- Sets the role based on email (ADMIN for designated email, AFFILIATE for others)

```typescript
const affiliate = await prisma.affiliate.upsert({
  where: { email: user.email },
  update: { /* role assignment */ },
  create: {
    name: user.name || user.email,
    email: user.email,
    role: 'AFFILIATE',
  },
})
```

### 2. **Dashboard Auto-Provisioning** (`app/api/dashboard/route.ts`)

✅ **Updated**: Added defensive auto-provisioning in both execution paths:

**Main Path** (lines 55-85):
- If affiliate is missing after the first query, creates it automatically
- Returns 500 error only if creation fails
- Never returns 404 error

**Fallback Path** (error handler, lines 448-480):
- If affiliate is missing in the error handler fallback, creates it
- Returns 201 status with redirect instruction on success
- Client-side hook captures this and reloads the page

### 3. **Dashboard Fetcher Utility** (`lib/dashboard-fetcher.ts`) ✨ NEW

Created a centralized fetcher for all dashboard pages that:
- Handles normal API responses (2xx)
- Detects 201 auto-provisioning response
- Triggers page reload on auto-provisioning
- Properly logs errors with context

**Used by all dashboard pages:**
- `/dashboard` - Overview
- `/dashboard/earnings` - Earnings history
- `/dashboard/growth-level` - Sales level progression
- `/dashboard/leaderboard` - Top performers
- `/dashboard/referrals` - My Clients
- `/dashboard/products` - Products to Promote
- `/dashboard/profile` - Profile Settings
- `/dashboard/withdrawals` - Withdrawal Requests

### 4. **Sales Link Format**

✅ **Updated**: Sales links now use the product-specific format:

**Old Format** (still supported via `/r/[code]`):
```
https://leads.clintonstack.com?ref={code}
```

**New Format** (product-specific):
```
https://affiliate.clintonstack.com/s/{code}
```

Both routes redirect to the Lead Capture SaaS with proper tracking:
```
https://leads.clintonstack.com?ref={code}
```

---

## 🔄 End-to-End Flow

### **User Registration to Dashboard**

```
1. New User clicks "Sign in with Google" on homepage
   ↓
2. Google OAuth redirects back with user email & name
   ↓
3. NextAuth signIn callback triggers
   ├─ Checks: Does affiliate record exist?
   ├─ If NO → Creates new sales record for email
   └─ If YES → Continues (upsert)
   ↓
4. User redirected to /dashboard
   ↓
5. Frontend calls GET /api/dashboard
   ├─ API checks: Does affiliate exist?
   ├─ If NO → Auto-creates and returns 201
   │  └─ Client reloads page
   └─ If YES → Returns dashboard data (200)
   ↓
6. Dashboard renders with:
   - Sales level & commission info
   - Earnings summary
   - Products available for promotion
   - Sales links (in format: /s/{code})
   - WhatsApp sales group banner
   ✅ Success!
```

---

## 🛡️ Error Handling

| Scenario | Response | Action |
|----------|----------|--------|
| User authenticated, affiliate exists | 200 | Return full dashboard data |
| User authenticated, affiliate missing (main path) | 201 | Auto-create & return redirect instruction |
| User authenticated, affiliate missing (fallback) | 201 | Auto-create & return redirect instruction |
| Creation fails in main path | 500 | Return error with retry message |
| Creation fails in fallback | 500 | Return error with retry message |
| User not authenticated | 401 | Redirect to login |

---

## 🎯 Product-Specific Features

### Sales Links
- **Location**: `/s/{uniqueUserCode}`
- **Format**: `https://affiliate.clintonstack.com/s/ABC1234567`
- **Redirects to**: Lead Capture SaaS with tracking: `https://leads.clintonstack.com?ref=ABC1234567`
- **Generated**: Per user, per product
- **Stored in**: `AffiliateLink` table with `referralCode` field

### Sales Record
- **Represents**: An authenticated user selling the Lead Capture System
- **Created on**: First sign-in via Google
- **Contains**: Name, email, phone, sales level, earnings, balance
- **Manages**: Commission rates, level progression, withdrawals

### Sales Terminology
All user-facing text now refers to:
- "Sales Link" (not Referral Link)
- "Sales Partner" (not Affiliate)
- "My Clients" (not My Referrals)
- "Sales Level" (not Affiliate Level)
- "Sales Earnings" (not Commission Earnings)

---

## 📡 Database Schema

No schema changes required! The system uses existing tables:

### Affiliate (Sales Record)
```
id: UUID (primary key)
email: String (unique) ← Auto-provisioned from Google
name: String ← Auto-provisioned from Google
phone: String (optional) ← Collected later
role: AFFILIATE or ADMIN
level: LEVEL_1 to LEVEL_4
totalReferralsIndividual: Int
totalReferralsProfessional: Int
availableBalance: Decimal
pendingBalance: Decimal
totalEarned: Decimal
createdAt: DateTime ← Timestamped on auto-provision
...
```

### AffiliateLink (Sales Link)
```
id: UUID
affiliateId: UUID (fk to Affiliate)
productId: UUID (fk to Product)
productSlug: String
referralCode: String (unique) ← nanoid(10)
createdAt: DateTime
```

---

## 🚀 Testing the Flow

### Step 1: Sign In
```bash
curl -X GET http://localhost:3000/api/auth/signin
# Click "Sign in with Google" (or use test account)
```

### Step 2: Verify Auto-Provisioning
```bash
curl -X GET http://localhost:3000/api/dashboard \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "affiliate": {
    "id": "...",
    "email": "user@example.com",
    "name": "User Name",
    "level": "LEVEL_1",
    ...
  },
  "summary": { ... },
  "salesTrackingLinks": [],
  ...
}
```

### Step 3: Check Database
```sql
SELECT id, email, name, role, level, "createdAt" 
FROM affiliates 
WHERE email = 'user@example.com';
```

✅ Record should exist and be auto-provisioned!

---

## 📝 Logging

The system logs all auto-provisioning events:

```
✅ Affiliate record ensured: {email, name, role, method: 'signIn_callback'}
✅ Affiliate auto-provisioned on dashboard access: {email, name}
📝 Sales record auto-provisioned, refreshing dashboard...
❌ Failed to auto-provision affiliate: {email, error}
```

Monitor these logs to ensure the flow is working properly.

---

## 🔗 Related Files

**Authentication:**
- `lib/auth.ts` - NextAuth configuration with auto-provisioning
- `app/api/auth/[...nextauth]/route.ts` - NextAuth API route

**Dashboard API:**
- `app/api/dashboard/route.ts` - Auto-provisioning fallback
- `lib/dashboard-fetcher.ts` - Unified fetcher for all pages

**Dashboard Pages:**
- `app/dashboard/page.tsx` - Overview (uses dashboardFetcher)
- `app/dashboard/products/page.tsx` - Sales Link generation
- `app/dashboard/earnings/page.tsx` - Commission history
- All other dashboard pages - Support dashboardFetcher

**Sales Links:**
- `app/r/[code]/page.tsx` - Legacy redirect route
- `app/s/[code]/page.tsx` - New product-specific route
- `lib/url.ts` - URL building utilities

**UI Components:**
- `components/WhatsAppButton.tsx` - Floating WhatsApp button
- `app/providers.tsx` - WhatsApp button provider
- `app/dashboard/page.tsx` - WhatsApp banner

---

## ✅ Verification Checklist

- [x] New users can sign in via Google
- [x] Affiliate record auto-created on sign-in
- [x] Dashboard loads without 404 errors
- [x] Sales links generated in format `/s/{code}`
- [x] WhatsApp button appears on all dashboard pages
- [x] WhatsApp banner on dashboard homepage
- [x] All terminology changed to "Sales" (not Affiliate)
- [x] Build completes with no errors
- [x] No database schema changes required
- [x] Fallback error handler also auto-provisions

---

## 🌟 Key Benefits

1. **SaaS-Ready**: New users don't need manual account creation
2. **Zero Friction**: Sign in → Dashboard → Sell (3 steps)
3. **Product-Specific**: Sales Links only for Lead Capture System
4. **Robust**: Multiple fallback paths for auto-provisioning
5. **Observable**: Comprehensive logging for debugging
6. **Sales-Focused UI**: All terminology emphasizes sales, not affiliate marketing
