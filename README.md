# Affiliate System - Next.js 14 with Supabase

A complete affiliate marketing system built with Next.js 14, Supabase, and Tailwind CSS. Features Google OAuth authentication, click tracking, conversion webhooks, and Paystack payout integration.

> 📖 **New to the project?** Check out the [Documentation Index](DOCS-INDEX.md) to find exactly what you need!

## Features

- **Google OAuth Authentication** - Secure sign-in via Supabase Auth
- **Affiliate Dashboard** - Track clicks, conversions, and earnings
- **Admin Dashboard** - Monitor all affiliates and conversions
- **Referral Tracking** - Unique referral links with click logging
- **Conversion Webhooks** - Receive conversion data from your Lead Capture System
- **Payout Management** - Request payouts with Paystack integration
- **Responsive Design** - Clean, modern UI built with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database & Auth**: Supabase
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Payment**: Paystack (for payouts)

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- A Supabase account and project
- A Google Cloud project with OAuth credentials
- (Optional) A Paystack account for payout functionality

## Setup Instructions

### 1. Clone and Install

```bash
cd "Affiliate system"
npm install
```

### 2. Configure Supabase

#### Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to finish setting up

#### Run Database Migration
1. Go to the SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase-schema.sql`
3. Run the SQL script to create all tables and policies

#### Configure Google OAuth
1. Go to Authentication > Providers in your Supabase dashboard
2. Enable Google provider
3. Follow Supabase's guide to set up Google OAuth:
   - Create OAuth credentials in Google Cloud Console
   - Add authorized redirect URIs: `https://your-project.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret to Supabase

### 3. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Update the following variables:

```env
# Get these from Supabase Dashboard > Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Your deployment URL (use http://localhost:3000 for development)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Create a secure random string for webhook authentication
WEBHOOK_SECRET=your_secure_webhook_secret

# Get from Paystack Dashboard (optional for development)
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# Where referral links should redirect to
TARGET_PRODUCT_URL=https://your-product-url.com
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
affiliate-system/
├── app/
│   ├── api/
│   │   ├── click/          # Log clicks
│   │   ├── conversion/     # Webhook endpoint
│   │   └── payout/         # Process payouts
│   ├── auth/
│   │   └── callback/       # OAuth callback
│   ├── dashboard/          # Affiliate dashboard
│   ├── admin/              # Admin dashboard
│   ├── r/[code]/           # Referral redirect
│   ├── layout.tsx
│   ├── page.tsx            # Landing page
│   └── globals.css
├── components/
│   ├── AffiliatesTable.tsx
│   ├── ConversionsTable.tsx
│   ├── SignOutButton.tsx
│   └── StatsCard.tsx
├── lib/
│   ├── supabase/
│   │   ├── admin.ts        # Admin client
│   │   ├── client.ts       # Browser client
│   │   ├── middleware.ts   # Middleware helper
│   │   └── server.ts       # Server client
│   └── utils.ts
├── types/
│   └── index.ts            # TypeScript types
├── middleware.ts           # Auth middleware
├── supabase-schema.sql     # Database schema
└── .env.local              # Environment variables
```

## Usage Guide

### For Affiliates

1. **Sign In**: Visit the homepage and click "Sign in with Google"
2. **Get Your Referral Link**: After signing in, copy your unique referral link from the dashboard
3. **Share Your Link**: Share your referral link with potential customers
4. **Track Performance**: Monitor clicks and conversions in real-time
5. **Request Payout**: Once you reach the minimum balance (KSh 5,000), request a payout

### For Admins

1. **Access Admin Dashboard**: Navigate to `/admin` after signing in
2. **View All Affiliates**: See all registered affiliates and their stats
3. **Monitor Conversions**: Track all conversions across the platform
4. **Process Payouts**: (Feature to be implemented with Paystack)

### Integration with Your SaaS

#### Sending Conversion Data

When a referred user completes a purchase or signs up, send a POST request to the conversion webhook:

```bash
curl -X POST https://your-domain.com/api/conversion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{
    "affiliate_code": "ABC123456",
    "user_id": "user_12345",
    "product_id": "product_67890",
    "amount": 5000,
    "status": "completed"
  }'
```

**Webhook Payload**:
- `affiliate_code`: The affiliate's unique code (from URL parameter)
- `user_id`: Your system's user ID
- `product_id`: Your product/plan ID
- `amount`: Commission amount in cents (for KES) or smallest currency unit
- `status`: Either "pending" or "completed"

