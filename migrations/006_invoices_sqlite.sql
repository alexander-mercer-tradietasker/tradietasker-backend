-- Invoice System Migration (SQLite)
-- Created: 2026-05-13

-- ============================================
-- INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  stripe_invoice_id TEXT,
  amount REAL NOT NULL,
  gst_amount REAL DEFAULT 0,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- ============================================
-- ADMIN SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default GST setting
INSERT OR IGNORE INTO admin_settings (key, value, description) 
VALUES ('gst_enabled', 'false', 'Enable GST (10%) on all invoices');

-- Insert business details for invoices
INSERT OR IGNORE INTO admin_settings (key, value, description) 
VALUES ('business_abn', '72 688 296 013', 'Business ABN for invoices');

INSERT OR IGNORE INTO admin_settings (key, value, description) 
VALUES ('business_name', 'Drachen Pty Ltd', 'Business name for invoices');
