const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/connection'); // Use db.query() instead of get()/run()
const { query } = require('../../db/connection');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/users - List users with filters
router.get('/', async (req, res) => {
  try {
    const {
      role,
      tier,
      status = 'active',
      country,
      state_province,
      search,
      limit = 50,
      offset = 0
    } = req.query;

    let sql = `
      SELECT id, account_number, name, email, phone, role, tier, status, 
             email_verified, phone_verified, created_at
      FROM users
      WHERE 1=1
    `;
    const params = [];

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }

    if (tier) {
      sql += ' AND tier = ?';
      params.push(tier);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (country) {
      sql += ' AND country = ?';
      params.push(country);
    }

    if (state_province) {
      sql += ' AND state_province = ?';
      params.push(state_province);
    }

    if (search) {
      sql += ` AND (name ILIKE ? OR email ILIKE ? OR phone ILIKE ? OR account_number ILIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const users = await query(sql, params);
    res.json(users);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// GET /api/admin/users/:id - Get full user details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await query('SELECT * FROM users WHERE id = $1', [id]).then(r => r[0]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// POST /api/admin/users/:id/promote-god-tier - Promote tradie to god tier
router.post('/:id/promote-god-tier', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await query('SELECT id, role, tier FROM users WHERE id = $1', [id]).then(r => r[0]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'tasker' && user.role !== 'both') {
      return res.status(400).json({ error: 'Only tradie users can be promoted to god tier' });
    }

    await query('UPDATE users SET tier = $1 WHERE id = $2 RETURNING *', ['god', id]);

    const updated = await query('SELECT * FROM users WHERE id = $1', [id]).then(r => r[0]);
    res.json(updated);
  } catch (error) {
    console.error('Promote god tier error:', error);
    res.status(500).json({ error: 'Failed to promote user' });
  }
});

// POST /api/admin/users/:id/ban - Ban user
router.post('/:id/ban',
  [body('reason').notEmpty().trim()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { reason } = req.body;

      const user = await query('SELECT id FROM users WHERE id = $1', [id]).then(r => r[0]);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await query('UPDATE users SET status = $1, banned_at = CURRENT_TIMESTAMP, banned_reason = $2 WHERE id = $3', ['banned', reason, id]);

      res.json({ message: 'User banned successfully' });
    } catch (error) {
      console.error('Ban user error:', error);
      res.status(500).json({ error: 'Failed to ban user' });
    }
  }
);

// POST /api/admin/users/:id/suspend - Suspend user
router.post('/:id/suspend',
  [body('reason').notEmpty().trim()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { reason } = req.body;

      const user = await query('SELECT id FROM users WHERE id = $1', [id]).then(r => r[0]);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await query('UPDATE users SET status = $1, suspended_at = CURRENT_TIMESTAMP, suspended_reason = $2 WHERE id = $3', ['suspended', reason, id]);

      res.json({ message: 'User suspended successfully' });
    } catch (error) {
      console.error('Suspend user error:', error);
      res.status(500).json({ error: 'Failed to suspend user' });
    }
  }
);

// POST /api/admin/users/:id/unban - Unban user
router.post('/:id/unban', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await query('SELECT id, status FROM users WHERE id = $1', [id]).then(r => r[0]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.status !== 'banned') {
      return res.status(400).json({ error: 'User is not banned' });
    }

    await query('UPDATE users SET status = $1, banned_at = NULL, banned_reason = NULL WHERE id = $2 RETURNING *', ['active', id]);

    res.json({ message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// POST /api/admin/users/:id/unsuspend - Unsuspend user
router.post('/:id/unsuspend', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await query('SELECT id, status FROM users WHERE id = $1', [id]).then(r => r[0]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.status !== 'suspended') {
      return res.status(400).json({ error: 'User is not suspended' });
    }

    await query('UPDATE users SET status = $1, suspended_at = NULL, suspended_reason = NULL WHERE id = $2 RETURNING *', ['active', id]);

    res.json({ message: 'User unsuspended successfully' });
  } catch (error) {
    console.error('Unsuspend user error:', error);
    res.status(500).json({ error: 'Failed to unsuspend user' });
  }
});

// POST /api/admin/users/:id/reset-password - Send password reset
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await query('SELECT id, email FROM users WHERE id = $1', [id]).then(r => r[0]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // TODO: Implement actual password reset email
    res.json({ message: 'Password reset email sent (placeholder)' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
