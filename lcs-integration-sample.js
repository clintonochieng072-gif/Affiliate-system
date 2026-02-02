/**
 * Sample Integration Code for Lead Capture System (LCS)
 * 
 * This file demonstrates how to integrate the Affiliate Commission API
 * into your LCS payment/registration flow.
 */

// ============================================
// CONFIGURATION
// ============================================

const AFFILIATE_API_URL = process.env.AFFILIATE_API_URL || 'https://affiliate.clintonstack.com/api/commission';
const AFFILIATE_WEBHOOK_SECRET = process.env.AFFILIATE_WEBHOOK_SECRET;

if (!AFFILIATE_WEBHOOK_SECRET) {
  console.warn('⚠️ AFFILIATE_WEBHOOK_SECRET not set - commission tracking disabled');
}

// ============================================
// STEP 1: CAPTURE REFERRAL CODE
// ============================================

/**
 * Capture referral code from URL parameter when user lands on LCS
 * Store in session or cookie for later use
 */
function captureReferralCode(req, res) {
  const referralCode = req.query.ref;
  
  if (referralCode) {
    // Store in session
    req.session.referralCode = referralCode;
    
    // Or store in cookie (30 days)
    res.cookie('referral_code', referralCode, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
    
    console.log('📎 Referral code captured:', referralCode);
  }
}

// Example usage in Express route:
// app.get('/landing', captureReferralCode, (req, res) => {
//   res.render('landing');
// });

// ============================================
// STEP 2: RETRIEVE REFERRAL CODE
// ============================================

/**
 * Retrieve stored referral code when needed
 */
function getReferralCode(req) {
  // Try session first
  if (req.session?.referralCode) {
    return req.session.referralCode;
  }
  
  // Fall back to cookie
  if (req.cookies?.referral_code) {
    return req.cookies.referral_code;
  }
  
  return null;
}

// ============================================
// STEP 3: RECORD COMMISSION
// ============================================

/**
 * Send commission to affiliate system
 * Call this after successful registration/payment
 */
async function recordCommission(referralCode, userEmail, amount, transactionReference) {
  if (!AFFILIATE_WEBHOOK_SECRET) {
    console.warn('⚠️ Commission tracking disabled (no webhook secret)');
    return { success: false, error: 'Commission tracking not configured' };
  }
  
  if (!referralCode) {
    console.log('ℹ️ No referral code - skipping commission');
    return { success: false, error: 'No referral code' };
  }
  
  try {
    const response = await fetch(AFFILIATE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AFFILIATE_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify({
        referrer_id: referralCode,
        user_email: userEmail,
        amount: amount,
        reference: transactionReference,
        product_slug: 'lead-capture-system',
        metadata: {
          source: 'lcs',
          timestamp: new Date().toISOString(),
        },
      }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Commission recorded:', {
        commissionId: data.commission?.id,
        amount: data.commission?.amount,
        reference: transactionReference,
      });
      return { success: true, data };
    } else {
      console.error('❌ Commission failed:', {
        status: response.status,
        error: data.error,
        reference: transactionReference,
      });
      return { success: false, error: data.error };
    }
    
  } catch (error) {
    console.error('❌ Commission request failed:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// STEP 4: INTEGRATE INTO PAYMENT FLOW
// ============================================

/**
 * Example: Paystack webhook handler
 * This runs after successful payment
 */
async function handlePaystackWebhook(req, res) {
  const event = req.body;
  
  // Verify Paystack signature (important!)
  // ... your existing Paystack verification code ...
  
  if (event.event === 'charge.success') {
    const { customer, reference, amount } = event.data;
    
    // Get stored referral code for this user
    const referralCode = await getUserReferralCode(customer.email);
    
    if (referralCode) {
      // Record commission (non-blocking)
      recordCommission(
        referralCode,
        customer.email,
        amount, // Amount in kobo
        reference
      ).catch(error => {
        // Log but don't fail the payment
        console.error('Commission recording failed:', error);
      });
    }
    
    // Continue with normal payment processing
    // ... your existing code ...
  }
  
  res.sendStatus(200);
}

// ============================================
// STEP 5: INTEGRATE INTO REGISTRATION FLOW
// ============================================

/**
 * Example: Registration handler
 * Record commission when user completes free registration
 */
async function handleRegistration(req, res) {
  const { email, name, plan } = req.body;
  
  // Create user account
  const user = await createUserAccount({ email, name, plan });
  
  // Get referral code from session/cookie
  const referralCode = getReferralCode(req);
  
  if (referralCode) {
    // Commission amount (e.g., 5000 cents = KSh 50)
    const commissionAmount = 5000;
    
    // Generate unique reference
    const reference = `LCS_REG_${user.id}_${Date.now()}`;
    
    // Record commission (non-blocking)
    recordCommission(
      referralCode,
      email,
      commissionAmount,
      reference
    ).catch(error => {
      console.error('Commission recording failed:', error);
    });
    
    // Clean up stored referral code
    delete req.session.referralCode;
    res.clearCookie('referral_code');
  }
  
  res.json({ success: true, user });
}

// ============================================
// STEP 6: RETRY LOGIC (OPTIONAL BUT RECOMMENDED)
// ============================================

/**
 * Retry commission recording with exponential backoff
 */
async function recordCommissionWithRetry(referralCode, userEmail, amount, reference, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await recordCommission(referralCode, userEmail, amount, reference);
      
      if (result.success) {
        return result;
      }
      
      // If 404 (invalid referrer) or 400 (bad request), don't retry
      if (result.error?.includes('not found') || result.error?.includes('Invalid')) {
        console.log(`❌ Not retrying - permanent error: ${result.error}`);
        return result;
      }
      
    } catch (error) {
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return { success: false, error: 'Max retries exceeded' };
}

// ============================================
// STEP 7: BACKGROUND QUEUE (PRODUCTION)
// ============================================

/**
 * For production, use a job queue (Bull, BullMQ, etc.)
 * to handle commission recording asynchronously
 */

// Example with Bull:
// const Queue = require('bull');
// const commissionQueue = new Queue('commissions');
//
// commissionQueue.process(async (job) => {
//   const { referralCode, userEmail, amount, reference } = job.data;
//   return await recordCommissionWithRetry(referralCode, userEmail, amount, reference);
// });
//
// // Add to queue
// commissionQueue.add({
//   referralCode: 'AFF123',
//   userEmail: 'user@mail.com',
//   amount: 5000,
//   reference: 'TX_123'
// });

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Store referral code in database with user
 * (for later retrieval in payment webhooks)
 */
async function storeUserReferralCode(userEmail, referralCode) {
  // Store in your user database
  await db.users.update(
    { email: userEmail },
    { $set: { referralCode: referralCode } }
  );
}

/**
 * Retrieve referral code from database
 */
async function getUserReferralCode(userEmail) {
  const user = await db.users.findOne({ email: userEmail });
  return user?.referralCode;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  captureReferralCode,
  getReferralCode,
  recordCommission,
  recordCommissionWithRetry,
  handlePaystackWebhook,
  handleRegistration,
};

// ============================================
// USAGE EXAMPLE
// ============================================

/*
// In your Express app:

const { captureReferralCode, getReferralCode, recordCommission } = require('./affiliate-integration');

// 1. Capture referral on landing
app.get('/landing', captureReferralCode, (req, res) => {
  res.render('landing');
});

// 2. Store with user during registration
app.post('/register', async (req, res) => {
  const referralCode = getReferralCode(req);
  
  const user = await createUser({
    email: req.body.email,
    name: req.body.name,
    referralCode: referralCode, // Store for later
  });
  
  res.json({ success: true, user });
});

// 3. Record commission after payment
app.post('/webhooks/paystack', async (req, res) => {
  const { customer, reference, amount } = req.body.data;
  
  const user = await getUser(customer.email);
  
  if (user.referralCode) {
    await recordCommission(
      user.referralCode,
      customer.email,
      amount,
      reference
    );
  }
  
  res.sendStatus(200);
});
*/
