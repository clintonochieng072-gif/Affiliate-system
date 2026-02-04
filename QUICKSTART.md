# Quick Start Guide

## Get Your Affiliate System Running in 5 Minutes

### 1. Install Dependencies ✅
Already done! All packages are installed.

### 2. Set Up Supabase

#### Create a Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details and wait for setup

#### Run the Database Migration
1. In Supabase dashboard, go to **SQL Editor**
2. Copy all contents from `supabase-schema.sql`
3. Paste and click **Run** to create tables

#### Enable Google OAuth
1. Go to **Authentication > Providers**
2. Enable **Google**
3. Follow the setup guide to create OAuth credentials in Google Cloud Console
4. Add this redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`

### 3. Configure Environment Variables

Edit `.env.local` with your Supabase credentials:

```env
# From Supabase Dashboard > Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Keep as-is for local development
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Create a random secure string
WEBHOOK_SECRET=my_super_secret_webhook_key_12345

# Optional - get from Paystack later
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# Where to redirect referrals
TARGET_PRODUCT_URL=https://your-product.com
```

### 4. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Test the System

1. **Sign In**: Click "Sign in with Google" on the homepage
2. **View Dashboard**: You'll be redirected to your affiliate dashboard
3. **Copy Referral Link**: Copy your unique referral link
4. **Test Referral**: Open your referral link in a new incognito window
5. **Send Test Conversion**: Use curl or Postman to send a test conversion

```bash
curl -X POST http://localhost:3000/api/conversion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my_super_secret_webhook_key_12345" \
  -d '{
    "affiliate_code": "YOUR_CODE_FROM_DASHBOARD",
    "user_id": "test_user_123",
    "product_id": "default-product",
    "amount": 70,
    "status": "completed"
  }'
```

6. **Check Dashboard**: Refresh your dashboard to see the conversion

### 6. Access Admin Dashboard

Visit [http://localhost:3000/admin](http://localhost:3000/admin) to see all affiliates and conversions.

## Next Steps

- **Deploy to Production**: See the [Deployment section in README.md](README.md#deployment)
- **Integrate with Your SaaS**: See the [Integration Guide in README.md](README.md#integration-with-your-saas)
- **Customize**: Modify components, styling, and commission structure

## Common Issues

### Google Sign-In Not Working
- Make sure you've enabled Google provider in Supabase
- Verify OAuth credentials are correct
- Check that redirect URI matches exactly

### Conversions Not Recording
- Verify your webhook secret matches
- Check the affiliate code is correct
- Look at the browser console and terminal for errors

### Build Errors
All TypeScript errors are fixed! If you encounter any:
```bash
npm run build
```

## Need Help?

Check the full [README.md](README.md) for detailed documentation.

---

🎉 You're all set! Start sharing your referral links and track your conversions.
