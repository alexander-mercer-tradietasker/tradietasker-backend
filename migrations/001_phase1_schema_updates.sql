-- Migration 001: Phase 1 Schema Updates
-- Adds new tables and fields for TradieTasker rebuild
-- Run this against existing database to upgrade to Phase 1 schema
-- Created: 2026-05-08

-- ============================================
-- 1. ADD NEW FIELDS TO EXISTING USERS TABLE
-- ============================================
-- Personal Information
ALTER TABLE users ADD COLUMN date_of_birth DATE;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN residential_address TEXT;
ALTER TABLE users ADD COLUMN residential_suburb TEXT;
ALTER TABLE users ADD COLUMN residential_state TEXT;
ALTER TABLE users ADD COLUMN residential_postcode TEXT;
ALTER TABLE users ADD COLUMN postal_address TEXT;
ALTER TABLE users ADD COLUMN postal_postcode TEXT;

-- Business Information
ALTER TABLE users ADD COLUMN abn TEXT;
ALTER TABLE users ADD COLUMN business_name TEXT;
ALTER TABLE users ADD COLUMN business_address TEXT;
ALTER TABLE users ADD COLUMN business_phone TEXT;
ALTER TABLE users ADD COLUMN business_email TEXT;
ALTER TABLE users ADD COLUMN business_logo_url TEXT;
ALTER TABLE users ADD COLUMN profile_photo_url TEXT;

-- Service Area
ALTER TABLE users ADD COLUMN service_radius_km INTEGER DEFAULT 25;
ALTER TABLE users ADD COLUMN service_postcode TEXT;

-- Subscription & Credits
ALTER TABLE users ADD COLUMN tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 0;

-- ============================================
-- 2. ADD NEW FIELDS TO EXISTING JOBS TABLE
-- ============================================
ALTER TABLE jobs ADD COLUMN job_type_id INTEGER;
ALTER TABLE jobs ADD COLUMN short_description TEXT;
ALTER TABLE jobs ADD COLUMN full_description TEXT;
ALTER TABLE jobs ADD COLUMN photos TEXT; -- JSON array
ALTER TABLE jobs ADD COLUMN status TEXT DEFAULT 'open';
ALTER TABLE jobs ADD COLUMN awarded_to_user_id INTEGER;
ALTER TABLE jobs ADD COLUMN completed_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN is_god_tier BOOLEAN DEFAULT 0;

-- ============================================
-- 3. CREATE NEW TABLES
-- ============================================

-- Professions
CREATE TABLE IF NOT EXISTS professions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  requires_licence BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Types
CREATE TABLE IF NOT EXISTS job_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Professions (Many-to-Many)
CREATE TABLE IF NOT EXISTS user_professions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  profession_id INTEGER NOT NULL,
  licence_number TEXT,
  state TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE,
  UNIQUE(user_id, profession_id)
);

-- User Job Types (Many-to-Many)
CREATE TABLE IF NOT EXISTS user_job_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  job_type_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_type_id) REFERENCES job_types(id) ON DELETE CASCADE,
  UNIQUE(user_id, job_type_id)
);

-- User Qualifications
CREATE TABLE IF NOT EXISTS user_qualifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  year_obtained INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tier TEXT NOT NULL,
  credits_included INTEGER NOT NULL,
  credits_remaining INTEGER NOT NULL,
  price_per_week DECIMAL(10,2),
  discount_percent DECIMAL(5,2) DEFAULT 0,
  early_access_hours INTEGER DEFAULT 24,
  starts_at TIMESTAMP NOT NULL,
  renews_at TIMESTAMP,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Contact Transactions
CREATE TABLE IF NOT EXISTS contact_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user_id INTEGER NOT NULL,
  to_user_id INTEGER NOT NULL,
  job_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  credits_used INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  reviewer_id INTEGER NOT NULL,
  reviewee_id INTEGER NOT NULL,
  stars INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
  comment TEXT,
  credit_awarded BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(job_id, reviewer_id, reviewee_id)
);

-- Poster Packages
CREATE TABLE IF NOT EXISTS poster_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  job_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  tradies_unlocked INTEGER DEFAULT 0,
  tradies_limit INTEGER NOT NULL,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- ============================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_professions_category ON professions(category);
CREATE INDEX IF NOT EXISTS idx_job_types_category ON job_types(category);
CREATE INDEX IF NOT EXISTS idx_user_professions_user ON user_professions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_job_types_user ON user_job_types(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type_id);
CREATE INDEX IF NOT EXISTS idx_jobs_is_god_tier ON jobs(is_god_tier);
CREATE INDEX IF NOT EXISTS idx_contact_transactions_from ON contact_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_contact_transactions_to ON contact_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_contact_transactions_job ON contact_transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_job ON reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_poster_packages_user ON poster_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_poster_packages_job ON poster_packages(job_id);
