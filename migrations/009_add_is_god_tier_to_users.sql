-- Add is_god_tier column to users table
-- This allows marking specific users as "god-tier" who get special privileges

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_god_tier BOOLEAN DEFAULT FALSE;

-- Add index for god-tier filtering
CREATE INDEX IF NOT EXISTS idx_users_is_god_tier ON users(is_god_tier);

-- Note: To manually promote a user to god-tier:
-- UPDATE users SET is_god_tier = TRUE WHERE id = <user_id>;
