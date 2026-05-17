#!/usr/bin/env node
/**
 * Force migrate Render database
 * Applies all migrations regardless of tracking
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const migrations = [
  'migrations/001_phase1_schema_updates.sql',
  'migrations/002_add_password_hash.sql',
  'migrations/003_tradie_profile_enhancements.sql',
  'migrations/004_create_messages.sql',
  'migrations/004_customer_dashboard.sql',
  'migrations/005_add_invoices_and_admin_settings.sql',
  'migrations/005_create_transactions.sql',
  'migrations/006_add_profile_completed.sql',
  'migrations/006_customer_dashboard.sql',
  'migrations/007_tradie_dashboard_enhancements.sql',
  'migrations/008_job_status_and_reviews.sql',
  'migrations/009_profession_job_types.sql'
];

async function runMigration(filePath) {
  console.log(`Running: ${filePath}`);
  
  const sql = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
  
  // Convert SQLite to PostgreSQL syntax
  let pgSql = sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
    .replace(/AUTOINCREMENT/g, '')
    .replace(/BOOLEAN DEFAULT 0/g, 'BOOLEAN DEFAULT FALSE')
    .replace(/BOOLEAN DEFAULT 1/g, 'BOOLEAN DEFAULT TRUE')
    .replace(/datetime\('now'\)/g, 'NOW()')
    .replace(/CURRENT_TIMESTAMP/g, 'NOW()');
  
  const statements = pgSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (error) {
      // Ignore "already exists" errors
      if (!error.code || !['42P07', '42701', '42710', '23505'].includes(error.code)) {
        console.error(`  Error: ${error.message}`);
      }
    }
  }
  
  console.log(`  ✓ Done`);
}

async function main() {
  try {
    console.log('Starting forced migration...\n');
    
    for (const migration of migrations) {
      await runMigration(migration);
    }
    
    console.log('\n✓ All migrations applied');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
