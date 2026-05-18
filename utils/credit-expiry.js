// Credit expiry utilities

/**
 * Calculate expiry date for free credits (referral, promo)
 * @param {number} days - Number of days until expiry (default 30)
 * @returns {Date} - Expiry timestamp
 */
function calculateCreditExpiry(days = 30) {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

/**
 * Check if credits have expired
 * @param {Date} expiryDate - Expiry timestamp
 * @returns {boolean} - True if expired
 */
function isExpired(expiryDate) {
  if (!expiryDate) return false; // Purchased credits never expire
  return new Date() > new Date(expiryDate);
}

/**
 * Get days remaining until expiry
 * @param {Date} expiryDate - Expiry timestamp
 * @returns {number} - Days remaining (negative if expired)
 */
function getDaysRemaining(expiryDate) {
  if (!expiryDate) return Infinity; // Purchased credits never expire
  
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

module.exports = {
  calculateCreditExpiry,
  isExpired,
  getDaysRemaining
};
