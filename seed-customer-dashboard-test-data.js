#!/usr/bin/env node
/**
 * Seed test data for Customer Dashboard testing
 */

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
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🌱 Seeding customer dashboard test data...\n');

    // 1. Create test customer
    const passwordHash = await bcrypt.hash('password123', 10);
    
    let customer;
    const existingCustomer = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['testcustomer@example.com']
    );

    if (existingCustomer.rows.length > 0) {
      customer = existingCustomer.rows[0];
      console.log('✓ Using existing test customer (ID:', customer.id, ')');
    } else {
      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, phone, role, tier, credits, created_at)
         VALUES ($1, $2, $3, $4, 'poster', 'free', 10, NOW())
         RETURNING id`,
        ['Test Customer', 'testcustomer@example.com', passwordHash, '0400123456']
      );
      customer = result.rows[0];
      console.log('✓ Created test customer (ID:', customer.id, ')');
    }

    // 2. Create test tradies
    const tradieNames = ['John Smith', 'Sarah Johnson'];
    const tradieIds = [];

    for (const name of tradieNames) {
      const email = name.toLowerCase().replace(' ', '') + '@tradie.com';
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

      if (existing.rows.length > 0) {
        tradieIds.push(existing.rows[0].id);
        console.log(`✓ Using existing tradie: ${name} (ID: ${existing.rows[0].id})`);
      } else {
        const result = await pool.query(
          `INSERT INTO users (name, email, password_hash, phone, role, tier, credits, created_at)
           VALUES ($1, $2, $3, $4, 'tasker', 'bronze', 5, NOW())
           RETURNING id`,
          [name, email, passwordHash, '0400' + Math.floor(Math.random() * 1000000)]
        );
        tradieIds.push(result.rows[0].id);
        console.log(`✓ Created tradie: ${name} (ID: ${result.rows[0].id})`);
      }
    }

    // 3. Get a job type
    const jobTypeResult = await pool.query('SELECT id FROM job_types LIMIT 1');
    const jobTypeId = jobTypeResult.rows[0].id;

    // 4. Create test jobs with different statuses
    const jobData = [
      {
        title: 'Fix Leaking Tap',
        status: 'open',
        assigned_tradie_id: null
      },
      {
        title: 'Install Kitchen Cabinets',
        status: 'in-progress',
        assigned_tradie_id: tradieIds[0]
      },
      {
        title: 'Paint Living Room',
        status: 'complete',
        assigned_tradie_id: tradieIds[1]
      }
    ];

    console.log('\n📋 Creating test jobs...');
    const createdJobs = [];

    for (const job of jobData) {
      const result = await pool.query(
        `INSERT INTO jobs (
          user_id, job_type_id, title, short_description, full_description,
          budget, postcode, suburb, state, status, assigned_tradie_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING id`,
        [
          customer.id,
          jobTypeId,
          job.title,
          'Short description for ' + job.title,
          'Full description for ' + job.title + '. This is a detailed description of the work required.',
          '500',
          '2000',
          'Sydney',
          'NSW',
          job.status,
          job.assigned_tradie_id
        ]
      );
      
      const jobId = result.rows[0].id;
      createdJobs.push({ id: jobId, ...job });
      console.log(`  ✓ ${job.title} (${job.status}) - ID: ${jobId}`);
    }

    // 5. Create unlock transactions for assigned tradies
    console.log('\n🔓 Creating unlock transactions...');
    for (const job of createdJobs) {
      if (job.assigned_tradie_id) {
        await pool.query(
          `INSERT INTO contact_transactions (from_user_id, to_user_id, job_id, type, credits_used, created_at)
           VALUES ($1, $2, $3, 'poster-unlock-tradie', 1, NOW())`,
          [customer.id, job.assigned_tradie_id, job.id]
        );
        console.log(`  ✓ Unlocked tradie for: ${job.title}`);
      }
    }

    // 6. Add professions to tradies
    console.log('\n👷 Adding professions to tradies...');
    const professionResult = await pool.query('SELECT id FROM professions LIMIT 2');
    
    for (let i = 0; i < tradieIds.length && i < professionResult.rows.length; i++) {
      await pool.query(
        `INSERT INTO user_professions (user_id, profession_id, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, profession_id) DO NOTHING`,
        [tradieIds[i], professionResult.rows[i].id]
      );
    }
    console.log('  ✓ Professions added');

    console.log('\n✅ Test data seeded successfully!\n');
    console.log('📝 Test credentials:');
    console.log('   Email: testcustomer@example.com');
    console.log('   Password: password123');
    console.log('\n📊 Test data summary:');
    console.log(`   Customer: ${customer.id}`);
    console.log(`   Tradies: ${tradieIds.join(', ')}`);
    console.log(`   Jobs: ${createdJobs.length} (open: 1, in-progress: 1, complete: 1)`);

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedTestData();
