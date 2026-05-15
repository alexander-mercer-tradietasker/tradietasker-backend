require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting profession-job-types migration...\n');

    // Step 1: Create the junction table
    console.log('📋 Step 1: Creating profession_job_types table...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '009_profession_job_types.sql'),
      'utf8'
    );
    await client.query(migrationSQL);
    console.log('✅ Table created successfully\n');

    // Step 2: Seed the mappings
    console.log('📋 Step 2: Seeding profession-to-job-type mappings...');
    const seedSQL = fs.readFileSync(
      path.join(__dirname, 'seeds', '009_profession_job_types_mapping.sql'),
      'utf8'
    );
    await client.query(seedSQL);
    console.log('✅ Mappings seeded successfully\n');

    // Step 3: Verify the data
    console.log('📋 Step 3: Verifying data...');
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_mappings,
        COUNT(DISTINCT profession_id) as unique_professions,
        COUNT(DISTINCT job_type_id) as unique_job_types
      FROM profession_job_types
    `);
    
    console.log('✅ Migration complete!');
    console.log('\nStatistics:');
    console.log(`  - Total mappings: ${result.rows[0].total_mappings}`);
    console.log(`  - Unique professions: ${result.rows[0].unique_professions}`);
    console.log(`  - Unique job types: ${result.rows[0].unique_job_types}`);
    
    // Show some sample mappings
    const samples = await client.query(`
      SELECT 
        p.name as profession,
        jt.name as job_type
      FROM profession_job_types pjt
      JOIN professions p ON p.id = pjt.profession_id
      JOIN job_types jt ON jt.id = pjt.job_type_id
      WHERE p.name IN ('Electrician', 'Plumber', 'Carpenter')
      ORDER BY p.name, jt.name
      LIMIT 20
    `);
    
    console.log('\nSample mappings:');
    samples.rows.forEach(row => {
      console.log(`  - ${row.profession} → ${row.job_type}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
