#!/usr/bin/env node
/**
 * TradieTasker Database Migration Script
 * Phase 1: Apply schema updates and seed data
 * 
 * Usage:
 *   node migrate.js [database_path]
 * 
 * If no database path provided, uses: ./db/tradietasker.db
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Configuration
const DB_PATH = process.argv[2] || path.join(__dirname, 'db', 'tradietasker.db');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
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
    
    // Split by semicolons but keep transaction blocks together
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let completed = 0;
    
    function runNext() {
      if (completed >= statements.length) {
        resolve();
        return;
      }
      
      const statement = statements[completed];
      completed++;
      
      db.run(statement, (err) => {
        if (err) {
          // Ignore "duplicate column" errors (means migration already applied)
          if (err.message.includes('duplicate column')) {
            log(`  ⚠ Skipping already applied change`, 'yellow');
            runNext();
          } else {
            reject(err);
          }
        } else {
          runNext();
        }
      });
    }
    
    runNext();
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

// Main migration function
async function migrate() {
  log('\n========================================', 'cyan');
  log('TradieTasker Database Migration', 'cyan');
  log('Phase 1: Schema Updates & Seed Data', 'cyan');
  log('========================================\n', 'cyan');
  
  ensureDbDirectory();
  
  log(`📂 Database: ${DB_PATH}`, 'blue');
  
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
    
    // Apply migrations
    log('📝 Applying migrations...', 'blue');
    const migrations = getSqlFiles(MIGRATIONS_DIR);
    
    if (migrations.length === 0) {
      log('  ⚠ No migration files found', 'yellow');
    } else {
      for (const migrationFile of migrations) {
        const fileName = path.basename(migrationFile);
        log(`  → ${fileName}`, 'cyan');
        
        try {
          await executeSqlFile(db, migrationFile);
          log(`  ✓ Applied ${fileName}`, 'green');
        } catch (err) {
          log(`  ✗ Error in ${fileName}: ${err.message}`, 'red');
          throw err;
        }
      }
    }
    
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
    log('✓ Migration Complete!', 'green');
    log('========================================\n', 'green');
    
    log('Next steps:', 'blue');
    log('  1. Test the schema by starting your backend server', 'cyan');
    log('  2. Verify API endpoints work correctly', 'cyan');
    log('  3. Proceed to Phase 2: Backend API Updates\n', 'cyan');
    
  } catch (err) {
    log('\n========================================', 'red');
    log('✗ Migration Failed', 'red');
    log('========================================', 'red');
    log(`\nError: ${err.message}\n`, 'red');
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run migration
migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
