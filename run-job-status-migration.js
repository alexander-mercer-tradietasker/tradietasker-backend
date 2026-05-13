// Run this with: railway run node run-job-status-migration.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('✓ Connected');
    
    // Read migration
    const migrationPath = path.join(__dirname, 'migrations', '008_job_status_and_reviews.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying migration...');
    await client.query(migration);
    console.log('✓ Migration applied');
    
    // Verify
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' AND column_name = 'assigned_tradie_id'
    `);
    
    if (result.rows.length > 0) {
      console.log('✓ assigned_tradie_id column exists');
    } else {
      console.log('✗ assigned_tradie_id column NOT found');
    }
    
    const reviewsResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'reviews'
    `);
    
    if (parseInt(reviewsResult.rows[0].count) > 0) {
      console.log('✓ reviews table exists');
    } else {
      console.log('✗ reviews table NOT found');
    }
    
    client.release();
    console.log('\n✓ Migration completed successfully');
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
