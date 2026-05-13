-- Invoice System Migration
-- Created: 2026-05-13

-- ============================================
-- INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  stripe_invoice_id VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'paid', 'pending'
  description TEXT,
  pdf_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- ============================================
-- ADMIN SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default GST setting
INSERT INTO admin_settings (key, value, description) 
VALUES ('gst_enabled', 'false', 'Enable GST (10%) on all invoices')
ON CONFLICT (key) DO NOTHING;

-- Insert business details for invoices
INSERT INTO admin_settings (key, value, description) 
VALUES ('business_abn', '72 688 296 013', 'Business ABN for invoices')
ON CONFLICT (key) DO NOTHING;

INSERT INTO admin_settings (key, value, description) 
VALUES ('business_name', 'Drachen Pty Ltd', 'Business name for invoices')
ON CONFLICT (key) DO NOTHING;
