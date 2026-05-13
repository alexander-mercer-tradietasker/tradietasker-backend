require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function init() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    console.log('✓ Connected');
    
    console.log('🌱 Seeding professions...');
    const professions = fs.readFileSync(path.join(__dirname, 'seeds', '002_professions_seed_pg.sql'), 'utf8');
    await client.query(professions);
    console.log('✓ Professions');
    
    console.log('🌱 Seeding job types...');
    const jobTypes = fs.readFileSync(path.join(__dirname, 'seeds', '003_job_types_seed_pg.sql'), 'utf8');
    await client.query(jobTypes);
    console.log('✓ Job types');
    
    const result = await client.query(`SELECT (SELECT COUNT(*) FROM professions) as p, (SELECT COUNT(*) FROM job_types) as j, (SELECT COUNT(*) FROM users) as u`);
    console.log(`\n📊 Professions: ${result.rows[0].p} | Job Types: ${result.rows[0].j} | Users: ${result.rows[0].u}`);
    console.log('\n✅ PostgreSQL database initialized! Ready for test records.');
    
  } catch (err) {
    console.error('❌', err.message);
  } finally {
    await client.end();
  }
}

init();
