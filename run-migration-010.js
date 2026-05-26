#!/usr/bin/env node
/**
 * Run Migration 010: Add subscription_tiers table
 * Usage: node run-migration-010.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🚀 Running migration 010: Add subscription_tiers table...');
    
    const migrationPath = path.join(__dirname, 'migrations', '010_add_subscription_tiers.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Migration 010 completed successfully');
    
    // Verify tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('subscription_tiers', 'site_wide_discount')
    `);
    
    console.log(`✅ Created ${tables.rows.length} tables:`);
    tables.rows.forEach(row => {
      console.log(`  • ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
