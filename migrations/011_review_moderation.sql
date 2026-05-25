-- Migration 011: Add review moderation fields

-- Add flagging columns to reviews table
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS flag_reason TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP;

-- Create index for faster flagged review lookups
CREATE INDEX IF NOT EXISTS idx_reviews_flagged ON reviews(is_flagged) WHERE is_flagged = TRUE;
