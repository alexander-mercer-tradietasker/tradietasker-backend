require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;

async function checkUsers() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    
    const users = await client.query(`SELECT id, name, email, role, credits FROM users ORDER BY id LIMIT 10`);
    
    console.log('Users on Railway:');
    console.log('================');
    users.rows.forEach(user => {
      console.log(`ID: ${user.id} | Name: ${user.name} | Email: ${user.email} | Role: ${user.role} | Credits: ${user.credits}`);
    });
    
    client.release();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkUsers();
