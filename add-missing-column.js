const { Pool } = require('pg');

async function addColumn() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Adding missing column...');
    await pool.query('ALTER TABLE professions ADD COLUMN IF NOT EXISTS requires_licence BOOLEAN DEFAULT FALSE');
    console.log('✓ Column added successfully');
  } catch (error) {
    console.error('✗ Failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addColumn();
