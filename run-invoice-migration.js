const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('DATABASE_URL not set. This migration is for PostgreSQL only.');
    console.log('For local SQLite, the tables will be created automatically.');
    return;
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Running invoice system migration...');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '006_invoices.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements (handling multi-line statements)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 60)}...`);
        await pool.query(statement);
      }
    }

    console.log('✅ Invoice migration completed successfully!');

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('invoices', 'admin_settings')
      ORDER BY table_name
    `);

    console.log('\nCreated tables:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Check admin_settings data
    const settings = await pool.query('SELECT * FROM admin_settings');
    console.log('\nAdmin settings:');
    settings.rows.forEach(row => {
      console.log(`  - ${row.key}: ${row.value}`);
    });

  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Failed to run migration:', err);
  process.exit(1);
});
