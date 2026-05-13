const { run, query, get } = require('./db/connection');
const bcrypt = require('bcryptjs');

async function seedTestData() {
  console.log('Seeding test data for tradie dashboard...\n');

  try {
    // Delete existing test users
    await run('DELETE FROM users WHERE email IN (?, ?, ?)', [
      'tradie@test.com', 'customer@test.com', 'customer2@test.com'
    ]);
    console.log('✓ Cleaned up existing test data\n');

    // Create test tradie user
    const passwordHash = await bcrypt.hash('password123', 10);
    
    const tradieResult = await run(
      `INSERT INTO users (
        name, email, password, phone, role, tier, credits,
        business_name, abn, service_postcode, service_radius_km,
        profile_photo, business_logo,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        'Test Tradie',
        'tradie@test.com',
        passwordHash,
        '0412345678',
        'tasker',
        'bronze',
        50,
        'Test Tradie Services Pty Ltd',
        '12345678901',
        '2000',
        50,
        'https://via.placeholder.com/150',
        'https://via.placeholder.com/150'
      ]
    );
    
    const tradieId = tradieResult.lastID;
    console.log(`✓ Created test tradie (ID: ${tradieId})`);

    // Add profession to tradie
    const professions = await query('SELECT id FROM professions LIMIT 3');
    for (const prof of professions) {
      await run(
        `INSERT INTO user_professions (user_id, profession_id, created_at)
         VALUES (?, ?, datetime('now'))`,
        [tradieId, prof.id]
      );
    }
    console.log(`✓ Added ${professions.length} professions to tradie`);

    // Add qualifications
    await run(
      `INSERT INTO user_qualifications (user_id, type, name, year_obtained, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [tradieId, 'tafe', 'Certificate III in Carpentry', 2015]
    );
    await run(
      `INSERT INTO user_qualifications (user_id, type, name, year_obtained, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [tradieId, 'other', 'White Card', 2014]
    );
    console.log('✓ Added 2 qualifications');

    // Create test poster (customer)
    const posterResult = await run(
      `INSERT INTO users (
        name, email, password, phone, role, tier, credits,
        residential_address, residential_suburb, residential_state, residential_postcode,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        'Test Customer',
        'customer@test.com',
        passwordHash,
        '0498765432',
        'poster',
        'free',
        0,
        '123 Test Street',
        'Sydney',
        'NSW',
        '2000'
      ]
    );
    
    const posterId = posterResult.lastID;
    console.log(`✓ Created test customer (ID: ${posterId})`);

    // Get job type
    const jobType = await get('SELECT id FROM job_types LIMIT 1');
    if (!jobType) {
      console.error('❌ No job types found. Run profession/job type seeds first.');
      process.exit(1);
    }

    // Create 3 test jobs
    const jobs = [
      {
        title: 'Kitchen Renovation',
        description: 'Complete kitchen renovation including new cabinets, benchtops, and tiling. Budget is flexible for quality work.',
        budget: '15000',
        location: 'Sydney, NSW 2000'
      },
      {
        title: 'Deck Building',
        description: 'Looking to build a 4m x 6m timber deck in the backyard. Materials already purchased.',
        budget: '5000',
        location: 'Parramatta, NSW 2150'
      },
      {
        title: 'Bathroom Waterproofing',
        description: 'Bathroom shower area needs complete waterproofing. Tiles to be replaced after.',
        budget: '3500',
        location: 'Bondi, NSW 2026'
      }
    ];

    const jobIds = [];
    for (const job of jobs) {
      const result = await run(
        `INSERT INTO jobs (
          poster_id, poster_name, job_type_id, category, title, description,
          budget, location, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now'))`,
        [
          posterId,
          'Test Customer',
          jobType.id,
          'general',
          job.title,
          job.description,
          job.budget,
          job.location
        ]
      );
      jobIds.push(result.lastID);
    }
    console.log(`✓ Created ${jobs.length} test jobs`);

    // Create contact transactions (tradie unlocked 2 customers/jobs)
    await run(
      `INSERT INTO contact_transactions (
        from_user_id, to_user_id, job_id, type, credits_used, created_at
      ) VALUES (?, ?, ?, 'full-contact', 5, datetime('now'))`,
      [tradieId, posterId, jobIds[0]]
    );
    await run(
      `INSERT INTO contact_transactions (
        from_user_id, to_user_id, job_id, type, credits_used, created_at
      ) VALUES (?, ?, ?, 'full-contact', 5, datetime('now'))`,
      [tradieId, posterId, jobIds[1]]
    );
    console.log('✓ Created 2 contact unlock transactions');

    // Create an application from tradie to job 3
    await run(
      `INSERT INTO applications (
        job_id, tradie_id, tradie_name, tradie_email, message, status, created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`,
      [jobIds[2], tradieId, 'Test Tradie', 'tradie@test.com', 'I would love to help with this job!']
    );
    console.log('✓ Created 1 job application');

    // Create a second customer
    const poster2Result = await run(
      `INSERT INTO users (
        name, email, password, phone, role, tier, credits,
        residential_address, residential_suburb, residential_state, residential_postcode,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        'Another Customer',
        'customer2@test.com',
        passwordHash,
        '0411223344',
        'poster',
        'free',
        0,
        '456 Another Road',
        'Newtown',
        'NSW',
        '2042'
      ]
    );
    
    const poster2Id = poster2Result.lastID;
    
    // Create another job and unlock it
    const job4Result = await run(
      `INSERT INTO jobs (
        poster_id, poster_name, job_type_id, category, title, description,
        budget, location, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now'))`,
      [
        poster2Id,
        'Another Customer',
        jobType.id,
        'general',
        'Fence Repair',
        'Timber fence needs repair after storm damage. About 10 meters of fencing.',
        '2000',
        'Newtown, NSW 2042'
      ]
    );
    
    await run(
      `INSERT INTO contact_transactions (
        from_user_id, to_user_id, job_id, type, credits_used, created_at
      ) VALUES (?, ?, ?, 'full-contact', 5, datetime('now'))`,
      [tradieId, poster2Id, job4Result.lastID]
    );
    console.log('✓ Created second customer with job and unlock');

    console.log('\n✅ Test data seeded successfully!');
    console.log('\nTest credentials:');
    console.log('  Tradie: tradie@test.com / password123');
    console.log('  Customer 1: customer@test.com / password123');
    console.log('  Customer 2: customer2@test.com / password123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedTestData();
