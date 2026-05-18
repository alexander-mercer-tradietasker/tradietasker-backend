const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, get, run } = require('../../db/connection');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// Generate random promo code
function generatePromoCode(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/admin/promo-codes - List all promo codes with usage stats
router.get('/', async (req, res) => {
  try {
    const promoCodes = await query(`
      SELECT 
        pc.*,
        COUNT(pcu.id) as actual_usage_count
      FROM promo_codes pc
      LEFT JOIN promo_code_usage pcu ON pc.id = pcu.promo_code_id
      GROUP BY pc.id
      ORDER BY pc.created_at DESC
    `);
    
    res.json(promoCodes);
  } catch (error) {
    console.error('Get promo codes error:', error);
    res.status(500).json({ error: 'Failed to get promo codes' });
  }
});

// POST /api/admin/promo-codes - Create promo code
router.post('/',
  [
    body('code').optional().trim().isLength({ min: 3, max: 50 }),
    body('type').isIn(['signup_bonus', 'package_discount', 'both']),
    body('signup_bonus_credits').optional().isInt({ min: 0 }),
    body('discount_percent').optional().isFloat({ min: 0, max: 100 }),
    body('discount_dollar').optional().isFloat({ min: 0 }),
    body('applicable_packages').optional().isString(),
    body('expiry_date').optional().isDate(), // DATE ONLY - no time
    body('usage_limit').optional().isInt({ min: 1 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let {
        code,
        type,
        signup_bonus_credits = 0,
        discount_percent = 0,
        discount_dollar = 0,
        applicable_packages = null,
        expiry_date = null,
        usage_limit = null
      } = req.body;

      // Generate code if not provided
      if (!code) {
        code = generatePromoCode(12);
      }

      // Convert to uppercase
      code = code.toUpperCase();
      const code_lower = code.toLowerCase();

      // Check if code already exists
      const existing = await get('SELECT id FROM promo_codes WHERE code_lower = ?', [code_lower]);
      if (existing) {
        return res.status(409).json({ error: 'Promo code already exists' });
      }

      // CRITICAL FIX: Handle expiry_date as DATE ONLY
      // If expiry_date has time component, strip it
      if (expiry_date) {
        expiry_date = expiry_date.split('T')[0]; // Get YYYY-MM-DD only
      }

      const result = await run(
        `INSERT INTO promo_codes (
          code, code_lower, type, 
          signup_bonus_credits, discount_percent, discount_dollar,
          applicable_packages, expiry_date, usage_limit,
          enabled, created_by_admin_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?)`,
        [
          code, code_lower, type,
          signup_bonus_credits, discount_percent, discount_dollar,
          applicable_packages, expiry_date, usage_limit,
          req.user.id
        ]
      );

      const newPromoCode = await get('SELECT * FROM promo_codes WHERE id = ?', [result.lastID]);
      res.status(201).json(newPromoCode);
    } catch (error) {
      console.error('Create promo code error:', error);
      res.status(500).json({ error: 'Failed to create promo code' });
    }
  }
);

// PUT /api/admin/promo-codes/:id - Update promo code
router.put('/:id',
  [
    body('code').optional().trim(),
    body('type').optional().isIn(['signup_bonus', 'package_discount', 'both']),
    body('signup_bonus_credits').optional().isInt({ min: 0 }),
    body('discount_percent').optional().isFloat({ min: 0, max: 100 }),
    body('discount_dollar').optional().isFloat({ min: 0 }),
    body('applicable_packages').optional().isString(),
    body('expiry_date').optional().isDate(),
    body('usage_limit').optional().isInt({ min: 1 }),
    body('enabled').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updates = req.body;

      const existing = await get('SELECT id FROM promo_codes WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Promo code not found' });
      }

      // Handle code update
      if (updates.code) {
        updates.code = updates.code.toUpperCase();
        updates.code_lower = updates.code.toLowerCase();
      }

      // Handle expiry_date - DATE ONLY
      if (updates.expiry_date) {
        updates.expiry_date = updates.expiry_date.split('T')[0];
      }

      const fields = Object.keys(updates);
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const setClause = fields.map(f => `${f} = ?`).join(', ');
      const values = fields.map(f => updates[f]);
      values.push(id);

      await run(
        `UPDATE promo_codes SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      const updated = await get('SELECT * FROM promo_codes WHERE id = ?', [id]);
      res.json(updated);
    } catch (error) {
      console.error('Update promo code error:', error);
      res.status(500).json({ error: 'Failed to update promo code' });
    }
  }
);

// DELETE /api/admin/promo-codes/:id - Delete promo code
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await get('SELECT id FROM promo_codes WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Promo code not found' });
    }

    await run('DELETE FROM promo_codes WHERE id = ?', [id]);
    res.json({ message: 'Promo code deleted successfully' });
  } catch (error) {
    console.error('Delete promo code error:', error);
    res.status(500).json({ error: 'Failed to delete promo code' });
  }
});

// POST /api/admin/promo-codes/:id/toggle - Enable/disable promo code
router.post('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await get('SELECT enabled FROM promo_codes WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Promo code not found' });
    }

    const newEnabled = !existing.enabled;
    await run(
      'UPDATE promo_codes SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newEnabled, id]
    );

    const updated = await get('SELECT * FROM promo_codes WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Toggle promo code error:', error);
    res.status(500).json({ error: 'Failed to toggle promo code' });
  }
});

// GET /api/admin/promo-codes/:id/usage - Get usage details
router.get('/:id/usage', async (req, res) => {
  try {
    const { id } = req.params;

    const promoCode = await get('SELECT * FROM promo_codes WHERE id = ?', [id]);
    if (!promoCode) {
      return res.status(404).json({ error: 'Promo code not found' });
    }

    const usage = await query(`
      SELECT 
        pcu.*,
        u.name as user_name,
        u.email as user_email,
        u.account_number
      FROM promo_code_usage pcu
      JOIN users u ON pcu.user_id = u.id
      WHERE pcu.promo_code_id = ?
      ORDER BY pcu.used_at DESC
    `, [id]);

    res.json({ promoCode, usage });
  } catch (error) {
    console.error('Get promo code usage error:', error);
    res.status(500).json({ error: 'Failed to get promo code usage' });
  }
});

module.exports = router;
