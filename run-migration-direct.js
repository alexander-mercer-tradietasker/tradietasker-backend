#!/usr/bin/env node
const { Pool } = require('pg');

const migrationSQL = `
-- Migration 006: Customer Dashboard Core Features
-- Add assigned_tradie_id, notification_prefs, marketing_prefs, and profile_photo columns

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

-- profile_photo_url should already exist, but ensure it's there
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

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not set');
    console.log('\n💡 Run this with: railway run node run-migration-direct.js');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Running Customer Dashboard migration...');
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully');
    
    // Verify
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

    console.log('\n✓ Columns verified:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
