const express = require('express');
const { query } = require('../db/connection');

const router = express.Router();

// GET /api/professions - List all professions
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;

    let sql = 'SELECT * FROM professions';
    const params = [];

    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }

    sql += ' ORDER BY name';

    const professions = await query(sql, params);

    res.json({ professions });
  } catch (error) {
    console.error('Get professions error:', error);
    res.status(500).json({ error: 'Failed to get professions' });
  }
});

// GET /api/professions/categories - List profession categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await query(
      'SELECT DISTINCT category FROM professions ORDER BY category'
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
