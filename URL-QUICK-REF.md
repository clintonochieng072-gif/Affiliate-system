## Quick Reference: Dynamic Referral Links

### ✅ What Changed

**Before (Hardcoded):**
```typescript
// ❌ Hardcoded localhost - breaks in production
const referralUrl = `http://localhost:3000/r/${code}`
```

**After (Dynamic):**
```typescript
// ✅ Automatically adapts to environment
import { getReferralUrl } from '@/lib/url'
const referralUrl = getReferralUrl(code, request)
```

### 🚀 How It Works

| Environment | Detected URL |
|------------|--------------|
| Local Dev | `http://localhost:3000/r/ABC123` |
| Vercel Production | `https://affiliate.clintonstack.com/r/ABC123` |
| Vercel Preview | `https://affiliate-git-branch.vercel.app/r/ABC123` |
| Custom Staging | `https://staging.yourdomain.com/r/ABC123` |

### 📋 Setup Checklist

#### Local Development
- [x] No changes needed - works automatically
- [x] Uses `http://localhost:3000` by default

#### Production Deployment (Vercel)
- [ ] Set `NEXT_PUBLIC_SITE_URL=https://affiliate.clintonstack.com` in Vercel
- [ ] Set `NEXTAUTH_URL=https://affiliate.clintonstack.com` in Vercel
- [ ] Deploy and test referral link generation

#### Verification
```bash
# Test locally
npm run dev
# Visit http://localhost:3000/dashboard/products
# Generate link → should show localhost

# After deploying to Vercel
# Visit https://affiliate.clintonstack.com/dashboard/products
# Generate link → should show your domain
```

### 🔧 Common Use Cases

**Backend (API Route):**
```typescript
import { getReferralUrl } from '@/lib/url'

export async function POST(request: NextRequest) {
  const code = 'ABC123'
  const url = getReferralUrl(code, request)
  return Response.json({ url })
}
```

**Frontend (React Component):**
```typescript
import { buildReferralUrl } from '@/lib/url'

export default function MyComponent() {
  const code = 'ABC123'
  const url = buildReferralUrl(code)
  return <input value={url} readOnly />
}
```

### 🎯 Key Benefits

✅ **No hardcoding** - URLs adapt automatically
✅ **Works everywhere** - Local, staging, production
✅ **Vercel-friendly** - Auto-detects Vercel URLs
✅ **Type-safe** - Full TypeScript support
✅ **One source of truth** - Centralized in `lib/url.ts`

---

**See [DYNAMIC-URLS.md](DYNAMIC-URLS.md) for complete documentation**
