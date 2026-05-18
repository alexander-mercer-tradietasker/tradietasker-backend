// Generate unique 12-character alphanumeric referral codes
const { query } = require('../db/connection');

function generateRandomCode(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function generateUniqueReferralCode() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const code = generateRandomCode(12);
    
    // Check if code already exists
    const existing = await query('SELECT id FROM users WHERE referral_code = ?', [code]);
    
    if (existing.length === 0) {
      return code;
    }
    
    attempts++;
  }
  
  throw new Error('Failed to generate unique referral code after multiple attempts');
}

module.exports = { generateUniqueReferralCode };
