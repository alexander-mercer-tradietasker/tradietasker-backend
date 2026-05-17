const express = require('express');
const { query, get } = require('../db/connection');
const { authenticateAdmin } = require('../middleware/adminAuth');

const router = express.Router();
router.use(authenticateAdmin);

// GET /api/admin/stats - Dashboard stats matching frontend expectations
router.get('/stats', async (req, res) => {
  try {
    // User stats
    const userStats = await get(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN tier = 'god' THEN 1 ELSE 0 END) as god_users,
        SUM(CASE WHEN tier IN ('bronze', 'silver', 'gold', 'platinum') THEN 1 ELSE 0 END) as premium_users,
        SUM(CASE WHEN tier = 'free' THEN 1 ELSE 0 END) as free_users,
        SUM(CASE WHEN role IN ('tasker', 'both') THEN 1 ELSE 0 END) as taskers,
        SUM(CASE WHEN role IN ('poster', 'both') THEN 1 ELSE 0 END) as posters
      FROM users
    `);

    // Promo code stats (placeholder - table doesn't exist yet)
    const promoStats = {
      total_codes: 0,
      active_codes: 0,
      total_usage: 0
    };

    // Recent activity (placeholder - audit log doesn't exist yet)
    const recentActivity = [];

    res.json({
      users: userStats || {
        total_users: 0,
        god_users: 0,
        premium_users: 0,
        free_users: 0,
        taskers: 0,
        posters: 0
      },
      promoCodes: promoStats,
      recentActivity
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Failed to load statistics' });
  }
});

module.exports = router;
