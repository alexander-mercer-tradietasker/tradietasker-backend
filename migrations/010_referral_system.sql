-- Migration 010: Add referral system

-- Add referral_code and referrer_id to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_credit_earned INTEGER DEFAULT 0;

-- Create referrals tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credit_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(referrer_id, referred_user_id)
);

-- Create referral_settings table for admin configuration
CREATE TABLE IF NOT EXISTS referral_settings (
  id SERIAL PRIMARY KEY,
  credit_per_referral INTEGER DEFAULT 5,
  enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default referral settings
INSERT INTO referral_settings (credit_per_referral, enabled)
VALUES (5, TRUE)
ON CONFLICT DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
