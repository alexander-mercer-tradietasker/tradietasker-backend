#!/usr/bin/env node
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function executeSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Split by semicolons, filter empty statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    if (statement) {
      await pool.query(statement);
    }
  }
}

async function initPostgres() {
  console.log('Initializing PostgreSQL database...');
  
  try {
    // Create schema
    const schemaFile = path.join(__dirname, 'db', 'schema-postgres.sql');
    console.log('Creating schema from', schemaFile);
    await executeSqlFile(schemaFile);
    console.log('✓ Schema created');
    
    // Run seed files
    const seedsDir = path.join(__dirname, 'seeds');
    const seedFiles = fs.readdirSync(seedsDir)
      .filter(f => f.endsWith('_pg.sql'))
      .sort();
    
    console.log(`Found ${seedFiles.length} seed files`);
    
    for (const file of seedFiles) {
      console.log(`Seeding ${file}...`);
      const seedPath = path.join(seedsDir, file);
      await executeSqlFile(seedPath);
      console.log(`✓ ${file} complete`);
    }
    
    // Verify job_types populated
    const result = await pool.query('SELECT COUNT(*) FROM job_types');
    console.log(`✓ Database initialized. Job types count: ${result.rows[0].count}`);
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Failed to initialize database:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

if (process.env.DATABASE_URL) {
  initPostgres();
} else {
  console.log('DATABASE_URL not set, skipping PostgreSQL init');
  process.exit(0);
}
