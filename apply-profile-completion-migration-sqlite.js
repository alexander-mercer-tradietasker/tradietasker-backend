#!/usr/bin/env node
/**
 * Apply Profile Completion Migration to SQLite
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'db', 'tradietasker.db');
const db = new sqlite3.Database(dbPath);

async function applyMigration() {
  return new Promise((resolve, reject) => {
    console.log('Applying profile_completed migration to SQLite...');
    console.log('Database path:', dbPath);
    
    db.serialize(() => {
      // Check if column already exists
      db.all("PRAGMA table_info(users)", (err, columns) => {
        if (err) {
          console.error('Error checking columns:', err);
          reject(err);
          return;
        }
        
        const hasColumn = columns.some(col => col.name === 'profile_completed');
        
        if (hasColumn) {
          console.log('✓ profile_completed column already exists');
          
          // Still update existing records
          db.run(`
            UPDATE users 
            SET profile_completed = 1 
            WHERE role IN ('tasker', 'both') AND (profile_completed IS NULL OR profile_completed = 0)
          `, function(err) {
            if (err) {
              console.error('Error updating records:', err);
              reject(err);
            } else {
              console.log(`✓ Updated ${this.changes} existing tasker accounts`);
              
              // Verify
              db.all('SELECT id, email, role, profile_completed FROM users LIMIT 5', (err, rows) => {
                if (!err) {
                  console.log('\nSample users:');
                  console.table(rows);
                }
                db.close();
                resolve();
              });
            }
          });
        } else {
          // Add column
          db.run('ALTER TABLE users ADD COLUMN profile_completed INTEGER DEFAULT 0', (err) => {
            if (err) {
              console.error('Error adding column:', err);
              reject(err);
              return;
            }
            
            console.log('✓ profile_completed column added');
            
            // Mark existing taskers as having completed profiles
            db.run(`
              UPDATE users 
              SET profile_completed = 1 
              WHERE role IN ('tasker', 'both')
            `, function(err) {
              if (err) {
                console.error('Error updating records:', err);
                reject(err);
              } else {
                console.log(`✓ Updated ${this.changes} existing tasker accounts`);
                
                // Verify
                db.all('SELECT id, email, role, profile_completed FROM users LIMIT 5', (err, rows) => {
                  if (!err) {
                    console.log('\nSample users:');
                    console.table(rows);
                  }
                  db.close();
                  resolve();
                });
              }
            });
          });
        }
      });
    });
  });
}

applyMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
