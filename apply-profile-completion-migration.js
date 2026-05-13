#!/usr/bin/env node
/**
 * Apply Profile Completion Migration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function applyMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Applying profile_completed migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '006_add_profile_completed.sql'),
      'utf8'
    );
    
    await client.query(migrationSQL);
    console.log('✓ Migration applied successfully');
    
    // Verify the column exists
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'profile_completed'
    `);
    
    if (result.rows.length > 0) {
      console.log('✓ profile_completed column verified:', result.rows[0]);
    } else {
      console.error('✗ profile_completed column not found!');
    }
    
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch(console.error);
