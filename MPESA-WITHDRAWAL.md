# M-PESA Withdrawal System Documentation

## Overview

Complete M-PESA withdrawal system for the affiliate platform with automated commission calculations, platform fees, and Paystack Transfers API integration.

## Commission Structure

- **Per Referral**: 70 KES
- **Withdrawal Block**: 140 KES (2 referrals minimum)
- **Platform Fee**: 30 KES per 140 KES block (stays in Paystack)
- **Affiliate Payout**: 110 KES per 140 KES block (sent to M-PESA)
- **Transfer Fees**: Paid by system (20 KES for 1-1,500 KES, 40 KES for 1,501-20,000 KES)

## How It Works

### 1. Earning Commissions
- Affiliates earn **70 KES per successful referral**
- Commissions are tracked in the `referrals` table with status='paid'
- Total earnings = Number of paid referrals × 70 KES

### 2. Withdrawal Process
1. Affiliate selects withdrawal amount (must be multiple of 140 KES)
2. Enters M-PESA phone number (254XXXXXXXXX format)
3. System calculates:
   - Number of blocks = Amount ÷ 140
   - Platform fee = Blocks × 30 KES
   - Payout amount = Amount - Platform fee
   - Transfer fee = 20 or 40 KES (paid by system)
4. Creates withdrawal record in database
5. Sends payout to M-PESA via Paystack Transfers API
6. Webhook updates withdrawal status

### 3. Example Calculation

**Withdrawal Request: 280 KES**
- Blocks: 280 ÷ 140 = 2
- Platform Fee: 2 × 30 = 60 KES
- Payout to Affiliate: 280 - 60 = **220 KES**
- Transfer Fee (paid by system): 20 KES

## API Endpoints

### POST /api/withdrawal
Request a withdrawal to M-PESA.

**Request Body:**
```json
{
  "amount": 280,
  "mpesaNumber": "254712345678"
}
```

**Response:**
```json
{
  "success": true,
  "withdrawal": {
    "id": "uuid",
    "requestedAmount": 280,
    "platformFee": 60,
    "payoutAmount": 220,
    "transferFee": 20,
    "mpesaNumber": "254712345678",
    "status": "processing",
    "message": "Withdrawal initiated. You will receive M-PESA notification shortly."
  }
}
```

**Validations:**
- Amount must be multiple of 140
- M-PESA number must be valid Kenyan format
- Sufficient balance required
- Authenticated user only

### GET /api/withdrawal
Get withdrawal history for authenticated user.

**Response:**
```json
{
  "withdrawals": [
    {
      "id": "uuid",
      "requestedAmount": 280,
      "platformFee": 60,
      "payoutAmount": 220,
      "mpesaNumber": "254712345678",
      "status": "completed",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/webhooks/paystack
Paystack webhook endpoint for transfer status updates.

**⚠️ DEPRECATED - Use Internal Webhook Instead**

This endpoint is kept for backward compatibility but should not be used directly.
Paystack webhooks should be received by Lead Capture System and forwarded to:

### POST /api/internal/paystack-webhook
Internal webhook endpoint for forwarded Paystack events.

**Security**: Requires `Authorization: Bearer AFFILIATE_API_SECRET`

**Request Body:**
```json
{
  "event": "transfer.success",
  "data": {
    "reference": "withdrawal-uuid",
    "transfer_code": "TRF_xxxxx",
    "amount": 24000,
    "status": "success"
  }
}
```

**Events Handled:**
- `transfer.success` - Updates withdrawal status to 'completed'
- `transfer.failed` - Updates withdrawal status to 'failed' and makes balance available for retry

**Response:**
```json
{
  "success": true,
  "message": "Withdrawal marked as completed",
  "withdrawalId": "uuid",
  "status": "completed"
}
```

## Database Schema

### Withdrawal Model
```prisma
model Withdrawal {
  id                  String   @id @default(uuid())
  affiliateId         String
  requestedAmount     Decimal  // Amount requested (e.g., 140, 280, 420)
  platformFee         Decimal  // Platform fee (30 KES per 140 block)
  payoutAmount        Decimal  // Amount sent to affiliate
  paystackTransferFee Decimal  // Transfer fee paid by system
  mpesaNumber         String   // M-PESA phone number
  status              String   // 'pending', 'processing', 'completed', 'failed'
  paystackReference   String?  // Paystack transfer reference ID
  failureReason       String?  // Error message if failed
  createdAt           DateTime
  updatedAt           DateTime
  
  affiliate           Affiliate @relation(...)
}
```

## Frontend Implementation

### Withdrawal Page: `/dashboard/withdraw`

**Features:**
- Displays available balance
- Shows selectable withdrawal amounts in multiples of 140 KES
- M-PESA number input with format validation
- Real-time fee breakdown display
- Withdrawal history with status tracking
- Responsive design for mobile/desktop

**User Flow:**
1. View available balance and number of withdrawable blocks
2. Select withdrawal amount from grid
3. See instant fee breakdown
4. Enter M-PESA number
5. Submit withdrawal
6. Receive confirmation and M-PESA notification

## Paystack Integration

### Setup Requirements

1. **Paystack Account**
   - Sign up at https://paystack.com
   - Verify business in Kenya
   - Get API keys from Settings > API Keys

2. **Environment Variables**
```env
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxx
```

3. **Webhook Configuration**
   - URL: `https://your-domain.com/api/webhooks/paystack`
   - Events: `transfer.success`, `transfer.failed`
   - Get webhook secret from Paystack dashboard

### Transfer Flow

