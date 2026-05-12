const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, get, run } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Tier definitions with pricing
const TIERS = {
  free: {
    name: 'Free',
    price_per_week: 0,
    credits_included: 0,
    early_access_hours: 24,
    discount_percent: 0
  },
  bronze: {
    name: 'Bronze',
    price_per_week: 25,
    credits_included: 5,
    early_access_hours: 3,
    discount_percent: 0
  },
  silver: {
    name: 'Silver',
    price_per_week: 45,
    credits_included: 10,
    early_access_hours: 2,
    discount_percent: 10
  },
  gold: {
    name: 'Gold',
    price_per_week: 65,
    credits_included: 20,
    early_access_hours: 1,
    discount_percent: 15
  },
  platinum: {
    name: 'Platinum',
    price_per_week: 100,
    credits_included: 40,
    early_access_hours: 0,
    discount_percent: 20
  },
  god: {
    name: 'God',
    price_per_week: 0,
    credits_included: 999,
    early_access_hours: 0,
    discount_percent: 100
  }
};

// GET /api/subscriptions/tiers - List subscription tiers and pricing
router.get('/tiers', async (req, res) => {
  try {
    res.json({ tiers: TIERS });
  } catch (error) {
    console.error('Get tiers error:', error);
    res.status(500).json({ error: 'Failed to get tiers' });
  }
});

// GET /api/subscriptions/my-subscription - Get current subscription
router.get('/my-subscription', authenticateToken, async (req, res) => {
  try {
    const subscription = await get(
      `SELECT * FROM subscriptions 
       WHERE user_id = ? AND is_active = 1 
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    res.json({ 
      subscription: subscription || null,
      tier: req.user.tier,
      credits: req.user.credits
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// POST /api/subscriptions/subscribe - Subscribe to a tier
router.post('/subscribe',
  authenticateToken,
  [body('tier').isIn(['bronze', 'silver', 'gold', 'platinum'])],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tier } = req.body;
      const tierConfig = TIERS[tier];

      // Deactivate old subscriptions
      await run(
        'UPDATE subscriptions SET is_active = 0 WHERE user_id = ?',
        [req.user.id]
      );

      // Calculate renewal date (7 days from now)
      const renewsAt = new Date();
      renewsAt.setDate(renewsAt.getDate() + 7);

      // Create new subscription
      await run(
        `INSERT INTO subscriptions (
          user_id, tier, credits_included, credits_remaining,
          price_per_week, discount_percent, early_access_hours,
          starts_at, renews_at, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 1, datetime('now'))`,
        [
          req.user.id,
          tier,
          tierConfig.credits_included,
          tierConfig.credits_included,
          tierConfig.price_per_week,
          tierConfig.discount_percent,
          tierConfig.early_access_hours,
          renewsAt.toISOString()
        ]
      );

      // Update user tier and add credits
      await run(
        'UPDATE users SET tier = ?, credits = credits + ? WHERE id = ?',
        [tier, tierConfig.credits_included, req.user.id]
      );

      res.json({ 
        message: 'Subscription created successfully',
        tier,
        credits_added: tierConfig.credits_included
      });
    } catch (error) {
      console.error('Subscribe error:', error);
      res.status(500).json({ error: 'Subscription failed' });
    }
  }
);

// PUT /api/subscriptions/change-tier - Upgrade/downgrade tier
router.put('/change-tier',
  authenticateToken,
  [body('tier').isIn(['free', 'bronze', 'silver', 'gold', 'platinum'])],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tier } = req.body;
      const tierConfig = TIERS[tier];

      // Get current subscription
      const currentSub = await get(
        `SELECT * FROM subscriptions 
         WHERE user_id = ? AND is_active = 1 
         ORDER BY created_at DESC LIMIT 1`,
        [req.user.id]
      );

      if (tier === 'free') {
        // Cancel subscription
        if (currentSub) {
          await run('UPDATE subscriptions SET is_active = 0 WHERE id = ?', [currentSub.id]);
        }
        await run('UPDATE users SET tier = ? WHERE id = ?', ['free', req.user.id]);
        
        return res.json({ message: 'Subscription cancelled' });
      }

      // Deactivate old subscription
      if (currentSub) {
        await run('UPDATE subscriptions SET is_active = 0 WHERE id = ?', [currentSub.id]);
      }

      // Create new subscription
      const renewsAt = new Date();
      renewsAt.setDate(renewsAt.getDate() + 7);

      await run(
        `INSERT INTO subscriptions (
          user_id, tier, credits_included, credits_remaining,
          price_per_week, discount_percent, early_access_hours,
          starts_at, renews_at, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 1, datetime('now'))`,
        [
          req.user.id,
          tier,
          tierConfig.credits_included,
          tierConfig.credits_included,
          tierConfig.price_per_week,
          tierConfig.discount_percent,
          tierConfig.early_access_hours,
          renewsAt.toISOString()
        ]
      );

      // Update user tier and add credits
      await run(
        'UPDATE users SET tier = ?, credits = credits + ? WHERE id = ?',
        [tier, tierConfig.credits_included, req.user.id]
      );

      res.json({ 
        message: 'Tier changed successfully',
        tier,
        credits_added: tierConfig.credits_included
      });
    } catch (error) {
      console.error('Change tier error:', error);
      res.status(500).json({ error: 'Failed to change tier' });
    }
  }
);

// POST /api/subscriptions/cancel - Cancel subscription
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    await run(
      'UPDATE subscriptions SET is_active = 0 WHERE user_id = ?',
      [req.user.id]
    );

    await run(
      'UPDATE users SET tier = ? WHERE id = ?',
      ['free', req.user.id]
    );

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;
