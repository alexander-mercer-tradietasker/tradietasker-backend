#!/usr/bin/env node
/**
 * Migration Runner
 * Run with: node run-migration.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Get DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

// Create PostgreSQL pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const migrationPath = path.join(__dirname, 'migrations', '001-add-admin-features.sql');
  
  console.log('Reading migration file:', migrationPath);
  
  if (!fs.existsSync(migrationPath)) {
    console.error('ERROR: Migration file not found at', migrationPath);
    process.exit(1);
  }
  
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('Connecting to database...');
  const client = await pool.connect();
  
  try {
    console.log('Running migration...');
    await client.query(sql);
    console.log('✓ Migration completed successfully!');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
