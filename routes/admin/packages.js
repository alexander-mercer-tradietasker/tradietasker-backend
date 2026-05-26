const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, get, run } = require('../../db/connection');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/packages
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    let sql = 'SELECT * FROM credit_packages';
    const params = [];
    
    if (type && ['customer', 'tradie'].includes(type)) {
      sql += ' WHERE package_type = ?';
      params.push(type);
    }
    
    sql += ' ORDER BY package_type, display_order';
    
    const packages = await query(sql, params);
    res.json({ packages });
  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({ error: 'Failed to get packages' });
  }
});

// GET /api/admin/packages/:id
router.get('/:id', async (req, res) => {
  try {
    const pkg = await get('SELECT * FROM credit_packages WHERE id = ?', [req.params.id]);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json(pkg);
  } catch (error) {
    console.error('Get package error:', error);
    res.status(500).json({ error: 'Failed to get package' });
  }
});

// POST /api/admin/packages
router.post('/',
  [
    body('package_type').isIn(['customer', 'tradie']),
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('price_excl_tax').isFloat({ min: 0 }),
    body('package_discount_percent').optional().isFloat({ min: 0, max: 100 }),
    body('package_discount_dollar').optional().isFloat({ min: 0 }),
    body('package_discount_enabled').optional().isBoolean(),
    body('standard_credits').optional().isInt({ min: 0 }),
    body('standard_credits_multiplier').optional().isInt({ min: 1 }),
    body('bonus_credits').optional().isInt({ min: 0 }),
    body('bonus_credits_multiplier').optional().isInt({ min: 1 }),
    body('additional_bonus_credits').optional().isInt({ min: 0 }),
    body('additional_bonus_credits_multiplier').optional().isInt({ min: 1 }),
    body('display_order').optional().isInt({ min: 0 }),
    body('enabled').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const allowedFields = [
        'package_type', 'name', 'price_excl_tax',
        'package_discount_percent', 'package_discount_dollar', 'package_discount_enabled',
        'standard_credits', 'standard_credits_multiplier',
        'bonus_credits', 'bonus_credits_multiplier',
        'additional_bonus_credits', 'additional_bonus_credits_multiplier',
        'display_order', 'enabled'
      ];

      const fields = [];
      const values = [];
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          fields.push(field);
          values.push(req.body[field]);
        }
      }

      const placeholders = fields.map(() => '?').join(', ');
      const fieldsList = fields.join(', ');

      const result = await run(
        `INSERT INTO credit_packages (${fieldsList}) VALUES (${placeholders}) RETURNING id`,
        values
      );

      const newPkg = await get('SELECT * FROM credit_packages WHERE id = ?', [result.lastID]);
      res.status(201).json(newPkg);
    } catch (error) {
      console.error('Create package error:', error);
      res.status(500).json({ error: 'Failed to create package' });
    }
  }
);

// PUT /api/admin/packages/:id
router.put('/:id',
  [
    body('package_type').optional().isIn(['customer', 'tradie']),
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('price_excl_tax').optional().isFloat({ min: 0 }),
    body('package_discount_percent').optional().isFloat({ min: 0, max: 100 }),
    body('package_discount_dollar').optional().isFloat({ min: 0 }),
    body('package_discount_enabled').optional().isBoolean(),
    body('standard_credits').optional().isInt({ min: 0 }),
    body('standard_credits_multiplier').optional().isInt({ min: 1 }),
    body('bonus_credits').optional().isInt({ min: 0 }),
    body('bonus_credits_multiplier').optional().isInt({ min: 1 }),
    body('additional_bonus_credits').optional().isInt({ min: 0 }),
    body('additional_bonus_credits_multiplier').optional().isInt({ min: 1 }),
    body('display_order').optional().isInt({ min: 0 }),
    body('enabled').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const existing = await get('SELECT id FROM credit_packages WHERE id = ?', [req.params.id]);
      if (!existing) {
        return res.status(404).json({ error: 'Package not found' });
      }

      const allowedFields = [
        'package_type', 'name', 'price_excl_tax',
        'package_discount_percent', 'package_discount_dollar', 'package_discount_enabled',
        'standard_credits', 'standard_credits_multiplier',
        'bonus_credits', 'bonus_credits_multiplier',
        'additional_bonus_credits', 'additional_bonus_credits_multiplier',
        'display_order', 'enabled'
      ];

      const updates = {};
      for (const field of Object.keys(req.body)) {
        if (allowedFields.includes(field)) {
          updates[field] = req.body[field];
        }
      }

      const fields = Object.keys(updates);
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const setClause = fields.map(f => `${f} = ?`).join(', ');
      const values = fields.map(f => updates[f]);
      values.push(req.params.id);

      await run(
        `UPDATE credit_packages SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      const updated = await get('SELECT * FROM credit_packages WHERE id = ?', [req.params.id]);
      res.json(updated);
    } catch (error) {
      console.error('Update package error:', error);
      res.status(500).json({ error: 'Failed to update package' });
    }
  }
);

// DELETE /api/admin/packages/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await get('SELECT id FROM credit_packages WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Package not found' });
    }

    await run('DELETE FROM credit_packages WHERE id = ?', [req.params.id]);
    res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

module.exports = router;
