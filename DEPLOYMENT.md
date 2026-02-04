# Deployment Guide

Complete guide to deploy your Affiliate System to production.

---

## Prerequisites

Before deploying:
- [ ] Project builds successfully (`npm run build`)
- [ ] All environment variables configured
- [ ] Supabase project created
- [ ] Google OAuth configured
- [ ] Code pushed to Git repository

---

## Option 1: Deploy to Vercel (Recommended)

### Why Vercel?
- Native Next.js support
- Automatic deployments
- Free SSL certificates
- Global CDN
- Serverless functions
- Easy environment variable management

### Steps

#### 1. Prepare Your Repository
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/affiliate-system.git
git push -u origin main
```

#### 2. Sign Up / Login to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub

#### 3. Import Project
1. Click "Add New Project"
2. Import your GitHub repository
3. Configure project:
   - Framework Preset: **Next.js**
   - Root Directory: **.**
   - Build Command: `npm run build`
   - Output Directory: `.next`

#### 4. Add Environment Variables
In Vercel project settings, add:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
WEBHOOK_SECRET=your_secure_secret
PAYSTACK_SECRET_KEY=sk_live_xxxxx
TARGET_PRODUCT_URL=https://your-product.com
```

**Important**: Use production Supabase credentials!

#### 5. Deploy
1. Click "Deploy"
2. Wait for build to complete
3. Your app is live! 🎉

#### 6. Configure Custom Domain (Optional)
1. Go to Project Settings > Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXT_PUBLIC_SITE_URL` to your custom domain

#### 7. Update Supabase OAuth
1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Add Site URL: `https://your-domain.vercel.app`
3. Add Redirect URL: `https://your-domain.vercel.app/auth/callback`
4. Update Google OAuth redirect URIs to include production URL

---

## Option 2: Deploy to Netlify

### Steps

#### 1. Install Netlify CLI
```bash
npm install -g netlify-cli
```

#### 2. Build Project
```bash
npm run build
```

#### 3. Deploy
```bash
netlify deploy --prod
```

#### 4. Configure Environment Variables
```bash
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://xxxxx.supabase.co"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "eyJhbGc..."
netlify env:set SUPABASE_SERVICE_ROLE_KEY "eyJhbGc..."
netlify env:set NEXT_PUBLIC_SITE_URL "https://your-site.netlify.app"
netlify env:set WEBHOOK_SECRET "your_secret"
netlify env:set PAYSTACK_SECRET_KEY "sk_live_xxxxx"
netlify env:set TARGET_PRODUCT_URL "https://your-product.com"
```

---

## Option 3: Deploy to Railway

### Steps

