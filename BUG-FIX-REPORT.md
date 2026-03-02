# BUG REPORT & FIX: New Users Cannot Access Dashboard

## Issue Summary
New users can successfully register with Google OAuth but receive **"Failed to load dashboard"** error when accessing the dashboard. Only the email `clintonochieng072@gmail.com` can successfully access the dashboard.

## Root Cause
**Critical bug in authentication callbacks that silently swallows errors during affiliate record creation.**

### Location
File: [lib/auth.ts](lib/auth.ts)  
Function: `signIn` callback (lines 57-77 in original code)

### The Problem
```typescript
// OLD CODE (BROKEN)
} catch (error) {
  console.error('❌ Error creating sales agent:', error)  // Just logs, doesn't stop anything
}
return true  // Returns TRUE even if affiliate creation failed!
```

When a new user signs in:
1. Google OAuth succeeds ✅
2. `prisma.affiliate.upsert()` is called to create affiliate record
3. **If upsert fails for ANY reason, the error is caught and logged**
4. **But callback still returns `true`** allowing the user to sign in
5. User is authenticated but **NO affiliate record exists** ❌
6. User tries to access dashboard → queries for affiliate → gets 404
7. Dashboard shows: **"Failed to load dashboard"**

The `clintonochieng072@gmail.com` account works because:
- It has an affiliate record in the database (created before the bug or manually added)
- The API can find and load its dashboard data

## Why This Happens

The `signIn` callback does:
```typescript
await prisma.affiliate.upsert({
  where: { email: user.email },
  update: {}, // Empty for regular users
  create: {
    name: user.name || user.email,
    email: user.email,
    role: user.email === ADMIN_EMAIL ? 'ADMIN' : 'AFFILIATE',
  },
})
```

If this fails due to:
- Database connection error
- Missing environment variables
- Schema mismatch
- Constraint violation
- Any other Prisma error

**The error is silently swallowed and login proceeds anyway.** This is a critical SaaS bug!

## The Fix Applied

### 1. **Fail Fast in Auth Callback** (lib/auth.ts)
```typescript
// NEW CODE (FIXED)
if (account?.provider === 'google' && user.email) {
  try {
    // Validate required fields
    if (!user.email || !user.name) {
      console.error('❌ Missing required fields for affiliate creation:', {...})
      return false  // Prevent login
    }
    
    const affiliate = await prisma.affiliate.upsert({...})
    
    console.log('✅ Affiliate record ensured:', {...})
  } catch (error) {
    console.error('❌ CRITICAL: Error creating sales agent - login denied:', {
      email: user.email,
      provider: account?.provider,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    // CRITICAL: Return false to prevent login
    return false
  }
}
return true
```

**Changes:**
- ✅ Returns `false` if affiliate creation fails (prevents login)
- ✅ Returns `false` if required fields are missing
- ✅ Detailed error logging with stack traces
- ✅ Confirms affiliate creation with success logging

### 2. **Better Error Messages in Dashboard API** (app/api/dashboard/route.ts)
```typescript
if (!affiliate) {
  console.error('⚠️ Affiliate record missing for authenticated user:', {...})
  return NextResponse.json(
    { 
      error: 'Affiliate account not initialized',
      details: 'Your account exists but the affiliate record was not created during login. Please sign out and sign in again.',
    },
    { status: 404 }
  )
}
```

**Improvements:**
- ✅ Clearer error message for users
- ✅ Actionable error (suggests signing out/in again)
- ✅ Better logging with context

### 3. **Enhanced Error Logging**
- ✅ Dashboard API logs errors with email, timestamp, and stack traces
- ✅ Auth callback logs detailed error info including provider
- ✅ Helps diagnose issues faster in production

## Verification Steps

### 1. Run Affiliate Record Verification
```bash
npx ts-node verify-affiliate-records.ts
```

This shows:
- All affiliate records in database
- Profile completion status
- Commission rules status
- Any missing data issues

### 2. Test New User Registration
1. Clear browser cookies/cache
2. Visit application
3. Click "Sign in with Google"
4. Use a NEW Gmail account (not previously registered)
5. Complete profile if needed
6. Try to access dashboard
7. Should now see dashboard (not error)

Check server logs for:
```
✅ Affiliate record ensured: { email: 'newuser@gmail.com', name: 'User Name', role: 'AFFILIATE' }
```

### 3. Check Server Logs
If login fails after fix:
```
❌ CRITICAL: Error creating sales agent - login denied: {
  email: 'user@gmail.com',
  provider: 'google',
  error: 'Specific error message',
  stack: '...'
}
```

This shows what's actually failing during affiliate creation.

## Data Recovery (If Needed)

If you have existing users who are stuck (authenticated but no affiliate record):

```typescript
// Get all authenticated users without affiliate records
// Query your JWT tokens or user table to find their emails
// Then manually create affiliate records:

await prisma.affiliate.create({
  data: {
    email: 'stuck-user@gmail.com',
    name: 'User Name', // From Google profile
    role: 'AFFILIATE',
  },
})
```

Or run the verification script and it will show you which users need fixing.

## How to Prevent This in Future

1. **Always throw or return false in auth callbacks** if critical operations fail
2. **Add detailed error logs** with context (email, stack trace, timestamp)
3. **Test auth flows** with intentionally broken databases to catch these bugs
4. **Never silently swallow errors** in authentication code - always fail fast
5. **Use try-catch without return as a last resort** - prefer explicit error handling

## Benefits of This Fix

- ✅ **Fail Fast**: Users immediately know if something is wrong instead of hidden errors
- ✅ **Clear Error Messages**: Users can take action (sign out/in again)
- ✅ **Diagnostic Info**: Server logs show exactly what failed
- ✅ **Data Consistency**: All authenticated users have affiliate records
- ✅ **SaaS Best Practice**: Proper account initialization flow

## Files Modified

1. **[lib/auth.ts](lib/auth.ts)** - Enhanced signIn callback with proper error handling
2. **[app/api/dashboard/route.ts](app/api/dashboard/route.ts)** - Better error messages and logging

## Files Added

1. **[verify-affiliate-records.ts](verify-affiliate-records.ts)** - Diagnostic tool to verify affiliate data

## Testing Checklist

- [ ] New user can sign in with Google
- [ ] New user is logged in (session is set)
- [ ] New user can access dashboard
- [ ] New user dashboard shows correct data
- [ ] Existing users (like clintonochieng072@gmail.com) still work
- [ ] Admin features still work
- [ ] Server logs show proper error messages if signup fails
- [ ] Verify script runs without errors
