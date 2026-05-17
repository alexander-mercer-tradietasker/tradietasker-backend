#!/usr/bin/env node
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('\n=== RENDER DATABASE INITIALIZATION ===\n');
    
    // Drop all tables
    console.log('Dropping existing tables...');
    const tables = [
      'profession_job_types', 'user_qualifications', 'user_job_types', 'user_professions',
      'profile_unlocks', 'tradie_profiles', 'messages', 'invoices', 'transactions',
      'reviews', 'applications', 'jobs', 'job_types', 'professions',
      'subscriptions', 'poster_packages', 'contact_transactions', 'users', 'tasks'
    ];
    
    for (const table of tables) {
      try {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      } catch (e) {}
    }
    console.log('✓ Dropped\n');
    
    // Extract and execute CREATE TABLE statements
    console.log('Creating schema...');
    const schema = fs.readFileSync('db/schema-postgres.sql', 'utf8');
    const createRegex = /CREATE TABLE[^;]+;/gs;
    const createStatements = schema.match(createRegex) || [];
    
    for (const stmt of createStatements) {
      await pool.query(stmt);
    }
    console.log(`✓ Created ${createStatements.length} tables\n`);
    
    // Seed professions
    console.log('Seeding professions...');
    const profSql = fs.readFileSync('seeds/002_professions_pg.sql', 'utf8');
    await pool.query(profSql);
    console.log('✓ Professions seeded\n');
    
    // Seed job types
    console.log('Seeding job types...');
    const jobTypesSql = fs.readFileSync('seeds/003_job_types_pg.sql', 'utf8');
    await pool.query(jobTypesSql);
    console.log('✓ Job types seeded\n');
    
    // Seed test users
    console.log('Seeding test users...');
    const hash = await bcrypt.hash('password123', 10);
    
    await pool.query(`
      INSERT INTO users (name, email, phone, password_hash, role, created_at) VALUES 
      ('Sarah Johnson', 'sarah.j@example.com', '0412345001', $1, 'poster', NOW()),
      ('David Chen', 'david.chen@example.com', '0412345002', $1, 'poster', NOW()),
      ('Emma Wilson', 'emma.w@example.com', '0412345003', $1, 'poster', NOW())
    `, [hash]);
    
    const tradieRes = await pool.query(`
      INSERT INTO users (name, email, phone, password_hash, role, tier, created_at) VALUES 
      ('Jack Thompson', 'jack.plumber@example.com', '0422345001', $1, 'tasker', 'premium', NOW()),
      ('Alex Martinez', 'alex.electrician@example.com', '0422345002', $1, 'tasker', 'standard', NOW())
      RETURNING id, name
    `, [hash]);
    
    for (const {id, name} of tradieRes.rows) {
      const profRes = await pool.query(`SELECT id FROM professions WHERE name = 'Plumber' LIMIT 1`);
      if (profRes.rows.length > 0) {
        await pool.query(`
          INSERT INTO tradie_profiles (user_id, profession_id, business_name, tier, years_experience, insurance_verified, service_radius, profile_completed, created_at)
          VALUES ($1, $2, $3, 'premium', 10, true, 50, true, NOW())
        `, [id, profRes.rows[0].id, `${name} Plumbing`]);
      }
    }
    console.log('✓ Test users created\n');
    
    // Seed sample job
    console.log('Seeding sample jobs...');
    await pool.query(`
      INSERT INTO jobs (poster_id, poster_name, title, category, budget, location, description, status, created_at)
      VALUES (1, 'Sarah Johnson', 'Bathroom Renovation', 'Plumbing', 3500, 'Bondi, NSW', 'Complete bathroom renovation including new fixtures', 'open', NOW())
    `);
    console.log('✓ Sample job created\n');
    
    console.log('='.repeat(70));
    console.log('DATABASE INITIALIZATION COMPLETE');
    console.log('='.repeat(70));
    console.log('\nTest Credentials:');
    console.log('  Customers: sarah.j@example.com, david.chen@example.com, emma.w@example.com');
    console.log('  Tradies: jack.plumber@example.com, alex.electrician@example.com');
    console.log('  Password (all): password123');
    console.log('\nAdmin Credentials:');
    console.log('  Username: admin');
    console.log('  Password: SecureAdmin2026!');
    console.log('\nBackend URL: https://tradietasker-backend.onrender.com');
    console.log('Admin URL: https://tradietasker-backend.onrender.com/admin\n');
    
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
})();
