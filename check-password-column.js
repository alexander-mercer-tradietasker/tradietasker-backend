require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;

async function checkColumn() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    const client = await pool.connect();
    
    const columns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('Users table columns:');
    columns.rows.forEach(col => console.log(`  - ${col.column_name}`));
    
    // Check actual user data
    const user = await client.query(`SELECT id, email, password_hash FROM users WHERE email = 'testuser@example.com'`);
    console.log('\nTest user:');
    console.log(user.rows[0]);
    
    client.release();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkColumn();
