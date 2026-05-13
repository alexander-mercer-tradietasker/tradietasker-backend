-- Migration 006: Add profile_completed column to users table
-- This tracks whether a tradie has completed their full profile after initial registration

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;

-- Mark existing users as having completed profiles
UPDATE users SET profile_completed = TRUE WHERE role IN ('tasker', 'both');
