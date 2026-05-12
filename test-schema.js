#!/usr/bin/env node
/**
 * TradieTasker Schema Test Script
 * Verifies all tables and columns exist after migration
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.argv[2] || path.join(__dirname, 'db', 'tradietasker.db');

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

// Expected tables
const expectedTables = [
  'users',
  'professions',
  'job_types',
  'user_professions',
  'user_job_types',
  'user_qualifications',
  'subscriptions',
  'jobs',
  'applications',
  'contact_transactions',
  'reviews',
  'poster_packages'
];

// Expected new columns in users table
const expectedUserColumns = [
  'date_of_birth',
  'phone',
  'residential_address',
  'abn',
  'business_name',
  'tier',
  'credits',
  'service_radius_km'
];

// Expected new columns in jobs table
const expectedJobColumns = [
  'job_type_id',
  'short_description',
  'full_description',
  'status',
  'photos',
  'is_god_tier'
];

async function testSchema() {
  log('\n========================================', 'cyan');
  log('TradieTasker Schema Test', 'cyan');
  log('========================================\n', 'cyan');
  
  log(`📂 Database: ${DB_PATH}`, 'blue');
  
  const db = new sqlite3.Database(DB_PATH);
  
  try {
    // Test 1: Check all tables exist
    log('\n1️⃣  Testing table existence...', 'blue');
    
    const tables = await new Promise((resolve, reject) => {
      db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        ORDER BY name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.name));
      });
    });
    
    let allTablesExist = true;
    for (const tableName of expectedTables) {
      if (tables.includes(tableName)) {
        log(`  ✓ ${tableName}`, 'green');
      } else {
        log(`  ✗ ${tableName} - MISSING`, 'red');
        allTablesExist = false;
      }
    }
    
    if (!allTablesExist) {
      throw new Error('Some tables are missing');
    }
    
    // Test 2: Check users table has new columns
    log('\n2️⃣  Testing users table columns...', 'blue');
    
    const userColumns = await new Promise((resolve, reject) => {
      db.all(`PRAGMA table_info(users)`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.name));
      });
    });
    
    let allUserColumnsExist = true;
    for (const colName of expectedUserColumns) {
      if (userColumns.includes(colName)) {
        log(`  ✓ ${colName}`, 'green');
      } else {
        log(`  ✗ ${colName} - MISSING`, 'red');
        allUserColumnsExist = false;
      }
    }
    
    if (!allUserColumnsExist) {
      throw new Error('Some user columns are missing');
    }
    
    // Test 3: Check jobs table has new columns
    log('\n3️⃣  Testing jobs table columns...', 'blue');
    
    const jobColumns = await new Promise((resolve, reject) => {
      db.all(`PRAGMA table_info(jobs)`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.name));
      });
    });
    
    let allJobColumnsExist = true;
    for (const colName of expectedJobColumns) {
      if (jobColumns.includes(colName)) {
        log(`  ✓ ${colName}`, 'green');
      } else {
        log(`  ✗ ${colName} - MISSING`, 'red');
        allJobColumnsExist = false;
      }
    }
    
    if (!allJobColumnsExist) {
      throw new Error('Some job columns are missing');
    }
    
    // Test 4: Check seed data
    log('\n4️⃣  Testing seed data...', 'blue');
    
    const counts = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          (SELECT COUNT(*) FROM professions) as professions,
          (SELECT COUNT(*) FROM job_types) as job_types
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (counts.professions >= 70) {
      log(`  ✓ Professions: ${counts.professions} (expected 70)`, 'green');
    } else {
      log(`  ✗ Professions: ${counts.professions} (expected 70)`, 'red');
      throw new Error('Not enough professions seeded');
    }
    
    if (counts.job_types >= 100) {
      log(`  ✓ Job Types: ${counts.job_types} (expected 100)`, 'green');
    } else {
      log(`  ✗ Job Types: ${counts.job_types} (expected 100)`, 'red');
      throw new Error('Not enough job types seeded');
    }
    
    // Test 5: Sample queries
    log('\n5️⃣  Testing sample queries...', 'blue');
    
    // Get professions by category
    const coreTrades = await new Promise((resolve, reject) => {
      db.all(`
        SELECT name FROM professions 
        WHERE category = 'core-trades' 
        LIMIT 5
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    log(`  ✓ Core trades query: ${coreTrades.length} results`, 'green');
    coreTrades.forEach(p => {
      log(`    - ${p.name}`, 'cyan');
    });
    
    // Get job types by category
    const buildingJobs = await new Promise((resolve, reject) => {
      db.all(`
        SELECT name FROM job_types 
        WHERE category = 'building-construction' 
        LIMIT 5
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    log(`  ✓ Building jobs query: ${buildingJobs.length} results`, 'green');
    buildingJobs.forEach(j => {
      log(`    - ${j.name}`, 'cyan');
    });
    
    log('\n========================================', 'green');
    log('✓ All Tests Passed!', 'green');
    log('========================================\n', 'green');
    
    log('Schema Summary:', 'blue');
    log(`  Tables: ${tables.length}`, 'cyan');
    log(`  Professions: ${counts.professions}`, 'cyan');
    log(`  Job Types: ${counts.job_types}`, 'cyan');
    log('\nPhase 1 Complete! ✨\n', 'green');
    
  } catch (err) {
    log('\n========================================', 'red');
    log('✗ Tests Failed', 'red');
    log('========================================', 'red');
    log(`\nError: ${err.message}\n`, 'red');
    process.exit(1);
  } finally {
    db.close();
  }
}

testSchema().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
