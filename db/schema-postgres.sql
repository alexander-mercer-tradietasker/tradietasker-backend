-- TradieTasker Database Schema - PostgreSQL Version
-- Phase 1: Complete schema including existing and new tables
-- Created: 2026-05-11

-- ============================================
-- USERS TABLE (Updated with new fields)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'poster', -- 'poster', 'tasker', 'both'
  
  -- Personal Information
  date_of_birth DATE,
  phone TEXT,
  residential_address TEXT,
  residential_suburb TEXT,
  residential_state TEXT,
  residential_postcode TEXT,
  postal_address TEXT,
  postal_postcode TEXT,
  
  -- Business Information
  abn TEXT,
  business_name TEXT,
  business_address TEXT,
  business_phone TEXT,
  business_email TEXT,
  business_logo_url TEXT,
  profile_photo_url TEXT,
  
  -- Service Area (for taskers)
  service_radius_km INTEGER DEFAULT 25,
  service_postcode TEXT,
  
  -- Subscription & Credits
  tier TEXT DEFAULT 'free', -- 'free', 'bronze', 'silver', 'gold', 'platinum', 'god'
  credits INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROFESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS professions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- 'core-trades', 'specialised', 'adjacent', 'maintenance', 'home-services', 'transport'
  requires_licence BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- JOB TYPES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS job_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- 'building-construction', 'maintenance-garden', 'transport-delivery'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- USER PROFESSIONS (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS user_professions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  profession_id INTEGER NOT NULL,
  licence_number TEXT,
  state TEXT, -- NSW, VIC, QLD, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (profession_id) REFERENCES professions(id) ON DELETE CASCADE,
  UNIQUE(user_id, profession_id)
);

-- ============================================
-- USER JOB TYPES (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS user_job_types (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  job_type_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_type_id) REFERENCES job_types(id) ON DELETE CASCADE,
  UNIQUE(user_id, job_type_id)
);

-- ============================================
-- USER QUALIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS user_qualifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'tafe', 'university', 'other'
  name TEXT NOT NULL,
  year_obtained INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  tier TEXT NOT NULL, -- 'free', 'bronze', 'silver', 'gold', 'platinum', 'god'
  credits_included INTEGER NOT NULL,
  credits_remaining INTEGER NOT NULL,
  price_per_week DECIMAL(10,2),
  discount_percent DECIMAL(5,2) DEFAULT 0,
  early_access_hours INTEGER DEFAULT 24, -- 24=free, 3=bronze, 2=silver, 1=gold, 0=platinum/god
  starts_at TIMESTAMP NOT NULL,
  renews_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- JOBS TABLE (Updated with new fields)
-- ============================================
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  poster_id INTEGER NOT NULL,
  poster_name TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- Legacy field, will map to job_type_id
  job_type_id INTEGER,
  
  -- Job Descriptions
  description TEXT NOT NULL, -- Legacy full description
  short_description TEXT, -- Visible to paid tiers
  full_description TEXT, -- Visible after full contact
  
  location TEXT NOT NULL,
  budget TEXT,
  photos TEXT, -- JSON array of photo URLs
  
  -- Job Status
  status TEXT DEFAULT 'open', -- 'open', 'awarded', 'in-progress', 'complete', 'cancelled'
  awarded_to_user_id INTEGER,
  completed_at TIMESTAMP,
  
  -- God Tier
  is_god_tier BOOLEAN DEFAULT FALSE, -- Only visible to god-tier users
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (poster_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_type_id) REFERENCES job_types(id),
  FOREIGN KEY (awarded_to_user_id) REFERENCES users(id)
);

-- ============================================
-- JOB APPLICATIONS TABLE (Existing)
-- ============================================
CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  tradie_id INTEGER NOT NULL,
  tradie_name TEXT NOT NULL,
  tradie_email TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (tradie_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- CONTACT TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contact_transactions (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL, -- Who initiated the contact
  to_user_id INTEGER NOT NULL, -- Who received the contact
  job_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'send-profile', 'full-contact', 'poster-unlock-tradie', 'poster-3-pack', 'poster-20-pack'
  credits_used INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- ============================================
-- REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL,
  reviewer_id INTEGER NOT NULL,
  reviewee_id INTEGER NOT NULL,
  stars INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
  comment TEXT,
  credit_awarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(job_id, reviewer_id, reviewee_id) -- One review per job per user pair
);

-- ============================================
-- POSTER PACKAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS poster_packages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL, -- Poster who bought the package
  job_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- '3-tradie', '20-tradie'
  tradies_unlocked INTEGER DEFAULT 0,
  tradies_limit INTEGER NOT NULL,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_professions_category ON professions(category);
CREATE INDEX IF NOT EXISTS idx_job_types_category ON job_types(category);
CREATE INDEX IF NOT EXISTS idx_user_professions_user ON user_professions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_job_types_user ON user_job_types(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_poster ON jobs(poster_id);
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type_id);
CREATE INDEX IF NOT EXISTS idx_jobs_is_god_tier ON jobs(is_god_tier);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_tradie ON applications(tradie_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_contact_transactions_from ON contact_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_contact_transactions_to ON contact_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_contact_transactions_job ON contact_transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_job ON reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_poster_packages_user ON poster_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_poster_packages_job ON poster_packages(job_id);
-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  subject VARCHAR(255),
  body TEXT NOT NULL,
  thread_id VARCHAR(36) NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, read);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
