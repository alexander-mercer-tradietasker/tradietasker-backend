-- TradieTasker Credit Packages Migration
-- Version: 5.0.32
-- Date: 2026-05-26
-- Description: Create credit_packages table for managing credit packages for customers and tradies

-- Create credit_packages table
CREATE TABLE IF NOT EXISTS credit_packages (
  id SERIAL PRIMARY KEY,
  package_type VARCHAR(20) NOT NULL CHECK (package_type IN ('customer', 'tradie')),
  name VARCHAR(100) NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  price_excl_tax DECIMAL(10,2) NOT NULL CHECK (price_excl_tax >= 0),
  display_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for package_type lookups
CREATE INDEX IF NOT EXISTS idx_credit_packages_type ON credit_packages(package_type);
CREATE INDEX IF NOT EXISTS idx_credit_packages_enabled ON credit_packages(enabled);

-- Insert default customer credit packages (matching existing hardcoded values)
INSERT INTO credit_packages (package_type, name, credits, price_excl_tax, display_order, enabled) VALUES
  ('customer', 'Small', 5, 5.00, 1, true),
  ('customer', 'Medium', 10, 9.00, 2, true),
  ('customer', 'Large', 20, 16.00, 3, true),
  ('customer', 'XLarge', 50, 35.00, 4, true)
ON CONFLICT DO NOTHING;

-- Insert default tradie credit packages (same as customer for now, can be customized)
INSERT INTO credit_packages (package_type, name, credits, price_excl_tax, display_order, enabled) VALUES
  ('tradie', 'Small', 5, 5.00, 1, true),
  ('tradie', 'Medium', 10, 9.00, 2, true),
  ('tradie', 'Large', 20, 16.00, 3, true),
  ('tradie', 'XLarge', 50, 35.00, 4, true)
ON CONFLICT DO NOTHING;

-- Add update trigger for updated_at
DROP TRIGGER IF EXISTS update_credit_packages_updated_at ON credit_packages;
CREATE TRIGGER update_credit_packages_updated_at BEFORE UPDATE ON credit_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
