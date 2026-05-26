-- Migration 010: Add subscription_tiers table for admin tier configuration
-- Created: 2026-05-26

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id SERIAL PRIMARY KEY,
  tier_name TEXT NOT NULL UNIQUE, -- 'free', 'bronze', 'silver', 'gold', 'platinum', 'god'
  
  -- Pricing
  subscription_cost_excl_tax DECIMAL(10, 2) DEFAULT 0.00,
  
  -- Tier-specific discount
  tier_discount_enabled BOOLEAN DEFAULT false,
  tier_discount_percent DECIMAL(5, 2) DEFAULT 0.00,
  tier_discount_dollar DECIMAL(10, 2) DEFAULT 0.00,
  tier_discount_expiry TIMESTAMP,
  
  -- Credits included per week
  base_credits INTEGER DEFAULT 0,
  base_credits_multiplier INTEGER DEFAULT 1,
  bonus_credits INTEGER DEFAULT 0,
  bonus_credits_multiplier INTEGER DEFAULT 1,
  additional_bonus_credits INTEGER DEFAULT 0,
  additional_bonus_credits_multiplier INTEGER DEFAULT 1,
  
  -- Job access delay
  job_view_delay_minutes INTEGER DEFAULT 0, -- 0 = instant access
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tier configurations
INSERT INTO subscription_tiers (
  tier_name, 
  subscription_cost_excl_tax, 
  base_credits, 
  base_credits_multiplier,
  bonus_credits,
  bonus_credits_multiplier,
  additional_bonus_credits,
  additional_bonus_credits_multiplier,
  job_view_delay_minutes
) VALUES
  ('free', 0.00, 0, 1, 0, 1, 0, 1, 1440), -- 24h delay
  ('bronze', 5.00, 5, 1, 2, 1, 0, 1, 720), -- 12h delay
  ('silver', 10.00, 10, 1, 5, 1, 0, 1, 360), -- 6h delay
  ('gold', 20.00, 20, 1, 10, 1, 5, 1, 120), -- 2h delay
  ('platinum', 40.00, 40, 1, 20, 1, 10, 1, 30), -- 30min delay
  ('god', 80.00, 80, 1, 40, 1, 20, 1, 0) -- instant
ON CONFLICT (tier_name) DO NOTHING;

-- Create site-wide discount settings table
CREATE TABLE IF NOT EXISTS site_wide_discount (
  id SERIAL PRIMARY KEY,
  percent DECIMAL(5, 2) DEFAULT 0.00,
  dollar DECIMAL(10, 2) DEFAULT 0.00,
  expiry TIMESTAMP,
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default site-wide discount (disabled)
INSERT INTO site_wide_discount (percent, dollar, enabled)
VALUES (0.00, 0.00, false)
ON CONFLICT DO NOTHING;
