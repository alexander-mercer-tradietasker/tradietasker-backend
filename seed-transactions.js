require('dotenv').config();
const { query, get } = require('./db/connection');

async function seedTransactions() {
  try {
    console.log('Seeding test transactions...');
    
    // Get a customer and a tradie
    const customer = await get(`SELECT id, credits FROM users WHERE role = 'poster' LIMIT 1`);
    const tradie = await get(`SELECT id, credits FROM users WHERE role = 'tasker' LIMIT 1`);
    
    if (!customer) {
      console.error('No customer found. Please seed users first.');
      return;
    }
    
    if (!tradie) {
      console.error('No tradie found. Please seed users first.');
      return;
    }
    
    console.log(`Customer: ID ${customer.id}, Current balance: ${customer.credits}`);
    console.log(`Tradie: ID ${tradie.id}, Current balance: ${tradie.credits}`);
    
    // Check if transactions already exist
    const existingCustomer = await get('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?', [customer.id]);
    const existingTradie = await get('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?', [tradie.id]);
    
    if (existingCustomer.count > 0) {
      console.log(`Customer already has ${existingCustomer.count} transactions`);
    } else {
      // Customer transactions (tokens)
      let balance = 0;
      
      // Purchase
      balance = 100;
      await query(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '-10 days'))
      `, [customer.id, 'purchase', 100, balance, 'Token purchase - 100 tokens']);
      console.log('✓ Added customer purchase transaction');
      
      // First spend
      balance -= 20;
      await query(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '-8 days'))
      `, [customer.id, 'spend', -20, balance, 'Unlocked tradie profile - Job #123']);
      console.log('✓ Added customer first spend transaction');
      
      // Second spend
      balance -= 20;
      await query(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '-5 days'))
      `, [customer.id, 'spend', -20, balance, 'Unlocked tradie profile - Job #124']);
      console.log('✓ Added customer second spend transaction');
      
      // Update user balance
      await query('UPDATE users SET credits = ? WHERE id = ?', [balance, customer.id]);
    }
    
    if (existingTradie.count > 0) {
      console.log(`Tradie already has ${existingTradie.count} transactions`);
    } else {
      // Tradie transactions (credits)
      let balance = 0;
      
      // Purchase
      balance = 50;
      await query(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '-12 days'))
      `, [tradie.id, 'purchase', 50, balance, 'Credit purchase - 50 credits']);
      console.log('✓ Added tradie purchase transaction');
      
      // Spend
      balance -= 10;
      await query(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '-6 days'))
      `, [tradie.id, 'spend', -10, balance, 'Unlocked customer contact - Job #125']);
      console.log('✓ Added tradie spend transaction');
      
      // Update user balance
      await query('UPDATE users SET credits = ? WHERE id = ?', [balance, tradie.id]);
    }
    
    console.log('\n✓ Transaction seeding complete');
    
    // Show summary
    const customerTxns = await query('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC', [customer.id]);
    const tradieTxns = await query('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC', [tradie.id]);
    
    console.log(`\nCustomer transactions: ${customerTxns.length}`);
    console.log(`Tradie transactions: ${tradieTxns.length}`);
    
  } catch (error) {
    console.error('Error seeding transactions:', error);
  }
}

seedTransactions();
