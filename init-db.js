#!/usr/bin/env node
/**
 * TradieTasker Database Initialization Script
 * Creates a fresh database with complete schema and seed data
 * 
 * Usage:
 *   node init-db.js [database_path]
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Configuration
const DB_PATH = process.argv[2] || path.join(__dirname, 'db', 'tradietasker.db');
const SCHEMA_FILE = path.join(__dirname, 'db', 'schema.sql');
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

// Ensure database directory exists
function ensureDbDirectory() {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    log(`✓ Created database directory: ${dbDir}`, 'green');
  }
}

// Read and execute SQL file
function executeSqlFile(db, filePath) {
  return new Promise((resolve, reject) => {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Use exec() which can handle multiple statements
    db.exec(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
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

// Main initialization function
async function initializeDatabase() {
  log('\n========================================', 'cyan');
  log('TradieTasker Database Initialization', 'cyan');
  log('Fresh Database Setup', 'cyan');
  log('========================================\n', 'cyan');
  
  ensureDbDirectory();
  
  // Delete existing database if it exists
  if (fs.existsSync(DB_PATH)) {
    log(`⚠️  Removing existing database: ${DB_PATH}`, 'yellow');
    fs.unlinkSync(DB_PATH);
  }
  
  log(`📂 Creating new database: ${DB_PATH}`, 'blue');
  
  const db = new sqlite3.Database(DB_PATH);
  
  try {
    // Enable foreign keys
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    log('✓ Connected to database\n', 'green');
    
    // Apply schema
    log('📝 Creating schema...', 'blue');
    log(`  → schema.sql`, 'cyan');
    
    await executeSqlFile(db, SCHEMA_FILE);
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
          await executeSqlFile(db, seedFile);
          log(`  ✓ Applied ${fileName}`, 'green');
        } catch (err) {
          log(`  ✗ Error in ${fileName}: ${err.message}`, 'red');
          throw err;
        }
      }
    }
    
    // Verify data
    log('\n📊 Verification:', 'blue');
    
    const counts = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          (SELECT COUNT(*) FROM professions) as professions_count,
          (SELECT COUNT(*) FROM job_types) as job_types_count,
          (SELECT COUNT(*) FROM users) as users_count,
          (SELECT COUNT(*) FROM jobs) as jobs_count
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    log(`  Professions: ${counts.professions_count}`, 'cyan');
    log(`  Job Types: ${counts.job_types_count}`, 'cyan');
    log(`  Users: ${counts.users_count}`, 'cyan');
    log(`  Jobs: ${counts.jobs_count}`, 'cyan');
    
    log('\n========================================', 'green');
    log('✓ Database Initialized Successfully!', 'green');
    log('========================================\n', 'green');
    
    log('Next steps:', 'blue');
    log('  1. Run: npm test (to verify schema)', 'cyan');
    log('  2. Start backend server', 'cyan');
    log('  3. Test API endpoints\n', 'cyan');
    
  } catch (err) {
    log('\n========================================', 'red');
    log('✗ Initialization Failed', 'red');
    log('========================================', 'red');
    log(`\nError: ${err.message}\n`, 'red');
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run initialization
initializeDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
