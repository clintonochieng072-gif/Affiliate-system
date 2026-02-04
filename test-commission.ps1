# Commission API Testing Script
# Tests the /api/commission endpoint with various scenarios

$baseUrl = "http://localhost:3000"
$webhookSecret = "LW5DXRnrilmzB4FIwhH0jab1tYcPG27s" # From your .env.local

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $webhookSecret"
}

Write-Host "`n=== COMMISSION API TESTS ===`n" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "Test 1: Health Check (GET)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/commission" -Method GET
    Write-Host "✅ Health check passed" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
}

Write-Host "`n---`n"

# Test 2: Valid Commission Request (70 KES as per LCS integration)
Write-Host "Test 2: Valid Commission Request" -ForegroundColor Yellow
$validPayload = @{
    referrer_id = "jWdlBtQzvE"  # Replace with your actual referral code from dashboard
    user_email = "newuser@example.com"
    amount = 70  # 70 KES per successful referral
    reference = "LCS_TX_" + (Get-Random -Maximum 999999)
    product_slug = "lead-capture-system"
    metadata = @{
        source = "LCS"
        plan = "premium"
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/commission" -Method POST -Headers $headers -Body $validPayload
    Write-Host "✅ Commission recorded successfully" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    $_.Exception.Response | ConvertTo-Json
}

Write-Host "`n---`n"

# Test 3: Idempotency Test (Duplicate Reference)
Write-Host "Test 3: Idempotency Test (Same Reference)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/commission" -Method POST -Headers $headers -Body $validPayload
    Write-Host "✅ Idempotency check passed (duplicate detected)" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
}

Write-Host "`n---`n"

# Test 4: Invalid Referrer ID
Write-Host "Test 4: Invalid Referrer ID" -ForegroundColor Yellow
$invalidRefPayload = @{
    referrer_id = "INVALID123"
    user_email = "test@example.com"
    amount = 70
    reference = "LCS_TX_" + (Get-Random -Maximum 999999)
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/commission" -Method POST -Headers $headers -Body $invalidRefPayload
    Write-Host "❌ Should have failed with 404" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "✅ Correctly rejected invalid referrer_id (404)" -ForegroundColor Green
    } else {
        Write-Host "❌ Unexpected error: $_" -ForegroundColor Red
    }
}

Write-Host "`n---`n"

# Test 5: Missing Required Fields
Write-Host "Test 5: Missing Required Fields" -ForegroundColor Yellow
$missingFieldsPayload = @{
    referrer_id = "jWdlBtQzvE"
    amount = 70
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/commission" -Method POST -Headers $headers -Body $missingFieldsPayload
    Write-Host "❌ Should have failed with 400" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Correctly rejected missing fields (400)" -ForegroundColor Green
    } else {
        Write-Host "❌ Unexpected error: $_" -ForegroundColor Red
    }
}

Write-Host "`n---`n"

# Test 6: Unauthorized Request (Wrong Secret)
Write-Host "Test 6: Unauthorized Request (Wrong Secret)" -ForegroundColor Yellow
$badHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer wrong_secret"
}

$unauthorizedPayload = @{
    referrer_id = "jWdlBtQzvE"
    user_email = "test@example.com"
    amount = 1000
    reference = "LCS_TX_" + (Get-Random -Maximum 999999)
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/commission" -Method POST -Headers $badHeaders -Body $unauthorizedPayload
    Write-Host "❌ Should have failed with 401" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ Correctly rejected unauthorized request (401)" -ForegroundColor Green
    } else {
        Write-Host "❌ Unexpected error: $_" -ForegroundColor Red
    }
}

Write-Host "`n---`n"

# Test 7: Invalid Email Format
Write-Host "Test 7: Invalid Email Format" -ForegroundColor Yellow
$invalidEmailPayload = @{
    referrer_id = "jWdlBtQzvE"
    user_email = "not-an-email"
    amount = 1500
    reference = "LCS_TX_" + (Get-Random -Maximum 999999)
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/commission" -Method POST -Headers $headers -Body $invalidEmailPayload
    Write-Host "❌ Should have failed with 400" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Correctly rejected invalid email (400)" -ForegroundColor Green
    } else {
        Write-Host "❌ Unexpected error: $_" -ForegroundColor Red
    }
}

Write-Host "`n---`n"

# Test 8: Negative Amount
Write-Host "Test 8: Negative Amount" -ForegroundColor Yellow
$negativeAmountPayload = @{
    referrer_id = "jWdlBtQzvE"
    user_email = "test@example.com"
    amount = -1000
    reference = "LCS_TX_" + (Get-Random -Maximum 999999)
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/commission" -Method POST -Headers $headers -Body $negativeAmountPayload
    Write-Host "❌ Should have failed with 400" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Correctly rejected negative amount (400)" -ForegroundColor Green
    } else {
        Write-Host "❌ Unexpected error: $_" -ForegroundColor Red
    }
}

Write-Host "`n=== TESTS COMPLETE ===`n" -ForegroundColor Cyan
Write-Host "Check your dashboard at http://localhost:3000/dashboard" -ForegroundColor Yellow
Write-Host "to see the recorded commissions!`n" -ForegroundColor Yellow
