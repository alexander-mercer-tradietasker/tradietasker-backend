require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Adding discount fields to credit_packages...');
    
    await client.query(`
      ALTER TABLE credit_packages
      ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2),
      ADD COLUMN IF NOT EXISTS discount_dollar DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS discount_enabled BOOLEAN DEFAULT false;
    `);
    
    console.log('✓ Discount fields added successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