1. **Create Transfer Recipient**
```javascript
POST https://api.paystack.co/transferrecipient
{
  "type": "mobile_money",
  "name": "Affiliate Name",
  "account_number": "254712345678",
  "bank_code": "mpesa",
  "currency": "KES"
}
```

2. **Initiate Transfer**
```javascript
POST https://api.paystack.co/transfer
{
  "source": "balance",
  "amount": 22000, // In cents (220 KES)
  "recipient": "RCP_xxxxx",
  "reason": "Affiliate commission withdrawal - 2 blocks",
  "reference": "withdrawal-uuid"
}
```

3. **Webhook Notification**
Paystack sends webhook when transfer completes or fails.

## Testing

### Test Withdrawal Flow

1. **Generate Test Referrals** (to have balance):
```bash
# Create test referrals via commission API
curl -X POST http://localhost:3000/api/commission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{
    "affiliate_code": "ABC123456",
    "user_id": "test@example.com",
    "amount": 70,
    "status": "completed"
  }'
```

2. **Request Withdrawal**:
```bash
curl -X POST http://localhost:3000/api/withdrawal \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth-session-token" \
  -d '{
    "amount": 280,
    "mpesaNumber": "254712345678"
  }'
```

3. **Simulate Webhook** (for testing):
```bash
curl -X POST http://localhost:3000/api/webhooks/paystack \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: YOUR_SIGNATURE" \
  -d '{
    "event": "transfer.success",
    "data": {
      "reference": "withdrawal-uuid",
      "transfer_code": "TRF_xxxxx",
      "amount": 22000
    }
  }'
```

## Error Handling

### Common Errors

**Insufficient Balance**
```json
{
  "error": "Insufficient balance",
  "availableBalance": 70,
  "requestedAmount": 140
}
```

**Invalid Amount**
```json
{
  "error": "Amount must be a multiple of 140 KES"
}
```

**Invalid M-PESA Number**
```json
{
  "error": "Invalid M-PESA number format. Use 254XXXXXXXXX or 07XXXXXXXX"
}
```

**Transfer Failed**
```json
{
  "error": "Transfer failed",
  "details": "Insufficient funds in Paystack balance"
}
```

## Security

### Authentication
- All withdrawal endpoints require NextAuth session
- User can only access their own withdrawals

### Webhook Security
- HMAC SHA512 signature verification
- Rejects unsigned requests
- Validates signature against Paystack secret key

### Input Validation
- Amount must be multiple of 140
- M-PESA number format validation
- Balance verification before processing
- Prevents duplicate withdrawals

## Monitoring

### Key Metrics to Track

1. **Withdrawal Volume**
   - Total withdrawals per day/week/month
   - Average withdrawal amount
   - Success vs failure rate

2. **Platform Fees Collected**
   - Total platform fees = Sum of all platformFee in withdrawals
   - Track revenue from fees

3. **Transfer Costs**
   - Total Paystack fees paid by system
   - Track against platform fees collected

4. **Processing Time**
   - Time from request to completion
   - Monitor webhook delivery delays

### Database Queries

**Total Withdrawals Today:**
```sql
SELECT COUNT(*), SUM(requestedAmount), SUM(platformFee)
FROM withdrawals
WHERE DATE(createdAt) = CURRENT_DATE;
```

**Failed Withdrawals:**
```sql
SELECT * FROM withdrawals
WHERE status = 'failed'
ORDER BY createdAt DESC;
```

**Pending Withdrawals:**
```sql
SELECT * FROM withdrawals
WHERE status IN ('pending', 'processing')
AND createdAt < NOW() - INTERVAL '1 hour';
```

## Production Checklist

- [ ] Set up Paystack account and verify business
- [ ] Add `PAYSTACK_SECRET_KEY` to production environment variables
- [ ] Configure Paystack webhook URL in dashboard
- [ ] Test with small amounts first
- [ ] Monitor withdrawal success rates
- [ ] Set up alerts for failed withdrawals
- [ ] Implement admin dashboard for withdrawal management
- [ ] Add email/SMS notifications for withdrawal status
- [ ] Set withdrawal limits per affiliate (if needed)
- [ ] Implement withdrawal history export feature

## Support

### Common Issues

**"Insufficient funds in Paystack balance"**
- Fund your Paystack account with KES
- Paystack needs balance to process transfers

**"Invalid recipient"**
- Verify M-PESA number is active
- Check number format (254XXXXXXXXX)
- Ensure Paystack supports recipient's network

**"Webhook not received"**
- Verify webhook URL is accessible
- Check Paystack dashboard for webhook logs
- Ensure x-paystack-signature header is present

### Contact
- Documentation: See README.md
- Issues: Check GitHub repository
- Paystack Support: support@paystack.com

---

## Quick Reference

| Metric | Value |
|--------|-------|
| Commission per referral | 70 KES |
| Minimum withdrawal | 140 KES (2 referrals) |
| Platform fee | 30 KES per 140 block |
| Affiliate payout | 110 KES per 140 block |
| Transfer fee (1-1,500) | 20 KES (paid by system) |
| Transfer fee (1,501-20,000) | 40 KES (paid by system) |
| Payout method | M-PESA via Paystack |
| Processing time | 5-30 minutes |

**Example Withdrawals:**

| Requested | Blocks | Platform Fee | You Receive |
|-----------|--------|--------------|-------------|
| 140 KES | 1 | 30 KES | 110 KES |
| 280 KES | 2 | 60 KES | 220 KES |
| 420 KES | 3 | 90 KES | 330 KES |
| 700 KES | 5 | 150 KES | 550 KES |
| 1,400 KES | 10 | 300 KES | 1,100 KES |
