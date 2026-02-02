# 🔧 Quick Fix: Google Sign-In Button Not Working

## The Problem
When you click "Get Started Free", it redirects but shows an error. This is because **Google OAuth needs to be configured** in Google Cloud Console.

## ✅ Quick Solution (5 Minutes)

### Step 1: Open Google Cloud Console
👉 https://console.cloud.google.com/

### Step 2: Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. If prompted, configure the consent screen:
   - Choose **External**
   - App name: `Clintonstack Affiliates`
   - Add your email
   - Save

### Step 3: Configure OAuth Client
1. Application type: **Web application**
2. Name: `Clintonstack Affiliates`
3. **Authorized redirect URIs** - Click "ADD URI" and paste:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
4. Click **CREATE**
5. **IMPORTANT**: Copy the Client ID and Client Secret

### Step 4: Update Environment Variables
Open your `.env.local` file and replace:

```env
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

### Step 5: Restart Server
In your terminal:
```bash
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

### Step 6: Test!
1. Go to http://localhost:3000
2. Click "Get Started Free"
3. Sign in with Google
4. ✅ You'll be redirected to the dashboard

---

## 🎯 The Button IS Working!

The button itself is working perfectly - it's redirecting to `/api/auth/signin/google` correctly. The issue is just that Google doesn't recognize your app yet because the OAuth credentials haven't been set up.

Once you complete the steps above, the entire flow will work:
1. Click button → Google login page
2. Sign in → Auto-create affiliate account
3. Redirect → Dashboard with all your stats

---

## 🆘 Still Having Issues?

### Error: "redirect_uri_mismatch"
The redirect URI must be **exactly**: `http://localhost:3000/api/auth/callback/google`
- No trailing slash
- Must be http (not https) for localhost
- Must be port 3000

### Error: "Access blocked"
Add yourself as a test user:
1. Google Cloud Console → **OAuth consent screen**
2. Scroll to **Test users** → **ADD USERS**
3. Add your email

### Want to See the Button Work Right Now?
The button click is working - you can verify in browser console (F12):
1. Open Developer Tools (F12)
2. Go to Network tab
3. Click "Get Started Free"
4. You'll see it navigates to `/api/auth/signin/google`

The server is responding correctly, it's just redirecting back with an error because Google OAuth isn't configured yet.

---

## 📱 Mobile Responsive?
Yes! The button is fully responsive:
- ✅ Hover effects
- ✅ Click/tap works
- ✅ Scales properly on mobile
- ✅ Links to correct endpoint

The functionality is perfect - we just need to complete the Google OAuth setup! 🚀
