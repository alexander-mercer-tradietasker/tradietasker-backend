#!/bin/bash
# Final Render database setup with proper password escaping

export DATABASE_URL="postgresql://tradietasker_db_user:T0ZsNNEiWpjmjvZ31P6wmnsKbJcimoV7@dpg-d84q5dh9rddc739q9gp0-a.singapore-postgres.render.com:5432/tradietasker_db"

node <<'NODESCRIPT'
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('=== RENDER DATABASE SETUP ===\n');
    
    // Drop tables
    console.log('Dropping tables...');
    const dropTables = [
      'profession_job_types', 'user_qualifications', 'user_job_types', 'user_professions',
      'profile_unlocks', 'tradie_profiles', 'messages', 'invoices', 'transactions',
      'reviews', 'applications', 'jobs', 'job_types', 'professions',
      'subscriptions', 'poster_packages', 'contact_transactions', 'users', 'tasks'
    ];
    
    for (const table of dropTables) {
      try {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      } catch (e) {}
    }
    console.log('✓ Dropped\n');
    
    // Create tables
    console.log('Creating schema...');
    const schema = fs.readFileSync('db/schema-postgres.sql', 'utf8');
    const creates = schema.split(';').filter(s => s.trim().startsWith('CREATE TABLE'));
    
    for (const stmt of creates) {
      await pool.query(stmt);
    }
    console.log(`✓ ${creates.length} tables\n`);
    
    // Professions
    console.log('Seeding professions...');
    await pool.query(fs.readFileSync('seeds/002_professions_pg.sql', 'utf8'));
    console.log('✓ Done\n');
    
    // Job types
    console.log('Seeding job types...');
    await pool.query(fs.readFileSync('seeds/003_job_types_pg.sql', 'utf8'));
    console.log('✓ Done\n');
    
    // Users
    console.log('Seeding users...');
    const hash = await bcrypt.hash('password123', 10);
    
    await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, created_at) VALUES 
      ('Sarah Johnson', 'sarah.j@example.com', '0412345001', $1, 'poster', NOW()),
      ('David Chen', 'david.chen@example.com', '0412345002', $1, 'poster', NOW()),
      ('Emma Wilson', 'emma.w@example.com', '0412345003', $1, 'poster', NOW())`,
      [hash]
    );
    
    const tradieRes = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, tier, created_at) VALUES 
      ('Jack Thompson', 'jack.plumber@example.com', '0422345001', $1, 'tasker', 'premium', NOW()),
      ('Alex Martinez', 'alex.electrician@example.com', '0422345002', $1, 'tasker', 'standard', NOW())
      RETURNING id`,
      [hash]
    );
    
    for (const row of tradieRes.rows) {
      const profRes = await pool.query(`SELECT id FROM professions WHERE name = 'Plumber' LIMIT 1`);
      if (profRes.rows.length > 0) {
        await pool.query(
          `INSERT INTO tradie_profiles (user_id, profession_id, business_name, tier, years_experience, insurance_verified, service_radius, profile_completed, created_at)
           VALUES ($1, $2, 'Sample Plumber', 'premium', 10, true, 50, true, NOW())`,
          [row.id, profRes.rows[0].id]
        );
      }
    }
    console.log('✓ Done\n');
    
    // Job
    await pool.query(
      `INSERT INTO jobs (poster_id, poster_name, title, category, budget, location, description, status, created_at)
       VALUES (1, 'Sarah Johnson', 'Bathroom Renovation', 'Plumbing', 3500, 'Bondi, NSW', 'Complete bathroom renovation', 'open', NOW())`
    );
    console.log('✓ Sample job\n');
    
    console.log('='.repeat(60));
    console.log('SETUP COMPLETE');
    console.log('='.repeat(60));
    console.log('Logins: sarah.j@example.com, jack.plumber@example.com');
    console.log('Password: password123');
    console.log('Admin: admin / SecureAdmin2026!');
    console.log('Backend: https://tradietasker-backend.onrender.com\n');
    
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
NODESCRIPT
