require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

async function applyMigration() {
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL not set. Skipping PostgreSQL migration.');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Connecting to PostgreSQL...');
    
    // Check if messages table already exists
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
      );
    `);

    if (checkTable.rows[0].exists) {
      console.log('✓ Messages table already exists');
    } else {
      console.log('Creating messages table...');
      const sql = fs.readFileSync('./migrations/004_create_messages.sql', 'utf8');
      await pool.query(sql);
      console.log('✓ Messages table created successfully');
    }

    // Check message count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM messages');
    console.log(`✓ Messages table ready (${countResult.rows[0].count} messages)`);

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

applyMigration()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
