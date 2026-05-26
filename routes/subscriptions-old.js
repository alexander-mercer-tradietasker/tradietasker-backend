const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper function to calculate total credits for a tier
function calculateTierCredits(tierConfig) {
  return (
    (tierConfig.base_credits || 0) * (tierConfig.base_credits_multiplier || 1) +
    (tierConfig.bonus_credits || 0) * (tierConfig.bonus_credits_multiplier || 1) +
    (tierConfig.additional_bonus_credits || 0) * (tierConfig.additional_bonus_credits_multiplier || 1)
  );
}

// Helper function to calculate discounted price
function calculateDiscountedPrice(basePrice, tierDiscount, siteWideDiscount) {
  let price = parseFloat(basePrice);
  
  // Apply tier-specific discount if enabled and not expired
  if (tierDiscount.enabled) {
    const now = new Date();
    const isExpired = tierDiscount.expiry && new Date(tierDiscount.expiry) < now;
    
    if (!isExpired) {
      if (tierDiscount.percent > 0) {
        price = price * (1 - tierDiscount.percent / 100);
      }
      if (tierDiscount.dollar > 0) {
        price = Math.max(0, price - tierDiscount.dollar);
      }
    }
  }
  
  // Apply site-wide discount
  if (siteWideDiscount.percent > 0) {
    price = price * (1 - siteWideDiscount.percent / 100);
  }
  if (siteWideDiscount.dollar > 0) {
    price = Math.max(0, price - siteWideDiscount.dollar);
  }
  
  return Math.round(price * 100) / 100; // Round to 2 decimal places
}

// GET /api/subscriptions/tiers - List subscription tiers and pricing
router.get('/tiers', async (req, res) => {
  try {
    // Fetch all tiers from database
    const tiersData = await query('SELECT * FROM tiers ORDER BY subscription_cost_excl_tax');
    
    // Get site-wide discount settings
    const siteSettings = await query(`
      SELECT setting_key, setting_value 
      FROM site_settings 
      WHERE setting_key IN ('site_wide_discount_percent', 'site_wide_discount_dollar')
    `);
    
    const siteWideDiscount = {
      percent: parseFloat(siteSettings.find(s => s.setting_key === 'site_wide_discount_percent')?.setting_value || 0),
      dollar: parseFloat(siteSettings.find(s => s.setting_key === 'site_wide_discount_dollar')?.setting_value || 0)
    };
    
    // Transform database tiers to API format
    const tiers = {};
    for (const tier of tiersData) {
      const tierDiscount = {
        percent: parseFloat(tier.tier_discount_percent || 0),
        dollar: parseFloat(tier.tier_discount_dollar || 0),
        enabled: tier.tier_discount_enabled,
        expiry: tier.tier_discount_expiry
      };
      
      const basePrice = parseFloat(tier.subscription_cost_excl_tax);
      const discountedPrice = calculateDiscountedPrice(basePrice, tierDiscount, siteWideDiscount);
      const totalCredits = calculateTierCredits(tier);
      const earlyAccessHours = Math.floor((tier.job_view_delay_minutes || 0) / 60);
      
      tiers[tier.tier_name] = {
        name: tier.tier_name.charAt(0).toUpperCase() + tier.tier_name.slice(1),
        price_per_week: discountedPrice,
        original_price: basePrice,
        credits_included: totalCredits,
        initial_purchase_bonus: tier.initial_purchase_bonus_credits || 0,
        recurring_bonus: tier.recurring_bonus_credits || 0,
        early_access_hours: earlyAccessHours,
        job_view_delay_minutes: tier.job_view_delay_minutes || 0,
        discount_percent: tierDiscount.enabled && tierDiscount.percent > 0 ? tierDiscount.percent : 0,
        has_discount: discountedPrice < basePrice
      };
    }
    
    res.json({ tiers });
  } catch (error) {
    console.error('Get tiers error:', error);
    res.status(500).json({ error: 'Failed to get tiers' });
  }
});

