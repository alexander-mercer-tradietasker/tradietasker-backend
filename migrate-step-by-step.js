require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('📂 Connecting...');
    await pool.query('SELECT NOW()');
    console.log('✓ Connected\n');
    
    console.log('📝 Loading schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema-postgres.sql'), 'utf8');
    
    // Split into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Found ${statements.length} statements\n`);
    
    console.log('🔨 Executing schema...');
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.trim()) {
        try {
          await pool.query(stmt);
          process.stdout.write('.');
          if ((i + 1) % 50 === 0) process.stdout.write(` ${i + 1}\n`);
        } catch (err) {
          if (!err.message.includes('already exists')) {
            console.error(`\n\n❌ Error at statement ${i + 1}:`);
            console.error(stmt.substring(0, 200));
            console.error('\nError:', err.message);
            throw err;
          }
        }
      }
    }
    console.log('\n✓ Schema created\n');
    
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
        (SELECT COUNT(*) FROM job_types) as job_types,
        (SELECT COUNT(*) FROM users) as users
    `);
    
    console.log(`  Professions: ${result.rows[0].professions}`);
    console.log(`  Job Types: ${result.rows[0].job_types}`);
    console.log(`  Users: ${result.rows[0].users}\n`);
    
    console.log('✅ PostgreSQL database initialized successfully!');
    console.log('   You can now add test records.');
    
  } catch (err) {
    console.error('\n❌ Migration failed:');
    console.error(err.message);
  } finally {
    await pool.end();
  }
}

migrate();
