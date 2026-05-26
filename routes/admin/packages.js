const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../../db/connection');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/packages
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    let sql = 'SELECT *, package_discount_percent as discount_percent, package_discount_dollar as discount_dollar, package_discount_enabled as discount_enabled FROM credit_packages';
    const params = [];
    
    if (type && ['customer', 'tradie'].includes(type)) {
      sql += ' WHERE package_type = $1';
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
    const result = await query('SELECT *, package_discount_percent as discount_percent, package_discount_dollar as discount_dollar, package_discount_enabled as discount_enabled FROM credit_packages WHERE id = $1', [req.params.id]);
    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json(result[0]);
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
    body('credits').optional().isInt({ min: 0 }),
    body('price_excl_tax').isFloat({ min: 0 }),
    body('discount_percent').optional().isFloat({ min: 0, max: 100 }),
    body('discount_dollar').optional().isFloat({ min: 0 }),
    body('discount_enabled').optional().isBoolean(),
    body('display_order').optional().isInt({ min: 0 }),
    body('enabled').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const fieldMapping = {
        'package_type': 'package_type',
        'name': 'name',
        'credits': 'credits',
        'price_excl_tax': 'price_excl_tax',
        'discount_percent': 'package_discount_percent',
        'discount_dollar': 'package_discount_dollar',
        'discount_enabled': 'package_discount_enabled',
        'display_order': 'display_order',
        'enabled': 'enabled',
        'standard_credits': 'standard_credits',
        'standard_credits_multiplier': 'standard_credits_multiplier',
        'bonus_credits': 'bonus_credits',
        'bonus_credits_multiplier': 'bonus_credits_multiplier',
        'additional_bonus_credits': 'additional_bonus_credits',
        'additional_bonus_credits_multiplier': 'additional_bonus_credits_multiplier'
      };

      const dbFields = [];
      const values = [];
      
      for (const [apiField, dbField] of Object.entries(fieldMapping)) {
        if (req.body[apiField] !== undefined) {
          dbFields.push(dbField);
          values.push(req.body[apiField]);
        }
      }

      const placeholders = dbFields.map((_, i) => `$${i + 1}`).join(', ');
      const fieldsList = dbFields.join(', ');

      const result = await query(
        `INSERT INTO credit_packages (${fieldsList}) VALUES (${placeholders}) RETURNING *, package_discount_percent as discount_percent, package_discount_dollar as discount_dollar, package_discount_enabled as discount_enabled`,
        values
      );

      res.status(201).json(result[0]);
    } catch (error) {
      console.error('Create package error:', error);
      res.status(500).json({ error: 'Failed to create package', details: error.message });
    }
  }
);

// PUT /api/admin/packages/:id
router.put('/:id',
  [
    body('package_type').optional().isIn(['customer', 'tradie']),
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('credits').optional().isInt({ min: 0 }),
    body('price_excl_tax').optional().isFloat({ min: 0 }),
    body('discount_percent').optional().isFloat({ min: 0, max: 100 }),
    body('discount_dollar').optional().isFloat({ min: 0 }),
    body('discount_enabled').optional().isBoolean(),
    body('display_order').optional().isInt({ min: 0 }),
    body('enabled').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const existingResult = await query('SELECT id FROM credit_packages WHERE id = $1', [req.params.id]);
      if (!existingResult || existingResult.length === 0) {
        return res.status(404).json({ error: 'Package not found' });
      }

      const fieldMapping = {
        'package_type': 'package_type',
        'name': 'name',
        'credits': 'credits',
        'price_excl_tax': 'price_excl_tax',
        'discount_percent': 'package_discount_percent',
        'discount_dollar': 'package_discount_dollar',
        'discount_enabled': 'package_discount_enabled',
        'display_order': 'display_order',
        'enabled': 'enabled',
        'standard_credits': 'standard_credits',
        'standard_credits_multiplier': 'standard_credits_multiplier',
        'bonus_credits': 'bonus_credits',
        'bonus_credits_multiplier': 'bonus_credits_multiplier',
        'additional_bonus_credits': 'additional_bonus_credits',
        'additional_bonus_credits_multiplier': 'additional_bonus_credits_multiplier'
      };

      const dbUpdates = {};
      for (const [apiField, dbField] of Object.entries(fieldMapping)) {
        if (req.body[apiField] !== undefined) {
          dbUpdates[dbField] = req.body[apiField];
        }
      }

      const fields = Object.keys(dbUpdates);
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
      const values = fields.map(f => dbUpdates[f]);
      values.push(req.params.id);

      const result = await query(
        `UPDATE credit_packages SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *, package_discount_percent as discount_percent, package_discount_dollar as discount_dollar, package_discount_enabled as discount_enabled`,
        values
      );

      res.json(result[0]);
    } catch (error) {
      console.error('Update package error:', error);
      res.status(500).json({ error: 'Failed to update package', details: error.message });
    }
  }
);

// DELETE /api/admin/packages/:id
router.delete('/:id', async (req, res) => {
  try {
    const existingResult = await query('SELECT id FROM credit_packages WHERE id = $1', [req.params.id]);
    if (!existingResult || existingResult.length === 0) {
      return res.status(404).json({ error: 'Package not found' });
    }

    await query('DELETE FROM credit_packages WHERE id = $1', [req.params.id]);
    res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json({ error: 'Failed to delete package' });
  }
});

module.exports = router;
