require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function seedTestData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Seeding tradie dashboard test data...');
    
    // Create a test tradie user
    const passwordHash = await bcrypt.hash('password123', 10);
    
    const tradieResult = await client.query(`
      INSERT INTO users (
        name, email, password_hash, phone, role, tier, credits,
        business_name, abn, business_address, service_postcode, service_radius_km,
        notification_prefs, created_at
      )
      VALUES ($1, $2, $3, $4, 'tasker', 'bronze', 5, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (email) DO UPDATE SET
        role = EXCLUDED.role,
        tier = EXCLUDED.tier,
        credits = EXCLUDED.credits,
        business_name = EXCLUDED.business_name
      RETURNING id
    `, [
      'Test Tradie',
      'tradie@test.com',
      passwordHash,
      '0400111222',
      'Test Tradie Plumbing',
      '12345678901',
      '123 Trade St, Sydney NSW',
      '2000',
      25,
      JSON.stringify({ email: true, sms: false })
    ]);
    
    const tradieId = tradieResult.rows[0].id;
    console.log(`✓ Test tradie created (ID: ${tradieId})`);
    
    // Add professions to tradie
    const profResult = await client.query('SELECT id FROM professions WHERE name = $1', ['Plumber']);
    if (profResult.rows.length > 0) {
      await client.query(`
        INSERT INTO user_professions (user_id, profession_id, licence_number, state, created_at)
        VALUES ($1, $2, 'NSW123456', 'NSW', NOW())
        ON CONFLICT DO NOTHING
      `, [tradieId, profResult.rows[0].id]);
      console.log('✓ Profession added to tradie');
    }
    
    // Add qualifications
    await client.query(`
      INSERT INTO user_qualifications (user_id, type, name, issuer, year_obtained, created_at)
      VALUES 
        ($1, 'licence', 'Plumbing Licence NSW', 'NSW Fair Trading', 2018, NOW()),
        ($1, 'certificate', 'White Card', 'Safe Work Australia', 2017, NOW()),
        ($1, 'other', 'Backflow Prevention', 'Master Plumbers Association', 2019, NOW())
      ON CONFLICT DO NOTHING
    `, [tradieId]);
    console.log('✓ Qualifications added');
    
    // Create a test customer
    const customerResult = await client.query(`
      INSERT INTO users (
        name, email, password_hash, phone, role, tier, credits, created_at
      )
      VALUES ($1, $2, $3, $4, 'poster', 'free', 10, NOW())
      ON CONFLICT (email) DO UPDATE SET
        credits = EXCLUDED.credits
      RETURNING id
    `, [
      'Test Customer',
      'customer@test.com',
      passwordHash,
      '0400333444'
    ]);
    
    const customerId = customerResult.rows[0].id;
    console.log(`✓ Test customer created (ID: ${customerId})`);
    
    // Create 3 test jobs
    const jobs = [
      {
        title: 'Kitchen Sink Leak Repair',
        description: 'Kitchen sink is leaking underneath. Need urgent repair.',
        budget_min: 150,
        budget_max: 300,
        location: 'Sydney',
        suburb: 'Parramatta',
        postcode: '2150',
        status: 'open'
      },
      {
        title: 'Bathroom Renovation Plumbing',
        description: 'Complete bathroom renovation. Need new plumbing for shower, sink, and toilet.',
        budget_min: 2000,
        budget_max: 4000,
        location: 'Sydney',
        suburb: 'Penrith',
        postcode: '2750',
        status: 'Applied'
      },
      {
        title: 'Hot Water System Installation',
        description: 'Old hot water system needs replacement. Looking for electric system.',
        budget_min: 800,
        budget_max: 1500,
        location: 'Sydney',
        suburb: 'Campbelltown',
        postcode: '2560',
        status: 'Assigned'
      }
    ];
    
    const jobIds = [];
    
    for (const job of jobs) {
      const jobResult = await client.query(`
        INSERT INTO jobs (
          user_id, title, description, budget_min, budget_max,
          location, suburb, postcode, status, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id
      `, [
        customerId, job.title, job.description, job.budget_min, job.budget_max,
        job.location, job.suburb, job.postcode, job.status
      ]);
      
      const jobId = jobResult.rows[0].id;
      jobIds.push(jobId);
      
      // Create profile unlock for this tradie-customer pair
      await client.query(`
        INSERT INTO profile_unlocks (
          unlocked_by_user_id, unlocked_user_id, job_id, unlocked_at
        )
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT DO NOTHING
      `, [tradieId, customerId, jobId]);
    }
    
    console.log(`✓ Created ${jobs.length} test jobs`);
    
    // Create 2 more customer contacts (unlocked)
    for (let i = 0; i < 2; i++) {
      const extraCustomerResult = await client.query(`
        INSERT INTO users (
          name, email, password_hash, phone, role, tier, credits, created_at
        )
        VALUES ($1, $2, $3, $4, 'poster', 'free', 5, NOW())
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `, [
        `Customer ${i + 2}`,
        `customer${i + 2}@test.com`,
        passwordHash,
        `040055566${i}`
      ]);
      
      if (extraCustomerResult.rows.length > 0) {
        const extraCustomerId = extraCustomerResult.rows[0].id;
        
        // Create a job for this customer
        const extraJobResult = await client.query(`
          INSERT INTO jobs (
            user_id, title, description, budget_min, budget_max,
            location, suburb, postcode, status, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', NOW())
          RETURNING id
        `, [
          extraCustomerId,
          `Past Job ${i + 1}`,
          'Completed plumbing work',
          200, 400,
          'Sydney', 'Blacktown', '2148'
        ]);
        
        const extraJobId = extraJobResult.rows[0].id;
        
        // Create profile unlock
        await client.query(`
          INSERT INTO profile_unlocks (
            unlocked_by_user_id, unlocked_user_id, job_id, unlocked_at
          )
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT DO NOTHING
        `, [tradieId, extraCustomerId, extraJobId]);
      }
    }
    
    console.log('✓ Created 2 additional unlocked customers');
    
    await client.query('COMMIT');
    console.log('\n✅ Test data seeded successfully!');
    console.log('\nTest credentials:');
    console.log('Tradie: tradie@test.com / password123');
    console.log('Customer: customer@test.com / password123');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedTestData()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
