-- Migration 006: Add profile_completed column to users table
-- This tracks whether a tradie has completed their full profile after initial registration

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'profile_completed'
  ) THEN
    ALTER TABLE users ADD COLUMN profile_completed BOOLEAN DEFAULT FALSE;
    
    -- Mark existing users as having completed profiles
    UPDATE users SET profile_completed = TRUE WHERE role IN ('tasker', 'both');
    
    RAISE NOTICE 'profile_completed column added and existing taskers marked as completed';
  ELSE
    RAISE NOTICE 'profile_completed column already exists';
  END IF;
END $$;
