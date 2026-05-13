const express = require('express');
const router = express.Router();
const { query, get, run } = require('../db/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/admin/settings - Get all admin settings
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await query('SELECT * FROM admin_settings ORDER BY key');
    
    // Convert to key-value object
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = {
        value: setting.value,
        description: setting.description
      };
    });
    
    res.json(settingsObj);
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    res.status(500).json({ error: 'Failed to fetch admin settings' });
  }
});

// GET /api/admin/settings/gst - Get GST setting
router.get('/gst', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const setting = await get('SELECT * FROM admin_settings WHERE key = ?', ['gst_enabled']);
    
    if (!setting) {
      return res.json({ gst_enabled: false });
    }
    
    res.json({
      gst_enabled: setting.value === 'true',
      description: setting.description
    });
  } catch (error) {
    console.error('Error fetching GST setting:', error);
    res.status(500).json({ error: 'Failed to fetch GST setting' });
  }
});

// PUT /api/admin/settings/gst - Update GST setting
router.put('/gst', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    
    await run(
      `INSERT INTO admin_settings (key, value, description, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
      ['gst_enabled', enabled.toString(), 'Enable GST (10%) on all invoices', enabled.toString()]
    );
    
    res.json({
      message: 'GST setting updated successfully',
      gst_enabled: enabled
    });
  } catch (error) {
    console.error('Error updating GST setting:', error);
    res.status(500).json({ error: 'Failed to update GST setting' });
  }
});

// GET /api/admin/settings/:key - Get specific setting
router.get('/:key', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const setting = await get('SELECT * FROM admin_settings WHERE key = ?', [key]);
    
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json(setting);
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// PUT /api/admin/settings/:key - Update specific setting
router.put('/:key', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    
    if (!value) {
      return res.status(400).json({ error: 'value is required' });
    }
    
    const existing = await get('SELECT * FROM admin_settings WHERE key = ?', [key]);
    
    if (existing) {
      await run(
        'UPDATE admin_settings SET value = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
        [value, description || existing.description, key]
      );
    } else {
      await run(
        'INSERT INTO admin_settings (key, value, description) VALUES (?, ?, ?)',
        [key, value, description || '']
      );
    }
    
    res.json({
      message: 'Setting updated successfully',
      key,
      value
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

module.exports = router;
