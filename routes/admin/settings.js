const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, get, run } = require('../../db/connection');
const { requireAdmin } = require('../../middleware/adminAuth');

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

// GET /api/admin/settings - Get all settings as key-value object
router.get('/', async (req, res) => {
  try {
    const settings = await query('SELECT setting_key, setting_value FROM site_settings');
    
    // Convert to key-value object
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.setting_key] = s.setting_value;
    });
    
    res.json(settingsObj);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// PUT /api/admin/settings - Batch update settings
router.put('/', async (req, res) => {
  try {
    const updates = req.body;
    
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No settings to update' });
    }

    // Upsert each setting
    for (const [key, value] of Object.entries(updates)) {
      await run(
        `INSERT INTO site_settings (setting_key, setting_value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (setting_key) 
         DO UPDATE SET setting_value = ?, updated_at = CURRENT_TIMESTAMP`,
        [key, value, value]
      );
    }

    // Return updated settings
    const settings = await query('SELECT setting_key, setting_value FROM site_settings');
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.setting_key] = s.setting_value;
    });
    
    res.json(settingsObj);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// PUT /api/admin/settings/:key - Update single setting
router.put('/:key', 
  [body('value').exists()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { key } = req.params;
      const { value } = req.body;

      await run(
        `INSERT INTO site_settings (setting_key, setting_value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (setting_key) 
         DO UPDATE SET setting_value = ?, updated_at = CURRENT_TIMESTAMP`,
        [key, value, value]
      );

      res.json({ setting_key: key, setting_value: value });
    } catch (error) {
      console.error('Update setting error:', error);
      res.status(500).json({ error: 'Failed to update setting' });
    }
  }
);

module.exports = router;
