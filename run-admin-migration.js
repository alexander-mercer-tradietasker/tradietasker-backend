#!/usr/bin/env node
/**
 * Run admin features migration - creates tax_rates and other admin tables
 * Safe to run multiple times (uses IF NOT EXISTS)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔄 Running admin features migration...');
    
    const sqlPath = path.join(__dirname, 'migrations', '001-add-admin-features.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.error(`❌ Migration file not found: ${sqlPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the entire migration as one transaction
    console.log('📝 Executing migration SQL...');
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify tax_rates table exists
    const result = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'tax_rates'
    `);
    
    if (result.rows[0].count > 0) {
      console.log('✅ tax_rates table verified');
      
      const taxCount = await pool.query('SELECT COUNT(*) as count FROM tax_rates');
      console.log(`📊 Tax rates count: ${taxCount.rows[0].count}`);
    } else {
      console.error('❌ tax_rates table not found after migration');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
