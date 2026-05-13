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
    
    const professions = fs.readFileSync(path.join(__dirname, 'seeds', '002_professions_pg.sql'), 'utf8');
    await client.query(professions);
    
    const jobTypes = fs.readFileSync(path.join(__dirname, 'seeds', '003_job_types_pg.sql'), 'utf8');
    await client.query(jobTypes);
    
    const result = await client.query(`SELECT (SELECT COUNT(*) FROM professions) as p, (SELECT COUNT(*) FROM job_types) as j`);
    console.log(`✅ Database ready! Professions: ${result.rows[0].p}, Job Types: ${result.rows[0].j}`);
    
  } catch (err) {
    console.error('❌', err.message);
  } finally {
    await client.end();
  }
}

init();
