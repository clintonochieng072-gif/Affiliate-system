# Commission System Deployment Checklist

## Pre-Deployment

### 1. Environment Variables
- [ ] `WEBHOOK_SECRET` is set in production `.env`
- [ ] Secret is strong (at least 32 characters, random)
- [ ] Secret is shared securely with LCS team (encrypted channel)
- [ ] All other required env vars are set

### 2. Database
- [ ] Prisma schema is up-to-date
- [ ] Migrations have been run in production
- [ ] `referrals` table has unique index on `paymentReference`
- [ ] Database connection is stable

### 3. Testing
- [ ] Health check works: `GET /api/commission`
- [ ] Can record test commission
- [ ] Idempotency works (duplicate detection)
- [ ] Invalid referrer_id returns 404
- [ ] Unauthorized requests return 401
- [ ] Commissions appear in dashboard

## Deployment

### 4. Deploy to Production
- [ ] Code deployed to production environment
- [ ] Server restarted/rebuilt
- [ ] No build errors
- [ ] API endpoint accessible

### 5. Production Testing
- [ ] Health check: `curl https://your-domain.com/api/commission`
- [ ] Send test commission with valid data
- [ ] Verify commission appears in production dashboard
- [ ] Check server logs for proper logging

## LCS Integration

### 6. Share Documentation
- [ ] Send `COMMISSION-API.md` to LCS team
- [ ] Send `lcs-integration-sample.js` as reference
- [ ] Share production API URL
- [ ] Share `WEBHOOK_SECRET` securely

### 7. LCS Implementation
- [ ] LCS captures `ref` parameter from URLs
- [ ] LCS stores referral code with user
- [ ] LCS sends commission after successful registration/payment
- [ ] LCS implements retry logic for failures

### 8. End-to-End Testing
- [ ] Create test referral link in production
- [ ] Share link with test user
- [ ] User registers via referral link in LCS
- [ ] LCS sends commission request
- [ ] Commission appears in affiliate dashboard
- [ ] Affiliate sees correct amount

## Monitoring

### 9. Set Up Monitoring
- [ ] Monitor API response times
- [ ] Set up alerts for 5xx errors
- [ ] Track commission success rate
- [ ] Monitor for suspicious activity (fraud detection)

### 10. Logging
- [ ] Logs are being captured
- [ ] Can access logs for debugging
- [ ] Logs include:
  - [ ] All commission requests
  - [ ] Success/failure status
  - [ ] Processing duration
  - [ ] Error details

## Security

### 11. Security Audit
- [ ] HTTPS enforced in production
- [ ] WEBHOOK_SECRET never exposed in client code
- [ ] Rate limiting in place (optional but recommended)
- [ ] CORS properly configured
- [ ] Input validation working

### 12. Access Control
- [ ] Only authorized systems can call API
- [ ] Dashboard requires authentication
- [ ] Admin functions are protected

## Documentation

### 13. Internal Docs
- [ ] Team knows how commission system works
- [ ] Runbook for troubleshooting
- [ ] Contact info for LCS team
- [ ] Escalation procedures

### 14. User Communication
- [ ] Affiliates notified about commission tracking
- [ ] FAQ updated with commission info
- [ ] Support team trained on commission system

## Maintenance

### 15. Regular Checks
- [ ] Weekly: Check for failed commissions
- [ ] Monthly: Review commission accuracy
- [ ] Quarterly: Audit commission data
- [ ] As needed: Update documentation

### 16. Backup Plan
- [ ] Database backups include referrals table
- [ ] Can recover commission data if needed
- [ ] Have rollback plan if issues arise

## Go-Live Checklist

Use this on launch day:

```
□ All pre-deployment checks passed
□ Production deployment successful
□ Health check returns 200
□ Test commission recorded successfully
□ LCS team has all documentation
□ LCS team has WEBHOOK_SECRET
□ End-to-end test passed
□ Monitoring active
□ Team notified of go-live
□ Support team ready
```

## Troubleshooting

### Common Issues

**Issue: Commissions not recording**
- Check: WEBHOOK_SECRET matches
- Check: Referral code is valid
- Check: LCS is sending correct payload
- Check: Server logs for errors

**Issue: 401 Unauthorized**
- Verify: Authorization header format
- Verify: WEBHOOK_SECRET in LCS matches production
- Check: Header is `Authorization: Bearer {secret}`

**Issue: 404 Referrer Not Found**
- Verify: Referral code exists in database
- Check: Code hasn't expired/been deleted
- Test: Visit `/r/{code}` to verify redirect

**Issue: Duplicate commissions**
- Check: Transaction references are unique
- Verify: LCS not retrying with same reference
- Review: Idempotency logs

## Support Contacts

**Affiliate System Team:**
- Email: support@clintonstack.com
- Phone: [Your phone]

**LCS Team:**
- Email: [LCS email]
- Phone: [LCS phone]

## Success Metrics

Track these metrics post-launch:

- Total commissions recorded
- Average processing time
- Error rate (< 1% target)
- Commission accuracy (100% target)
- Time to resolution for issues

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA | | | |
| DevOps | | | |
| Product Owner | | | |

---

**Last Updated:** February 2, 2026  
**Version:** 1.0.0
