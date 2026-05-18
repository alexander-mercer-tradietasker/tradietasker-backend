// Generate 8-digit account numbers starting from 00010000
const { query } = require('../db/connection');

async function generateAccountNumber() {
  try {
    // Get next sequence value
    const result = await query('SELECT nextval(\'account_number_seq\') as num');
    const num = result[0].num;
    
    // Format as 8-digit string with leading zeros
    return num.toString().padStart(8, '0');
  } catch (error) {
    console.error('Error generating account number:', error);
    throw new Error('Failed to generate account number');
  }
}

module.exports = { generateAccountNumber };
