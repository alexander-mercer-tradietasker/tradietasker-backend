const { query, get } = require('../db/connection');

async function seedTransactions() {
  console.log('Seeding test transactions...');
  
  try {
    // Get test customer (poster)
    const customer = await get(`SELECT id, credits FROM users WHERE email = 'test@example.com' AND role = 'poster'`);
    
    if (customer) {
      // Customer transactions (tokens)
      await query(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at)
        VALUES 
          (?, 'purchase', 100, 100, 'Token purchase - 100 tokens', datetime('now', '-10 days')),
          (?, 'spend', -20, 80, 'Unlocked tradie profile for Job #1', datetime('now', '-8 days')),
          (?, 'spend', -20, 60, 'Unlocked tradie profile for Job #1', datetime('now', '-7 days'))
      `, [customer.id, customer.id, customer.id]);
      
      // Update user credits to match final balance
      await query('UPDATE users SET credits = 60 WHERE id = ?', [customer.id]);
      console.log('✓ Seeded customer transactions');
    }
    
    // Get test tradie
    const tradie = await get(`SELECT id, credits FROM users WHERE role = 'tasker' LIMIT 1`);
    
    if (tradie) {
      // Tradie transactions (credits)
      await query(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description, created_at)
        VALUES 
          (?, 'purchase', 50, 50, 'Credit purchase - 50 credits', datetime('now', '-15 days')),
          (?, 'spend', -10, 40, 'Unlocked customer contact for Job #2', datetime('now', '-12 days'))
      `, [tradie.id, tradie.id]);
      
      // Update user credits to match final balance
      await query('UPDATE users SET credits = 40 WHERE id = ?', [tradie.id]);
      console.log('✓ Seeded tradie transactions');
    }
    
    console.log('Transaction seeding completed');
  } catch (error) {
    console.error('Error seeding transactions:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedTransactions()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch(err => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seedTransactions };
