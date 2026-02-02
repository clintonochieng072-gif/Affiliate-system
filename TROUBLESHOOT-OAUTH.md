# OAuth Troubleshooting Guide

## Current Issue
You've added the redirect URI but still getting `error=google` when trying to sign in.

## Most Common Causes & Solutions

### 1. Enable Required Google APIs ⚠️ MOST LIKELY ISSUE

Google OAuth requires specific APIs to be enabled:

**Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to **APIs & Services > Library**
4. Search for and **ENABLE** these APIs:
   - **Google+ API** (or People API)
   - **Google Identity Toolkit API**
5. Wait 2-3 minutes for changes to propagate
6. Try signing in again

### 2. OAuth Consent Screen Configuration

Your consent screen might be incomplete:

**Steps:**
1. Go to **APIs & Services > OAuth consent screen**
2. Check that:
   - **App name** is filled in
   - **User support email** is set
   - **Developer contact email** is set
   - **App domain** (optional for testing)
3. Under **Scopes**, add:
   - `userinfo.email`
   - `userinfo.profile`
4. If "Testing" status:
   - Add your Google email to **Test users** list
   - Click **Save**

### 3. Verify Redirect URI Exactly

Make sure the redirect URI is **EXACTLY**:
```
http://localhost:3000/api/auth/callback/google
```

**Common mistakes:**
- ❌ `http://localhost:3000/api/auth/signin/google` (wrong endpoint)
- ❌ `https://localhost:3000/...` (wrong protocol - should be http)
- ❌ Missing `/google` at the end
- ❌ Extra slash at the end

**Correct location in Google Console:**
1. Go to **APIs & Services > Credentials**
2. Click your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, verify the exact URI above
4. Click **Save** if you made any changes

### 4. Regenerate OAuth Credentials

Sometimes credentials get corrupted or don't update properly:

**Steps:**
1. Go to **APIs & Services > Credentials**
2. Find your OAuth 2.0 Client ID
3. Click the trash icon to **DELETE** it
4. Click **+ CREATE CREDENTIALS > OAuth client ID**
5. Application type: **Web application**
6. Name: `Clintonstack Affiliates Local`
7. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
8. Click **Create**
9. Copy the new **Client ID** and **Client Secret**
10. Update `.env.local`:
```env
GOOGLE_CLIENT_ID=your-new-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-new-secret
```
11. **Restart dev server**: Stop `npm run dev` and start again

### 5. Check OAuth Consent Screen Status

If your app is in "Testing" status:

**Option A: Add yourself as test user**
1. Go to **OAuth consent screen**
2. Scroll to **Test users**
3. Click **+ ADD USERS**
4. Add the Google email you're trying to sign in with
5. Click **Save**

**Option B: Publish app (for internal use)**
1. Go to **OAuth consent screen**
2. Click **PUBLISH APP**
3. Confirm (this is fine for personal/internal apps)

### 6. Clear Browser Cache & Cookies

Sometimes the OAuth error gets cached:

**Steps:**
1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Under **Storage**, click **Clear site data**
4. Close incognito windows
5. Try signing in again in a fresh incognito window

### 7. Restart Everything

After making any changes:

**Steps:**
1. Stop the dev server (Ctrl+C in terminal)
2. Clear Next.js cache:
   ```bash
   rm -rf .next
   ```
   Or on Windows PowerShell:
   ```powershell
   Remove-Item -Recurse -Force .next
   ```
3. Restart dev server:
   ```bash
   npm run dev
   ```
4. Try signing in again

## Quick Checklist

Run through this checklist:

- [ ] Google+ API or People API is ENABLED in Google Cloud Console
- [ ] OAuth consent screen has app name, support email, developer email filled
- [ ] OAuth consent screen has userinfo.email and userinfo.profile scopes
- [ ] If "Testing" status, your email is added to test users
- [ ] Redirect URI is EXACTLY: `http://localhost:3000/api/auth/callback/google`
- [ ] OAuth credentials are saved in Google Console
- [ ] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local match Google Console
- [ ] Dev server restarted after any .env changes
- [ ] Tried in fresh incognito window
- [ ] Waited 2-3 minutes after making changes

## Still Not Working?

If you've tried everything above, let's check the specific error from Google:

1. Open Chrome DevTools (F12)
2. Go to **Network** tab
3. Click "Get Started Free" button
4. Look for the `/api/auth/signin/google` request
5. Check the **Headers** and **Response** tabs
6. Share any error messages you see

## Alternative: Create New OAuth Project

If nothing works, create a fresh OAuth setup:

1. Create a **new project** in Google Cloud Console
2. Enable **Google+ API** and **Google Identity Toolkit API**
3. Configure OAuth consent screen from scratch
4. Create new OAuth 2.0 credentials
5. Use the new credentials in your .env.local

---

## Need More Help?

Common error patterns:

- **"Error 400: redirect_uri_mismatch"** → Check step 3 (verify redirect URI)
- **"Error 403: access_denied"** → Check step 2 (consent screen) and step 5 (test users)
- **"Error 401: invalid_client"** → Check step 4 (regenerate credentials)
- **Generic "error=google"** → Usually step 1 (enable APIs)

