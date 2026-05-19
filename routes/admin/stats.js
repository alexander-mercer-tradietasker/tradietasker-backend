const express = require('express');
const { query, get } = require('../../db/connection');
const { authenticateAdmin } = require('../../middleware/adminAuth');

const router = express.Router();

router.use(authenticateAdmin);

// Helper to get date filter
function getDateFilter(period) {
  const now = new Date();
  let dateFilter = '';

  switch (period) {
    case 'today':
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      dateFilter = `>= '${startOfDay.toISOString()}'`;
      break;
    case 'week':
      const weekAgo = new Date(now.setDate(now.getDate() - 7));
      dateFilter = `>= '${weekAgo.toISOString()}'`;
      break;
    case 'month':
      const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
      dateFilter = `>= '${monthAgo.toISOString()}'`;
      break;
    case 'all':
    default:
      dateFilter = '> \'1970-01-01\'';
  }

  return dateFilter;
}

// GET /api/admin/stats/overview - All platform stats
router.get('/overview', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    const dateFilter = getDateFilter(period);

    // User stats
    const totalUsers = await get(`SELECT COUNT(*) as count FROM users WHERE created_at ${dateFilter}`);
    const usersByRole = await query(`SELECT role, COUNT(*) as count FROM users WHERE created_at ${dateFilter} GROUP BY role`);
    const usersByTier = await query(`SELECT tier, COUNT(*) as count FROM users WHERE created_at ${dateFilter} GROUP BY tier`);
    const usersByStatus = await query(`SELECT status, COUNT(*) as count FROM users GROUP BY status`);

    // Job stats
    const totalJobs = await get(`SELECT COUNT(*) as count FROM jobs WHERE created_at ${dateFilter}`);
    const jobsByStatus = await query(`SELECT status, COUNT(*) as count FROM jobs WHERE created_at ${dateFilter} GROUP BY status`);

    // Credit stats
    const totalCredits = await get(`SELECT SUM(credits) as total FROM users`);

    // Referral stats - skip if table doesn't exist
    let referralStats = [{ total_referrals: 0, total_credits_granted: 0 }];
    try {
      referralStats = await query(`
        SELECT 
          COUNT(*) as total_referrals,
          SUM(credits_granted) as total_credits_granted
        FROM referral_credits
        WHERE granted_at ${dateFilter}
      `);
    } catch (e) {
      // Table doesn't exist yet
    }

    // Flag stats - skip if table doesn't exist
    let flagStats = [];
    try {
      flagStats = await query(`SELECT status, COUNT(*) as count FROM user_flags GROUP BY status`);
    } catch (e) {
      // Table doesn't exist yet
    }

    res.json({
      users: {
        total: totalUsers.count,
        byRole: usersByRole,
        byTier: usersByTier,
        byStatus: usersByStatus
      },
      jobs: {
        total: totalJobs.count,
        byStatus: jobsByStatus
      },
      credits: {
        totalInSystem: totalCredits.total || 0
      },
      referrals: {
        total: referralStats[0]?.total_referrals || 0,
        creditsGranted: referralStats[0]?.total_credits_granted || 0
      },
      flags: flagStats,
      period
    });
  } catch (error) {
    console.error('Get overview stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/admin/stats/revenue - Revenue breakdown
router.get('/revenue', async (req, res) => {
  try {
    // Placeholder - need transaction tracking
    res.json({
      total: 0,
      byTier: [],
      byPackage: [],
      note: 'Revenue tracking not yet implemented'
    });
  } catch (error) {
    console.error('Get revenue stats error:', error);
    res.status(500).json({ error: 'Failed to get revenue stats' });
  }
});

// GET /api/admin/stats/users - User metrics
router.get('/users', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    const dateFilter = getDateFilter(period);

    const newSignups = await get(`SELECT COUNT(*) as count FROM users WHERE created_at ${dateFilter}`);
    const byRole = await query(`SELECT role, COUNT(*) as count FROM users WHERE created_at ${dateFilter} GROUP BY role`);
    const byTier = await query(`SELECT tier, COUNT(*) as count FROM users WHERE created_at ${dateFilter} GROUP BY tier`);

    res.json({
      newSignups: newSignups.count,
      byRole,
      byTier,
      period
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

// GET /api/admin/stats/jobs - Job metrics
router.get('/jobs', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    const dateFilter = getDateFilter(period);

    const total = await get(`SELECT COUNT(*) as count FROM jobs WHERE created_at ${dateFilter}`);
    const byStatus = await query(`SELECT status, COUNT(*) as count FROM jobs WHERE created_at ${dateFilter} GROUP BY status`);

    res.json({
      total: total.count,
      byStatus,
      period
    });
  } catch (error) {
    console.error('Get job stats error:', error);
    res.status(500).json({ error: 'Failed to get job stats' });
  }
});

module.exports = router;
