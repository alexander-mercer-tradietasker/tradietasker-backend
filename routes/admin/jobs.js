const express = require('express');
const { query, get } = require('../../db/connection');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/jobs - List all jobs with filters
router.get('/', async (req, res) => {
  try {
    const {
      status,
      god_tier_only,
      limit = 50,
      offset = 0
    } = req.query;

    let sql = `
      SELECT 
        j.*,
        u.name as poster_name,
        u.email as poster_email,
        jt.name as job_type_name
      FROM jobs j
      LEFT JOIN users u ON j.poster_id = u.id
      LEFT JOIN job_types jt ON j.job_type_id = jt.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND j.status = ?';
      params.push(status);
    }

    if (god_tier_only === 'true') {
      sql += ' AND j.god_tier_only = true';
    } else if (god_tier_only === 'false') {
      sql += ' AND j.god_tier_only = false';
    }

    sql += ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const jobs = await query(sql, params);
    res.json(jobs);
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

// GET /api/admin/jobs/flagged - List flagged jobs
router.get('/flagged', async (req, res) => {
  try {
    const flaggedJobs = await query(`
      SELECT 
        j.*,
        uf.reason as flag_reason,
        uf.details as flag_details,
        uf.created_at as flagged_at,
        reporter.name as reporter_name,
        reporter.email as reporter_email
      FROM user_flags uf
      JOIN jobs j ON uf.reported_job_id = j.id
      JOIN users reporter ON uf.reported_by_user_id = reporter.id
      WHERE uf.flag_type = 'job' AND uf.status = 'pending'
      ORDER BY uf.created_at DESC
    `);

    res.json(flaggedJobs);
  } catch (error) {
    console.error('List flagged jobs error:', error);
    res.status(500).json({ error: 'Failed to list flagged jobs' });
  }
});

// GET /api/admin/jobs/:id - Get job details with all flags
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const job = await get(`
      SELECT 
        j.*,
        u.name as poster_name,
        u.email as poster_email,
        u.phone as poster_phone,
        jt.name as job_type_name
      FROM jobs j
      LEFT JOIN users u ON j.poster_id = u.id
      LEFT JOIN job_types jt ON j.job_type_id = jt.id
      WHERE j.id = ?
    `, [id]);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const flags = await query(`
      SELECT 
        uf.*,
        reporter.name as reporter_name,
        reporter.email as reporter_email
      FROM user_flags uf
      JOIN users reporter ON uf.reported_by_user_id = reporter.id
      WHERE uf.flag_type = 'job' AND uf.reported_job_id = ?
      ORDER BY uf.created_at DESC
    `, [id]);

    res.json({ job, flags });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

module.exports = router;
