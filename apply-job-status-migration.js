require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Cannot apply migration to PostgreSQL.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    console.log('Connecting to Railway PostgreSQL...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '008_job_status_and_reviews.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying migration 008_job_status_and_reviews.sql...');
    await pool.query(migration);
    
    console.log('✓ Migration applied successfully');
    
    // Verify tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('jobs', 'reviews')
      ORDER BY table_name
    `);
    
    console.log('\n✓ Tables verified:');
    tablesResult.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Check for assigned_tradie_id column
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' AND column_name = 'assigned_tradie_id'
    `);
    
    if (columnsResult.rows.length > 0) {
      console.log('\n✓ assigned_tradie_id column exists in jobs table');
    } else {
      console.log('\n✗ assigned_tradie_id column NOT found in jobs table');
    }
    
    // Check reviews table structure
    const reviewsColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reviews'
      ORDER BY ordinal_position
    `);
    
    if (reviewsColumns.rows.length > 0) {
      console.log('\n✓ Reviews table columns:');
      reviewsColumns.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
    }
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
