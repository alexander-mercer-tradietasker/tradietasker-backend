#!/usr/bin/env node
/**
 * TradieTasker Database Migration Script - PostgreSQL Version
 * Creates schema and applies seed data to PostgreSQL database
 * 
 * Usage:
 *   DATABASE_URL=postgres://... node migrate-postgres.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const SCHEMA_FILE = path.join(__dirname, 'db', 'schema-postgres.sql');
const SEEDS_DIR = path.join(__dirname, 'seeds');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Execute SQL file
async function executeSqlFile(pool, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Remove SQLite-specific syntax and convert to PostgreSQL
  let pgSql = sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
    .replace(/BOOLEAN DEFAULT 0/g, 'BOOLEAN DEFAULT FALSE')
    .replace(/BOOLEAN DEFAULT 1/g, 'BOOLEAN DEFAULT TRUE')
    .replace(/CURRENT_TIMESTAMP/g, 'CURRENT_TIMESTAMP');
  
  // Split into statements but be careful with CREATE INDEX IF NOT EXISTS
  const statements = pgSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await pool.query(statement);
      } catch (err) {
        // Ignore duplicate errors
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }
    }
  }
}

// Get list of SQL files in directory
function getSqlFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  
  return fs.readdirSync(directory)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => path.join(directory, f));
}

// Main migration function
async function migrate() {
  log('\n========================================', 'cyan');
  log('TradieTasker PostgreSQL Migration', 'cyan');
  log('Schema Creation & Seed Data', 'cyan');
  log('========================================\n', 'cyan');
  
  if (!DATABASE_URL) {
    log('✗ DATABASE_URL environment variable not set', 'red');
    log('\nPlease set DATABASE_URL to your PostgreSQL connection string:', 'yellow');
    log('  DATABASE_URL=postgres://user:pass@host:5432/dbname node migrate-postgres.js\n', 'cyan');
    process.exit(1);
  }
  
  log(`📂 Connecting to PostgreSQL...`, 'blue');
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    log('✓ Connected to PostgreSQL database\n', 'green');
    
    // Apply schema
    log('📝 Creating schema...', 'blue');
    log(`  → schema-postgres.sql`, 'cyan');
    
    await executeSqlFile(pool, SCHEMA_FILE);
    log(`  ✓ Schema created`, 'green');
    
    log('');
    
    // Apply seed data
    log('🌱 Applying seed data...', 'blue');
    const seeds = getSqlFiles(SEEDS_DIR);
    
    if (seeds.length === 0) {
      log('  ⚠ No seed files found', 'yellow');
    } else {
      for (const seedFile of seeds) {
        const fileName = path.basename(seedFile);
        log(`  → ${fileName}`, 'cyan');
        
        try {
          await executeSqlFile(pool, seedFile);
          log(`  ✓ Applied ${fileName}`, 'green');
        } catch (err) {
          log(`  ✗ Error in ${fileName}: ${err.message}`, 'red');
          throw err;
        }
      }
    }
    
    // Verify data
    log('\n📊 Verification:', 'blue');
    
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM professions) as professions_count,
        (SELECT COUNT(*) FROM job_types) as job_types_count,
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM jobs) as jobs_count
    `);
    
    const counts = result.rows[0];
    
    log(`  Professions: ${counts.professions_count}`, 'cyan');
    log(`  Job Types: ${counts.job_types_count}`, 'cyan');
    log(`  Users: ${counts.users_count}`, 'cyan');
    log(`  Jobs: ${counts.jobs_count}`, 'cyan');
    
    log('\n========================================', 'green');
    log('✓ PostgreSQL Migration Complete!', 'green');
    log('========================================\n', 'green');
    
    log('Next steps:', 'blue');
    log('  1. Test the backend API endpoints', 'cyan');
    log('  2. Deploy to Railway', 'cyan');
    log('  3. Verify data persistence\n', 'cyan');
    
  } catch (err) {
    log('\n========================================', 'red');
    log('✗ Migration Failed', 'red');
    log('========================================', 'red');
    log(`\nError: ${err.message}\n`, 'red');
    if (err.stack) {
      log(`Stack: ${err.stack}\n`, 'red');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
