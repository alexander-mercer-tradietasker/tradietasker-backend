const express = require('express');
const { Pool } = require('pg');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// Direct PostgreSQL pool for admin routes
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// GET /api/admin/stats/overview - All platform stats
router.get('/overview', async (req, res) => {
  try {
    // Simple direct queries that will work
    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const jobsResult = await pool.query('SELECT COUNT(*) as count FROM jobs');
    const professionsResult = await pool.query('SELECT COUNT(*) as count FROM professions');
    
    const usersByRoleResult = await pool.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
    const jobsByStatusResult = await pool.query('SELECT status, COUNT(*) as count FROM jobs GROUP BY status');

    res.json({
      users: {
        total: parseInt(usersResult.rows[0].count),
        byRole: usersByRoleResult.rows
      },
      jobs: {
        total: parseInt(jobsResult.rows[0].count),
        byStatus: jobsByStatusResult.rows
      },
      professions: {
        total: parseInt(professionsResult.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Get overview stats error:', error);
    res.status(500).json({ error: 'Failed to get stats', details: error.message });
  }
});

// GET /api/admin/stats/users - User metrics
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    const byRole = await pool.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');

    res.json({
      total: parseInt(result.rows[0].count),
      byRole: byRole.rows
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user stats', details: error.message });
  }
});

// GET /api/admin/stats/jobs - Job metrics  
router.get('/jobs', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM jobs');
    const byStatus = await pool.query('SELECT status, COUNT(*) as count FROM jobs GROUP BY status');

    res.json({
      total: parseInt(result.rows[0].count),
      byStatus: byStatus.rows
    });
  } catch (error) {
    console.error('Get job stats error:', error);
    res.status(500).json({ error: 'Failed to get job stats', details: error.message });
  }
});

module.exports = router;
