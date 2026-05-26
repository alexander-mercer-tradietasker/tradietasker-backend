const express = require('express');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Super secret token (change this after running migration once!)
const MIGRATION_SECRET = process.env.MIGRATION_SECRET || 'temp-secret-change-me-12345';

// POST /api/migrate-admin - Run admin features migration
router.post('/', async (req, res) => {
  const { secret } = req.body;
  
  if (secret !== MIGRATION_SECRET) {
    return res.status(403).json({ error: 'Invalid secret' });
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Starting admin migration...');
    
    const sqlPath = path.join(__dirname, '..', 'migrations', '001-add-admin-features.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sql);
    
    // Verify
    const result = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'tax_rates'
    `);
    
    const taxCount = await pool.query('SELECT COUNT(*) as count FROM tax_rates');
    
    res.json({
      success: true,
      tax_rates_table_exists: result.rows[0].count > 0,
      tax_rates_count: taxCount.rows[0].count
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  } finally {
    await pool.end();
  }
});

module.exports = router;
