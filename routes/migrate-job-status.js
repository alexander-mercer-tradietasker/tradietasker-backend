const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const router = express.Router();

// POST /api/migrate/job-status - Apply job status and reviews migration
router.post('/', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(400).json({ error: 'PostgreSQL DATABASE_URL not configured' });
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Applying job status and reviews migration...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '008_job_status_and_reviews.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    // Apply migration
    await pool.query(migration);
    
    // Verify tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('jobs', 'reviews')
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    // Check for assigned_tradie_id column
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' AND column_name = 'assigned_tradie_id'
    `);
    
    const hasAssignedTradieColumn = columnsResult.rows.length > 0;
    
    // Check reviews table structure
    const reviewsColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reviews'
      ORDER BY ordinal_position
    `);
    
    await pool.end();
    
    res.json({
      success: true,
      message: 'Migration applied successfully',
      tables,
      assigned_tradie_id_exists: hasAssignedTradieColumn,
      reviews_columns: reviewsColumns.rows.map(row => ({
        name: row.column_name,
        type: row.data_type
      }))
    });
  } catch (error) {
    console.error('Migration error:', error);
    await pool.end();
    res.status(500).json({ 
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
