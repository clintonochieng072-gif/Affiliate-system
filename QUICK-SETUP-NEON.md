# Quick Setup - Neon PostgreSQL Affiliate System

## 1. Get Neon Database (2 minutes)

1. Visit [neon.tech](https://neon.tech)
2. Click "Sign Up" (free)
3. Create new project
4. Copy connection string (starts with `postgresql://...`)

## 2. Configure Environment (.env.local)

```env
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/database?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-random-32-chars"
GOOGLE_CLIENT_ID="your-google-oauth-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-secret"
WEBHOOK_SECRET="your-webhook-secret"
TARGET_PRODUCT_URL="https://your-product.com"
```

## 3. Initialize Database

```bash
npx prisma db push
npx prisma generate
```

## 4. Run Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 5. Test Webhook

```powershell
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer your-webhook-secret"
}

$body = @{
    referral_code = "ABC123XYZ"
    user_email = "customer@example.com"
    product_slug = "default-product"
    amount_paid = 10000
    payment_reference = "txn_unique_123"
    commission_rate = 0.20
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/conversion" -Method POST -Headers $headers -Body $body
```

## Database Schema

```
Affiliate (id, email, name, createdAt)
  ├── AffiliateLink (id, affiliateId, productSlug, referralCode, createdAt)
  ├── Referral (id, affiliateId, userEmail, productSlug, amountPaid, commissionAmount, paymentReference, status, createdAt)
  └── Payout (id, affiliateId, amount, status, createdAt)
```

## API Routes

- `POST /api/conversion` - Record referral (webhook)
- `GET /api/dashboard` - Affiliate stats
- `GET /api/admin` - Admin overview
- `POST /api/payout` - Request payout
- `GET /r/[code]` - Referral redirect

## View Database

```bash
npx prisma studio
```

Opens web UI at [http://localhost:5555](http://localhost:5555)

## Deploy to Production

1. Get production Neon database URL
2. Set all environment variables
3. Run `npx prisma db push`
4. Deploy to Vercel/Railway/etc.

---

**Build Status**: ✅ PASSING  
**Ready for**: Neon PostgreSQL serverless database
