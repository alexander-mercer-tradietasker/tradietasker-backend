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
      tasker_id, 
      customer_id, 
      min_price, 
      max_price,
      profession,
      job_type,
      location,
      limit = 50,
      offset = 0,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    let sql = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (tasker_id) {
      sql += ` AND tasker_id = $${paramIndex++}`;
      params.push(parseInt(tasker_id));
    }

    if (customer_id) {
      sql += ` AND customer_id = $${paramIndex++}`;
      params.push(parseInt(customer_id));
    }

    if (min_price) {
      sql += ` AND price >= $${paramIndex++}`;
      params.push(parseFloat(min_price));
    }

    if (max_price) {
      sql += ` AND price <= $${paramIndex++}`;
      params.push(parseFloat(max_price));
    }

    if (profession) {
      sql += ` AND profession ILIKE $${paramIndex++}`;
      params.push(`%${profession}%`);
    }

    if (job_type) {
      sql += ` AND job_type ILIKE $${paramIndex++}`;
      params.push(`%${job_type}%`);
    }

    if (location) {
      sql += ` AND location ILIKE $${paramIndex++}`;
      params.push(`%${location}%`);
    }

    // Add sorting
    const validSorts = ['created_at', 'updated_at', 'price', 'status'];
    const sortField = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${sortField} ${sortOrder}`;

    // Add pagination
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const jobs = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM jobs WHERE 1=1';
    const countParams = params.slice(0, -2); // Remove limit and offset
    
    if (status) countSql += ` AND status = $1`;
    if (tasker_id) countSql += ` AND tasker_id = $${countParams.length}`;
    if (customer_id) countSql += ` AND customer_id = $${countParams.length}`;
    if (min_price) countSql += ` AND price >= $${countParams.length}`;
    if (max_price) countSql += ` AND price <= $${countParams.length}`;
    if (profession) countSql += ` AND profession ILIKE $${countParams.length}`;
    if (job_type) countSql += ` AND job_type ILIKE $${countParams.length}`;
    if (location) countSql += ` AND location ILIKE $${countParams.length}`;

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult[0].total);

    res.json({
      jobs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + jobs.length < total
      }
    });
  } catch (error) {
    console.error('Admin jobs list error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET /api/admin/jobs/:id - Get single job details
router.get('/:id', async (req, res) => {
  try {
    const job = await get('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job });
  } catch (error) {
    console.error('Admin job detail error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

module.exports = router;
