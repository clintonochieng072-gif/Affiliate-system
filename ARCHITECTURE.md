# System Architecture

## Overview

The Affiliate System is a full-stack application with three main components:

1. **Frontend** - Next.js 14 with Server & Client Components
2. **Backend** - Next.js API Routes
3. **Database** - Supabase (PostgreSQL + Authentication)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NEXT.JS 14 APP                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Landing    │  │  Dashboard   │  │    Admin     │         │
│  │     Page     │  │     Page     │  │     Page     │         │
│  │      /       │  │  /dashboard  │  │    /admin    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                           │
│  │   Referral   │  │     Auth     │                           │
│  │   Redirect   │  │   Callback   │                           │
│  │  /r/[code]   │  │ /auth/callback│                          │
│  └──────────────┘  └──────────────┘                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐      │
│  │              MIDDLEWARE (Auth Protection)            │      │
│  └─────────────────────────────────────────────────────┘      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐      │
│  │                   API ROUTES                         │      │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │      │
│  │  │ /api/click   │  │/api/conversion│  │/api/payout│ │      │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │      │
│  └─────────────────────────────────────────────────────┘      │
└──────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐      │
│  │           AUTHENTICATION (Google OAuth)              │      │
│  └─────────────────────────────────────────────────────┘      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐      │
│  │              POSTGRESQL DATABASE                     │      │
│  │                                                      │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │      │
│  │  │affiliates│  │  clicks  │  │ conversions  │     │      │
│  │  └──────────┘  └──────────┘  └──────────────┘     │      │
│  │                                                      │      │
│  │  ┌──────────┐                                       │      │
│  │  │ products │                                       │      │
│  │  └──────────┘                                       │      │
│  │                                                      │      │
│  │  Row Level Security (RLS) Policies                  │      │
│  └─────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                          ▲
                          │
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                  EXTERNAL SYSTEMS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐        ┌─────────────────────┐       │
│  │  Your SaaS Product  │        │   Paystack API       │       │
│  │  (Sends webhooks)   │        │   (Payouts)          │       │
│  └─────────────────────┘        └─────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. User Authentication Flow

```
User → Click "Sign in with Google"
     → Supabase Auth (OAuth)
     → Google Login
     → Redirect to /auth/callback
     → Session created
     → Check if affiliate exists
     → If not, create affiliate record
     → Redirect to /dashboard
```

### 2. Referral Click Flow

```
Visitor → Click referral link (/r/ABC123456)
        → Server-side page logs click
        → Insert into clicks table
        → Redirect to target product URL
```

### 3. Conversion Flow

```
Your SaaS → User completes purchase/signup
          → Send POST to /api/conversion
          → Validate webhook secret
          → Find affiliate by code
          → Insert conversion record
          → If status = "completed":
              → Update affiliate balance
          → Return success response
```

### 4. Payout Flow

```
Affiliate → Request payout from dashboard
          → POST to /api/payout
          → Verify authentication
          → Check balance >= minimum
          → Call Paystack Transfer API
          → Update affiliate balance
          → Return success response
```

## Component Structure

```
app/
├── layout.tsx              # Root layout with global CSS
├── page.tsx                # Landing page with Google sign-in
├── auth/
│   └── callback/
│       └── route.ts        # OAuth callback handler
├── dashboard/
│   └── page.tsx            # Affiliate dashboard (protected)
├── admin/
│   └── page.tsx            # Admin dashboard (protected)
├── r/
│   └── [code]/
│       └── page.tsx        # Dynamic referral redirect
└── api/
    ├── click/
    │   └── route.ts        # Log click endpoint
    ├── conversion/
    │   └── route.ts        # Conversion webhook endpoint
    └── payout/
        └── route.ts        # Payout request endpoint

components/
├── StatsCard.tsx           # Reusable stat display
├── ConversionsTable.tsx    # Table of conversions
├── AffiliatesTable.tsx     # Table of affiliates (admin)
└── SignOutButton.tsx       # Client component for sign out

lib/
├── supabase/
│   ├── client.ts           # Browser Supabase client
│   ├── server.ts           # Server Supabase client
│   ├── admin.ts            # Admin client (service role)
│   └── middleware.ts       # Middleware helper
└── utils.ts                # Utility functions

types/
└── index.ts                # TypeScript type definitions
```

## Technology Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - UI library
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type safety

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Supabase Client** - Database and auth SDK

### Database & Auth
- **Supabase** - Backend-as-a-Service
- **PostgreSQL** - Relational database
- **Row Level Security** - Database-level authorization

### External Services
- **Google OAuth** - Authentication provider
- **Paystack** - Payment processing (payouts)

## Security Layers

1. **Authentication**
   - Google OAuth via Supabase
   - Session-based authentication
   - HTTP-only cookies

2. **Authorization**
   - Middleware protects routes
   - RLS policies on database
   - Service role key for admin operations

3. **API Security**
   - Webhook secret validation
   - Bearer token authentication
   - Input validation

4. **Database Security**
   - Row Level Security enabled
   - Role-based access control
   - Prepared statements (SQL injection prevention)

## Scalability Considerations

### Current Setup (Good for 0-10k affiliates)
- Server-side rendering
- Direct database queries
- Simple authentication

### Future Optimizations (For scale)
- Add Redis caching
- Implement rate limiting
- Use CDN for static assets
- Add database read replicas
- Implement queue for webhooks
- Add monitoring and alerts

## Environment Variables

```
Frontend (Public):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_SITE_URL

Backend (Private):
- SUPABASE_SERVICE_ROLE_KEY
- WEBHOOK_SECRET
- PAYSTACK_SECRET_KEY
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│              VERCEL / HOSTING                    │
│  ┌───────────────────────────────────────────┐ │
│  │         Next.js Application               │ │
│  │  (Server Functions + Static Assets)       │ │
│  └───────────────────────────────────────────┘ │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│          SUPABASE CLOUD                          │
│  ┌───────────────────────────────────────────┐ │
│  │     PostgreSQL Database + Auth            │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## API Endpoints Summary

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/` | GET | No | Landing page |
| `/dashboard` | GET | Yes | Affiliate dashboard |
| `/admin` | GET | Yes | Admin dashboard |
| `/r/[code]` | GET | No | Referral redirect |
| `/auth/callback` | GET | No | OAuth callback |
| `/api/click` | POST | No | Log click |
| `/api/conversion` | POST | Webhook Secret | Record conversion |
| `/api/payout` | POST | Yes | Request payout |

---

This architecture provides a solid foundation for an affiliate system that can scale with your business.
