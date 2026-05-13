require('dotenv').config();
const { Pool } = require('pg');

// Override with Railway DATABASE_URL if provided as env var
const DATABASE_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: No DATABASE_URL found. Please set RAILWAY_DATABASE_URL or DATABASE_URL');
  process.exit(1);
}

async function seedTransactions() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: false
  });

  try {
    console.log('Connecting to Railway PostgreSQL database...');
    const client = await pool.connect();
    
    console.log('Fetching users...');
    
    // Get customers (we'll use first two as customer and tradie for demo)
    const usersResult = await client.query(`SELECT id, credits, role FROM users ORDER BY id LIMIT 2`);
    
    if (usersResult.rows.length === 0) {
      console.error('No users found. Please seed users first.');
      client.release();
      await pool.end();
      return;
    }
    
    const customer = usersResult.rows[0];
    const tradie = usersResult.rows[1] || usersResult.rows[0]; // Use same user if only one exists
    
    console.log(`Customer: ID ${customer.id}, Current balance: ${customer.credits}`);
    console.log(`Tradie: ID ${tradie.id}, Current balance: ${tradie.credits}`);
    
    // Check if transactions already exist
    const existingCustomer = await client.query('SELECT COUNT(*) as count FROM transactions WHERE user_id = $1', [customer.id]);
    const existingTradie = await client.query('SELECT COUNT(*) as count FROM transactions WHERE user_id = $1', [tradie.id]);
    
    if (parseInt(existingCustomer.rows[0].count) > 0) {
      console.log(`Customer already has ${existingCustomer.rows[0].count} transactions`);
    } else {
      // Customer transactions (tokens)
      let balance = 0;
      
      // Purchase
      balance = 100;
      await client.query(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '10 days')
      `, [customer.id, 'purchase', 100, balance, 'Token purchase - 100 tokens']);
      console.log('✓ Added customer purchase transaction');
      
      // First spend
      balance -= 20;
      await client.query(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '8 days')
      `, [customer.id, 'spend', -20, balance, 'Unlocked tradie profile - Job #123']);
      console.log('✓ Added customer first spend transaction');
      
      // Second spend
      balance -= 20;
      await client.query(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '5 days')
      `, [customer.id, 'spend', -20, balance, 'Unlocked tradie profile - Job #124']);
      console.log('✓ Added customer second spend transaction');
      
      // Update user balance
      await client.query('UPDATE users SET credits = $1 WHERE id = $2', [balance, customer.id]);
      console.log(`✓ Updated customer balance to ${balance}`);
    }
    
    if (parseInt(existingTradie.rows[0].count) > 0) {
      console.log(`Tradie already has ${existingTradie.rows[0].count} transactions`);
    } else {
      // Tradie transactions (credits)
      let balance = 0;
      
      // Purchase
      balance = 50;
      await client.query(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '12 days')
      `, [tradie.id, 'purchase', 50, balance, 'Credit purchase - 50 credits']);
      console.log('✓ Added tradie purchase transaction');
      
      // Spend
      balance -= 10;
      await client.query(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '6 days')
      `, [tradie.id, 'spend', -10, balance, 'Unlocked customer contact - Job #125']);
      console.log('✓ Added tradie spend transaction');
      
      // Update user balance
      await client.query('UPDATE users SET credits = $1 WHERE id = $2', [balance, tradie.id]);
      console.log(`✓ Updated tradie balance to ${balance}`);
    }
    
    console.log('\n✓ Transaction seeding complete');
    
    // Show summary
    const customerTxns = await client.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC', [customer.id]);
    const tradieTxns = await client.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC', [tradie.id]);
    
    console.log(`\nCustomer transactions: ${customerTxns.rows.length}`);
    console.log(`Tradie transactions: ${tradieTxns.rows.length}`);
    
    client.release();
  } catch (error) {
    console.error('Error seeding transactions:', error);
  } finally {
    await pool.end();
  }
}

seedTransactions();
