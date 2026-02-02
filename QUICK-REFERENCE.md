# Quick Reference - MySQL + Prisma + NextAuth Setup

## Environment Variables

```env
# Database (MySQL/PlanetScale)
DATABASE_URL="mysql://user:password@host:3306/database"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# App Config
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
WEBHOOK_SECRET="your-webhook-secret"
TARGET_PRODUCT_URL="https://your-product.com"

# Paystack (optional)
PAYSTACK_SECRET_KEY="sk_test_xxxxx"
```

## Quick Commands

### Setup
```bash
npm install                  # Install dependencies
npx prisma generate         # Generate Prisma client
npx prisma db push          # Create database tables
npm run dev                 # Start dev server
```

### Database Management
```bash
npx prisma studio           # Open database GUI
npx prisma db pull          # Pull schema from database
npx prisma db push          # Push schema to database
npx prisma migrate dev      # Create migration
```

### Building
```bash
npm run build               # Build for production
npm start                   # Start production server
```

## Database Schema (Prisma)

### Models
- **Affiliate** - User accounts with balance and affiliate code
- **Click** - Referral link clicks
- **Conversion** - Completed sales/signups
- **Product** - (Future use) Product catalog

### Key Relationships
- Affiliate hasMany Clicks
- Affiliate hasMany Conversions
- Product hasMany Clicks
- Product hasMany Conversions

## API Endpoints

### Public
- `POST /api/click` - Log a referral click
- `POST /api/conversion` - Record a conversion (requires webhook secret)

### Authenticated
- `GET /api/dashboard` - Get affiliate stats and conversions
- `GET /api/admin` - Get all affiliates and conversions
- `POST /api/payout` - Request a payout

### Auth
- `GET/POST /api/auth/[...nextauth]` - NextAuth handlers
- `/api/auth/signin` - Sign in page
- `/api/auth/signout` - Sign out

## Component Patterns

### Server Component with Prisma
```typescript
import { prisma } from '@/lib/prisma'

export default async function Page() {
  const data = await prisma.affiliate.findMany()
  return <div>{JSON.stringify(data)}</div>
}
```

### Client Component with SWR
```typescript
'use client'
import useSWR from 'swr'

export default function Page() {
  const { data, error, isLoading } = useSWR('/api/dashboard', fetcher)
  if (isLoading) return <div>Loading...</div>
  return <div>{JSON.stringify(data)}</div>
}
```

### Authenticated Component
```typescript
'use client'
import { useSession } from 'next-auth/react'

export default function Page() {
  const { data: session, status } = useSession()
  if (status === 'loading') return <div>Loading...</div>
  if (!session) return <div>Access denied</div>
  return <div>Hello {session.user.name}</div>
}
```

### API Route with Auth
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }
  // Your logic here
}
```

## Common Queries

### Find Affiliate by Code
```typescript
const affiliate = await prisma.affiliate.findUnique({
  where: { affiliateCode: code }
})
```

### Get Affiliate Stats
```typescript
const stats = await prisma.affiliate.findUnique({
  where: { id: affiliateId },
  include: {
    clicks: true,
    conversions: {
      where: { status: 'completed' }
    }
  }
})
```

### Create Conversion
```typescript
const conversion = await prisma.conversion.create({
  data: {
    affiliateId: affiliate.id,
    productId: 'product-id',
    userId: 'user-123',
    amount: 5000,
    status: 'completed'
  }
})
```

### Update Balance
```typescript
await prisma.affiliate.update({
  where: { id: affiliateId },
  data: {
    balance: {
      increment: 5000
    }
  }
})
```

## Type Conversions

### Decimal to Number
```typescript
import { decimalToNumber } from '@/lib/utils'

// In components
formatCurrency(decimalToNumber(affiliate.balance))

// In API responses
balance: decimalToNumber(affiliate.balance)
```

### Date Formatting
```typescript
import { formatDate } from '@/lib/utils'

formatDate(affiliate.createdAt)
```

## Authentication Flow

### Sign In
```typescript
import { signIn } from 'next-auth/react'
<button onClick={() => signIn('google')}>Sign in with Google</button>
```

### Sign Out
```typescript
import { signOut } from 'next-auth/react'
<button onClick={() => signOut()}>Sign out</button>
```

### Check Session
```typescript
import { useSession } from 'next-auth/react'
const { data: session, status } = useSession()
```

### Server-Side Session
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
const session = await getServerSession(authOptions)
```

## Testing Webhook

### PowerShell
```powershell
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer my_super_secret_webhook_key_12345"
}

$body = @{
    affiliate_code = "ABC123456"
    user_id = "test_user_001"
    product_id = "default-product"
    amount = 5000
    status = "completed"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/conversion" -Method POST -Headers $headers -Body $body
```

### cURL
```bash
curl -X POST http://localhost:3000/api/conversion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my_super_secret_webhook_key_12345" \
  -d '{
    "affiliate_code": "ABC123456",
    "user_id": "test_user_001",
    "product_id": "default-product",
    "amount": 5000,
    "status": "completed"
  }'
```

## Middleware

### Protect Routes
```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/',
  },
})

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*']
}
```

## PlanetScale Setup

### 1. Create Database
```bash
# Install PlanetScale CLI
brew install planetscale/tap/pscale

# Create database
pscale database create affiliate-system

# Get connection string
pscale connect affiliate-system main
```

### 2. Update DATABASE_URL
```env
DATABASE_URL="mysql://user:password@aws.connect.psdb.cloud/database?sslaccept=strict"
```

### 3. Push Schema
```bash
npx prisma db push
```

## Production Deployment

### Vercel
1. Push code to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

### Railway
1. Create new project
2. Add MySQL service
3. Deploy from GitHub
4. Set environment variables

### Environment Variables Checklist
- [ ] DATABASE_URL
- [ ] NEXTAUTH_URL (your domain)
- [ ] NEXTAUTH_SECRET (32+ char random)
- [ ] GOOGLE_CLIENT_ID
- [ ] GOOGLE_CLIENT_SECRET
- [ ] WEBHOOK_SECRET
- [ ] TARGET_PRODUCT_URL
- [ ] PAYSTACK_SECRET_KEY (optional)

## Troubleshooting

### Prisma Client Not Generated
```bash
npx prisma generate
```

### Database Connection Error
- Check DATABASE_URL format
- Ensure database is accessible
- Test: `npx prisma db pull`

### NextAuth Error
- Verify NEXTAUTH_SECRET is set
- Check NEXTAUTH_URL matches domain
- Clear cookies and try again

### Build Errors
```bash
npm install
npx prisma generate
npm run build
```

## Useful Links

- [Prisma Docs](https://www.prisma.io/docs)
- [NextAuth Docs](https://next-auth.js.org)
- [SWR Docs](https://swr.vercel.app)
- [PlanetScale Docs](https://planetscale.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
