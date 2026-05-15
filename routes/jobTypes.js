const express = require('express');
const { query } = require('../db/connection');

const router = express.Router();

// GET /api/job-types - List all job types
// Query params:
//   - category: filter by job type category
//   - professionIds: comma-separated list of profession IDs to filter by
router.get('/', async (req, res) => {
  try {
    const { category, professionIds } = req.query;

    let sql = 'SELECT DISTINCT jt.* FROM job_types jt';
    const params = [];
    const whereClauses = [];

    // If professionIds provided, join with profession_job_types
    if (professionIds) {
      const ids = professionIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      
      if (ids.length > 0) {
        sql = `
          SELECT DISTINCT jt.*
          FROM job_types jt
          INNER JOIN profession_job_types pjt ON jt.id = pjt.job_type_id
          WHERE pjt.profession_id IN (${ids.map(() => '?').join(',')})
        `;
        params.push(...ids);

        if (category) {
          sql += ' AND jt.category = ?';
          params.push(category);
        }
      }
    } else {
      // No profession filter, just get all job types
      if (category) {
        whereClauses.push('category = ?');
        params.push(category);
      }

      if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
      }
    }

    sql += ' ORDER BY jt.name';

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
