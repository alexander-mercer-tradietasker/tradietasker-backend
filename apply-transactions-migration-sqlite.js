require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'db', 'tradietasker.db');

function applyMigration() {
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Failed to connect to database:', err);
      process.exit(1);
    }
    console.log('Connected to SQLite database at:', dbPath);
  });

  db.serialize(() => {
    console.log('Reading migration file...');
    let migration = fs.readFileSync(
      path.join(__dirname, 'migrations', '005_create_transactions.sql'),
      'utf8'
    );
    
    // Convert PostgreSQL syntax to SQLite
    migration = migration
      .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/VARCHAR\(\d+\)/g, 'TEXT')
      .replace(/DECIMAL\(\d+,\d+\)/g, 'REAL')
      .replace(/DEFAULT NOW\(\)/g, "DEFAULT (datetime('now'))")
      .replace(/TIMESTAMP/g, 'TEXT');
    
    console.log('Applying migration...');
    
    db.exec(migration, (err) => {
      if (err) {
        console.error('Error applying migration:', err);
        process.exit(1);
      }
      
      console.log('✓ Migration applied successfully');
      
      // Verify table exists
      db.all(`PRAGMA table_info(transactions)`, (err, rows) => {
        if (err) {
          console.error('Error checking table:', err);
        } else {
          console.log('\nTransactions table schema:');
          rows.forEach(col => {
            console.log(`  ${col.name}: ${col.type}`);
          });
        }
        
        db.close();
      });
    });
  });
}

applyMigration();
