const { getDb } = require('./db/connection');

async function applyMigration() {
  console.log('Applying tradie profile migration...');
  
  const db = getDb();
  
  // For SQLite, we need to use serialize to execute queries in order
  db.serialize(() => {
    // Add business_name column
    db.run(`ALTER TABLE users ADD COLUMN business_name TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding business_name:', err.message);
      } else {
        console.log('✓ Added business_name column');
      }
    });
    
    // Add business_logo column
    db.run(`ALTER TABLE users ADD COLUMN business_logo TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding business_logo:', err.message);
      } else {
        console.log('✓ Added business_logo column');
      }
    });
    
    // Add profile_photo column
    db.run(`ALTER TABLE users ADD COLUMN profile_photo TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding profile_photo:', err.message);
      } else {
        console.log('✓ Added profile_photo column');
      }
    });
    
    // Add notification_prefs column
    db.run(`ALTER TABLE users ADD COLUMN notification_prefs TEXT DEFAULT '{"email":true,"sms":false}'`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding notification_prefs:', err.message);
      } else {
        console.log('✓ Added notification_prefs column');
      }
    });
    
    // Verify user_qualifications table exists
    db.run(`CREATE TABLE IF NOT EXISTS user_qualifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      year_obtained INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, (err) => {
      if (err) {
        console.error('Error creating user_qualifications table:', err.message);
      } else {
        console.log('✓ Verified user_qualifications table exists');
      }
    });
    
    // Verify contact_transactions table exists
    db.run(`CREATE TABLE IF NOT EXISTS contact_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      credits_used INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    )`, (err) => {
      if (err) {
        console.error('Error creating contact_transactions table:', err.message);
      } else {
        console.log('✓ Verified contact_transactions table exists');
      }
    });
    
    // Close after all operations
    setTimeout(() => {
      console.log('\n✅ Migration complete!');
      process.exit(0);
    }, 1000);
  });
}

applyMigration().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
