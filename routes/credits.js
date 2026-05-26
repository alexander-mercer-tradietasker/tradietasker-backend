const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/connection'); // Use db.query() instead of get()/run()
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/credits/balance
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const user = await query('SELECT credits FROM users WHERE id = $1', [req.user.id]).then(r => r[0]);
    const packages = await query('SELECT * FROM credit_packages WHERE enabled = true ORDER BY package_type, display_order');
    res.json({ credits: user.credits, packages });
  } catch (error) {
    console.error('Get credit balance error:', error);
    res.status(500).json({ error: 'Failed to get credit balance' });
  }
});

// GET /api/credits/packages
router.get('/packages', async (req, res) => {
  try {
    const { type } = req.query;
    let sql = 'SELECT * FROM credit_packages WHERE enabled = true';
    const params = [];
    
    if (type && ['customer', 'tradie'].includes(type)) {
      sql += ' AND package_type = ?';
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

// POST /api/credits/purchase
router.post('/purchase',
  authenticateToken,
  [body('package_id').isInt({ min: 1 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { package_id } = req.body;
      const pkg = await query('SELECT * FROM credit_packages WHERE id = $1 AND enabled = true', [package_id]).then(r => r[0]);
      
      if (!pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }

      // TODO: Integrate Stripe payment
      // For now, mock success

      await query('UPDATE users SET credits = credits + $1 WHERE id = $2 RETURNING *', [pkg.credits, req.user.id]);
      res.json({ message: 'Credits purchased', credits_added: pkg.credits, package: pkg.name });
    } catch (error) {
      console.error('Purchase credits error:', error);
      res.status(500).json({ error: 'Failed to purchase credits' });
    }
  }
);

module.exports = router;
