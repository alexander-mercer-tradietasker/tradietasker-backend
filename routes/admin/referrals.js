const express = require('express');
const { query, run } = require('../../db/connection');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/referrals - List all referral codes and usage
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, sortBy = 'referrals' } = req.query;
    const offset = (page - 1) * limit;

    let orderBy = 'referral_count DESC';
    if (sortBy === 'credits') {
      orderBy = 'total_credits_earned DESC';
    } else if (sortBy === 'date') {
      orderBy = 'u.created_at DESC';
    }

    const referrals = await query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.referral_code,
        u.referral_credit_earned,
        u.created_at,
        COUNT(r.id) as referral_count,
        COALESCE(SUM(r.credit_awarded), 0) as total_credits_earned
      FROM users u
      LEFT JOIN referrals r ON u.id = r.referrer_id
      WHERE u.referral_code IS NOT NULL
      GROUP BY u.id, u.name, u.email, u.referral_code, u.referral_credit_earned, u.created_at
      ORDER BY ${orderBy}
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), offset]);

    const countResult = await query(
      'SELECT COUNT(*) as total FROM users WHERE referral_code IS NOT NULL'
    );

    res.json({ 
      referrals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({ error: 'Failed to get referrals' });
  }
});

// GET /api/admin/referrals/:userId - Get referral details for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await query('SELECT id, name, email, referral_code, referral_credit_earned FROM users WHERE id = $1',
      [userId]
    );

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const referredUsers = await query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.created_at,
        r.credit_awarded,
        r.created_at as referral_date
      FROM referrals r
      INNER JOIN users u ON r.referred_user_id = u.id
      WHERE r.referrer_id = $1
      ORDER BY r.created_at DESC
    `, [userId]);

    res.json({ 
      user: user[0],
      referredUsers
    });
  } catch (error) {
    console.error('Get referral details error:', error);
    res.status(500).json({ error: 'Failed to get referral details' });
  }
});

// GET /api/admin/referrals/settings - Get referral settings
router.get('/settings/current', async (req, res) => {
  try {
    const settings = await query(
      'SELECT * FROM referral_settings ORDER BY id DESC LIMIT 1'
    );

    if (settings.length === 0) {
      return res.status(404).json({ error: 'Referral settings not found' });
    }

    res.json({ settings: settings[0] });
  } catch (error) {
    console.error('Get referral settings error:', error);
    res.status(500).json({ error: 'Failed to get referral settings' });
  }
});

// PUT /api/admin/referrals/settings - Update referral settings
router.put('/settings/current', async (req, res) => {
  try {
    const { credit_per_referral, enabled } = req.body;

    if (credit_per_referral === undefined && enabled === undefined) {
      return res.status(400).json({ error: 'No settings provided to update' });
    }

    let sql = 'UPDATE referral_settings SET updated_at = CURRENT_TIMESTAMP';
    const params = [];

    if (credit_per_referral !== undefined) {
      sql += ', credit_per_referral = ?';
      params.push(credit_per_referral);
    }

    if (enabled !== undefined) {
      sql += ', enabled = ?';
      params.push(enabled);
    }

    sql += ' WHERE id = (SELECT id FROM referral_settings ORDER BY id DESC LIMIT 1)';

    await query(sql, params);

    const settings = await query(
      'SELECT * FROM referral_settings ORDER BY id DESC LIMIT 1'
    );

    res.json({ 
      message: 'Referral settings updated successfully',
      settings: settings[0]
    });
  } catch (error) {
    console.error('Update referral settings error:', error);
    res.status(500).json({ error: 'Failed to update referral settings' });
  }
});

// GET /api/admin/referrals/stats - Get referral statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(DISTINCT referrer_id) as active_referrers,
        COUNT(*) as total_referrals,
        SUM(credit_awarded) as total_credits_awarded,
        AVG(credit_awarded) as avg_credits_per_referral
      FROM referrals
    `);

    // Get top referrers
    const topReferrers = await query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.referral_code,
        COUNT(r.id) as referral_count,
        SUM(r.credit_awarded) as total_credits_earned
      FROM users u
      INNER JOIN referrals r ON u.id = r.referrer_id
      GROUP BY u.id, u.name, u.email, u.referral_code
      ORDER BY referral_count DESC
      LIMIT 10
    `);

    // Get referral trend for the last 30 days
    const dailyTrend = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as referral_count,
        SUM(credit_awarded) as credits_awarded
      FROM referrals
      WHERE created_at >= DATE('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json({ 
      stats: stats[0],
      topReferrers,
      dailyTrend
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ error: 'Failed to get referral statistics' });
  }
});

module.exports = router;
