-- Add password_hash column for authentication
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Create index for faster email lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
