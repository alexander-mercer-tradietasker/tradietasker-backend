-- Migration: Customer Dashboard Core Features
-- Date: 2026-05-13
-- Description: Add columns needed for customer dashboard functionality

-- Add assigned_tradie_id to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_tradie_id INTEGER REFERENCES users(id);

-- Add notification and marketing preferences to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSON;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_prefs JSON;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(255);

-- Create index for assigned tradie lookups
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_tradie ON jobs(assigned_tradie_id);

-- Set default preferences for existing users
UPDATE users 
SET notification_prefs = '{"email": true, "sms": false}'::json,
    marketing_prefs = '{"email": true}'::json
WHERE notification_prefs IS NULL;
