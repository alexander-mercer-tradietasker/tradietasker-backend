// Discount calculation utilities

/**
 * Apply tier-specific discount
 * @param {number} price - Original price
 * @param {number} discountPercent - Discount percentage
 * @param {number} discountDollar - Discount dollar amount
 * @returns {number} - Price after tier discount
 */
function applyTierDiscount(price, discountPercent, discountDollar) {
  let discountedPrice = price;
  
  // Apply percentage discount if set
  if (discountPercent > 0) {
    discountedPrice = price * (1 - discountPercent / 100);
  }
  
  // Apply dollar discount if set (takes precedence)
  if (discountDollar > 0) {
    discountedPrice = price - discountDollar;
  }
  
  // Round down to nearest whole number
  return Math.floor(Math.max(0, discountedPrice));
}

/**
 * Apply site-wide discount (after tier discount)
 * @param {number} price - Price after tier discount
 * @param {number} discountPercent - Site-wide discount percentage
 * @param {number} discountDollar - Site-wide discount dollar amount
 * @returns {number} - Final price after both discounts
 */
function applySiteWideDiscount(price, discountPercent, discountDollar) {
  let discountedPrice = price;
  
  // Apply percentage discount if set
  if (discountPercent > 0) {
    discountedPrice = price * (1 - discountPercent / 100);
  }
  
  // Apply dollar discount if set (takes precedence)
  if (discountDollar > 0) {
    discountedPrice = price - discountDollar;
  }
  
  // Round down to nearest whole number
  return Math.floor(Math.max(0, discountedPrice));
}

/**
 * Calculate full discounted price (tier + site-wide)
 * @param {number} originalPrice - Original price (tax-exclusive)
 * @param {object} tierDiscount - { percent, dollar, enabled, expiry }
 * @param {object} siteWideDiscount - { percent, dollar }
 * @returns {number} - Final discounted price
 */
function calculateDiscountedPrice(originalPrice, tierDiscount = {}, siteWideDiscount = {}) {
  let price = originalPrice;
  
  // Apply tier discount if enabled and not expired
  if (tierDiscount.enabled) {
    const now = new Date();
    const expired = tierDiscount.expiry && new Date(tierDiscount.expiry) < now;
    
    if (!expired) {
      price = applyTierDiscount(
        price,
        tierDiscount.percent || 0,
        tierDiscount.dollar || 0
      );
    }
  }
  
  // Apply site-wide discount
  price = applySiteWideDiscount(
    price,
    siteWideDiscount.percent || 0,
    siteWideDiscount.dollar || 0
  );
  
  return price;
}

/**
 * Calculate package discount percentage
 * @param {number} totalCredits - Total credits in package
 * @param {number} creditBaseValue - Reference price per credit
 * @param {number} packagePrice - Actual package price
 * @returns {number} - Discount percentage (rounded down)
 */
function calculatePackageDiscountPercent(totalCredits, creditBaseValue, packagePrice) {
  const referenceValue = totalCredits * creditBaseValue;
  
  if (referenceValue <= 0) return 0;
  
  const discountPercent = ((referenceValue - packagePrice) / referenceValue) * 100;
  
  return Math.floor(Math.max(0, discountPercent));
}

module.exports = {
  applyTierDiscount,
  applySiteWideDiscount,
  calculateDiscountedPrice,
  calculatePackageDiscountPercent
};
