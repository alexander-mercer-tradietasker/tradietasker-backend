#!/usr/bin/env node
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initPostgres() {
  console.log('Initializing PostgreSQL database...');
  
  try {
    // Read schema
    const schemaFile = path.join(__dirname, 'db', 'schema-postgres.sql');
    const schema = fs.readFileSync(schemaFile, 'utf8');
    
    console.log('Creating schema...');
    await pool.query(schema);
    
    // Read and execute seed files
    const seedsDir = path.join(__dirname, 'seeds');
    const seedFiles = fs.readdirSync(seedsDir)
      .filter(f => f.endsWith('_pg.sql'))
      .sort();
    
    for (const file of seedFiles) {
      console.log(`Seeding ${file}...`);
      const seedSql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
      await pool.query(seedSql);
    }
    
    console.log('✓ PostgreSQL database initialized');
    process.exit(0);
  } catch (error) {
    console.error('✗ Failed to initialize database:', error);
    process.exit(1);
  }
}

if (process.env.DATABASE_URL) {
  initPostgres();
} else {
  console.log('DATABASE_URL not set, skipping PostgreSQL init');
  process.exit(0);
}
