const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../../db/connection');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/tax/rates - List all tax rates
router.get('/rates', async (req, res) => {
  try {
    const rates = await query('SELECT * FROM tax_rates ORDER BY country, state_province');
    res.json(rates);
  } catch (error) {
    console.error('Get tax rates error:', error);
    res.status(500).json({ error: 'Failed to get tax rates' });
  }
});

// POST /api/admin/tax/rates - Create tax rate
router.post('/rates',
  [
    body('name').notEmpty().trim(),
    body('country').notEmpty().trim(),
    body('rate_percent').isFloat({ min: 0, max: 100 }),
    body('state_province').optional().trim(),
    body('tax_id_label').optional().trim(),
    body('tax_id_number').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, country, state_province, rate_percent, tax_id_label, tax_id_number } = req.body;

      const result = await query(`INSERT INTO tax_rates (name, country, state_province, rate_percent, tax_id_label, tax_id_number, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, true)`, [name, country, state_province || null, rate_percent, tax_id_label || null, tax_id_number || null]);

      const newRate = await query('SELECT * FROM tax_rates WHERE id = $1', [result.lastID]).then(r => r[0]);
      res.status(201).json(newRate);
    } catch (error) {
      console.error('Create tax rate error:', error);
      res.status(500).json({ error: 'Failed to create tax rate' });
    }
  }
);

// PUT /api/admin/tax/rates/:id - Update tax rate
router.put('/rates/:id',
  [
    body('name').optional().trim(),
    body('country').optional().trim(),
    body('rate_percent').optional().isFloat({ min: 0, max: 100 }),
    body('state_province').optional().trim(),
    body('tax_id_label').optional().trim(),
    body('tax_id_number').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updates = req.body;

      const existing = await query('SELECT id FROM tax_rates WHERE id = $1', [id]).then(r => r[0]);
      if (!existing) {
        return res.status(404).json({ error: 'Tax rate not found' });
      }

      const fields = Object.keys(updates);
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const setClause = fields.map(f => `${f} = ?`).join(', ');
      const values = fields.map(f => updates[f]);
      values.push(id);

      await query(
        `UPDATE tax_rates SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      const updated = await query('SELECT * FROM tax_rates WHERE id = $1', [id]).then(r => r[0]);
      res.json(updated);
    } catch (error) {
      console.error('Update tax rate error:', error);
      res.status(500).json({ error: 'Failed to update tax rate' });
    }
  }
);

// DELETE /api/admin/tax/rates/:id - Delete tax rate
router.delete('/rates/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT id FROM tax_rates WHERE id = $1', [id]).then(r => r[0]);
    if (!existing) {
      return res.status(404).json({ error: 'Tax rate not found' });
    }

    await query('DELETE FROM tax_rates WHERE id = $1', [id]);
    res.json({ message: 'Tax rate deleted successfully' });
  } catch (error) {
    console.error('Delete tax rate error:', error);
    res.status(500).json({ error: 'Failed to delete tax rate' });
  }
});

// POST /api/admin/tax/rates/:id/toggle - Enable/disable tax rate
router.post('/rates/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT enabled FROM tax_rates WHERE id = $1', [id]).then(r => r[0]);
    if (!existing) {
      return res.status(404).json({ error: 'Tax rate not found' });
    }

    const newEnabled = !existing.enabled;
    await query('UPDATE tax_rates SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [newEnabled, id]);

    const updated = await query('SELECT * FROM tax_rates WHERE id = $1', [id]).then(r => r[0]);
    res.json(updated);
  } catch (error) {
    console.error('Toggle tax rate error:', error);
    res.status(500).json({ error: 'Failed to toggle tax rate' });
  }
});

module.exports = router;
