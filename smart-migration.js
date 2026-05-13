require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });
  
  try {
    await client.connect();
    console.log('✓ Connected\n');
    
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema-postgres.sql'), 'utf8');
    
    // Extract CREATE TABLE statements
    const tableMatches = schema.match(/CREATE TABLE[^;]+;/gs) || [];
    console.log(`📝 Creating ${tableMatches.length} tables...`);
    for (const table of tableMatches) {
      await client.query(table);
      process.stdout.write('.');
    }
    console.log(' ✓\n');
    
    // Extract CREATE INDEX statements  
    const indexMatches = schema.match(/CREATE INDEX[^;]+;/g) || [];
    console.log(`📊 Creating ${indexMatches.length} indexes...`);
    for (const index of indexMatches) {
      try {
        await client.query(index);
        process.stdout.write('.');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error(`\nIndex error: ${err.message}`);
        }
      }
    }
    console.log(' ✓\n');
    
    console.log('🌱 Seeding...');
    const professions = fs.readFileSync(path.join(__dirname, 'seeds', '002_professions_seed.sql'), 'utf8');
    await client.query(professions);
    
    const jobTypes = fs.readFileSync(path.join(__dirname, 'seeds', '003_job_types_seed.sql'), 'utf8');
    await client.query(jobTypes);
    console.log('✓ Seeds applied\n');
    
    const result = await client.query(`SELECT (SELECT COUNT(*) FROM professions) as p, (SELECT COUNT(*) FROM job_types) as j`);
    console.log(`📊 Professions: ${result.rows[0].p}, Job Types: ${result.rows[0].j}\n`);
    console.log('✅ Database ready!');
    
  } catch (err) {
    console.error('❌', err.message);
  } finally {
    await client.end();
  }
}

migrate();
