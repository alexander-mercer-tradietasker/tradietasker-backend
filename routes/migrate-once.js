const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

// GET /api/migrate-once - Run migration once (temporary endpoint)
router.get('/', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ error: 'No DATABASE_URL configured' });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const migrationSQL = `
-- Add assigned_tradie_id to jobs table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'assigned_tradie_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assigned_tradie_id INTEGER;
    ALTER TABLE jobs ADD CONSTRAINT fk_assigned_tradie 
      FOREIGN KEY (assigned_tradie_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add notification and marketing preferences to users table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'notification_prefs'
  ) THEN
    ALTER TABLE users ADD COLUMN notification_prefs JSON DEFAULT '{"email": true, "sms": false}'::json;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'marketing_prefs'
  ) THEN
    ALTER TABLE users ADD COLUMN marketing_prefs JSON DEFAULT '{"emails": false}'::json;
  END IF;
END $$;

-- Ensure profile_photo_url exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'profile_photo_url'
  ) THEN
    ALTER TABLE users ADD COLUMN profile_photo_url TEXT;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_tradie ON jobs(assigned_tradie_id);
CREATE INDEX IF NOT EXISTS idx_jobs_poster_status ON jobs(poster_id, status);
`;

    await pool.query(migrationSQL);
    
    // Verify columns
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' AND column_name = 'assigned_tradie_id'
      UNION ALL
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('notification_prefs', 'marketing_prefs', 'profile_photo_url')
      ORDER BY column_name
    `);

    await pool.end();

    res.json({
      message: 'Migration completed successfully',
      columns_added: result.rows,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      error: 'Migration failed',
      message: error.message
    });
  }
});

module.exports = router;
