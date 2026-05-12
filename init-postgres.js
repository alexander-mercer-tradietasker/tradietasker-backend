#!/usr/bin/env node
/**
 * PostgreSQL Database Initialization for Railway
 * Initializes schema and seeds test data
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(80));
    console.log('PostgreSQL Database Initialization');
    console.log('='.repeat(80));
    
    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log(`\nFound ${tablesResult.rows.length} existing tables`);
    
    if (tablesResult.rows.length === 0) {
      console.log('\n✓ Database is empty, initializing schema...');
      
      // Read and execute PostgreSQL schema
      const schemaPath = path.join(__dirname, 'db', 'schema-postgres.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      await client.query(schema);
      console.log('✓ Schema initialized');
      
      // Seed professions
      console.log('\nSeeding professions...');
      const professionsPath = path.join(__dirname, 'seeds', '002_professions_seed_pg.sql');
      if (fs.existsSync(professionsPath)) {
        const professions = fs.readFileSync(professionsPath, 'utf8');
        await client.query(professions);
        console.log('✓ Professions seeded');
      }
      
      // Seed job types
      console.log('Seeding job types...');
      const jobTypesPath = path.join(__dirname, 'seeds', '003_job_types_seed_pg.sql');
      if (fs.existsSync(jobTypesPath)) {
        const jobTypes = fs.readFileSync(jobTypesPath, 'utf8');
        await client.query(jobTypes);
        console.log('✓ Job types seeded');
      }
      
      // Seed test data
      console.log('\nSeeding test data...');
      await seedTestData(client);
      console.log('✓ Test data seeded');
      
    } else {
      console.log('✓ Database already initialized');
      
      // Check user count
      const userCountResult = await client.query('SELECT COUNT(*) FROM users');
      const userCount = parseInt(userCountResult.rows[0].count);
      
      if (userCount < 10) {
        console.log(`\nOnly ${userCount} users found, seeding test data...`);
        await seedTestData(client);
        console.log('✓ Test data seeded');
      } else {
        console.log(`✓ Found ${userCount} users, test data already exists`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✓ Database initialization complete');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('✗ Initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function seedTestData(client) {
  const passwordHash = await bcrypt.hash('password123', 10);
  
  // 10 Customers
  const customers = [
    { name: 'Sarah Mitchell', email: 'sarah@example.com', phone: '0412345001' },
    { name: 'David Chen', email: 'david@example.com', phone: '0412345002' },
    { name: 'Emma Wilson', email: 'emma@example.com', phone: '0412345003' },
    { name: 'James Taylor', email: 'james@example.com', phone: '0412345004' },
    { name: 'Olivia Brown', email: 'olivia@example.com', phone: '0412345005' },
    { name: 'William Johnson', email: 'william@example.com', phone: '0412345006' },
    { name: 'Sophia Davis', email: 'sophia@example.com', phone: '0412345007' },
    { name: 'Lucas Martinez', email: 'lucas@example.com', phone: '0412345008' },
    { name: 'Mia Anderson', email: 'mia@example.com', phone: '0412345009' },
    { name: 'Ethan White', email: 'ethan@example.com', phone: '0412345010' }
  ];
  
  for (const customer of customers) {
    await client.query(
      `INSERT INTO users (name, email, password_hash, phone, role, tier, credits, created_at)
       VALUES ($1, $2, $3, $4, 'poster', 'free', 0, NOW())
       ON CONFLICT (email) DO NOTHING`,
      [customer.name, customer.email, passwordHash, customer.phone]
    );
  }
  
  console.log('  ✓ Created 10 customers');
  
  // Save credentials to temp file
  const credentials = {
    customers: customers.map(c => ({ ...c, password: 'password123', role: 'customer' })),
    note: 'All passwords: password123'
  };
  
  fs.writeFileSync('/tmp/test-credentials.json', JSON.stringify(credentials, null, 2));
  console.log('  ✓ Credentials saved to /tmp/test-credentials.json');
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('\n✓ All done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
