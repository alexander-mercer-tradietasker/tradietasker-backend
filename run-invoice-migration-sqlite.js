const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'db', 'tradietasker.db');
  
  console.log(`Running invoice system migration on SQLite database: ${dbPath}`);

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Failed to connect to database:', err);
      process.exit(1);
    }
  });

  return new Promise((resolve, reject) => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) {
        console.error('Failed to enable foreign keys:', err);
        reject(err);
        return;
      }

      // Read migration file
      const migrationPath = path.join(__dirname, 'migrations', '006_invoices_sqlite.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      // Execute migration
      db.exec(migrationSQL, (err) => {
        if (err) {
          console.error('Migration error:', err);
          reject(err);
          return;
        }

        console.log('✅ Invoice migration completed successfully!');

        // Verify tables were created
        db.all(`
          SELECT name FROM sqlite_master 
          WHERE type='table' 
          AND name IN ('invoices', 'admin_settings')
          ORDER BY name
        `, (err, rows) => {
          if (err) {
            console.error('Verification error:', err);
            reject(err);
            return;
          }

          console.log('\nCreated tables:');
          rows.forEach(row => {
            console.log(`  - ${row.name}`);
          });

          // Check admin_settings data
          db.all('SELECT * FROM admin_settings', (err, settings) => {
            if (err) {
              console.error('Settings check error:', err);
              reject(err);
              return;
            }

            console.log('\nAdmin settings:');
            settings.forEach(row => {
              console.log(`  - ${row.key}: ${row.value}`);
            });

            db.close((err) => {
              if (err) {
                console.error('Failed to close database:', err);
                reject(err);
              } else {
                resolve();
              }
            });
          });
        });
      });
    });
  });
}

runMigration().catch(err => {
  console.error('Failed to run migration:', err);
  process.exit(1);
});
