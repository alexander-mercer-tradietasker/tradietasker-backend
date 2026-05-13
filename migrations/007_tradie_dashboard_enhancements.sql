-- Migration: Tradie Dashboard Enhancements
-- Date: 2026-05-13
-- Description: Add business_name, business_logo, profile_photo, and notification_prefs columns
--              Ensure user_qualifications table exists

-- Add new columns to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_logo VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSON DEFAULT '{"email": true, "sms": false}';

-- Create user_qualifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_qualifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'licence', 'certificate', 'other'
  name TEXT NOT NULL,
  issuer TEXT,
  year_obtained INTEGER,
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add index for qualifications
CREATE INDEX IF NOT EXISTS idx_user_qualifications_user ON user_qualifications(user_id);
