-- TradieTasker Admin Features Migration
-- Version: 5.0.31
-- Date: 2026-05-19

-- 1. Create tiers configuration table
CREATE TABLE IF NOT EXISTS tiers (
  id SERIAL PRIMARY KEY,
  tier_name VARCHAR(20) UNIQUE NOT NULL,
  subscription_cost_excl_tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  tier_discount_percent DECIMAL(5,2) DEFAULT 0,
  tier_discount_dollar DECIMAL(10,2) DEFAULT 0,
  tier_discount_expiry TIMESTAMP,
  tier_discount_enabled BOOLEAN DEFAULT false,
  base_credits INTEGER DEFAULT 0,
  base_credits_multiplier INTEGER DEFAULT 1,
  bonus_credits INTEGER DEFAULT 0,
  bonus_credits_multiplier INTEGER DEFAULT 1,
  additional_bonus_credits INTEGER DEFAULT 0,
  additional_bonus_credits_multiplier INTEGER DEFAULT 1,
  initial_purchase_bonus_credits INTEGER DEFAULT 0,
  recurring_bonus_credits INTEGER DEFAULT 0,
  job_view_delay_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tier configurations
INSERT INTO tiers (tier_name, subscription_cost_excl_tax, job_view_delay_minutes) VALUES
  ('basic', 0, 1440),      -- Free tier, 24 hour delay
  ('bronze', 20, 720),     -- $20/week, 12 hour delay
  ('silver', 35, 360),     -- $35/week, 6 hour delay
  ('gold', 50, 180),       -- $50/week, 3 hour delay
  ('platinum', 75, 60),    -- $75/week, 1 hour delay
  ('god', 100, 0)          -- $100/week, no delay
ON CONFLICT (tier_name) DO NOTHING;

-- 2. Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default site settings
INSERT INTO site_settings (setting_key, setting_value) VALUES
  ('site_wide_discount_percent', '0'),
  ('site_wide_discount_dollar', '0'),
  ('credit_base_value_excl_tax', '2.00'),
  ('referral_signup_credits', '5'),
  ('referral_purchase_credits', '10'),
  ('free_credit_expiry_days', '30')
ON CONFLICT (setting_key) DO NOTHING;

-- 3. Create tax_rates table
CREATE TABLE IF NOT EXISTS tax_rates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  state_province VARCHAR(100),
  rate_percent DECIMAL(5,2) NOT NULL,
  tax_id_label VARCHAR(50),
  tax_id_number VARCHAR(50),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default Australian GST
INSERT INTO tax_rates (name, country, rate_percent, tax_id_label, tax_id_number, enabled) VALUES
  ('Australia GST 10%', 'Australia', 10.00, 'ABN', '12 345 678 901', true)
ON CONFLICT DO NOTHING;

-- 4. Modify users table - add new columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_number VARCHAR(8) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(12) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Australia';
ALTER TABLE users ADD COLUMN IF NOT EXISTS state_province VARCHAR(100);

-- Create sequence for account numbers starting at 10000
CREATE SEQUENCE IF NOT EXISTS account_number_seq START WITH 10000;

-- 5. Modify jobs table - add new columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS god_tier_only BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS god_tier_marked_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS view_delay_expires_at TIMESTAMP;

-- 6. Create promo_codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  code_lower VARCHAR(50) UNIQUE NOT NULL, -- lowercase for case-insensitive lookup
  type VARCHAR(20) NOT NULL, -- 'signup_bonus', 'package_discount', 'both'
  signup_bonus_credits INTEGER DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_dollar DECIMAL(10,2) DEFAULT 0,
  applicable_packages TEXT, -- JSON array or comma-separated
  expiry_date DATE,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_by_admin_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Create promo_code_usage table
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id SERIAL PRIMARY KEY,
  promo_code_id INTEGER REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  credits_granted INTEGER DEFAULT 0,
  discount_applied DECIMAL(10,2) DEFAULT 0,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create referral_credits table
CREATE TABLE IF NOT EXISTS referral_credits (
  id SERIAL PRIMARY KEY,
  referrer_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  referee_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  credit_type VARCHAR(20) NOT NULL, -- 'signup', 'purchase'
  credits_granted INTEGER NOT NULL,
  expires_at TIMESTAMP,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Create user_flags table
CREATE TABLE IF NOT EXISTS user_flags (
  id SERIAL PRIMARY KEY,
  flag_type VARCHAR(10) NOT NULL, -- 'job', 'user'
  reported_by_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reported_job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  reason VARCHAR(50) NOT NULL,
  details TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'reviewed', 'dismissed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by_admin_id INTEGER REFERENCES users(id)
);

-- 10. Create user_blocks table
CREATE TABLE IF NOT EXISTS user_blocks (
  id SERIAL PRIMARY KEY,
  blocking_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(blocking_user_id, blocked_user_id)
);

-- 11. Create scheduled_reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id SERIAL PRIMARY KEY,
  report_type VARCHAR(20) NOT NULL, -- 'weekly', 'monthly', 'quarterly', 'half_annual', 'annual'
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  file_path TEXT,
  file_format VARCHAR(10), -- 'csv', 'pdf'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'ready', 'failed'
  error_message TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_account_number ON users(account_number);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_jobs_god_tier_only ON jobs(god_tier_only);
CREATE INDEX IF NOT EXISTS idx_jobs_view_delay ON jobs(view_delay_expires_at);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code_lower ON promo_codes(code_lower);
CREATE INDEX IF NOT EXISTS idx_user_flags_status ON user_flags(status);
CREATE INDEX IF NOT EXISTS idx_referral_credits_referrer ON referral_credits(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_credits_referee ON referral_credits(referee_user_id);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers
DROP TRIGGER IF EXISTS update_tiers_updated_at ON tiers;
CREATE TRIGGER update_tiers_updated_at BEFORE UPDATE ON tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tax_rates_updated_at ON tax_rates;
CREATE TRIGGER update_tax_rates_updated_at BEFORE UPDATE ON tax_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promo_codes_updated_at ON promo_codes;
CREATE TRIGGER update_promo_codes_updated_at BEFORE UPDATE ON promo_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
