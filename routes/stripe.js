const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/connection');
const router = express.Router();

// Check if Stripe is configured
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_CONFIGURED = STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.includes('placeholder');

// Only initialize Stripe if properly configured
let stripe;
if (STRIPE_CONFIGURED) {
  stripe = require('stripe')(STRIPE_SECRET_KEY);
}

// Helper to get frontend URL
const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || 'https://tradietasker.com.au';
};

// POST /api/stripe/create-subscription-checkout
// Create checkout session for subscription upgrade
router.post('/create-subscription-checkout', authenticateToken, async (req, res) => {
  if (!STRIPE_CONFIGURED) {
    return res.status(503).json({ error: 'Stripe not configured. Contact support.' });
  }

  try {
    const { tier } = req.body;
    
    // Tier pricing (AUD per week)
    const prices = {
      bronze: 2500,  // $25.00
      silver: 4500,  // $45.00
      gold: 6500,    // $65.00
      platinum: 10000 // $100.00
    };

    if (!prices[tier]) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: req.user.email,
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: `TradieTasker ${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription`,
              description: `Weekly subscription to ${tier} tier`
            },
            unit_amount: prices[tier],
          },
          quantity: 1,
        },
      ],
      success_url: `${getFrontendUrl()}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getFrontendUrl()}/subscription/upgrade`,
      metadata: {
        user_id: req.user.id,
        tier: tier,
        type: 'subscription'
      }
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe subscription checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/stripe/create-credits-checkout
// Create checkout session for credit purchase
router.post('/create-credits-checkout', authenticateToken, async (req, res) => {
  if (!STRIPE_CONFIGURED) {
    return res.status(503).json({ error: 'Stripe not configured. Contact support.' });
  }

  try {
    const { packageId } = req.body;
    
    // Get package from database
    const result = await db.query(
      'SELECT * FROM credit_packages WHERE id = $1 AND enabled = true',
      [packageId]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or disabled package' });
    }

    const pkg = result.rows[0];
    const priceInCents = Math.round(parseFloat(pkg.price_excl_tax) * 100);
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: req.user.email,
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: `${pkg.name} Package - ${pkg.credits} Credits`,
              description: `TradieTasker ${pkg.package_type} credit package`
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${getFrontendUrl()}/credits-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getFrontendUrl()}/subscription/upgrade`,
      metadata: {
        user_id: req.user.id,
        package_id: pkg.id,
        credits: pkg.credits,
        type: 'credits'
      }
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe credits checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/stripe/create-poster-package-checkout
// Create checkout session for customer poster packages
router.post('/create-poster-package-checkout', authenticateToken, async (req, res) => {
  if (!STRIPE_CONFIGURED) {
    return res.status(503).json({ error: 'Stripe not configured. Contact support.' });
  }

  try {
    const { package: packageName } = req.body;
    
    // Poster package pricing (AUD)
    const packages = {
      '3-pack': { unlocks: 3, price: 1500 },     // $15.00
      '12-pack': { unlocks: 12, price: 4000 },   // $40.00
      '20-pack': { unlocks: 20, price: 6000 }    // $60.00
    };

    if (!packages[packageName]) {
      return res.status(400).json({ error: 'Invalid package' });
    }

    const pkg = packages[packageName];
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: req.user.email,
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: `${pkg.unlocks} Tradie Unlocks`,
              description: `Package for job posters`
            },
            unit_amount: pkg.price,
          },
          quantity: 1,
        },
      ],
      success_url: `${getFrontendUrl()}/package-success?session_id={CHECKOUT_SESSION_ID}&unlocks=${pkg.unlocks}`,
      cancel_url: `${getFrontendUrl()}/customer-dashboard`,
      metadata: {
        user_id: req.user.id,
        unlocks: pkg.unlocks,
        type: 'poster_package'
      }
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe poster package checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// GET /api/stripe/session/:sessionId
// Verify session status
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  if (!STRIPE_CONFIGURED) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    res.json({ 
      status: session.payment_status,
      metadata: session.metadata
    });
  } catch (error) {
    console.error('Stripe session retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

// GET /api/stripe/subscription-status
// Check if user has active Stripe subscription
router.get('/subscription-status', authenticateToken, async (req, res) => {
  // This is a placeholder - in production you'd check actual Stripe subscription status
  res.json({ active: false, message: 'Stripe subscriptions not yet implemented' });
});

module.exports = router;
