const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, get, run } = require('../db/connection');
const { authenticateToken, requireGodTier } = require('../middleware/auth');

const router = express.Router();

// All admin routes require god tier
router.use(authenticateToken);
router.use(requireGodTier);

// GET /api/admin/stats - Platform stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await get(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'poster') as poster_count,
        (SELECT COUNT(*) FROM users WHERE role = 'tasker') as tasker_count,
        (SELECT COUNT(*) FROM users WHERE role = 'both') as both_count,
        (SELECT COUNT(*) FROM jobs) as total_jobs,
        (SELECT COUNT(*) FROM jobs WHERE status = 'open') as open_jobs,
        (SELECT COUNT(*) FROM jobs WHERE status = 'complete') as completed_jobs,
        (SELECT SUM(credits_used) FROM contact_transactions) as total_credits_spent,
        (SELECT COUNT(*) FROM reviews) as total_reviews,
        (SELECT AVG(stars) FROM reviews) as platform_avg_rating
    `);

    // Tier distribution
    const tierDistribution = await query(`
      SELECT 
        tier,
        COUNT(*) as user_count,
        SUM(credits) as total_credits
      FROM users
      WHERE role IN ('tasker', 'both')
      GROUP BY tier
      ORDER BY 
        CASE tier
          WHEN 'god' THEN 1
          WHEN 'platinum' THEN 2
          WHEN 'gold' THEN 3
          WHEN 'silver' THEN 4
          WHEN 'bronze' THEN 5
          WHEN 'free' THEN 6
        END
    `);

    // Most active taskers
    const topTaskers = await query(`
      SELECT 
        u.id,
        u.name,
        u.tier,
        COUNT(DISTINCT ct.id) as contact_count,
        AVG(r.stars) as avg_rating
      FROM users u
      LEFT JOIN contact_transactions ct ON u.id = ct.from_user_id
      LEFT JOIN reviews r ON u.id = r.reviewee_id
      WHERE u.role IN ('tasker', 'both')
      GROUP BY u.id
      HAVING COUNT(DISTINCT ct.id) > 0
      ORDER BY contact_count DESC, avg_rating DESC
      LIMIT 10
    `);

    // Most popular professions
    const topProfessions = await query(`
      SELECT 
        p.name,
        p.category,
        COUNT(up.user_id) as tasker_count
      FROM professions p
      LEFT JOIN user_professions up ON p.id = up.profession_id
      GROUP BY p.id
      ORDER BY tasker_count DESC, p.name
      LIMIT 10
    `);

    // Job type demand (last 30 days)
    const jobTypeDemand = await query(`
      SELECT 
        jt.name,
        jt.category,
        COUNT(j.id) as job_count
      FROM job_types jt
      LEFT JOIN jobs j ON jt.id = j.job_type_id
      WHERE j.created_at > datetime('now', '-30 days')
      GROUP BY jt.id
      ORDER BY job_count DESC, jt.name
      LIMIT 10
    `);

    res.json({
      stats: {
        ...stats,
        platform_avg_rating: stats.platform_avg_rating ? parseFloat(stats.platform_avg_rating).toFixed(1) : null
      },
      tierDistribution,
      topTaskers: topTaskers.map(t => ({
        ...t,
        avg_rating: t.avg_rating ? parseFloat(t.avg_rating).toFixed(1) : null
      })),
      topProfessions,
      jobTypeDemand
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// POST /api/admin/users/:id/set-tier - Manually set user tier
router.post('/users/:id/set-tier',
  [body('tier').isIn(['free', 'bronze', 'silver', 'gold', 'platinum', 'god'])],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tier } = req.body;
      const userId = req.params.id;

      // Verify user exists
      const user = await get('SELECT id, name, tier FROM users WHERE id = ?', [userId]);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update tier
      await run('UPDATE users SET tier = ? WHERE id = ?', [tier, userId]);

      res.json({ 
        message: 'User tier updated successfully',
        user: {
          id: user.id,
          name: user.name,
          old_tier: user.tier,
          new_tier: tier
        }
      });
    } catch (error) {
      console.error('Set tier error:', error);
      res.status(500).json({ error: 'Failed to set tier' });
    }
  }
);

// POST /api/admin/jobs/:id/god-tier - Mark job as god-tier only
router.post('/jobs/:id/god-tier',
  [body('is_god_tier').isBoolean()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { is_god_tier } = req.body;
      const jobId = req.params.id;

      // Verify job exists
      const job = await get('SELECT id, title FROM jobs WHERE id = ?', [jobId]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Update god tier status
      await run('UPDATE jobs SET is_god_tier = ? WHERE id = ?', [is_god_tier ? 1 : 0, jobId]);

      res.json({ 
        message: 'Job god-tier status updated successfully',
        job: {
          id: job.id,
          title: job.title,
          is_god_tier
        }
      });
    } catch (error) {
      console.error('Set god tier error:', error);
      res.status(500).json({ error: 'Failed to set god tier status' });
    }
  }
);

// GET /api/admin/users - List all users (with filters)
router.get('/users', async (req, res) => {
  try {
    const { role, tier, limit = 100, offset = 0 } = req.query;

    let sql = `
      SELECT 
        u.id,
        u.email,
        u.name,
        u.role,
        u.tier,
        u.credits,
        u.created_at,
        COUNT(DISTINCT r.id) as review_count,
        AVG(r.stars) as avg_rating
      FROM users u
      LEFT JOIN reviews r ON u.id = r.reviewee_id
      WHERE 1=1
    `;
    const params = [];

    if (role) {
      sql += ' AND u.role = ?';
      params.push(role);
    }

    if (tier) {
      sql += ' AND u.tier = ?';
      params.push(tier);
    }

    sql += ' GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const users = await query(sql, params);

    res.json({ 
      users: users.map(u => ({
        ...u,
        avg_rating: u.avg_rating ? parseFloat(u.avg_rating).toFixed(1) : null
      }))
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// GET /api/admin/jobs - List all jobs (with filters)
router.get('/jobs', async (req, res) => {
  try {
    const { status, is_god_tier, limit = 100, offset = 0 } = req.query;

    let sql = `
      SELECT 
        j.*,
        jt.name as job_type_name,
        u.name as poster_name,
        u.email as poster_email
      FROM jobs j
      LEFT JOIN job_types jt ON j.job_type_id = jt.id
      LEFT JOIN users u ON j.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND j.status = ?';
      params.push(status);
    }

    if (is_god_tier !== undefined) {
      sql += ' AND j.is_god_tier = ?';
      params.push(is_god_tier === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const jobs = await query(sql, params);

    res.json({ jobs });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

// POST /api/admin/users/:id/credits - Manually adjust user credits
router.post('/users/:id/credits',
  [body('amount').isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { amount } = req.body;
      const userId = req.params.id;

      // Verify user exists
      const user = await get('SELECT id, name, credits FROM users WHERE id = ?', [userId]);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update credits
      await run('UPDATE users SET credits = credits + ? WHERE id = ?', [amount, userId]);

      const updatedUser = await get('SELECT credits FROM users WHERE id = ?', [userId]);

      res.json({ 
        message: 'Credits adjusted successfully',
        user: {
          id: user.id,
          name: user.name,
          old_credits: user.credits,
          adjustment: amount,
          new_credits: updatedUser.credits
        }
      });
    } catch (error) {
      console.error('Adjust credits error:', error);
      res.status(500).json({ error: 'Failed to adjust credits' });
    }
  }
);

module.exports = router;
