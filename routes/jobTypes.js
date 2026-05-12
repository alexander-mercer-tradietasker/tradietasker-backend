const express = require('express');
const { query } = require('../db/connection');

const router = express.Router();

// GET /api/job-types - List all job types
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;

    let sql = 'SELECT * FROM job_types';
    const params = [];

    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }

    sql += ' ORDER BY name';

    const jobTypes = await query(sql, params);

    res.json({ jobTypes });
  } catch (error) {
    console.error('Get job types error:', error);
    res.status(500).json({ error: 'Failed to get job types' });
  }
});

// GET /api/job-types/categories - List job type categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await query(
      'SELECT DISTINCT category FROM job_types ORDER BY category'
    );

    res.json({ 
      categories: categories.map(c => c.category) 
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

module.exports = router;
