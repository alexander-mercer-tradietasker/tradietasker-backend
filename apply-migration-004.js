#!/usr/bin/env node
/**
 * Apply Migration 004: Customer Dashboard Core Features
 * Run this on Railway or with DATABASE_URL set
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('📦 Applying migration 004...');
    
    const migrationPath = path.join(__dirname, 'migrations', '004_customer_dashboard.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✓ Migration 004 applied successfully');
    console.log('  - Added assigned_tradie_id to jobs table');
    console.log('  - Added notification_prefs, marketing_prefs, profile_photo to users table');
    console.log('  - Set default preferences for existing users');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
