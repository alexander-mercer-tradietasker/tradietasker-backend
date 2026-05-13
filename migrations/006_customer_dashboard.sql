-- Migration 006: Customer Dashboard Core Features
-- Add assigned_tradie_id, notification_prefs, marketing_prefs, and profile_photo columns

-- Add assigned_tradie_id to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_tradie_id INTEGER;
ALTER TABLE jobs ADD CONSTRAINT fk_assigned_tradie 
  FOREIGN KEY (assigned_tradie_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add notification and marketing preferences to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSON DEFAULT '{"email": true, "sms": false}'::json;
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_prefs JSON DEFAULT '{"emails": false}'::json;

-- Ensure profile_photo_url column exists (should already be there from previous migrations)
-- This is idempotent
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Create index for faster queries on assigned_tradie_id
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_tradie ON jobs(assigned_tradie_id);
CREATE INDEX IF NOT EXISTS idx_jobs_poster_status ON jobs(poster_id, status);
