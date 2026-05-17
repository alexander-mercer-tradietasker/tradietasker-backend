const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ 
    version: 'admin-fix-v2',
    timestamp: '2026-05-17T00:10:00Z',
    commit: '0537485'
  });
});

module.exports = router;
