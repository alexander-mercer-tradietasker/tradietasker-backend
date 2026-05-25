-- Simple dummy data for Postgres

-- Users (customers and tradies)
INSERT INTO users (id, email, password_hash, name, role, residential_suburb, credits, tier)
VALUES
  (1, 'customer1@test.com', '$2a$10$test', 'Customer One', 'poster', 'Sydney', 10, 'free'),
  (2, 'customer2@test.com', '$2a$10$test', 'Customer Two', 'poster', 'Melbourne', 5, 'free'),
  (3, 'tradie1@test.com', '$2a$10$test', 'Tradie One', 'tasker', 'Sydney', 0, 'free'),
  (4, 'tradie2@test.com', '$2a$10$test', 'Tradie Two', 'tasker', 'Sydney', 0, 'bronze'),
  (5, 'tradie3@test.com', '$2a$10$test', 'Tradie Three', 'tasker', 'Melbourne', 0, 'silver')
ON CONFLICT (email) DO NOTHING;

-- Jobs
INSERT INTO jobs (id, user_id, job_type_id, title, poster_name, description, category, location, budget, status, urgency, created_at)
VALUES
  (1, 1, 1, 'Plumbing Job', 'Customer One', 'Fix leaking tap', 'plumbing', 'Sydney', '$200', 'open', 'flexible', NOW() - INTERVAL '2 days'),
  (2, 1, 2, 'Electrical Work', 'Customer One', 'Install new lights', 'electrical', 'Sydney', '$500', 'open', 'flexible', NOW() - INTERVAL '1 days'),
  (3, 2, 3, 'Painting', 'Customer Two', 'Paint living room', 'painting', 'Melbourne', '$800', 'open', 'flexible', NOW() - INTERVAL '3 days');

-- Admin account
INSERT INTO users (id, email, password_hash, name, role, residential_suburb, credits, tier)
VALUES
  (100, 'admin@tradietasker.com.au', '$2a$10$8K1p/a0dL3eH.WPqKa8hyu7z.vfZwVqLc1Q9L6YlKb9p0xCvV.j0C', 'Admin', 'admin', 'Sydney', 0, 'free')
ON CONFLICT (email) DO NOTHING;
