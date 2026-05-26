const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/credits/balance - Get current credit balance
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const user = await query('SELECT credits, role FROM users WHERE id = $1', [req.user.id]).then(r => r[0]);
    
    // Determine package type based on user role (default to customer)
    const packageType = user.role === 'tradie' ? 'tradie' : 'customer';
    
    // Fetch available packages from database
    const packagesData = await query('SELECT id, name, credits, price_excl_tax FROM credit_packages WHERE package_type = $1 AND enabled = true ORDER BY display_order, id',
      [packageType]
    );
    
    // Transform to legacy format for backward compatibility
    const packages = {};
    for (const pkg of packagesData) {
      const key = pkg.name.toLowerCase().replace(/\s+/g, '');
      packages[key] = {
        id: pkg.id,
        name: pkg.name,
        credits: pkg.credits,
        price: parseFloat(pkg.price_excl_tax)
      };
    }
    
    res.json({ 
      credits: user.credits,
      packages
    });
  } catch (error) {
    console.error('Get credit balance error:', error);
    res.status(500).json({ error: 'Failed to get credit balance' });
  }
});

// POST /api/credits/purchase - Buy one-off credits
router.post('/purchase',
  authenticateToken,
  [body('packageId').isInt({ min: 1 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { packageId } = req.body;
      
      // Fetch user role
      const user = await query('SELECT credits, role FROM users WHERE id = $1', [req.user.id]).then(r => r[0]);
      const packageType = user.role === 'tradie' ? 'tradie' : 'customer';
      
      // Fetch package from database
      const packageConfig = await query('SELECT * FROM credit_packages WHERE id = $1 AND package_type = $2 AND enabled = true', [packageId, packageType]).then(r => r[0]);
      
      if (!packageConfig) {
        return res.status(400).json({ error: 'Invalid or unavailable package' });
      }

      // TODO: Integrate with Stripe payment
      // For now, just add credits (mock payment success)

      await query('UPDATE users SET credits = credits + $1 WHERE id = $2', [packageConfig.credits, req.user.id]);

      const updatedUser = await query('SELECT credits FROM users WHERE id = $1', [req.user.id]).then(r => r[0]);

      res.json({
        message: 'Credits purchased successfully',
        package_name: packageConfig.name,
        credits_added: packageConfig.credits,
        new_balance: updatedUser.credits,
        amount_paid: parseFloat(packageConfig.price_excl_tax)
      });
    } catch (error) {
      console.error('Purchase credits error:', error);
      res.status(500).json({ error: 'Failed to purchase credits' });
    }
  }
);

module.exports = router;
