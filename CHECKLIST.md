# Development Checklist

Use this checklist when setting up and customizing your affiliate system.

## Initial Setup
- [ ] Created Supabase project
- [ ] Ran `supabase-schema.sql` in SQL Editor
- [ ] Enabled Google OAuth in Supabase
- [ ] Configured OAuth credentials in Google Cloud Console
- [ ] Updated `.env.local` with Supabase credentials
- [ ] Set `WEBHOOK_SECRET` to a secure random string
- [ ] Installed dependencies (`npm install`)
- [ ] Project builds without errors (`npm run build`)

## Testing
- [ ] Can sign in with Google
- [ ] Affiliate record created on first sign-in
- [ ] Referral link redirects properly
- [ ] Clicks are being logged
- [ ] Conversion webhook accepts valid requests
- [ ] Conversion webhook rejects invalid secret
- [ ] Balance updates on completed conversions
- [ ] Pending conversions shown separately
- [ ] Dashboard displays correct stats
- [ ] Admin page shows all affiliates
- [ ] Can copy referral link
- [ ] Sign out works

## Customization (Optional)
- [x] Changed currency from NGN to KES (Kenya Shillings)
- [ ] Updated minimum payout amount
- [ ] Modified commission calculation logic
- [ ] Added admin role checks
- [ ] Customized dashboard styling
- [ ] Added company branding/logo
- [ ] Modified referral link format
- [ ] Added email notifications
- [ ] Integrated Paystack payouts

## Production Deployment
- [ ] Pushed code to GitHub/GitLab
- [ ] Created production Supabase project
- [ ] Ran database migration in production
- [ ] Set up OAuth with production URLs
- [ ] Updated environment variables in hosting platform
- [ ] Set `NEXT_PUBLIC_SITE_URL` to production domain
- [ ] Tested Google sign-in on production
- [ ] Verified webhook endpoint is accessible
- [ ] Tested complete conversion flow
- [ ] Set up monitoring/error tracking
- [ ] Configured custom domain (if applicable)
- [ ] Enabled SSL/HTTPS

## Security Checklist
- [ ] `.env.local` is in `.gitignore`
- [ ] Service role key is kept secure
- [ ] Webhook secret is strong and random
- [ ] RLS policies reviewed and tested
- [ ] Admin routes properly protected
- [ ] API routes validate inputs
- [ ] CORS configured if needed
- [ ] Rate limiting considered

## Integration with Your SaaS
- [ ] Documented how to capture affiliate code
- [ ] Implemented affiliate code storage (cookie/session)
- [ ] Tested webhook integration
- [ ] Verified conversion tracking accuracy
- [ ] Set up webhook retry logic
- [ ] Added webhook signature validation (if needed)
- [ ] Tested webhook with different scenarios

## Nice to Have (Future Enhancements)
- [ ] Email notifications for conversions
- [ ] Detailed analytics dashboard
- [ ] CSV export functionality
- [ ] Multi-tier commission structure
- [ ] Affiliate referral program
- [ ] Automated payout processing
- [ ] Performance bonuses
- [ ] Marketing materials generator
- [ ] API documentation
- [ ] Affiliate onboarding guide

## Documentation
- [ ] Updated README with project-specific details
- [ ] Documented custom commission rules
- [ ] Created API documentation
- [ ] Wrote deployment guide for team
- [ ] Documented troubleshooting steps

## Maintenance
- [ ] Regularly update dependencies
- [ ] Monitor for security vulnerabilities
- [ ] Back up database regularly
- [ ] Monitor error logs
- [ ] Review and optimize database queries
- [ ] Update documentation as features change

---

## Quick Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Lint code

# Database
# (Run in Supabase SQL Editor)
# See supabase-schema.sql

# Testing
# See TESTING.md for test commands
```

## Support Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Paystack API Documentation](https://paystack.com/docs/api)

---

📝 **Tip**: Check off items as you complete them to track your progress!
