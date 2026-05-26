const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/subscriptions/tiers - List subscription tiers (from database)
router.get('/tiers', async (req, res) => {
  try {
    const tiers = await query('SELECT * FROM tiers WHERE tier_name != $1 ORDER BY subscription_cost_excl_tax', ['basic']);
    res.json({ tiers });
  } catch (error) {
    console.error('Get tiers error:', error);
    res.status(500).json({ error: 'Failed to get tiers' });
  }
});

// GET /api/subscriptions/my-subscription
router.get('/my-subscription', authenticateToken, async (req, res) => {
  try {
    const subscription = await query(`SELECT * FROM subscriptions WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`, [req.user.id]).then(r => r[0])[0];
    res.json({ subscription: subscription || null, tier: req.user.tier, credits: req.user.credits });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// POST /api/subscriptions/subscribe
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
      const tierConfig = await query('SELECT * FROM tiers WHERE tier_name = $1', [tier]).then(r => r[0]);
      if (!tierConfig) {
        return res.status(404).json({ error: 'Tier not found' });
      }

      await query('UPDATE subscriptions SET is_active = false WHERE user_id = $1 RETURNING *', [req.user.id]);

      const renewsAt = new Date();
      renewsAt.setDate(renewsAt.getDate() + 7);

      const totalCredits = 
        (tierConfig.base_credits * tierConfig.base_credits_multiplier) +
        (tierConfig.bonus_credits * tierConfig.bonus_credits_multiplier) +
        (tierConfig.additional_bonus_credits * tierConfig.additional_bonus_credits_multiplier) +
        tierConfig.initial_purchase_bonus_credits;

      await query(`INSERT INTO subscriptions (user_id, tier, credits_included, credits_remaining, price_per_week, starts_at, renews_at, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, true, CURRENT_TIMESTAMP)`, [req.user.id, tier, totalCredits, totalCredits, tierConfig.subscription_cost_excl_tax, renewsAt.toISOString()]);

      await query('UPDATE users SET tier = $1, credits = credits + $2 WHERE id = $3 RETURNING *', [tier, totalCredits, req.user.id]);

      res.json({ message: 'Subscription created', tier, credits_added: totalCredits });
    } catch (error) {
      console.error('Subscribe error:', error);
      res.status(500).json({ error: 'Subscription failed' });
    }
  }
);

// PUT /api/subscriptions/change-tier
router.put('/change-tier',
  authenticateToken,
  [body('tier').isIn(['basic', 'bronze', 'silver', 'gold', 'platinum'])],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tier } = req.body;

      if (tier === 'basic') {
        await query('UPDATE subscriptions SET is_active = false WHERE user_id = $1 RETURNING *', [req.user.id]);
        await query('UPDATE users SET tier = $1 WHERE id = $2 RETURNING *', ['basic', req.user.id]);
        return res.json({ message: 'Subscription cancelled' });
      }

      const tierConfig = await query('SELECT * FROM tiers WHERE tier_name = $1', [tier]).then(r => r[0]);
      if (!tierConfig) {
        return res.status(404).json({ error: 'Tier not found' });
      }

      await query('UPDATE subscriptions SET is_active = false WHERE user_id = $1 RETURNING *', [req.user.id]);

      const renewsAt = new Date();
      renewsAt.setDate(renewsAt.getDate() + 7);

      const totalCredits =
        (tierConfig.base_credits * tierConfig.base_credits_multiplier) +
        (tierConfig.bonus_credits * tierConfig.bonus_credits_multiplier) +
        (tierConfig.additional_bonus_credits * tierConfig.additional_bonus_credits_multiplier) +
        tierConfig.initial_purchase_bonus_credits;

      await query(`INSERT INTO subscriptions (user_id, tier, credits_included, credits_remaining, price_per_week, starts_at, renews_at, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, true, CURRENT_TIMESTAMP)`, [req.user.id, tier, totalCredits, totalCredits, tierConfig.subscription_cost_excl_tax, renewsAt.toISOString()]);

      await query('UPDATE users SET tier = $1, credits = credits + $2 WHERE id = $3 RETURNING *', [tier, totalCredits, req.user.id]);

      res.json({ message: 'Tier changed', tier, credits_added: totalCredits });
    } catch (error) {
      console.error('Change tier error:', error);
      res.status(500).json({ error: 'Failed to change tier' });
    }
  }
);

// POST /api/subscriptions/cancel
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    await query('UPDATE subscriptions SET is_active = false WHERE user_id = $1 RETURNING *', [req.user.id]);
    await query('UPDATE users SET tier = $1 WHERE id = $2 RETURNING *', ['basic', req.user.id]);
    res.json({ message: 'Subscription cancelled' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;
