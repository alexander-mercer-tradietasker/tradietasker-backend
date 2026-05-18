// Tax calculation utilities
const { query } = require('../db/connection');

/**
 * Get applicable tax rate for user's location
 * @param {string} country - User's country
 * @param {string} stateProvince - User's state/province (optional)
 * @returns {number} - Tax rate as percentage (e.g., 10 for 10%)
 */
async function getTaxRateForLocation(country, stateProvince = null) {
  try {
    let sql = `
      SELECT rate_percent 
      FROM tax_rates 
      WHERE enabled = true 
        AND country = ?
    `;
    const params = [country];
    
    if (stateProvince) {
      sql += ' AND (state_province = ? OR state_province IS NULL)';
      params.push(stateProvince);
      sql += ' ORDER BY state_province DESC NULLS LAST'; // Prefer specific state match
    }
    
    sql += ' LIMIT 1';
    
    const result = await query(sql, params);
    
    if (result.length > 0) {
      return parseFloat(result[0].rate_percent);
    }
    
    // No tax rate configured for location - return 0
    return 0;
  } catch (error) {
    console.error('Error getting tax rate:', error);
    return 0; // Default to 0 if error
  }
}

/**
 * Calculate tax-inclusive price from tax-exclusive price
 * @param {number} priceExclTax - Price excluding tax
 * @param {number} taxRate - Tax rate percentage (e.g., 10 for 10%)
 * @returns {number} - Price including tax
 */
function calculatePriceInclTax(priceExclTax, taxRate) {
  return priceExclTax * (1 + taxRate / 100);
}

/**
 * Calculate tax amount
 * @param {number} priceExclTax - Price excluding tax
 * @param {number} taxRate - Tax rate percentage
 * @returns {number} - Tax amount
 */
function calculateTaxAmount(priceExclTax, taxRate) {
  return priceExclTax * (taxRate / 100);
}

/**
 * Round price to 2 decimal places
 * @param {number} price
 * @returns {number}
 */
function roundPrice(price) {
  return Math.round(price * 100) / 100;
}

module.exports = {
  getTaxRateForLocation,
  calculatePriceInclTax,
  calculateTaxAmount,
  roundPrice
};
