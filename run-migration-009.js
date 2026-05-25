#!/usr/bin/env node

/**
 * Run migration 009 - Add is_god_tier to users table
 * 
 * Usage:
 *   node run-migration-009.js
 * 
 * Environment:
 *   DATABASE_URL - Full Postgres connection string
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  // Use DATABASE_URL from environment (Render sets this automatically)
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  console.log('🔗 Connecting to database...');
  const pool = new Pool({ connectionString });

  try {
    const migrationFile = path.join(__dirname, 'migrations', '009_add_is_god_tier_to_users.sql');
    console.log(`📄 Reading migration: ${migrationFile}`);
    
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('⏳ Running migration 009...');
    await pool.query(sql);
    
    console.log('✅ Migration 009 completed successfully!');
    console.log('');
    console.log('Changes applied:');
    console.log('  • Added is_god_tier BOOLEAN column to users table');
    console.log('  • Created index on is_god_tier');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
