# Commission API - Quick Reference

## Endpoint
```
POST https://your-domain.com/api/commission
```

## Authentication
```http
Authorization: Bearer YOUR_WEBHOOK_SECRET
```

## Request Payload
```json
{
  "referrer_id": "AFF123",
  "user_email": "user@mail.com",
  "amount": 5000,
  "reference": "UNIQUE_TX_REF"
}
```

## cURL Example
```bash
curl -X POST http://localhost:3000/api/commission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer LW5DXRnrilmzB4FIwhH0jab1tYcPG27s" \
  -d '{
    "referrer_id": "jWdlBtQzvE",
    "user_email": "newuser@example.com",
    "amount": 5000,
    "reference": "LCS_TX_12345"
  }'
```

## Response Codes
- **200** - Success (commission recorded or already exists)
- **400** - Invalid request (missing fields, bad format)
- **401** - Unauthorized (wrong secret)
- **404** - Referrer ID not found
- **500** - Server error

## Key Features
✅ Idempotency (safe to retry)  
✅ Secure authentication  
✅ Comprehensive logging  
✅ Multi-product support  

## Testing
```powershell
.\test-commission.ps1
```

## Documentation
See `COMMISSION-API.md` for full integration guide.
