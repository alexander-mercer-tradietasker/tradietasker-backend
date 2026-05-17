#!/usr/bin/env node
/**
 * Complete Render database setup
 * Drops and recreates the full schema, then seeds test data
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('\n=== COMPLETE RENDER DATABASE SETUP ===\n');
    
    // Drop all tables (cascade to handle foreign keys)
    console.log('Dropping existing tables...');
    const dropSql = `
      DROP TABLE IF EXISTS profession_job_types CASCADE;
      DROP TABLE IF EXISTS user_qualifications CASCADE;
      DROP TABLE IF EXISTS user_job_types CASCADE;
      DROP TABLE IF EXISTS user_professions CASCADE;
      DROP TABLE IF EXISTS profile_unlocks CASCADE;
      DROP TABLE IF EXISTS tradie_profiles CASCADE;
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS invoices CASCADE;
      DROP TABLE IF EXISTS transactions CASCADE;
      DROP TABLE IF EXISTS reviews CASCADE;
      DROP TABLE IF EXISTS applications CASCADE;
      DROP TABLE IF EXISTS jobs CASCADE;
      DROP TABLE IF EXISTS job_types CASCADE;
      DROP TABLE IF EXISTS professions CASCADE;
      DROP TABLE IF EXISTS subscriptions CASCADE;
      DROP TABLE IF EXISTS poster_packages CASCADE;
      DROP TABLE IF EXISTS contact_transactions CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS tasks CASCADE;
    `;
    await pool.query(dropSql);
    console.log('✓ Tables dropped\n');
    
    // Apply full schema
    console.log('Creating schema...');
    const schema = fs.readFileSync('db/schema-postgres.sql', 'utf8');
    const statements = schema.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'));
    
    for (const stmt of statements) {
      await pool.query(stmt);
    }
    console.log('✓ Schema created\n');
    
    // Seed professions and job types
    console.log('Seeding professions...');
    const professions = fs.readFileSync('seeds/002_professions_pg.sql', 'utf8');
    await pool.query(professions);
    console.log('✓ Professions seeded\n');
    
    console.log('Seeding job types...');
    const jobTypes = fs.readFileSync('seeds/003_job_types_pg.sql', 'utf8');
    await pool.query(jobTypes);
    console.log('✓ Job types seeded\n');
    
    // Seed test users
    console.log('Seeding test users...');
    const passwordHash = await bcrypt.hash('password123', 10);
    
    // 10 customers
    const customers = [
      ['Sarah Johnson', 'sarah.j@example.com', '0412345001'],
      ['David Chen', 'david.chen@example.com', '0412345002'],
      ['Emma Wilson', 'emma.w@example.com', '0412345003'],
      ['Michael Brown', 'michael.b@example.com', '0412345004'],
      ['Lisa Taylor', 'lisa.t@example.com', '0412345005'],
      ['James Anderson', 'james.a@example.com', '0412345006'],
      ['Sophie Martin', 'sophie.m@example.com', '0412345007'],
      ['Robert Lee', 'robert.l@example.com', '0412345008'],
      ['Olivia White', 'olivia.w@example.com', '0412345009'],
      ['Daniel Harris', 'daniel.h@example.com', '0412345010']
    ];
    
    for (const [name, email, phone] of customers) {
      await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, 'poster', NOW())`,
        [name, email, phone, passwordHash]
      );
    }
    console.log('✓ 10 customers created\n');
    
    // 10 tradies
    console.log('Seeding tradies...');
    const tradies = [
      ['Jack Thompson', 'jack.plumber@example.com', '0422345001', 'Plumber', 'premium'],
      ['Alex Martinez', 'alex.electrician@example.com', '0422345002', 'Electrician', 'standard'],
      ['Chris Roberts', 'chris.carpenter@example.com', '0422345003', 'Carpenter', 'premium'],
      ['Sam Parker', 'sam.painter@example.com', '0422345004', 'Painter', 'basic'],
      ['Jordan Blake', 'jordan.tiler@example.com', '0422345005', 'Tiler', 'standard'],
      ['Taylor Morgan', 'taylor.landscaper@example.com', '0422345006', 'Landscaper', 'premium'],
      ['Casey Ford', 'casey.plasterer@example.com', '0422345007', 'Plasterer', 'basic'],
      ['Drew Collins', 'drew.roofer@example.com', '0422345008', 'Roofer', 'standard'],
      ['Riley Hughes', 'riley.concreter@example.com', '0422345009', 'Concreter', 'premium'],
      ['Morgan Bell', 'morgan.bricklayer@example.com', '0422345010', 'Bricklayer', 'standard']
    ];
    
    for (const [name, email, phone, profession, tier] of tradies) {
      const userRes = await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, role, tier, created_at)
         VALUES ($1, $2, $3, $4, 'tasker', $5, NOW())
         RETURNING id`,
        [name, email, phone, passwordHash, tier]
      );
      
      const userId = userRes.rows[0].id;
      
      // Get profession ID
      const profRes = await pool.query(
        'SELECT id FROM professions WHERE name = $1',
        [profession]
      );
      
      if (profRes.rows.length > 0) {
        const professionId = profRes.rows[0].id;
        
        await pool.query(
          `INSERT INTO tradie_profiles (
            user_id, profession_id, business_name, abn, tier,
            years_experience, insurance_verified, license_number,
            service_radius, profile_completed, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, 50, true, NOW())`,
          [
            userId,
            professionId,
            `${name} ${profession}`,
            `12345678${userId.toString().padStart(3, '0')}`,
            tier,
            Math.floor(Math.random() * 15) + 5,
            `LIC${userId.toString().padStart(6, '0')}`
          ]
        );
      }
    }
    console.log('✓ 10 tradies created\n');
    
    // Seed 10 jobs
    console.log('Seeding jobs...');
    const jobs = [
      [1, 'Sarah Johnson', 'Bathroom Renovation', 'Plumbing', 3500, 'Bondi, NSW 2026', 'Complete bathroom renovation including new fixtures'],
      [2, 'David Chen', 'Electrical Safety Check', 'Electrical', 450, 'Parramatta, NSW 2150', 'Full electrical safety inspection for home sale'],
      [3, 'Emma Wilson', 'Kitchen Cabinets', 'Carpentry', 2800, 'Manly, NSW 2095', 'Custom kitchen cabinet installation'],
      [4, 'Michael Brown', 'House Exterior Paint', 'Painting', 4200, 'Hornsby, NSW 2077', 'Full exterior house painting, 3-bedroom home'],
      [5, 'Lisa Taylor', 'Bathroom Tiling', 'Tiling', 1800, 'Chatswood, NSW 2067', 'Bathroom floor and wall tiling'],
      [6, 'James Anderson', 'Backyard Landscaping', 'Landscaping', 5500, 'Ryde, NSW 2112', 'Complete backyard makeover with paving and gardens'],
      [7, 'Sophie Martin', 'Wall Repairs', 'Plastering', 850, 'Newtown, NSW 2042', 'Plaster repair and painting for damaged walls'],
      [8, 'Robert Lee', 'Roof Leak Repair', 'Roofing', 1200, 'Epping, NSW 2121', 'Fix leaking roof tiles and check gutters'],
      [9, 'Olivia White', 'Driveway Concrete', 'Concreting', 6500, 'Castle Hill, NSW 2154', 'New concrete driveway installation'],
      [10, 'Daniel Harris', 'Garden Wall', 'Bricklaying', 3200, 'North Sydney, NSW 2060', 'Brick retaining wall for garden area']
    ];
    
    for (const [posterId, posterName, title, category, budget, location, description] of jobs) {
      const jobTypeRes = await pool.query(
        'SELECT id FROM job_types WHERE name = $1',
        [category]
      );
      
      const jobTypeId = jobTypeRes.rows.length > 0 ? jobTypeRes.rows[0].id : null;
      
      await pool.query(
        `INSERT INTO jobs (
          poster_id, poster_name, title, category, job_type_id,
          short_description, description, budget, location, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', NOW())`,
        [posterId, posterName, title, category, jobTypeId, description, description, budget, location]
      );
    }
    console.log('✓ 10 jobs created\n');
    
    console.log('='.repeat(80));
    console.log('RENDER DATABASE SETUP COMPLETE');
    console.log('='.repeat(80));
    console.log('\nTest credentials:');
    console.log('  Customer logins: sarah.j@example.com ... daniel.h@example.com');
    console.log('  Tradie logins: jack.plumber@example.com ... morgan.bricklayer@example.com');
    console.log('  Password (all): password123');
    console.log('\nAdmin credentials:');
    console.log('  Username: admin');
    console.log('  Password: SecureAdmin2026!');
    console.log('\nBackend URL: https://tradietasker-backend.onrender.com\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main();
