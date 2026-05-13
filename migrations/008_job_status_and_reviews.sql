-- Migration 008: Job Status Management and Reviews System
-- Add assigned_tradie_id to jobs table and create reviews table

-- Add assigned_tradie_id column to jobs table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'assigned_tradie_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assigned_tradie_id INTEGER REFERENCES users(id);
    CREATE INDEX idx_jobs_assigned_tradie ON jobs(assigned_tradie_id);
  END IF;
END $$;

-- Create reviews table if not exists
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, reviewer_id, reviewee_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_job ON reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);

-- Ensure status column exists and has correct values
DO $$ 
BEGIN
  -- Add check constraint for valid status values
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_status_check'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_status_check 
    CHECK (status IN ('open', 'in-progress', 'completed', 'cancelled'));
  END IF;
END $$;