**Response**:
```json
{
  "success": true,
  "conversion": {
    "id": "uuid",
    "affiliate_id": "uuid",
    "amount": 5000,
    "status": "completed",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### Tracking the Affiliate Code

When users arrive via a referral link (`/r/ABC123456`), they're redirected to your product.
You should:

1. Capture the affiliate code from the URL before redirect
2. Store it in a cookie or session
3. Associate it with the user when they sign up
4. Send it with the conversion webhook

Example JavaScript to capture the code:

```javascript
// On your product page
const urlParams = new URLSearchParams(window.location.search);
const affiliateCode = urlParams.get('ref');
if (affiliateCode) {
  // Store in cookie
  document.cookie = `affiliate_code=${affiliateCode}; max-age=2592000; path=/`;
}
```

## API Endpoints

### POST /api/conversion
Record a conversion and update affiliate balance.

**Headers**:
- `Authorization: Bearer YOUR_WEBHOOK_SECRET`
- `Content-Type: application/json`

**Body**:
```json
{
  "affiliate_code": "string",
  "user_id": "string",
  "product_id": "string",
  "amount": number,
  "status": "pending" | "completed"
}
```

### POST /api/click
Manually log a click (alternative to server-side logging).

**Body**:
```json
{
  "affiliate_code": "string",
  "product_id": "string"
}
```

### POST /api/payout
Request a payout (requires authentication).

**Body**:
```json
{
  "amount": number
}
```

## Database Schema

### affiliates
- `id` (UUID, PK)
- `name` (TEXT)
- `email` (TEXT, UNIQUE)
- `affiliate_code` (TEXT, UNIQUE)
- `balance` (DECIMAL)
- `created_at` (TIMESTAMP)

### clicks
- `id` (UUID, PK)
- `affiliate_id` (UUID, FK)
- `product_id` (TEXT)
- `visitor_ip` (TEXT)
- `created_at` (TIMESTAMP)

### conversions
- `id` (UUID, PK)
- `affiliate_id` (UUID, FK)
- `product_id` (TEXT)
- `user_id` (TEXT)
- `amount` (DECIMAL)
- `status` (TEXT: 'pending' | 'completed')
- `created_at` (TIMESTAMP)

### products
- `id` (UUID, PK)
- `name` (TEXT)
- `price` (DECIMAL)
- `created_at` (TIMESTAMP)

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables
4. Deploy

**Important**: Update `NEXT_PUBLIC_SITE_URL` to your production URL after deployment.

### Deploy to Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- AWS Amplify
- Self-hosted with PM2

## Security Considerations

1. **Environment Variables**: Never commit `.env.local` to version control
2. **Webhook Secret**: Use a strong, random string for `WEBHOOK_SECRET`
3. **Service Role Key**: Keep `SUPABASE_SERVICE_ROLE_KEY` secure - it bypasses Row Level Security
4. **Row Level Security**: The database schema includes RLS policies - review them for your use case
5. **Admin Access**: Currently, any logged-in user can access `/admin` - implement proper admin checks

## Customization

### Change Currency
The system uses Kenya Shillings (KES) by default. To change:
1. Update `formatCurrency` in `lib/utils.ts`
2. Update minimum payout amount in `app/dashboard/page.tsx`

### Modify Commission Structure
Commission amounts are sent via webhook. Implement your logic in your Lead Capture System.

### Add Admin Role Check
Currently, any user can access `/admin`. To restrict:
1. Add an `is_admin` column to the `affiliates` table
2. Add a check in `app/admin/page.tsx`

### Integrate Paystack Payouts
Complete the Paystack integration in `app/api/payout/route.ts`:
1. Install Paystack SDK: `npm install paystack`
2. Implement transfer recipient creation
3. Implement transfer initiation
4. Handle Paystack webhooks for transfer confirmation

## Troubleshooting

### Google OAuth Not Working
- Verify OAuth credentials in Google Cloud Console
- Check that redirect URIs are correctly configured
- Ensure Supabase Google provider is enabled

### Conversions Not Recording
- Verify webhook secret matches in your Lead Capture System
- Check Supabase logs for errors
- Ensure affiliate code is correct

### Balance Not Updating
- Check conversion status is "completed" not "pending"
- Verify RLS policies allow the update
- Check Supabase logs for errors

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use this project for your own purposes.

## Support

For issues and questions:
- Check the Supabase documentation: https://supabase.com/docs
- Check the Next.js documentation: https://nextjs.org/docs
- Open an issue in this repository

## Roadmap

- [ ] Email notifications for conversions and payouts
- [ ] Multi-tier commission structure
- [ ] Affiliate performance analytics
- [ ] Custom commission rates per affiliate
- [ ] Automated Paystack payout processing
- [ ] Affiliate referral program (affiliates referring affiliates)
- [ ] CSV export for reports

---

Built with ❤️ using Next.js 14 and Supabase
