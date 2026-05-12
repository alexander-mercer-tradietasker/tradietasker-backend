const express = require('express');
const { body, validationResult } = require('express-validator');
const { get, run } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Credit packages
const CREDIT_PACKAGES = {
  small: { credits: 5, price: 5 },
  medium: { credits: 10, price: 9 },
  large: { credits: 20, price: 16 },
  xlarge: { credits: 50, price: 35 }
};

// GET /api/credits/balance - Get current credit balance
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT credits FROM users WHERE id = ?', [req.user.id]);
    
    res.json({ 
      credits: user.credits,
      packages: CREDIT_PACKAGES
    });
  } catch (error) {
    console.error('Get credit balance error:', error);
    res.status(500).json({ error: 'Failed to get credit balance' });
  }
});

// POST /api/credits/purchase - Buy one-off credits
router.post('/purchase',
  authenticateToken,
  [body('package').isIn(['small', 'medium', 'large', 'xlarge'])],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { package: packageName } = req.body;
      const packageConfig = CREDIT_PACKAGES[packageName];

      // TODO: Integrate with Stripe payment
      // For now, just add credits (mock payment success)

      await run(
        'UPDATE users SET credits = credits + ? WHERE id = ?',
        [packageConfig.credits, req.user.id]
      );

      const user = await get('SELECT credits FROM users WHERE id = ?', [req.user.id]);

      res.json({
        message: 'Credits purchased successfully',
        credits_added: packageConfig.credits,
        new_balance: user.credits,
        amount_paid: packageConfig.price
      });
    } catch (error) {
      console.error('Purchase credits error:', error);
      res.status(500).json({ error: 'Failed to purchase credits' });
    }
  }
);

module.exports = router;
