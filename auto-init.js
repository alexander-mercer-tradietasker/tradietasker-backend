const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Auto-initialization module for TradieTasker backend
// Uses migration tracking to safely apply only new migrations
// NEVER drops or truncates tables - preserves all existing data

const MIGRATION_FILES = [
  { name: '001_phase1_schema_updates.sql', file: 'migrations/001_phase1_schema_updates.sql' },
  { name: '002_add_password_hash.sql', file: 'migrations/002_add_password_hash.sql' },
  { name: '003_tradie_profile_enhancements.sql', file: 'migrations/003_tradie_profile_enhancements.sql' },
  { name: '004_create_messages.sql', file: 'migrations/004_create_messages.sql' },
  { name: '004_customer_dashboard.sql', file: 'migrations/004_customer_dashboard.sql' },
  { name: '005_add_invoices_and_admin_settings.sql', file: 'migrations/005_add_invoices_and_admin_settings.sql' },
  { name: '005_create_transactions.sql', file: 'migrations/005_create_transactions.sql' },
  { name: '006_add_profile_completed.sql', file: 'migrations/006_add_profile_completed.sql' },
  { name: '006_customer_dashboard.sql', file: 'migrations/006_customer_dashboard.sql' },
  { name: '007_tradie_dashboard_enhancements.sql', file: 'migrations/007_tradie_dashboard_enhancements.sql' },
  { name: '008_job_status_and_reviews.sql', file: 'migrations/008_job_status_and_reviews.sql' },
  { name: '009_profession_job_types.sql', file: 'migrations/009_profession_job_types.sql' }
];

const SEED_FILES = [
  { name: 'professions', file: 'seeds/002_professions_pg.sql', table: 'professions' },
  { name: 'job_types', file: 'seeds/003_job_types_pg.sql', table: 'job_types' },
  { name: 'profession_job_types_mapping', file: 'seeds/009_profession_job_types_mapping.sql', table: 'profession_job_types' },
  { name: 'dummy_jobs', file: 'seeds/010_dummy_jobs.sql', table: 'jobs' }
];

async function ensureMigrationTable(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Migration tracking table ready');
  } catch (error) {
    console.error('❌ Error creating migration tracking table:', error.message);
    throw error;
  }
}

async function getMigrationsRun(pool) {
  try {
    const result = await pool.query('SELECT migration_name FROM schema_migrations');
    return new Set(result.rows.map(r => r.migration_name));
  } catch (error) {
    console.error('❌ Error reading migrations:', error.message);
    return new Set();
  }
}

async function recordMigration(pool, migrationName) {
  try {
    await pool.query(
      'INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
      [migrationName]
    );
  } catch (error) {
    console.error(`⚠️  Warning: Could not record migration ${migrationName}:`, error.message);
  }
}

async function tableHasRows(pool, tableName) {
  try {
    const result = await pool.query(`SELECT EXISTS (SELECT 1 FROM ${tableName} LIMIT 1) as has_rows`);
    return result.rows[0].has_rows;
  } catch (error) {
    // Table might not exist yet
    return false;
  }
}

async function runSqlFile(pool, filePath, migrationName, skipIfExists = false) {
  const absolutePath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(absolutePath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return false;
  }
  
  try {
    const sql = fs.readFileSync(absolutePath, 'utf8');
    
    // Split on semicolons, filter out comments and empty statements
    const statements = sql
      .split(/;(?=\s*(?:--|$|\n))/g)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`   📝 ${migrationName}: ${statements.length} statements`);
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pool.query(statement);
        } catch (error) {
          // If it's an "already exists" error and we're skipping, that's OK
          if (skipIfExists && (
            error.code === '42P07' || // relation already exists
            error.code === '42701' || // column already exists
            error.code === '23505'    // unique violation
          )) {
            console.log(`   ℹ️  Skipping already-applied statement`);
            continue;
          }
          throw error;
        }
      }
    }
    
    console.log(`   ✅ ${migrationName}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error in ${migrationName}:`, error.message);
    throw error;
  }
}

async function applyBaseSchema(pool) {
  console.log('📋 Checking base schema...');
  
  // Check if users table exists
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    ) as exists
  `);
  
  if (result.rows[0].exists) {
    console.log('ℹ️  Base schema already exists, skipping');
    return false;
  }
  
  const schemaPath = path.join(__dirname, 'db/schema-postgres.sql');
  
  if (!fs.existsSync(schemaPath)) {
    console.warn('⚠️  PostgreSQL schema file not found');
    return false;
  }
  
  try {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    
    // Split and execute statements
    const statements = sql
      .split(/;(?=\s*(?:--|$|\n))/g)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`   Executing ${statements.length} base schema statements`);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }
    
    console.log('✅ Base schema applied');
    await recordMigration(pool, 'base_schema');
    return true;
  } catch (error) {
    console.error('❌ Error applying base schema:', error.message);
    throw error;
  }
}

async function applyMigrations(pool) {
  console.log('🔄 Checking migrations...');
  
  const appliedMigrations = await getMigrationsRun(pool);
  let appliedCount = 0;
  let skippedCount = 0;
  
  for (const migration of MIGRATION_FILES) {
    if (appliedMigrations.has(migration.name)) {
      console.log(`   ⏭️  ${migration.name} (already applied)`);
      skippedCount++;
      continue;
    }
    
    await runSqlFile(pool, migration.file, migration.name, true);
    await recordMigration(pool, migration.name);
    appliedCount++;
  }
  
  if (appliedCount > 0) {
    console.log(`✅ Applied ${appliedCount} new migration(s)`);
  }
  if (skippedCount > 0) {
    console.log(`ℹ️  Skipped ${skippedCount} already-applied migration(s)`);
  }
  if (appliedCount === 0 && skippedCount === 0) {
    console.log('ℹ️  No migrations to apply');
  }
}

async function applySeedData(pool) {
  console.log('🌱 Checking seed data...');
  
  let seededCount = 0;
  let skippedCount = 0;
  
  for (const seed of SEED_FILES) {
    const hasRows = await tableHasRows(pool, seed.table);
    
    if (hasRows) {
      console.log(`   ⏭️  ${seed.name} (table ${seed.table} already has data)`);
      skippedCount++;
      continue;
    }
    
    await runSqlFile(pool, seed.file, seed.name);
    seededCount++;
  }
  
  if (seededCount > 0) {
    console.log(`✅ Seeded ${seededCount} table(s)`);
  }
  if (skippedCount > 0) {
    console.log(`ℹ️  Skipped ${skippedCount} table(s) with existing data`);
  }
  if (seededCount === 0 && skippedCount === 0) {
    console.log('ℹ️  No seed data to apply');
  }
}

async function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('ℹ️  No DATABASE_URL found, skipping auto-initialization (SQLite mode)');
    return;
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔍 Starting database auto-initialization...');
    console.log('');
    
    // Create migration tracking table
    await ensureMigrationTable(pool);
    console.log('');
    
    // Apply base schema only if needed
    await applyBaseSchema(pool);
    console.log('');
    
    // Apply pending migrations
    await applyMigrations(pool);
    console.log('');
    
    // Apply seed data only to empty tables
    await applySeedData(pool);
    console.log('');
    
    console.log('🎉 Database initialization complete!');
    console.log('');
    
  } catch (error) {
    console.error('💥 Fatal error during database initialization:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

module.exports = { initializeDatabase };
