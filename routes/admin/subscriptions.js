const express = require('express');
const { query, run } = require('../../db/connection');
const { authenticateAdmin } = require('../../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// GET /api/admin/subscriptions - List all subscriptions
router.get('/', async (req, res) => {
  try {
    const { status, userId, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        s.*,
        u.name as user_name,
        u.email as user_email,
        u.tier as user_tier
      FROM subscriptions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    }

    if (userId) {
      sql += ' AND s.user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const subscriptions = await query(sql, params);

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM subscriptions s WHERE 1=1';
    const countParams = [];

    if (status) {
      countSql += ' AND s.status = ?';
      countParams.push(status);
    }

    if (userId) {
      countSql += ' AND s.user_id = ?';
      countParams.push(userId);
    }

    const countResult = await query(countSql, countParams);
    const total = countResult[0].total;

    res.json({ 
      subscriptions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to get subscriptions' });
  }
});

// GET /api/admin/subscriptions/:id - Get subscription details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = await query(`
      SELECT 
        s.*,
        u.name as user_name,
        u.email as user_email,
        u.tier as user_tier
      FROM subscriptions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [id]);

    if (subscription.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({ subscription: subscription[0] });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// PUT /api/admin/subscriptions/:id/cancel - Cancel subscription
router.put('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const subscription = await query(
      'SELECT * FROM subscriptions WHERE id = ?',
      [id]
    );

    if (subscription.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subscription[0].status === 'canceled') {
      return res.status(400).json({ error: 'Subscription is already canceled' });
    }

    await run(
      'UPDATE subscriptions SET status = ?, canceled_at = CURRENT_TIMESTAMP, cancellation_reason = ? WHERE id = ?',
      ['canceled', reason || 'Canceled by admin', id]
    );

    res.json({ message: 'Subscription canceled successfully' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// GET /api/admin/subscriptions/stats - Get subscription statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_subscriptions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
        COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceled_subscriptions,
        COUNT(CASE WHEN status = 'past_due' THEN 1 END) as past_due_subscriptions,
        SUM(CASE WHEN status = 'active' THEN price ELSE 0 END) as monthly_recurring_revenue
      FROM subscriptions
    `);

    // Get subscription trend for the last 12 months
    const monthlyTrend = await query(`
      SELECT 
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as new_subscriptions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count
      FROM subscriptions
      WHERE created_at >= DATE('now', '-12 months')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month DESC
    `);

    res.json({ 
      stats: stats[0],
      monthlyTrend
    });
  } catch (error) {
    console.error('Get subscription stats error:', error);
    res.status(500).json({ error: 'Failed to get subscription statistics' });
  }
});

module.exports = router;
