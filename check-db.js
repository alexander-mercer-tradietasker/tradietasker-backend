#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const usePostgres = !!process.env.DATABASE_URL;

console.log('='.repeat(80));
console.log('Database Check');
console.log('='.repeat(80));
console.log(`Database type: ${usePostgres ? 'PostgreSQL' : 'SQLite'}`);
console.log(`DATABASE_URL set: ${!!process.env.DATABASE_URL}`);

if (usePostgres) {
  console.log('\nUsing PostgreSQL - will initialize on first query if needed');
  console.log('Running PostgreSQL initialization...');
  
  const { initializeDatabase } = require('./init-postgres');
  
  initializeDatabase()
    .then(() => {
      console.log('✓ PostgreSQL ready\n');
      console.log('='.repeat(80) + '\n');
    })
    .catch(error => {
      console.error('✗ PostgreSQL initialization failed:', error.message);
      console.error('Server will start but database may not be ready');
      console.log('='.repeat(80) + '\n');
    });
} else {
  const { execSync } = require('child_process');
  const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'db', 'tradietasker.db');
  const dbDir = path.dirname(DB_PATH);
  
  console.log(`Database path: ${DB_PATH}`);
  console.log(`Database exists: ${fs.existsSync(DB_PATH)}`);
  
  if (!fs.existsSync(DB_PATH)) {
    console.log('\n⚠️  Database not found. Initializing...');
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log('✓ Created database directory');
    }
    
    try {
      execSync('node init-db.js', { stdio: 'inherit' });
      console.log('✓ Database initialized');
      
      execSync('node seed-expanded-test-data.js', { stdio: 'inherit' });
      console.log('✓ Test data seeded');
    } catch (error) {
      console.error('✗ Initialization failed:', error.message);
      process.exit(1);
    }
  } else {
    console.log('✓ SQLite database exists');
  }
  
  console.log('='.repeat(80) + '\n');
}
