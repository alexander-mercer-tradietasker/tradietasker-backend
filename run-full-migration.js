require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    console.log('📂 Connecting...');
    await pool.query('SELECT NOW()');
    console.log('✓ Connected\n');
    
    console.log('📝 Loading schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema-postgres.sql'), 'utf8');
    console.log('✓ Schema loaded\n');
    
    console.log('🔨 Executing schema (this may take a moment)...');
    await pool.query(schema);
    console.log('✓ Schema created\n');
    
    console.log('🌱 Loading seeds...');
    const professionsSQL = fs.readFileSync(path.join(__dirname, 'seeds', '002_professions_seed.sql'), 'utf8');
    await pool.query(professionsSQL);
    console.log('✓ Professions seeded');
    
    const jobTypesSQL = fs.readFileSync(path.join(__dirname, 'seeds', '003_job_types_seed.sql'), 'utf8');
    await pool.query(jobTypesSQL);
    console.log('✓ Job types seeded\n');
    
    console.log('📊 Verification:');
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM professions) as professions,
        (SELECT COUNT(*) FROM job_types) as job_types
    `);
    
    console.log(`  Professions: ${result.rows[0].professions}`);
    console.log(`  Job Types: ${result.rows[0].job_types}\n`);
    
    console.log('✅ Migration complete!');
    
  } catch (err) {
    console.error('\n❌ Migration failed:');
    console.error(err.message);
    if (err.detail) console.error('Detail:', err.detail);
    if (err.hint) console.error('Hint:', err.hint);
  } finally {
    await pool.end();
  }
}

migrate();
