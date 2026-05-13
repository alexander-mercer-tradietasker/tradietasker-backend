-- Migration: Add tradie profile enhancements
-- Date: 2026-05-13
-- Description: Add business_name, business_logo, profile_photo, and notification_prefs columns

-- Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_logo VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSON DEFAULT '{"email": true, "sms": false}';

-- Note: user_qualifications table already exists in schema
-- Verify it exists with proper structure
CREATE TABLE IF NOT EXISTS user_qualifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'tafe', 'university', 'other'
  name TEXT NOT NULL,
  year_obtained INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add index for qualifications
CREATE INDEX IF NOT EXISTS idx_user_qualifications_user ON user_qualifications(user_id);
