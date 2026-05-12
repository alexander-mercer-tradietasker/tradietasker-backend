#!/usr/bin/env node
/**
 * Expanded Test Data Seed Script
 * Creates 10 customers, 10 tradies, 10 jobs with documented credentials
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbConfig = require('./db/connection');
const { run, get } = require('./db/connection');

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

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function seedExpandedTestData() {
  const credentials = {
    customers: [],
    tradies: [],
    jobs: []
  };

  try {
    log('\n=== EXPANDED TEST DATA SEED ===\n', 'bold');
    
    // Hash password once for all test users
    const passwordHash = await hashPassword('password123');
    log('✓ Generated password hash', 'green');
    
    // ============================================
    // 10 CUSTOMERS
    // ============================================
    log('\nCreating 10 customers...', 'cyan');
    
    const customers = [
      { name: 'Sarah Mitchell', email: 'sarah@example.com', phone: '0412 345 001' },
      { name: 'David Chen', email: 'david@example.com', phone: '0412 345 002' },
      { name: 'Emma Wilson', email: 'emma@example.com', phone: '0412 345 003' },
      { name: 'James Taylor', email: 'james@example.com', phone: '0412 345 004' },
      { name: 'Olivia Brown', email: 'olivia@example.com', phone: '0412 345 005' },
      { name: 'William Johnson', email: 'william@example.com', phone: '0412 345 006' },
      { name: 'Sophia Davis', email: 'sophia@example.com', phone: '0412 345 007' },
      { name: 'Lucas Martinez', email: 'lucas@example.com', phone: '0412 345 008' },
      { name: 'Mia Anderson', email: 'mia@example.com', phone: '0412 345 009' },
      { name: 'Ethan White', email: 'ethan@example.com', phone: '0412 345 010' }
    ];
    
    for (const customer of customers) {
      const existing = await get('SELECT id FROM users WHERE email = ?', [customer.email]);
      if (existing) {
        log(`  - ${customer.name} already exists`, 'yellow');
        credentials.customers.push({
          name: customer.name,
          email: customer.email,
          password: 'password123',
          role: 'customer'
        });
        continue;
      }
      
      await run(
        `INSERT INTO users (name, email, password_hash, phone, role, tier, credits, created_at)
         VALUES (?, ?, ?, ?, 'poster', 'free', 0, datetime('now'))`,
        [customer.name, customer.email, passwordHash, customer.phone]
      );
      
      credentials.customers.push({
        name: customer.name,
        email: customer.email,
        password: 'password123',
        role: 'customer'
      });
      
      log(`  ✓ Created: ${customer.name} (${customer.email})`, 'green');
    }
    
    // ============================================
    // 10 TRADIES
    // ============================================
    log('\nCreating 10 tradies...', 'cyan');
    
    const tradies = [
      {
        name: 'Mike Thompson', email: 'mike@tradie.test', phone: '0445 678 001',
        tier: 'silver', credits: 25, dob: '1985-06-15',
        address: '12 Builder St', suburb: 'Sydney', state: 'NSW', postcode: '2000',
        abn: '12345678001', business_name: 'Mike Thompson Plumbing',
        service_postcode: '2000', service_radius: 25,
        profession: 'Plumber', licence: 'PL12345',
        jobTypes: ['Plumbing Installation', 'Plumbing Repair', 'Drainage Work', 'Bathroom Renovation']
      },
      {
        name: 'Lisa Rodriguez', email: 'lisa@tradie.test', phone: '0445 678 002',
        tier: 'gold', credits: 40, dob: '1990-03-22',
        address: '45 Sparky Ave', suburb: 'Parramatta', state: 'NSW', postcode: '2150',
        abn: '12345678002', business_name: 'Rodriguez Electrical',
        service_postcode: '2150', service_radius: 30,
        profession: 'Electrician', licence: 'EL67890',
        jobTypes: ['Electrical Installation', 'Electrical Repair', 'Home Automation', 'Security System Installation']
      },
      {
        name: 'Tom Anderson', email: 'tom@tradie.test', phone: '0445 678 003',
        tier: 'bronze', credits: 10, dob: '1988-11-30',
        address: '78 Carpenter Rd', suburb: 'Bondi', state: 'NSW', postcode: '2026',
        abn: '12345678003', business_name: 'Anderson Carpentry',
        service_postcode: '2026', service_radius: 20,
        profession: 'Carpenter', licence: '',
        jobTypes: ['Carpentry (General)', 'Decking Construction', 'Cabinet Making / Joinery', 'Door Installation']
      },
      {
        name: 'Sophie Lee', email: 'sophie@tradie.test', phone: '0445 678 004',
        tier: 'free', credits: 0, dob: '1992-07-08',
        address: '33 Painter Lane', suburb: 'Chatswood', state: 'NSW', postcode: '2067',
        abn: '', business_name: 'Sophie Lee Painting',
        service_postcode: '2067', service_radius: 15,
        profession: 'Painter', licence: '',
        jobTypes: ['House Painting (Interior)', 'House Painting (Exterior)', 'Painting (Commercial)']
      },
      {
        name: 'Jake Morrison', email: 'jake@tradie.test', phone: '0445 678 005',
        tier: 'platinum', credits: 60, dob: '1987-09-14',
        address: '56 Roof St', suburb: 'Manly', state: 'NSW', postcode: '2095',
        abn: '12345678005', business_name: 'Morrison Roofing',
        service_postcode: '2095', service_radius: 35,
        profession: 'Roofer', licence: 'RF45678',
        jobTypes: ['Roofing Installation', 'Roofing Repair', 'Guttering']
      },
      {
        name: 'Rachel Kim', email: 'rachel@tradie.test', phone: '0445 678 006',
        tier: 'silver', credits: 25, dob: '1991-04-21',
        address: '89 Tile Ave', suburb: 'Bondi Junction', state: 'NSW', postcode: '2022',
        abn: '12345678006', business_name: 'Kim Tiling Services',
        service_postcode: '2022', service_radius: 20,
        profession: 'Tiler', licence: '',
        jobTypes: ['Tiling', 'Bathroom Renovation', 'Kitchen Renovation']
      },
      {
        name: 'Daniel Foster', email: 'daniel@tradie.test', phone: '0445 678 007',
        tier: 'bronze', credits: 10, dob: '1989-12-03',
        address: '22 Brick Lane', suburb: 'Penrith', state: 'NSW', postcode: '2750',
        abn: '12345678007', business_name: 'Foster Bricklaying',
        service_postcode: '2750', service_radius: 25,
        profession: 'Bricklayer', licence: '',
        jobTypes: ['Bricklaying', 'Concreting (General)', 'Retaining Wall']
      },
      {
        name: 'Amy Chen', email: 'amy@tradie.test', phone: '0445 678 008',
        tier: 'gold', credits: 40, dob: '1993-01-17',
        address: '44 Garden St', suburb: 'Hornsby', state: 'NSW', postcode: '2077',
        abn: '12345678008', business_name: 'Chen Landscaping',
        service_postcode: '2077', service_radius: 30,
        profession: 'Landscaper', licence: '',
        jobTypes: ['Landscaping (Construction)', 'Garden Design', 'Turf Laying', 'Paving']
      },
      {
        name: 'Ryan Walsh', email: 'ryan@tradie.test', phone: '0445 678 009',
        tier: 'free', credits: 0, dob: '1994-08-29',
        address: '67 Clean Rd', suburb: 'Campbelltown', state: 'NSW', postcode: '2560',
        abn: '', business_name: 'Walsh Cleaning',
        service_postcode: '2560', service_radius: 15,
        profession: 'Cleaner (General)', licence: '',
        jobTypes: ['House Cleaning', 'End of Lease Cleaning', 'Commercial Cleaning']
      },
      {
        name: 'Jessica Brown', email: 'jessica@tradie.test', phone: '0445 678 010',
        tier: 'silver', credits: 25, dob: '1986-05-12',
        address: '91 Gas St', suburb: 'Liverpool', state: 'NSW', postcode: '2170',
        abn: '12345678010', business_name: 'Brown Gas Fitting',
        service_postcode: '2170', service_radius: 30,
        profession: 'Gas Fitter', licence: 'GF12345',
        jobTypes: ['Gas Fitting', 'Heating Installation', 'Appliance Installation']
      }
    ];
    
    for (const tradie of tradies) {
      const existing = await get('SELECT id FROM users WHERE email = ?', [tradie.email]);
      if (existing) {
        log(`  - ${tradie.name} already exists`, 'yellow');
        credentials.tradies.push({
          name: tradie.name,
          email: tradie.email,
          password: 'password123',
          role: 'tradie',
          tier: tradie.tier,
          profession: tradie.profession
        });
        continue;
      }
      
      // Create user
      const result = await run(
        `INSERT INTO users (
          name, email, password_hash, phone, role, tier, credits,
          date_of_birth, residential_address, residential_suburb, residential_state, residential_postcode,
          abn, business_name, business_phone, service_postcode, service_radius_km, created_at
        ) VALUES (?, ?, ?, ?, 'tasker', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          tradie.name, tradie.email, passwordHash, tradie.phone, tradie.tier, tradie.credits,
          tradie.dob, tradie.address, tradie.suburb, tradie.state, tradie.postcode,
          tradie.abn, tradie.business_name, tradie.phone, tradie.service_postcode, tradie.service_radius
        ]
      );
      
      const userId = result.lastID;
      
      credentials.tradies.push({
        name: tradie.name,
        email: tradie.email,
        password: 'password123',
        role: 'tradie',
        tier: tradie.tier,
        profession: tradie.profession
      });
      
      log(`  ✓ Created: ${tradie.name} (${tradie.email}) - ${tradie.tier} tier`, 'green');
      
      // Add profession
      const profession = await get('SELECT id FROM professions WHERE name = ?', [tradie.profession]);
      if (profession) {
        await run(
          'INSERT INTO user_professions (user_id, profession_id, licence_number, state, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
          [userId, profession.id, tradie.licence, tradie.state]
        );
      }
      
      // Add job types
      for (const jobTypeName of tradie.jobTypes) {
        const jobType = await get('SELECT id FROM job_types WHERE name = ?', [jobTypeName]);
        if (jobType) {
          await run(
            'INSERT INTO user_job_types (user_id, job_type_id, created_at) VALUES (?, ?, datetime(\'now\'))',
            [userId, jobType.id]
          );
        }
      }
    }
    
    // ============================================
    // 10 JOBS
    // ============================================
    log('\nCreating 10 jobs...', 'cyan');
    
    const jobs = [
      {
        poster_email: 'sarah@example.com', poster_name: 'Sarah Mitchell',
        title: 'Bathroom renovation needed', category: 'Plumbing',
        job_type: 'Bathroom Renovation',
        short_desc: 'Looking for qualified plumber for full bathroom renovation',
        full_desc: 'Need to replace fixtures, install new shower, and update all plumbing. Quality work required.',
        budget: '5000', location: 'Bondi, NSW', days_ago: 2
      },
      {
        poster_email: 'david@example.com', poster_name: 'David Chen',
        title: 'Power outlet not working', category: 'Electrical',
        job_type: 'Electrical Repair',
        short_desc: 'One power outlet in living room stopped working',
        full_desc: 'One power outlet in living room has stopped working. Need electrician to diagnose and fix. Urgent.',
        budget: '200', location: 'Parramatta, NSW', days_ago: 1
      },
      {
        poster_email: 'emma@example.com', poster_name: 'Emma Wilson',
        title: 'Build outdoor deck', category: 'Carpentry',
        job_type: 'Decking Construction',
        short_desc: 'Want to build 4x6 meter outdoor deck',
        full_desc: 'Want to build outdoor deck in backyard. Timber deck preferred. Looking for experienced carpenter.',
        budget: '8000', location: 'Chatswood, NSW', days_ago: 0
      },
      {
        poster_email: 'james@example.com', poster_name: 'James Taylor',
        title: 'Roof repair needed', category: 'Roofing',
        job_type: 'Roofing Repair',
        short_desc: 'Several tiles damaged in recent storm',
        full_desc: 'Storm damage to roof. Several tiles cracked and one missing. Need urgent repair before next rain.',
        budget: '1200', location: 'Manly, NSW', days_ago: 0
      },
      {
        poster_email: 'olivia@example.com', poster_name: 'Olivia Brown',
        title: 'Kitchen tiling', category: 'Tiling',
        job_type: 'Tiling',
        short_desc: 'Need splashback and floor tiling for new kitchen',
        full_desc: 'Installing new kitchen and need professional tiler for splashback and floor. Modern subway tiles.',
        budget: '3500', location: 'Bondi Junction, NSW', days_ago: 1
      },
      {
        poster_email: 'william@example.com', poster_name: 'William Johnson',
        title: 'Garden bed construction', category: 'Landscaping',
        job_type: 'Garden Design',
        short_desc: 'Want raised garden beds built',
        full_desc: 'Looking for landscaper to design and build 3 raised garden beds. Timber or brick options.',
        budget: '2000', location: 'Hornsby, NSW', days_ago: 3
      },
      {
        poster_email: 'sophia@example.com', poster_name: 'Sophia Davis',
        title: 'House painting exterior', category: 'Painting',
        job_type: 'House Painting (Exterior)',
        short_desc: 'Full exterior repaint needed',
        full_desc: '3 bedroom house needs full exterior repaint. Weatherboard, currently white, want to change to grey.',
        budget: '6500', location: 'Penrith, NSW', days_ago: 2
      },
      {
        poster_email: 'lucas@example.com', poster_name: 'Lucas Martinez',
        title: 'Gas heater installation', category: 'Gas Fitting',
        job_type: 'Gas Fitting',
        short_desc: 'Install new gas heater in living room',
        full_desc: 'Have purchased new gas heater and need licensed gas fitter to install safely with certification.',
        budget: '800', location: 'Liverpool, NSW', days_ago: 1
      },
      {
        poster_email: 'mia@example.com', poster_name: 'Mia Anderson',
        title: 'Brick letterbox construction', category: 'Bricklaying',
        job_type: 'Bricklaying',
        short_desc: 'Build new brick letterbox at front',
        full_desc: 'Old letterbox damaged. Want new brick letterbox built to match house facade. Modern design preferred.',
        budget: '1500', location: 'Penrith, NSW', days_ago: 4
      },
      {
        poster_email: 'ethan@example.com', poster_name: 'Ethan White',
        title: 'End of lease clean', category: 'Cleaning',
        job_type: 'End of Lease Cleaning',
        short_desc: 'Need full end of lease clean for 2BR unit',
        full_desc: 'Moving out of 2 bedroom unit and need professional end of lease clean to get bond back.',
        budget: '400', location: 'Campbelltown, NSW', days_ago: 0
      }
    ];
    
    for (const job of jobs) {
      const poster = await get('SELECT id FROM users WHERE email = ?', [job.poster_email]);
      const jobType = await get('SELECT id FROM job_types WHERE name = ?', [job.job_type]);
      
      if (!poster || !jobType) {
        log(`  ✗ Skipping: ${job.title} (missing references)`, 'red');
        continue;
      }
      
      const existing = await get(
        'SELECT id FROM jobs WHERE poster_id = ? AND title = ?',
        [poster.id, job.title]
      );
      
      if (existing) {
        log(`  - Job already exists: ${job.title}`, 'yellow');
        credentials.jobs.push({
          title: job.title,
          poster: job.poster_name,
          budget: job.budget,
          category: job.category
        });
        continue;
      }
      
      await run(
        `INSERT INTO jobs (
          poster_id, poster_name, title, category, job_type_id,
          short_description, description, budget, location, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now', '-${job.days_ago} days'))`,
        [
          poster.id, job.poster_name, job.title, job.category, jobType.id,
          job.short_desc, job.full_desc, job.budget, job.location
        ]
      );
      
      credentials.jobs.push({
        title: job.title,
        poster: job.poster_name,
        budget: job.budget,
        category: job.category
      });
      
      log(`  ✓ Created: ${job.title} ($${job.budget})`, 'green');
    }
    
    // ============================================
    // SAVE CREDENTIALS TO FILE
    // ============================================
    log('\nSaving credentials to file...', 'cyan');
    
    const credentialsFile = path.join(__dirname, 'TEST_CREDENTIALS.txt');
    let credentialsText = '='.repeat(80) + '\n';
    credentialsText += 'TRADIETASKER TEST CREDENTIALS\n';
    credentialsText += 'Generated: ' + new Date().toISOString() + '\n';
    credentialsText += '='.repeat(80) + '\n\n';
    
    credentialsText += 'ALL PASSWORDS: password123\n\n';
    
    credentialsText += '='.repeat(80) + '\n';
    credentialsText += 'CUSTOMER ACCOUNTS (10)\n';
    credentialsText += '='.repeat(80) + '\n';
    credentials.customers.forEach((c, i) => {
      credentialsText += `${i + 1}. ${c.name}\n`;
      credentialsText += `   Email: ${c.email}\n`;
      credentialsText += `   Password: ${c.password}\n`;
      credentialsText += `   Role: Customer (poster)\n\n`;
    });
    
    credentialsText += '='.repeat(80) + '\n';
    credentialsText += 'TRADIE ACCOUNTS (10)\n';
    credentialsText += '='.repeat(80) + '\n';
    credentials.tradies.forEach((t, i) => {
      credentialsText += `${i + 1}. ${t.name}\n`;
      credentialsText += `   Email: ${t.email}\n`;
      credentialsText += `   Password: ${t.password}\n`;
      credentialsText += `   Role: Tradie (tasker)\n`;
      credentialsText += `   Tier: ${t.tier}\n`;
      credentialsText += `   Profession: ${t.profession}\n\n`;
    });
    
    credentialsText += '='.repeat(80) + '\n';
    credentialsText += 'JOBS CREATED (10)\n';
    credentialsText += '='.repeat(80) + '\n';
    credentials.jobs.forEach((j, i) => {
      credentialsText += `${i + 1}. ${j.title}\n`;
      credentialsText += `   Posted by: ${j.poster}\n`;
      credentialsText += `   Budget: $${j.budget}\n`;
      credentialsText += `   Category: ${j.category}\n\n`;
    });
    
    fs.writeFileSync(credentialsFile, credentialsText);
    log(`✓ Credentials saved to: ${credentialsFile}`, 'green');
    
    // ============================================
    // SUMMARY
    // ============================================
    log('\n' + '='.repeat(80), 'bold');
    log('EXPANDED TEST DATA SEEDING COMPLETE', 'bold');
    log('='.repeat(80) + '\n', 'bold');
    
    log('Summary:', 'cyan');
    log(`  • ${credentials.customers.length} customer accounts`, 'green');
    log(`  • ${credentials.tradies.length} tradie accounts`, 'green');
    log(`  • ${credentials.jobs.length} jobs created`, 'green');
    log(`\n  All passwords: password123`, 'yellow');
    log(`  Full credentials: ${credentialsFile}\n`, 'yellow');
    
  } catch (error) {
    log(`\n✗ Error seeding expanded test data: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run seed
seedExpandedTestData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
