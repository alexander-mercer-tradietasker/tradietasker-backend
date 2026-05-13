require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    console.log('📂 Connecting...');
    await client.connect();
    console.log('✓ Connected\n');
    
    console.log('📝 Executing schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema-postgres.sql'), 'utf8');
    await client.query(schema);
    console.log('✓ Schema created\n');
    
    console.log('🌱 Seeding professions...');
    const professions = fs.readFileSync(path.join(__dirname, 'seeds', '002_professions_seed.sql'), 'utf8');
    await client.query(professions);
    console.log('✓ Professions seeded\n');
    
    console.log('🌱 Seeding job types...');
    const jobTypes = fs.readFileSync(path.join(__dirname, 'seeds', '003_job_types_seed.sql'), 'utf8');
    await client.query(jobTypes);
    console.log('✓ Job types seeded\n');
    
    console.log('📊 Verification:');
    const result = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM professions) as professions,
        (SELECT COUNT(*) FROM job_types) as job_types
    `);
    
    console.log(`  Professions: ${result.rows[0].professions}`);
    console.log(`  Job Types: ${result.rows[0].job_types}\n`);
    
    console.log('✅ Database ready! You can now add test records.');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.position) console.error('Position:', err.position);
  } finally {
    await client.end();
  }
}

migrate();
