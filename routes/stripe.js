const express = require('express');
const router = express.Router();

// Placeholder Stripe routes
router.post('/create-checkout-session', (req, res) => {
  res.json({ error: 'Stripe not configured' });
});

router.post('/create-poster-package-checkout', (req, res) => {
  res.json({ error: 'Stripe not configured' });
});

router.get('/subscription-status', (req, res) => {
  res.json({ active: false });
});

module.exports = router;
