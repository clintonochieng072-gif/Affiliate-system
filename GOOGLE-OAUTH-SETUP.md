# Google OAuth Setup Guide

## Issue
The "Get Started Free" button redirects to Google sign-in but returns an error. This is because the Google OAuth redirect URI needs to be properly configured.

## Quick Fix Steps

### 1. Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### 2. Select Your Project
- If you don't have a project, create one
- Click on the project dropdown at the top and select your project

### 3. Enable Google+ API
1. Go to **APIs & Services** > **Library**
2. Search for "Google+ API"
3. Click on it and click **Enable**

### 4. Configure OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type
3. Fill in:
   - App name: **Clintonstack Affiliates**
   - User support email: Your email
   - Developer contact: Your email
4. Click **Save and Continue**
5. Skip Scopes (click Save and Continue)
6. Add Test Users (add your email)
7. Click **Save and Continue**

### 5. Create OAuth 2.0 Credentials
1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Choose **Web application**
4. Name it: **Clintonstack Affiliates**
5. Add **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   http://localhost:3000/
   ```
6. Add **Authorized redirect URIs**:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

### 6. Update Your .env.local File
Replace the existing values with your new credentials:

```env
GOOGLE_CLIENT_ID=your-new-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-new-client-secret
```

### 7. Restart Your Dev Server
```bash
# Stop the current server (Ctrl+C in terminal)
npm run dev
```

### 8. Test the Sign In
1. Visit http://localhost:3000
2. Click "Get Started Free"
3. You should now see the Google sign-in page
4. Sign in with your Google account
5. You'll be redirected to the dashboard

## For Production Deployment

When deploying to production (e.g., https://affiliates.clintonstack.com):

1. Go back to Google Cloud Console > Credentials
2. Edit your OAuth client
3. Add production URLs:
   - **Authorized JavaScript origins**:
     ```
     https://affiliates.clintonstack.com
     ```
   - **Authorized redirect URIs**:
     ```
     https://affiliates.clintonstack.com/api/auth/callback/google
     ```
4. Update `.env.local` (or production env vars):
   ```env
   NEXTAUTH_URL=https://affiliates.clintonstack.com
   ```

## Troubleshooting

### Error: "redirect_uri_mismatch"
- Make sure the redirect URI in Google Console exactly matches:
  `http://localhost:3000/api/auth/callback/google`
- No trailing slashes
- Correct protocol (http for local, https for production)

### Error: "Access blocked: This app's request is invalid"
- Make sure you've added your email as a test user in OAuth consent screen
- Make sure Google+ API is enabled

### Error: "invalid_client"
- Double-check your Client ID and Client Secret in `.env.local`
- Make sure there are no extra spaces or quotes

### Still not working?
1. Clear your browser cache and cookies
2. Try in incognito/private browsing mode
3. Check the terminal output for specific error messages
4. Make sure your `.env.local` file is in the root directory

## Alternative: Create New OAuth Credentials from Scratch

If you want to start fresh:

1. Go to https://console.cloud.google.com/
2. Create a new project: **Clintonstack Affiliates**
3. Follow steps 3-7 above
4. This ensures no conflicts with existing credentials

---

## Quick Test After Setup

Open your browser console (F12) and run:
```javascript
fetch('/api/auth/providers').then(r => r.json()).then(console.log)
```

You should see:
```json
{
  "google": {
    "id": "google",
    "name": "Google",
    "type": "oauth",
    "signinUrl": "http://localhost:3000/api/auth/signin/google",
    "callbackUrl": "http://localhost:3000/api/auth/callback/google"
  }
}
```

If you see this, NextAuth is configured correctly and the issue is only with Google OAuth credentials.