#### 1. Sign Up at Railway
Go to [railway.app](https://railway.app)

#### 2. New Project from GitHub
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository

#### 3. Configure
Railway auto-detects Next.js

#### 4. Add Environment Variables
Add all environment variables in Railway dashboard

#### 5. Deploy
Railway automatically builds and deploys

---

## Option 4: Self-Hosted (VPS/AWS/Digital Ocean)

### Requirements
- Node.js 18+ installed
- PM2 process manager
- Nginx as reverse proxy
- SSL certificate (Let's Encrypt)

### Steps

#### 1. SSH to Your Server
```bash
ssh user@your-server-ip
```

#### 2. Install Dependencies
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt-get install nginx
```

#### 3. Clone Repository
```bash
cd /var/www
git clone https://github.com/yourusername/affiliate-system.git
cd affiliate-system
```

#### 4. Install Project Dependencies
```bash
npm install
```

#### 5. Create .env.local
```bash
nano .env.local
# Add all environment variables
```

#### 6. Build Project
```bash
npm run build
```

#### 7. Start with PM2
```bash
pm2 start npm --name "affiliate-system" -- start
pm2 save
pm2 startup
```

#### 8. Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/affiliate-system
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/affiliate-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 9. Install SSL Certificate
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Post-Deployment Checklist

### Test Authentication
- [ ] Visit your production URL
- [ ] Click "Sign in with Google"
- [ ] Verify successful authentication
- [ ] Check affiliate record is created

### Test Referral System
- [ ] Copy your referral link
- [ ] Visit in incognito window
- [ ] Verify redirect works
- [ ] Check click is logged in Supabase

### Test Conversion Webhook
```bash
curl -X POST https://your-domain.com/api/conversion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{
    "affiliate_code": "TEST123456",
    "user_id": "user_123",
    "product_id": "prod_456",
    "amount": 70,
    "status": "completed"
  }'
```

- [ ] Conversion recorded
- [ ] Balance updated
- [ ] Visible in dashboard

### Test Dashboard
- [ ] Stats display correctly
- [ ] Conversions table loads
- [ ] Referral link copyable
- [ ] Sign out works

### Test Admin Panel
- [ ] Admin page accessible
- [ ] All affiliates visible
- [ ] Statistics accurate

### Security Check
- [ ] Environment variables not exposed
- [ ] Webhook secret required
- [ ] Protected routes redirect to login
- [ ] HTTPS enabled

---

## Environment Variables Checklist

Production environment variables:

```env
# Supabase (Production)
✓ NEXT_PUBLIC_SUPABASE_URL
✓ NEXT_PUBLIC_SUPABASE_ANON_KEY
✓ SUPABASE_SERVICE_ROLE_KEY

# Site Configuration
✓ NEXT_PUBLIC_SITE_URL (Production URL)

# Security
✓ WEBHOOK_SECRET (Strong random string)

# Payments
✓ PAYSTACK_SECRET_KEY (Live key, not test)

# App Configuration
✓ TARGET_PRODUCT_URL (Your product URL)
```

---

## Monitoring & Maintenance

### Set Up Error Tracking
Consider adding:
- **Sentry** - Error tracking
- **LogRocket** - Session replay
- **Vercel Analytics** - Web vitals

### Monitor Performance
- Check response times
- Monitor database queries
- Watch for errors in logs

### Regular Maintenance
- Update dependencies monthly
- Monitor security advisories
- Back up Supabase database
- Review and optimize slow queries

### Scaling Considerations
When you reach scale:
- Add Redis caching
- Implement rate limiting
- Use database connection pooling
- Add read replicas
- Consider CDN for assets

---

## Troubleshooting

### Build Fails
```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### OAuth Not Working
- Verify redirect URLs in Google Console
- Check Supabase auth settings
- Ensure `NEXT_PUBLIC_SITE_URL` is correct

### Webhooks Failing
- Test webhook secret
- Check network/firewall rules
- Verify endpoint is accessible
- Review server logs

### Database Errors
- Check RLS policies
- Verify service role key
- Review connection limits
- Check query performance

---

## Rollback Procedure

If deployment fails:

### Vercel
1. Go to Deployments
2. Find last working deployment
3. Click "Promote to Production"

### Railway
1. Go to Deployments
2. Revert to previous deployment

### Self-Hosted
```bash
pm2 stop affiliate-system
git checkout <previous-commit>
npm install
npm run build
pm2 restart affiliate-system
```

---

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **Railway Docs**: https://docs.railway.app
- **PM2 Docs**: https://pm2.keymetrics.io/docs
- **Nginx Docs**: https://nginx.org/en/docs

---

## Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Use HTTPS** - Always enable SSL
3. **Rotate keys** - Change secrets periodically
4. **Monitor logs** - Watch for suspicious activity
5. **Update dependencies** - Keep packages current
6. **Backup database** - Regular Supabase backups
7. **Rate limiting** - Protect API endpoints
8. **Input validation** - Sanitize all inputs

---

## Need Help?

1. Check build logs in your deployment platform
2. Review [TESTING.md](TESTING.md) for debugging
3. Check Supabase logs for database issues
4. Review [ARCHITECTURE.md](ARCHITECTURE.md) for system overview

---

🎉 **Congratulations on your deployment!**

Your affiliate system is now live and ready to track conversions.