// GET /api/subscriptions/my-subscription - Get current subscription
router.get('/my-subscription', authenticateToken, async (req, res) => {
  try {
    const subscription = await query(`SELECT * FROM subscriptions 
       WHERE user_id = $1 AND is_active = true 
       ORDER BY created_at DESC LIMIT 1`, [req.user.id]).then(r => r[0]);

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
  [body('tier').isString().notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tier } = req.body;
      
      // Fetch tier config from database
      const tierConfig = await query('SELECT * FROM tiers WHERE tier_name = $1', [tier]).then(r => r[0]);
      
      if (!tierConfig) {
        return res.status(400).json({ error: 'Invalid tier' });
      }
      
      // Don't allow subscribing to basic/free tier via this endpoint
      if (tierConfig.tier_name === 'basic') {
        return res.status(400).json({ error: 'Cannot subscribe to basic tier' });
      }
      
      // Get site-wide discount settings
      const siteSettings = await query(`
        SELECT setting_key, setting_value 
        FROM site_settings 
        WHERE setting_key IN ('site_wide_discount_percent', 'site_wide_discount_dollar')
      `);
      
      const siteWideDiscount = {
        percent: parseFloat(siteSettings.find(s => s.setting_key === 'site_wide_discount_percent')?.setting_value || 0),
        dollar: parseFloat(siteSettings.find(s => s.setting_key === 'site_wide_discount_dollar')?.setting_value || 0)
      };
      
      const tierDiscount = {
        percent: parseFloat(tierConfig.tier_discount_percent || 0),
        dollar: parseFloat(tierConfig.tier_discount_dollar || 0),
        enabled: tierConfig.tier_discount_enabled,
        expiry: tierConfig.tier_discount_expiry
      };
      
      const basePrice = parseFloat(tierConfig.subscription_cost_excl_tax);
      const discountedPrice = calculateDiscountedPrice(basePrice, tierDiscount, siteWideDiscount);
      const totalCredits = calculateTierCredits(tierConfig);
      const initialBonus = tierConfig.initial_purchase_bonus_credits || 0;

      // Deactivate old subscriptions
      await query('UPDATE subscriptions SET is_active = false WHERE user_id = $1', [req.user.id]);

      // Calculate renewal date (7 days from now)
      const renewsAt = new Date();
      renewsAt.setDate(renewsAt.getDate() + 7);

      // Create new subscription
      await query(`INSERT INTO subscriptions (
          user_id, tier, credits_included, credits_remaining,
          price_per_week, discount_percent, early_access_hours,
          starts_at, renews_at, is_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, true, CURRENT_TIMESTAMP)`, [
          req.user.id,
          tier,
          totalCredits,
          totalCredits,
          discountedPrice,
          tierDiscount.enabled ? tierDiscount.percent : 0,
          Math.floor((tierConfig.job_view_delay_minutes || 0) / 60),
          renewsAt.toISOString()
        ]);

      // Update user tier and add credits (including initial bonus)
      const creditsToAdd = totalCredits + initialBonus;
      await query('UPDATE users SET tier = $1, credits = credits + $2 WHERE id = $3', [tier, creditsToAdd, req.user.id]);

      res.json({ 
        message: 'Subscription created successfully',
        tier,
        credits_added: creditsToAdd,
        weekly_credits: totalCredits,
        initial_bonus: initialBonus,
        price_paid: discountedPrice
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
  [body('tier').isString().notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tier } = req.body;

      // Get current subscription
      const currentSub = await query(`SELECT * FROM subscriptions 
         WHERE user_id = $1 AND is_active = true 
         ORDER BY created_at DESC LIMIT 1`, [req.user.id]).then(r => r[0]);

      if (tier === 'basic' || tier === 'free') {
        // Cancel subscription
        if (currentSub) {
          await query('UPDATE subscriptions SET is_active = false WHERE id = $1 RETURNING *', [currentSub.id]);
        }
        await query('UPDATE users SET tier = $1 WHERE id = $2 RETURNING *', ['basic', req.user.id]);
        
        return res.json({ message: 'Subscription cancelled' });
      }
      
      // Fetch tier config from database
      const tierConfig = await query('SELECT * FROM tiers WHERE tier_name = $1', [tier]).then(r => r[0]);
      
      if (!tierConfig) {
        return res.status(400).json({ error: 'Invalid tier' });
      }
      
      // Get site-wide discount settings
      const siteSettings = await query(`
        SELECT setting_key, setting_value 
        FROM site_settings 
        WHERE setting_key IN ('site_wide_discount_percent', 'site_wide_discount_dollar')
      `);
      
      const siteWideDiscount = {
        percent: parseFloat(siteSettings.find(s => s.setting_key === 'site_wide_discount_percent')?.setting_value || 0),
        dollar: parseFloat(siteSettings.find(s => s.setting_key === 'site_wide_discount_dollar')?.setting_value || 0)
      };
      
      const tierDiscount = {
        percent: parseFloat(tierConfig.tier_discount_percent || 0),
        dollar: parseFloat(tierConfig.tier_discount_dollar || 0),
        enabled: tierConfig.tier_discount_enabled,
        expiry: tierConfig.tier_discount_expiry
      };
      
      const basePrice = parseFloat(tierConfig.subscription_cost_excl_tax);
      const discountedPrice = calculateDiscountedPrice(basePrice, tierDiscount, siteWideDiscount);
      const totalCredits = calculateTierCredits(tierConfig);

      // Deactivate old subscription
      if (currentSub) {
        await query('UPDATE subscriptions SET is_active = false WHERE id = $1 RETURNING *', [currentSub.id]);
      }

      // Create new subscription
      const renewsAt = new Date();
      renewsAt.setDate(renewsAt.getDate() + 7);

      await query(`INSERT INTO subscriptions (
          user_id, tier, credits_included, credits_remaining,
          price_per_week, discount_percent, early_access_hours,
          starts_at, renews_at, is_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, true, CURRENT_TIMESTAMP)`, [
          req.user.id,
          tier,
          totalCredits,
          totalCredits,
          discountedPrice,
          tierDiscount.enabled ? tierDiscount.percent : 0,
          Math.floor((tierConfig.job_view_delay_minutes || 0) / 60),
          renewsAt.toISOString()
        ]);

      // Update user tier and add credits
      await query('UPDATE users SET tier = $1, credits = credits + $2 WHERE id = $3', [tier, totalCredits, req.user.id]);

      res.json({ 
        message: 'Tier changed successfully',
        tier,
        credits_added: totalCredits,
        price_paid: discountedPrice
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
    await query('UPDATE subscriptions SET is_active = false WHERE user_id = $1', [req.user.id]);

    await query('UPDATE users SET tier = $1 WHERE id = $2', ['basic', req.user.id]);

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;
