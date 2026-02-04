# Testing the Affiliate System

This guide shows you how to test all features of the affiliate system.

## Prerequisites

1. Complete the [Quick Start Guide](QUICKSTART.md)
2. Have the dev server running (`npm run dev`)
3. Be signed in to get your affiliate code

## Test 1: User Sign Up and Affiliate Creation

**Expected Result**: New affiliate record is automatically created on first sign-in

1. Sign in with Google at `http://localhost:3000`
2. You'll be redirected to `/dashboard`
3. Note your affiliate code (e.g., `JOH123456`)

**Verify in Supabase**:
- Go to Table Editor > affiliates
- You should see your record with balance = 0

## Test 2: Referral Click Tracking

**Expected Result**: Click is logged when someone visits your referral link

1. Copy your referral link from dashboard (e.g., `http://localhost:3000/r/JOH123456`)
2. Open in incognito/private window
3. You'll be redirected to the target URL

**Verify in Supabase**:
- Go to Table Editor > clicks
- You should see a new click record with your affiliate_id

## Test 3: Conversion Webhook (Manual)

**Expected Result**: Conversion is recorded and balance updated

Using PowerShell:
```powershell
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer my_super_secret_webhook_key_12345"
}

$body = @{
    affiliate_code = "JOH123456"
    user_id = "test_user_001"
    product_id = "default-product"
    amount = 70
    status = "completed"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/conversion" -Method POST -Headers $headers -Body $body
```

Or using curl (Git Bash/WSL):
```bash
curl -X POST http://localhost:3000/api/conversion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my_super_secret_webhook_key_12345" \
  -d '{
    "affiliate_code": "JOH123456",
    "user_id": "test_user_001",
    "product_id": "default-product",
    "amount": 70,
    "status": "completed"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "conversion": {
    "id": "uuid-here",
    "affiliate_id": "uuid-here",
    "product_id": "default-product",
    "user_id": "test_user_001",
    "amount": 70,
    "status": "completed",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Verify**:
1. Refresh your dashboard - balance should increase by KSh 70
2. Conversion should appear in the table
3. Check Supabase > conversions table

## Test 4: Pending Conversion

**Expected Result**: Conversion recorded but balance NOT updated

```powershell
$body = @{
    affiliate_code = "JOH123456"
    user_id = "test_user_002"
    product_id = "default-product"
    amount = 70
    status = "pending"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/conversion" -Method POST -Headers $headers -Body $body
```

**Verify**:
- Dashboard shows conversion in "Pending Balance"
- Available balance unchanged
- Conversion appears with yellow "pending" badge

## Test 5: Click Logging API

**Expected Result**: Click logged via API endpoint

```powershell
$clickBody = @{
    affiliate_code = "JOH123456"
    product_id = "test-product"
} | ConvertTo-Json

$clickHeaders = @{
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/click" -Method POST -Headers $clickHeaders -Body $clickBody
```

**Verify**:
- Check clicks count increases in dashboard
- New record in Supabase > clicks table

## Test 6: Admin Dashboard

**Expected Result**: See all affiliates and conversions

1. Navigate to `http://localhost:3000/admin`
2. Should see stats for all affiliates
3. Tables showing all data

**Create Multiple Test Affiliates**:
- Sign out and sign in with different Google accounts
- Each creates a new affiliate
- All visible in admin dashboard

## Test 7: Payout Request

**Expected Result**: Payout processed and balance deducted

First, ensure you have sufficient balance (≥ KSh 5,000):

```powershell
$payoutHeaders = @{
    "Content-Type" = "application/json"
    "Cookie" = "your-session-cookie"
}

$payoutBody = @{
    amount = 140
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/payout" -Method POST -Headers $payoutHeaders -Body $payoutBody
```

**Note**: This requires authentication cookie. In production, this would be called from the dashboard UI.

**Verify**:
- Balance decreased by payout amount
- (In production: Paystack transfer initiated)

## Test 8: Invalid Webhook Secret

**Expected Result**: 401 Unauthorized error

```powershell
$badHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer wrong_secret"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/conversion" -Method POST -Headers $badHeaders -Body $body
```

Should return error:
```json
{
  "error": "Unauthorized"
}
```

## Test 9: Invalid Affiliate Code

**Expected Result**: 404 Not Found error

```powershell
$body = @{
    affiliate_code = "INVALID999"
    user_id = "test_user_003"
    product_id = "default-product"
    amount = 70
    status = "completed"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/conversion" -Method POST -Headers $headers -Body $body
```

Should return:
```json
{
  "error": "Affiliate not found"
}
```

## Test 10: Full User Journey

**Simulate a complete conversion flow**:

1. **Affiliate shares link**: Copy referral link from dashboard
2. **User clicks**: Open link in incognito window → Click logged
3. **User signs up**: (On your actual product)
4. **System sends webhook**: Send conversion webhook with affiliate code
5. **Affiliate sees conversion**: Check dashboard for new conversion
6. **Balance updates**: Available balance increases
7. **Request payout**: When balance ≥ KSh 5,000

## Test 11: Multiple Conversions

**Test batch processing**:

```powershell
# Send multiple conversions
$codes = @("JOH123456")
1..5 | ForEach-Object {
    $body = @{
        affiliate_code = $codes[0]
        user_id = "test_user_$_"
        product_id = "default-product"
        amount = 70
        status = "completed"
    } | ConvertTo-Json
    
    Invoke-RestMethod -Uri "http://localhost:3000/api/conversion" -Method POST -Headers $headers -Body $body
    Start-Sleep -Milliseconds 500
}
```

**Verify**:
- Multiple conversions in dashboard
- Total balance correctly summed
- All conversions in Supabase

## Debugging Tips

### Check Server Logs
Watch the terminal where `npm run dev` is running for errors

### Check Browser Console
Open DevTools (F12) to see client-side errors

### Check Supabase Logs
- Go to Supabase Dashboard > Logs
- View API logs and errors

### Verify Data in Supabase
- Table Editor shows all data in real-time
- Check RLS policies if queries fail

### Test API Responses
Use the Network tab in DevTools to see API responses

## Production Testing

Before going live:

1. **Test with production Supabase**: Use production database
2. **Test OAuth**: Verify Google OAuth works on production domain
3. **Test webhooks**: Use production webhook secret
4. **Load test**: Send multiple simultaneous requests
5. **Security test**: Try to bypass authentication
6. **Edge cases**: Invalid data, missing fields, etc.

## Performance Testing

Test with realistic data volumes:

```powershell
# Create 100 test conversions
1..100 | ForEach-Object {
    # Your conversion request here
}
```

Monitor:
- Response times
- Database query performance
- Page load times

## Automated Testing (Future)

Consider adding:
- Unit tests for utility functions
- Integration tests for API routes
- E2E tests with Playwright
- Load tests with Artillery or k6

---

## Quick Test Checklist

- [ ] Sign in creates affiliate record
- [ ] Referral link redirects and logs click
- [ ] Completed conversion updates balance
- [ ] Pending conversion doesn't update balance
- [ ] Dashboard shows correct stats
- [ ] Admin dashboard shows all data
- [ ] Invalid webhook secret returns 401
- [ ] Invalid affiliate code returns 404
- [ ] Payout request works (when balance sufficient)
- [ ] Sign out works

---

✅ Once all tests pass, you're ready to integrate with your SaaS!
