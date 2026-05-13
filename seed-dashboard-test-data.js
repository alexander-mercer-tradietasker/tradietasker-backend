#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function seedTestData() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    console.log('🌱 Seeding Customer Dashboard test data...\n');

    // Create test customer
    const passwordHash = await bcrypt.hash('password123', 10);
    const customerResult = await pool.query(
      `INSERT INTO users (name, email, password_hash, phone, role, tier, credits, created_at)
       VALUES ($1, $2, $3, $4, 'poster', 'free', 10, NOW())
       ON CONFLICT (email) DO UPDATE 
       SET phone = EXCLUDED.phone, credits = EXCLUDED.credits
       RETURNING id`,
      ['Sarah Customer', 'customer@test.com', passwordHash, '0412345678']
    );
    const customerId = customerResult.rows[0].id;
    console.log(`✓ Customer created: Sarah Customer (ID: ${customerId})`);

    // Create test tradies
    const tradie1Result = await pool.query(
      `INSERT INTO users (name, email, password_hash, phone, role, tier, created_at)
       VALUES ($1, $2, $3, $4, 'tasker', 'bronze', NOW())
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Bob Builder', 'bob@tradie.com', passwordHash, '0423456789']
    );
    const tradie1Id = tradie1Result.rows[0].id;
    console.log(`✓ Tradie 1 created: Bob Builder (ID: ${tradie1Id})`);

    const tradie2Result = await pool.query(
      `INSERT INTO users (name, email, password_hash, phone, role, tier, created_at)
       VALUES ($1, $2, $3, $4, 'tasker', 'silver', NOW())
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Lisa Electrician', 'lisa@tradie.com', passwordHash, '0434567890']
    );
    const tradie2Id = tradie2Result.rows[0].id;
    console.log(`✓ Tradie 2 created: Lisa Electrician (ID: ${tradie2Id})`);

    // Get a job type ID
    const jobTypeResult = await pool.query(
      `SELECT id FROM job_types WHERE name LIKE '%Repair%' OR name LIKE '%Electrical%' LIMIT 1`
    );
    const jobTypeId = jobTypeResult.rows[0]?.id || 1;

    // Create test jobs
    const job1Result = await pool.query(
      `INSERT INTO jobs (
        poster_id, poster_name, title, category, job_type_id,
        description, location, budget, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        customerId,
        'Sarah Customer',
        'Fix leaking kitchen tap',
        'maintenance-garden',
        jobTypeId,
        'Kitchen tap has been leaking for a week. Needs urgent repair.',
        'Sydney NSW',
        '$100-200',
        'open'
      ]
    );
    const job1Id = job1Result.rows[0]?.id;
    if (job1Id) {
      console.log(`✓ Job 1 created: Fix leaking kitchen tap (ID: ${job1Id})`);
    }

    const job2Result = await pool.query(
      `INSERT INTO jobs (
        poster_id, poster_name, title, category, job_type_id,
        description, location, budget, status, assigned_tradie_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        customerId,
        'Sarah Customer',
        'Install new light fixtures',
        'building-construction',
        jobTypeId,
        'Need to install 3 new LED light fixtures in living room.',
        'Sydney NSW',
        '$300-500',
        'in-progress',
        tradie1Id
      ]
    );
    const job2Id = job2Result.rows[0]?.id;
    if (job2Id) {
      console.log(`✓ Job 2 created: Install new light fixtures (ID: ${job2Id})`);
    }

    const job3Result = await pool.query(
      `INSERT INTO jobs (
        poster_id, poster_name, title, category, job_type_id,
        description, location, budget, status, assigned_tradie_id, completed_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() - INTERVAL '3 days', NOW() - INTERVAL '5 days')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        customerId,
        'Sarah Customer',
        'Replace broken fence panels',
        'maintenance-garden',
        jobTypeId,
        'Two fence panels broken after storm. Need replacement.',
        'Sydney NSW',
        '$400-600',
        'complete',
        tradie2Id
      ]
    );
    const job3Id = job3Result.rows[0]?.id;
    if (job3Id) {
      console.log(`✓ Job 3 created: Replace broken fence panels (ID: ${job3Id})`);
    }

    // Create contact transactions (unlocked tradies)
    if (job1Id) {
      await pool.query(
        `INSERT INTO contact_transactions (from_user_id, to_user_id, job_id, type, credits_used, created_at)
         VALUES ($1, $2, $3, 'poster-unlock-tradie', 1, NOW())
         ON CONFLICT DO NOTHING`,
        [customerId, tradie1Id, job1Id]
      );
      console.log(`✓ Unlocked Bob Builder for customer`);
    }

    if (job2Id) {
      await pool.query(
        `INSERT INTO contact_transactions (from_user_id, to_user_id, job_id, type, credits_used, created_at)
         VALUES ($1, $2, $3, 'poster-unlock-tradie', 1, NOW() - INTERVAL '2 days')
         ON CONFLICT DO NOTHING`,
        [customerId, tradie2Id, job2Id]
      );
      console.log(`✓ Unlocked Lisa Electrician for customer`);
    }

    console.log('\n✅ Test data seeded successfully!');
    console.log('\nTest login:');
    console.log('  Email: customer@test.com');
    console.log('  Password: password123');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedTestData();
