const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper function to generate invoice
async function generateInvoice(userId, amount, description, stripeInvoiceId = null) {
  try {
    // Get GST setting
    const gstResult = await pool.query('SELECT value FROM admin_settings WHERE key = $1', ['gst_enabled']);
    const gstEnabled = gstResult.rows.length > 0 && gstResult.rows[0].value === 'true';
    
    // Calculate amounts
    const baseAmount = parseFloat(amount);
    const gstAmount = gstEnabled ? baseAmount * 0.1 : 0;
    const totalAmount = baseAmount + gstAmount;
    
    // Generate unique invoice number
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const invoiceNumber = `INV-${year}${month}-${random}`;
    
    // Insert invoice
    const result = await pool.query(
      `INSERT INTO invoices (user_id, invoice_number, stripe_invoice_id, amount, gst_amount, total, status, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id`,
      [userId, invoiceNumber, stripeInvoiceId, baseAmount, gstAmount, totalAmount, 'paid', description]
    );
    
    console.log(`Invoice ${invoiceNumber} generated for user ${userId}, amount $${totalAmount}`);
    
    // Trigger PDF generation and email (async, don't wait)
    triggerInvoicePDFGeneration(result.rows[0].id, userId).catch(err => {
      console.error('Failed to trigger invoice PDF generation:', err);
    });
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Failed to generate invoice:', error);
    throw error;
  }
}

// Trigger PDF generation (separate function to avoid blocking webhook response)
async function triggerInvoicePDFGeneration(invoiceId, userId) {
  const axios = require('axios');
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  
  try {
    // This would ideally use an internal service call, but for now we'll skip it
    // The PDF will be generated on-demand when the user downloads it
    console.log(`PDF generation queued for invoice ${invoiceId}`);
  } catch (error) {
    console.error('Failed to trigger PDF generation:', error);
  }
}

// Stripe webhook handler
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret) {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // For development without webhook secret
      event = JSON.parse(req.body.toString());
      console.warn('Stripe webhook signature verification skipped (no webhook secret)');
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Stripe webhook event:', event.type);

  try {
    switch (event.type) {
case 'checkout.session.completed': {
  const session = event.data.object;
  const { user_id, tier, type } = session.metadata || {};
  
  if (user_id && type === 'subscription' && tier) {
    // Get tier config from database
    const tierResult = await pool.query('SELECT * FROM tiers WHERE tier_name = $1', [tier]);
    if (tierResult.rows.length > 0) {
      const tierConfig = tierResult.rows[0];
      const totalCredits = 
        (tierConfig.base_credits * tierConfig.base_credits_multiplier) +
        (tierConfig.bonus_credits * tierConfig.bonus_credits_multiplier) +
        (tierConfig.additional_bonus_credits * tierConfig.additional_bonus_credits_multiplier) +
        tierConfig.initial_purchase_bonus_credits;
      
      // Update user tier and credits
      await pool.query(
        'UPDATE users SET tier = $1, credits = credits + $2 WHERE id = $3',
        [tier, totalCredits, user_id]
      );
      
      // Create subscription record
      const renewsAt = new Date();
      renewsAt.setDate(renewsAt.getDate() + 7);
      await pool.query(
        `INSERT INTO subscriptions (user_id, tier, credits_included, credits_remaining, price_per_week, starts_at, renews_at, is_active)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, true)`,
        [user_id, tier, totalCredits, totalCredits, tierConfig.subscription_cost_excl_tax, renewsAt]
      );
      
      // Generate invoice
      const amount = session.amount_total / 100;
      await generateInvoice(user_id, amount, `${tier} subscription`, session.invoice || null);
    }
  } else if (user_id && type === 'credits') {
    // Credit package purchase
    const credits = parseInt(session.metadata.credits);
    
    // Add credits to user
    await pool.query(
      'UPDATE users SET credits = credits + $1 WHERE id = $2',
      [credits, user_id]
    );
    
    console.log(`Added ${credits} credits to user ${user_id}`);
    
    // Generate invoice
    const amount = session.amount_total / 100;
    await generateInvoice(user_id, amount, `${credits} Credits Purchase`, session.invoice || null);
  } else if (user_id) {
    // Fallback for other payments
    const amount = session.amount_total / 100;
    await generateInvoice(user_id, amount, 'Payment via Stripe Checkout', session.invoice || null);
  }
  break;
}

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        // Find user by Stripe customer ID
        const userResult = await pool.query('SELECT id FROM users WHERE stripe_customer_id = $1', [customerId]);
        
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          const amount = invoice.amount_paid / 100;
          const description = invoice.lines.data.map(line => line.description).join(', ') || 'Subscription payment';
          
          await generateInvoice(
            user.id,
            amount,
            description,
            invoice.id
          );
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const { userId, description } = paymentIntent.metadata || {};
        
        if (userId) {
          const amount = paymentIntent.amount / 100;
          await generateInvoice(
            userId,
            amount,
            description || 'Token/Credit purchase',
            null
          );
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        // Update user subscription in database if needed
        console.log(`Subscription ${event.type} for customer ${customerId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

module.exports = router;
