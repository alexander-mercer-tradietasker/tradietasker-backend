const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../../db/connection');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const { calculateDiscountedPrice } = require('../../utils/discount-calculator');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/tiers - List all tier configurations
router.get('/', async (req, res) => {
  try {
    const tiers = await query('SELECT * FROM tiers ORDER BY id');
    
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
    
    res.json({ tiers, siteWideDiscount });
  } catch (error) {
    console.error('Get tiers error:', error);
    res.status(500).json({ error: 'Failed to get tier configurations' });
  }
});

// GET /api/admin/tiers/:tier - Get single tier configuration
router.get('/:tier', async (req, res) => {
  try {
    const { tier } = req.params;
    
    const result = await query('SELECT * FROM tiers WHERE tier_name = $1', [tier]);
    const tierConfig = result[0];
    
    if (!tierConfig) {
      return res.status(404).json({ error: 'Tier not found' });
    }
    
    res.json(tierConfig);
  } catch (error) {
    console.error('Get tier error:', error);
    res.status(500).json({ error: 'Failed to get tier configuration' });
  }
});

// PUT /api/admin/tiers/:tier - Update tier configuration
router.put('/:tier',
  [
    body('subscription_cost_excl_tax').optional().isFloat({ min: 0 }),
    body('tier_discount_percent').optional().isFloat({ min: 0, max: 100 }),
    body('tier_discount_dollar').optional().isFloat({ min: 0 }),
    body('tier_discount_enabled').optional().isBoolean(),
    body('tier_discount_expiry').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('base_credits').optional().isInt({ min: 0 }),
    body('base_credits_multiplier').optional().isInt({ min: 1 }),
    body('bonus_credits').optional().isInt({ min: 0 }),
    body('bonus_credits_multiplier').optional().isInt({ min: 1 }),
    body('additional_bonus_credits').optional().isInt({ min: 0 }),
    body('additional_bonus_credits_multiplier').optional().isInt({ min: 1 }),
    body('initial_purchase_bonus_credits').optional().isInt({ min: 0 }),
    body('recurring_bonus_credits').optional().isInt({ min: 0 }),
    body('job_view_delay_minutes').optional().isInt({ min: 0, max: 1440 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tier } = req.params;
      const updates = req.body;

      // Check tier exists
      const result2 = await query('SELECT id FROM tiers WHERE tier_name = $1', [tier]);
      const existing = result2[0];
      if (!existing) {
        return res.status(404).json({ error: 'Tier not found' });
      }

      // Whitelist of allowed update fields
      const allowedFields = [
        'subscription_cost_excl_tax',
        'tier_discount_percent',
        'tier_discount_dollar',
        'tier_discount_enabled',
        'tier_discount_expiry',
        'base_credits',
        'base_credits_multiplier',
        'bonus_credits',
        'bonus_credits_multiplier',
        'additional_bonus_credits',
        'additional_bonus_credits_multiplier',
        'initial_purchase_bonus_credits',
        'recurring_bonus_credits',
        'job_view_delay_minutes'
      ];

      // Filter updates to only allowed fields and handle null values
      const filteredUpdates = {};
      for (const field of Object.keys(updates)) {
        if (allowedFields.includes(field)) {
          // Convert null/empty string to NULL for optional timestamp fields
          if (field === 'tier_discount_expiry' && (!updates[field] || updates[field] === '')) {
            filteredUpdates[field] = null;
          } else {
            filteredUpdates[field] = updates[field];
          }
        }
      }

      const fields = Object.keys(filteredUpdates);
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
      const values = fields.map(f => filteredUpdates[f]);
      values.push(tier);

      await query(
        `UPDATE tiers SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE tier_name = $${values.length}`,
        values
      );

      // Return updated tier config
      const result3 = await query('SELECT * FROM tiers WHERE tier_name = $1', [tier]);
      const updated = result3[0];
      res.json(updated);
    } catch (error) {
      console.error('Update tier error:', error);
      res.status(500).json({ error: 'Failed to update tier configuration' });
    }
  }
);

// GET /api/admin/tiers/preview-price/:tier - Calculate price with discounts
router.get('/preview-price/:tier', async (req, res) => {
  try {
    const { tier } = req.params;
    
    const result = await query('SELECT * FROM tiers WHERE tier_name = $1', [tier]);
    const tierConfig = result[0];
    if (!tierConfig) {
      return res.status(404).json({ error: 'Tier not found' });
    }
    
    // Get site-wide discount
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
    
    const originalPrice = parseFloat(tierConfig.subscription_cost_excl_tax);
    const discountedPrice = calculateDiscountedPrice(originalPrice, tierDiscount, siteWideDiscount);
    
    // Calculate total credits
    const totalCredits = 
      (tierConfig.base_credits * tierConfig.base_credits_multiplier) +
      (tierConfig.bonus_credits * tierConfig.bonus_credits_multiplier) +
      (tierConfig.additional_bonus_credits * tierConfig.additional_bonus_credits_multiplier);
    
    res.json({
      originalPrice,
      discountedPrice,
      totalSavings: originalPrice - discountedPrice,
      totalCredits
    });
  } catch (error) {
    console.error('Preview price error:', error);
    res.status(500).json({ error: 'Failed to calculate price preview' });
  }
});

module.exports = router;
