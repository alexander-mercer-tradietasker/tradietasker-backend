-- Migration 009: Profession to Job Type Mapping
-- Creates junction table for many-to-many relationship between professions and job types
-- Created: 2026-05-16

-- ============================================
-- CREATE JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profession_job_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profession_id INTEGER NOT NULL,
  job_type_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE,
  FOREIGN KEY (job_type_id) REFERENCES job_types(id) ON DELETE CASCADE,
  UNIQUE(profession_id, job_type_id)
);

-- ============================================
-- CREATE INDEX FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profession_job_types_profession ON profession_job_types(profession_id);
CREATE INDEX IF NOT EXISTS idx_profession_job_types_job_type ON profession_job_types(job_type_id);
