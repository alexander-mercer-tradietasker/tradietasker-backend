require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;

async function createTestUser() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    const client = await pool.connect();
    
    // Check if test user exists
    const existing = await client.query(`SELECT id FROM users WHERE email = 'testuser@example.com'`);
    
    if (existing.rows.length > 0) {
      console.log('Test user already exists, updating password...');
      const hash = await bcrypt.hash('password123', 10);
      await client.query(`UPDATE users SET password_hash = $1 WHERE email = 'testuser@example.com'`, [hash]);
      console.log('✓ Password updated');
    } else {
      console.log('Creating test user...');
      const hash = await bcrypt.hash('password123', 10);
      await client.query(`
        INSERT INTO users (name, email, password_hash, role, credits)
        VALUES ($1, $2, $3, $4, $5)
      `, ['Test User', 'testuser@example.com', hash, 'poster', 60]);
      console.log('✓ Test user created');
    }
    
    client.release();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

createTestUser();
