-- Credit Packages Management
-- Replaces hardcoded packages in routes/credits.js

CREATE TABLE IF NOT EXISTS credit_packages (
  id SERIAL PRIMARY KEY,
  package_type VARCHAR(20) NOT NULL, -- 'customer' or 'tradie'
  name VARCHAR(100) NOT NULL,
  credits INTEGER NOT NULL,
  price_excl_tax DECIMAL(10,2) NOT NULL,
  display_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed existing packages
INSERT INTO credit_packages (package_type, name, credits, price_excl_tax, display_order, enabled) VALUES
  ('tradie', 'Small', 5, 5.00, 1, true),
  ('tradie', 'Medium', 10, 9.00, 2, true),
  ('tradie', 'Large', 20, 16.00, 3, true),
  ('tradie', 'X-Large', 50, 35.00, 4, true),
  ('customer', 'Starter', 3, 3.00, 1, true),
  ('customer', 'Standard', 5, 5.00, 2, true),
  ('customer', 'Premium', 10, 9.00, 3, true)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_credit_packages_type ON credit_packages(package_type);
CREATE INDEX IF NOT EXISTS idx_credit_packages_enabled ON credit_packages(enabled);

CREATE OR REPLACE FUNCTION update_credit_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_credit_packages_updated_at ON credit_packages;
CREATE TRIGGER update_credit_packages_updated_at BEFORE UPDATE ON credit_packages
  FOR EACH ROW EXECUTE FUNCTION update_credit_packages_updated_at();
