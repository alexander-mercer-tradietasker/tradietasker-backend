const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { get, run } = require('../db/connection');

// Helper function to generate invoice
async function generateInvoice(userId, amount, description, stripeInvoiceId = null) {
  try {
    // Get GST setting
    const gstSetting = await get('SELECT value FROM admin_settings WHERE key = ?', ['gst_enabled']);
    const gstEnabled = gstSetting && gstSetting.value === 'true';
    
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
    const result = await run(
      `INSERT INTO invoices (user_id, invoice_number, stripe_invoice_id, amount, gst_amount, total, status, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING id`,
      [userId, invoiceNumber, stripeInvoiceId, baseAmount, gstAmount, totalAmount, 'paid', description]
    );
    
    console.log(`Invoice ${invoiceNumber} generated for user ${userId}, amount $${totalAmount}`);
    
    return result.lastID;
  } catch (error) {
    console.error('Failed to generate invoice:', error);
    throw error;
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
        const { userId, description } = session.metadata || {};
        
        if (userId) {
          const amount = session.amount_total / 100; // Convert cents to dollars
          await generateInvoice(
            userId, 
            amount, 
            description || 'Payment via Stripe Checkout',
            session.invoice || null
          );
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        // Find user by Stripe customer ID
        const user = await get('SELECT id FROM users WHERE stripe_customer_id = ?', [customerId]);
        
        if (user) {
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
