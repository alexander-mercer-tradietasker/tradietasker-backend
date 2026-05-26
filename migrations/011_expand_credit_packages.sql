-- Expand credit_packages with tier-like discount and credit multipliers

ALTER TABLE credit_packages ADD COLUMN IF NOT EXISTS package_discount_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE credit_packages ADD COLUMN IF NOT EXISTS package_discount_dollar DECIMAL(10,2) DEFAULT 0;
ALTER TABLE credit_packages ADD COLUMN IF NOT EXISTS package_discount_enabled BOOLEAN DEFAULT false;
ALTER TABLE credit_packages ADD COLUMN IF NOT EXISTS standard_credits INTEGER DEFAULT 0;
ALTER TABLE credit_packages ADD COLUMN IF NOT EXISTS standard_credits_multiplier INTEGER DEFAULT 1;
ALTER TABLE credit_packages ADD COLUMN IF NOT EXISTS bonus_credits INTEGER DEFAULT 0;
ALTER TABLE credit_packages ADD COLUMN IF NOT EXISTS bonus_credits_multiplier INTEGER DEFAULT 1;
ALTER TABLE credit_packages ADD COLUMN IF NOT EXISTS additional_bonus_credits INTEGER DEFAULT 0;
ALTER TABLE credit_packages ADD COLUMN IF NOT EXISTS additional_bonus_credits_multiplier INTEGER DEFAULT 1;

-- Update existing packages to use new structure (migrate 'credits' to 'standard_credits')
UPDATE credit_packages SET standard_credits = credits WHERE standard_credits = 0;
