#!/usr/bin/env node
/**
 * Render Database Seeding Script
 * Seeds the Render PostgreSQL database with test data
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Render database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function seedRenderDatabase() {
  const credentials = {
    customers: [],
    tradies: [],
    jobs: []
  };

  let client;
  
  try {
    log('\n=== RENDER DATABASE SEED ===\n', 'bold');
    
    client = await pool.connect();
    log('✓ Connected to Render PostgreSQL', 'green');
    
    // Hash password once for all test users
    const passwordHash = await bcrypt.hash('password123', 10);
    log('✓ Generated password hash', 'green');
    
    // ============================================
    // 10 CUSTOMERS
    // ============================================
    log('\nCreating 10 customers...', 'cyan');
    
    const customers = [
      { name: 'Sarah Johnson', email: 'sarah.j@example.com', phone: '0412345001' },
      { name: 'David Chen', email: 'david.chen@example.com', phone: '0412345002' },
      { name: 'Emma Wilson', email: 'emma.w@example.com', phone: '0412345003' },
      { name: 'Michael Brown', email: 'michael.b@example.com', phone: '0412345004' },
      { name: 'Lisa Taylor', email: 'lisa.t@example.com', phone: '0412345005' },
      { name: 'James Anderson', email: 'james.a@example.com', phone: '0412345006' },
      { name: 'Sophie Martin', email: 'sophie.m@example.com', phone: '0412345007' },
      { name: 'Robert Lee', email: 'robert.l@example.com', phone: '0412345008' },
      { name: 'Olivia White', email: 'olivia.w@example.com', phone: '0412345009' },
      { name: 'Daniel Harris', email: 'daniel.h@example.com', phone: '0412345010' }
    ];
    
    for (const customer of customers) {
      const result = await client.query(
        `INSERT INTO users (name, email, phone, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, 'poster', NOW())
         RETURNING id`,
        [customer.name, customer.email, customer.phone, passwordHash]
      );
      
      credentials.customers.push({
        name: customer.name,
        email: customer.email,
        password: 'password123'
      });
      
      log(`  ✓ Created: ${customer.name}`, 'green');
    }
    
    // ============================================
    // 10 TRADIES
    // ============================================
    log('\nCreating 10 tradies...', 'cyan');
    
    const tradies = [
      { name: 'Jack Thompson', email: 'jack.plumber@example.com', phone: '0422345001', profession: 'Plumber', tier: 'premium' },
      { name: 'Alex Martinez', email: 'alex.electrician@example.com', phone: '0422345002', profession: 'Electrician', tier: 'standard' },
      { name: 'Chris Roberts', email: 'chris.carpenter@example.com', phone: '0422345003', profession: 'Carpenter', tier: 'premium' },
      { name: 'Sam Parker', email: 'sam.painter@example.com', phone: '0422345004', profession: 'Painter', tier: 'basic' },
      { name: 'Jordan Blake', email: 'jordan.tiler@example.com', phone: '0422345005', profession: 'Tiler', tier: 'standard' },
      { name: 'Taylor Morgan', email: 'taylor.landscaper@example.com', phone: '0422345006', profession: 'Landscaper', tier: 'premium' },
      { name: 'Casey Ford', email: 'casey.plasterer@example.com', phone: '0422345007', profession: 'Plasterer', tier: 'basic' },
      { name: 'Drew Collins', email: 'drew.roofer@example.com', phone: '0422345008', profession: 'Roofer', tier: 'standard' },
      { name: 'Riley Hughes', email: 'riley.concreter@example.com', phone: '0422345009', profession: 'Concreter', tier: 'premium' },
      { name: 'Morgan Bell', email: 'morgan.bricklayer@example.com', phone: '0422345010', profession: 'Bricklayer', tier: 'standard' }
    ];
    
    for (const tradie of tradies) {
      const result = await client.query(
        `INSERT INTO users (name, email, phone, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, 'tasker', NOW())
         RETURNING id`,
        [tradie.name, tradie.email, tradie.phone, passwordHash]
      );
      
      const userId = result.rows[0].id;
      
      // Get profession ID
      const profResult = await client.query(
        'SELECT id FROM professions WHERE name = $1',
        [tradie.profession]
      );
      
      if (profResult.rows.length > 0) {
        const professionId = profResult.rows[0].id;
        
        await client.query(
          `INSERT INTO tradie_profiles (
            user_id, profession_id, business_name, abn, tier,
            years_experience, insurance_verified, license_number,
            service_radius, profile_completed, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, 50, true, NOW())`,
          [
            userId,
            professionId,
            `${tradie.name} ${tradie.profession}`,
            `12345678${userId.toString().padStart(3, '0')}`,
            tradie.tier,
            Math.floor(Math.random() * 15) + 5,
            `LIC${userId.toString().padStart(6, '0')}`
          ]
        );
      }
      
      credentials.tradies.push({
        name: tradie.name,
        email: tradie.email,
        password: 'password123',
        profession: tradie.profession,
        tier: tradie.tier
      });
      
      log(`  ✓ Created: ${tradie.name} (${tradie.profession}, ${tradie.tier})`, 'green');
    }
    
    // ============================================
    // 10 JOBS
    // ============================================
    log('\nCreating 10 jobs...', 'cyan');
    
    const jobs = [
      { poster: 'Sarah Johnson', title: 'Bathroom Renovation', category: 'Plumbing', budget: 3500, location: 'Bondi, NSW 2026', desc: 'Complete bathroom renovation including new fixtures' },
      { poster: 'David Chen', title: 'Electrical Safety Check', category: 'Electrical', budget: 450, location: 'Parramatta, NSW 2150', desc: 'Full electrical safety inspection for home sale' },
      { poster: 'Emma Wilson', title: 'Kitchen Cabinets', category: 'Carpentry', budget: 2800, location: 'Manly, NSW 2095', desc: 'Custom kitchen cabinet installation' },
      { poster: 'Michael Brown', title: 'House Exterior Paint', category: 'Painting', budget: 4200, location: 'Hornsby, NSW 2077', desc: 'Full exterior house painting, 3-bedroom home' },
      { poster: 'Lisa Taylor', title: 'Bathroom Tiling', category: 'Tiling', budget: 1800, location: 'Chatswood, NSW 2067', desc: 'Bathroom floor and wall tiling' },
      { poster: 'James Anderson', title: 'Backyard Landscaping', category: 'Landscaping', budget: 5500, location: 'Ryde, NSW 2112', desc: 'Complete backyard makeover with paving and gardens' },
      { poster: 'Sophie Martin', title: 'Wall Repairs', category: 'Plastering', budget: 850, location: 'Newtown, NSW 2042', desc: 'Plaster repair and painting for damaged walls' },
      { poster: 'Robert Lee', title: 'Roof Leak Repair', category: 'Roofing', budget: 1200, location: 'Epping, NSW 2121', desc: 'Fix leaking roof tiles and check gutters' },
      { poster: 'Olivia White', title: 'Driveway Concrete', category: 'Concreting', budget: 6500, location: 'Castle Hill, NSW 2154', desc: 'New concrete driveway installation' },
      { poster: 'Daniel Harris', title: 'Garden Wall', category: 'Bricklaying', budget: 3200, location: 'North Sydney, NSW 2060', desc: 'Brick retaining wall for garden area' }
    ];
    
    for (const job of jobs) {
      // Find poster
      const posterResult = await client.query(
        'SELECT id FROM users WHERE name = $1 AND role = $2',
        [job.poster, 'poster']
      );
      
      if (posterResult.rows.length === 0) continue;
      
      const posterId = posterResult.rows[0].id;
      
      // Find job type
      const jobTypeResult = await client.query(
        'SELECT id FROM job_types WHERE name = $1',
        [job.category]
      );
      
      const jobTypeId = jobTypeResult.rows.length > 0 ? jobTypeResult.rows[0].id : null;
      
      await client.query(
        `INSERT INTO jobs (
          poster_id, poster_name, title, category, job_type_id,
          short_description, description, budget, location, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', NOW())`,
        [
          posterId, job.poster, job.title, job.category, jobTypeId,
          job.desc, job.desc, job.budget, job.location
        ]
      );
      
      credentials.jobs.push({
        title: job.title,
        poster: job.poster,
        budget: job.budget,
        category: job.category
      });
      
      log(`  ✓ Created: ${job.title} ($${job.budget})`, 'green');
    }
    
    // ============================================
    // SUMMARY
    // ============================================
    log('\n' + '='.repeat(80), 'bold');
    log('RENDER DATABASE SEEDING COMPLETE', 'bold');
    log('='.repeat(80) + '\n', 'bold');
    
    log('Summary:', 'cyan');
    log(`  • ${credentials.customers.length} customer accounts`, 'green');
    log(`  • ${credentials.tradies.length} tradie accounts`, 'green');
    log(`  • ${credentials.jobs.length} jobs created`, 'green');
    log(`\n  All test passwords: password123`, 'yellow');
    log(`  Admin credentials: admin / SecureAdmin2026!\n`, 'yellow');
    
  } catch (error) {
    log(`\n✗ Error seeding Render database: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run seed
seedRenderDatabase()
  .then(() => {
    log('\n✓ Seeding complete, exiting\n', 'green');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
