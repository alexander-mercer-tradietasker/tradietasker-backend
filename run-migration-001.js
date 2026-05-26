#!/usr/bin/env node
/**
 * Run migration 001-add-admin-features.sql on Render PostgreSQL
 * This creates the missing tax_rates, tiers, site_settings, and other admin tables
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Starting migration 001-add-admin-features.sql...');
    
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations', '001-add-admin-features.sql'),
      'utf8'
    );

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (!statement) continue;
      console.log('Executing:', statement.substring(0, 80) + '...');
      await pool.query(statement);
    }

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
