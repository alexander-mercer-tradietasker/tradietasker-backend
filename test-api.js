const { get, run } = require('./db/connection');
const bcrypt = require('bcryptjs');

async function testRegistration() {
  try {
    console.log('Testing database connection...');
    
    // Test SELECT
    const count = await get('SELECT COUNT(*) as count FROM users');
    console.log('Current user count:', count.count);
    
    // Test INSERT
    console.log('\nTesting user registration...');
    const email = 'testuser' + Date.now() + '@example.com';
    const passwordHash = await bcrypt.hash('password123', 10);
    
    const result = await run(
      `INSERT INTO users (email, password_hash, name, phone, role, tier, credits, created_at)
       VALUES (?, ?, ?, ?, ?, 'free', 0, datetime('now'))`,
      [email, passwordHash, 'Test User', '0412345678', 'tasker']
    );
    
    console.log('User created with ID:', result.lastID);
    
    // Verify
    const user = await get('SELECT * FROM users WHERE id = ?', [result.lastID]);
    delete user.password_hash;
    console.log('Created user:', JSON.stringify(user, null, 2));
    
    console.log('\n✅ Registration test successful!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testRegistration();
