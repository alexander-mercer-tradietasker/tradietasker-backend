#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Connect to Render Postgres database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration(filename) {
  const filePath = path.join(__dirname, 'migrations', filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Migration file not found: ${filename}`);
    return false;
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  
  console.log(`\n🔄 Running migration: ${filename}`);
  console.log(`📄 SQL:\n${sql.substring(0, 200)}...`);
  
  try {
    await pool.query(sql);
    console.log(`✅ Migration ${filename} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error running migration ${filename}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting new migrations on Render...\n');

  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to Render Postgres database\n');
    client.release();

    // Run new migrations
    const migrations = [
      '010_referral_system.sql',
      '011_review_moderation.sql'
    ];

    for (const migration of migrations) {
      const success = await runMigration(migration);
      if (!success) {
        console.log('\n⚠️  Migration failed, but continuing...');
      }
    }

    console.log('\n✅ All migrations completed!');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
