const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Auto-initialization module for TradieTasker backend
// Automatically sets up database schema and seeds on first run

const MIGRATION_FILES = [
  'migrations/001_phase1_schema_updates.sql',
  'migrations/002_add_password_hash.sql',
  'migrations/003_tradie_profile_enhancements.sql',
  'migrations/004_create_messages.sql',
  'migrations/004_customer_dashboard.sql',
  'migrations/005_add_invoices_and_admin_settings.sql',
  'migrations/005_create_transactions.sql',
  'migrations/006_add_profile_completed.sql',
  'migrations/006_customer_dashboard.sql',
  'migrations/007_tradie_dashboard_enhancements.sql',
  'migrations/008_job_status_and_reviews.sql',
  'migrations/009_profession_job_types.sql'
];

const SEED_FILES = [
  'seeds/002_professions_pg.sql',
  'seeds/003_job_types_pg.sql',
  'seeds/009_profession_job_types_mapping.sql',
  'seeds/010_dummy_jobs.sql'
];

async function isDatabaseEmpty(pool) {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'pg_%'
        AND table_name != 'sql_features'
        AND table_name != 'sql_implementation_info'
        AND table_name != 'sql_parts'
        AND table_name != 'sql_sizing'
    `);
    
    const tableCount = parseInt(result.rows[0].count);
    console.log(`📊 Found ${tableCount} user tables in database`);
    return tableCount === 0;
  } catch (error) {
    console.error('❌ Error checking database state:', error.message);
    return false;
  }
}

async function runSqlFile(pool, filePath) {
  const absolutePath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(absolutePath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return false;
  }
  
  try {
    const sql = fs.readFileSync(absolutePath, 'utf8');
    
    // Split on semicolons but be careful with function definitions
    const statements = sql
      .split(/;(?=\s*(?:--|$|\n))/g)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`   Running ${statements.length} statements from ${filePath}`);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }
    
    console.log(`✅ Completed: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error running ${filePath}:`, error.message);
    throw error;
  }
}

async function applyBaseSchema(pool) {
  console.log('📋 Applying base schema...');
  const schemaPath = path.join(__dirname, 'db/schema-postgres.sql');
  
  if (!fs.existsSync(schemaPath)) {
    console.warn('⚠️  PostgreSQL schema file not found, skipping base schema');
    return false;
  }
  
  try {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    
    // Convert SQLite syntax to PostgreSQL if needed
    const pgSql = sql
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
      .replace(/AUTOINCREMENT/g, '')
      .replace(/BOOLEAN DEFAULT 0/g, 'BOOLEAN DEFAULT FALSE')
      .replace(/BOOLEAN DEFAULT 1/g, 'BOOLEAN DEFAULT TRUE');
    
    // Split and execute statements
    const statements = pgSql
      .split(/;(?=\s*(?:--|$|\n))/g)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }
    
    console.log('✅ Base schema applied');
    return true;
  } catch (error) {
    console.error('❌ Error applying base schema:', error.message);
    throw error;
  }
}

async function applyMigrations(pool) {
  console.log('🔄 Applying migrations...');
  
  for (const file of MIGRATION_FILES) {
    await runSqlFile(pool, file);
  }
  
  console.log('✅ All migrations applied');
}

async function applySeedData(pool) {
  console.log('🌱 Applying seed data...');
  
  for (const file of SEED_FILES) {
    await runSqlFile(pool, file);
  }
  
  console.log('✅ All seed data applied');
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
    console.log('🔍 Checking database state...');
    const isEmpty = await isDatabaseEmpty(pool);
    
    if (!isEmpty) {
      console.log('ℹ️  Database already initialized, skipping auto-migration');
      await pool.end();
      return;
    }
    
    console.log('🚀 Database is empty, starting auto-initialization...');
    console.log('');
    
    // Apply base schema first
    await applyBaseSchema(pool);
    console.log('');
    
    // Apply migrations
    await applyMigrations(pool);
    console.log('');
    
    // Apply seed data
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
