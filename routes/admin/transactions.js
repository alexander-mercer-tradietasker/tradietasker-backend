const express = require('express');
const { query } = require('../../db/connection');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/transactions - List all contact transactions
router.get('/', async (req, res) => {
  try {
    const { userId, jobId, type, page = 1, limit = 50, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        ct.*,
        sender.name as sender_name,
        sender.email as sender_email,
        receiver.name as receiver_name,
        receiver.email as receiver_email,
        j.title as job_title
      FROM contact_transactions ct
      LEFT JOIN users sender ON ct.sender_id = sender.id
      LEFT JOIN users receiver ON ct.receiver_id = receiver.id
      LEFT JOIN jobs j ON ct.job_id = j.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      sql += ' AND (ct.sender_id = ? OR ct.receiver_id = ?)';
      params.push(userId, userId);
    }

    if (jobId) {
      sql += ' AND ct.job_id = ?';
      params.push(jobId);
    }

    if (type) {
      sql += ' AND ct.contact_type = ?';
      params.push(type);
    }

    if (startDate) {
      sql += ' AND ct.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND ct.created_at <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY ct.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const transactions = await query(sql, params);

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM contact_transactions ct WHERE 1=1';
    const countParams = [];

    if (userId) {
      countSql += ' AND (ct.sender_id = ? OR ct.receiver_id = ?)';
      countParams.push(userId, userId);
    }

    if (jobId) {
      countSql += ' AND ct.job_id = ?';
      countParams.push(jobId);
    }

    if (type) {
      countSql += ' AND ct.contact_type = ?';
      countParams.push(type);
    }

    if (startDate) {
      countSql += ' AND ct.created_at >= ?';
      countParams.push(startDate);
    }

    if (endDate) {
      countSql += ' AND ct.created_at <= ?';
      countParams.push(endDate);
    }

    const countResult = await query(countSql, countParams);
    const total = countResult[0].total;

    res.json({ 
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// GET /api/admin/transactions/stats - Get transaction statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (startDate) {
      dateFilter += ' AND created_at >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      dateFilter += ' AND created_at <= ?';
      params.push(endDate);
    }

    const stats = await query(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(credits_used) as total_credits_used,
        COUNT(CASE WHEN contact_type = 'send_profile' THEN 1 END) as send_profile_count,
        COUNT(CASE WHEN contact_type = 'full_contact' THEN 1 END) as full_contact_count,
        SUM(CASE WHEN contact_type = 'send_profile' THEN credits_used ELSE 0 END) as send_profile_credits,
        SUM(CASE WHEN contact_type = 'full_contact' THEN credits_used ELSE 0 END) as full_contact_credits
      FROM contact_transactions
      WHERE 1=1 ${dateFilter}
    `, params);

    // Get daily transaction volume for the last 30 days
    const dailyVolume = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(credits_used) as credits_used
      FROM contact_transactions
      WHERE created_at >= DATE('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Get top users by transaction volume
    const topUsers = await query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(ct.id) as transaction_count,
        SUM(ct.credits_used) as total_credits_used
      FROM users u
      INNER JOIN contact_transactions ct ON u.id = ct.sender_id
      WHERE ct.created_at >= DATE('now', '-30 days')
      GROUP BY u.id, u.name, u.email
      ORDER BY total_credits_used DESC
      LIMIT 10
    `);

    res.json({ 
      stats: stats[0],
      dailyVolume,
      topUsers
    });
  } catch (error) {
    console.error('Get transaction stats error:', error);
    res.status(500).json({ error: 'Failed to get transaction statistics' });
  }
});

// GET /api/admin/transactions/user/:userId - Get user's transaction history
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const transactions = await query(`
      SELECT 
        ct.*,
        receiver.name as receiver_name,
        receiver.email as receiver_email,
        j.title as job_title
      FROM contact_transactions ct
      LEFT JOIN users receiver ON ct.receiver_id = receiver.id
      LEFT JOIN jobs j ON ct.job_id = j.id
      WHERE ct.sender_id = ?
      ORDER BY ct.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), offset]);

    const countResult = await query(
      'SELECT COUNT(*) as total FROM contact_transactions WHERE sender_id = ?',
      [userId]
    );

    res.json({ 
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get user transactions error:', error);
    res.status(500).json({ error: 'Failed to get user transactions' });
  }
});

module.exports = router;
