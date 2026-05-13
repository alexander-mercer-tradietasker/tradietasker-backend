const express = require('express');
const router = express.Router();

// Placeholder profile unlock routes
router.post('/unlock', (req, res) => {
  res.json({ success: false, message: 'Not implemented' });
});

router.get('/status/:profileId', (req, res) => {
  res.json({ unlocked: false });
});

module.exports = router;
