require('dotenv').config();
const { query, get } = require('./db/connection');
const bcrypt = require('bcryptjs');

async function createTestUser() {
  try {
    // Check if test user exists
    const existing = await get(`SELECT id FROM users WHERE email = 'test@test.com'`);
    
    const hash = await bcrypt.hash('test123', 10);
    
    if (existing) {
      console.log('Test user exists, updating password...');
      await query(`UPDATE users SET password_hash = ? WHERE email = 'test@test.com'`, [hash]);
      console.log('✓ Password updated');
    } else {
      console.log('Creating test user...');
      await query(`
        INSERT INTO users (name, email, password_hash, role, credits)
        VALUES (?, ?, ?, ?, ?)
      `, ['Test User', 'test@test.com', hash, 'poster', 60]);
      console.log('✓ Test user created');
    }
    
    // Show user
    const user = await get('SELECT id, name, email, role, credits FROM users WHERE email = ?', ['test@test.com']);
    console.log('\nTest user:', user);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTestUser();
