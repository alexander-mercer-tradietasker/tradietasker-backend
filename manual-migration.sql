-- Manual migration for invoices and admin_settings tables
-- Run this directly on Railway PostgreSQL database

-- Create admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO admin_settings (key, value) VALUES 
  ('gst_enabled', 'false'),
  ('business_abn', '72 688 296 013'),
  ('business_name', 'Drachen Pty Ltd')
ON CONFLICT (key) DO NOTHING;

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  stripe_invoice_id VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'paid',
  description TEXT,
  pdf_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id);

-- Insert 2 test invoices (assuming user_id 1 exists)
INSERT INTO invoices (user_id, invoice_number, amount, gst_amount, total, status, description, created_at)
VALUES 
  (1, 'INV-202605-0001', 100.00, 0.00, 100.00, 'paid', 'Token purchase - 100 credits', NOW() - INTERVAL '7 days'),
  (1, 'INV-202605-0002', 50.00, 0.00, 50.00, 'paid', 'Subscription - Bronze Plan', NOW() - INTERVAL '3 days')
ON CONFLICT (invoice_number) DO NOTHING;
