# Dynamic URL Generation - Environment-Aware Affiliate Links

## Overview

The affiliate system now **automatically detects the environment** and generates referral links with the correct domain. No more hardcoded `localhost:3000` URLs!

## How It Works

### Priority System

The system checks for URLs in this order:

1. **`NEXT_PUBLIC_SITE_URL`** - Explicitly set in `.env.local` (highest priority)
2. **`VERCEL_URL`** - Automatically provided by Vercel deployments
3. **Request headers** - Server-side: derives from `host` and `x-forwarded-proto`
4. **`window.location.origin`** - Client-side: uses browser's current origin
5. **Fallback** - `http://localhost:3000` (development default)

### Automatic Environment Detection

| Environment | URL Source | Example |
|------------|------------|---------|
| **Local Dev** | Fallback or `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |
| **Vercel Production** | `VERCEL_URL` | `https://affiliate.clintonstack.com` |
| **Vercel Preview** | `VERCEL_URL` | `https://affiliate-git-feature-xxx.vercel.app` |
| **Custom Staging** | `NEXT_PUBLIC_SITE_URL` | `https://staging.clintonstack.com` |

## Usage Examples

### Backend (API Routes)

```typescript
import { getReferralUrl, getBaseUrl } from '@/lib/url'
import { NextRequest } from 'next/server'

// Example: Generate affiliate link in API route
export async function POST(request: NextRequest) {
  const referralCode = 'ABC123'
  
  // Automatically uses correct domain
  const referralUrl = getReferralUrl(referralCode, request)
  // Local: http://localhost:3000/r/ABC123
  // Production: https://affiliate.clintonstack.com/r/ABC123
  
  return Response.json({ referralUrl })
}

// Get just the base URL
export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request)
  // Local: http://localhost:3000
  // Production: https://affiliate.clintonstack.com
  
  return Response.json({ baseUrl })
}
```

### Frontend (React Components)

```typescript
import { buildReferralUrl, useBaseUrl } from '@/lib/url'

export default function MyComponent() {
  const baseUrl = useBaseUrl()
  const referralCode = 'ABC123'
  const referralUrl = buildReferralUrl(referralCode)
  
  return (
    <div>
      <p>Base URL: {baseUrl}</p>
      <p>Referral Link: {referralUrl}</p>
      <input value={referralUrl} readOnly />
    </div>
  )
}
```

### Updated Files

All affiliate link generation now uses dynamic URLs:

- ✅ **`app/api/link/create/route.ts`** - Generates referral links
- ✅ **`lib/url.ts`** - New utility module with all URL helpers
- ✅ **`.env.local`** - Updated with better documentation

## Environment Configuration

### Local Development

```env
# .env.local
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
```

### Production (Vercel)

```env
# Vercel Environment Variables
NEXT_PUBLIC_SITE_URL=https://affiliate.clintonstack.com
NEXTAUTH_URL=https://affiliate.clintonstack.com

# Note: VERCEL_URL is automatically set by Vercel
# If NEXT_PUBLIC_SITE_URL is not set, VERCEL_URL will be used
```

### Staging Environment

```env
# .env.staging
NEXT_PUBLIC_SITE_URL=https://staging.clintonstack.com
NEXTAUTH_URL=https://staging.clintonstack.com
```

## Best Practices

### ✅ DO

- **Use environment variables** for different deployments
- **Let Vercel auto-configure** on preview deployments
- **Test referral links** after deployment to verify correct domain
- **Use the utility functions** (`getReferralUrl`, `buildReferralUrl`)
- **Update `NEXT_PUBLIC_SITE_URL`** when changing domains

### ❌ DON'T

- **Hardcode URLs** like `http://localhost:3000` in code
- **Hardcode production URLs** like `https://affiliate.clintonstack.com`
- **Mix protocols** (http vs https) - let the system handle it
- **Skip testing** referral links in each environment

## Testing

### Test Locally

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Generate a referral link:**
   - Go to http://localhost:3000/dashboard/products
   - Click "Generate Affiliate Link"
   - Should see: `http://localhost:3000/r/XXXXXXXXXX`

### Test on Vercel

1. **Deploy to Vercel:**
   ```bash
   git push origin main
   ```

2. **Check preview deployment:**
   - Vercel creates preview URL: `https://affiliate-xxx.vercel.app`
   - Generate link → Should use Vercel preview domain

3. **Check production:**
   - After merging to main
   - Generate link → Should use `https://affiliate.clintonstack.com`

## Troubleshooting

### Links still show localhost in production

**Problem:** Referral links show `http://localhost:3000` in production

**Solution:**
1. Set `NEXT_PUBLIC_SITE_URL` in Vercel environment variables
2. Redeploy the application
3. Clear cache and test again

### Links show Vercel URL instead of custom domain

**Problem:** Links show `https://affiliate-xxx.vercel.app` instead of `https://affiliate.clintonstack.com`

**Solution:**
1. Set `NEXT_PUBLIC_SITE_URL=https://affiliate.clintonstack.com` in Vercel
2. This overrides `VERCEL_URL`
3. Redeploy

### Different URLs on client vs server

**Problem:** Client-side and server-side generate different URLs

**Solution:**
- Ensure `NEXT_PUBLIC_SITE_URL` is set (it's available on both sides)
- Client-side falls back to `window.location.origin`
- Server-side uses request headers if env var is missing

## Utility Functions Reference

### `getBaseUrl(request?: Request): string`
Get the base URL of the application. Pass `request` for server-side rendering.

### `getReferralUrl(code: string, request?: Request): string`
Generate a complete referral URL with the affiliate code.

### `useBaseUrl(): string`
Client-side function to get the base URL in React components.

### `buildReferralUrl(code: string): string`
Client-side function to build a referral URL in React components.

### `getEnvironment(): 'production' | 'staging' | 'development'`
Get the current environment name.

### `isProduction(): boolean`
Check if running in production environment.

## Migration from Hardcoded URLs

If you find any hardcoded URLs in your codebase:

### Before ❌
```typescript
const referralUrl = `http://localhost:3000/r/${code}`
const siteUrl = 'http://localhost:3000'
```

### After ✅
```typescript
import { getReferralUrl, getBaseUrl } from '@/lib/url'

const referralUrl = getReferralUrl(code, request)
const siteUrl = getBaseUrl(request)
```

## Summary

🎯 **No more hardcoded URLs!**
- Local development automatically uses `localhost:3000`
- Production automatically uses your live domain
- Staging and preview deployments work seamlessly
- One utility module handles all URL generation

✅ **Zero configuration on Vercel**
- Vercel deployments work out of the box
- Preview deployments get correct preview URLs
- Production gets your custom domain

🚀 **Best practices built-in**
- Environment-aware by design
- Server and client support
- Type-safe with TypeScript
- Consistent across the entire app
