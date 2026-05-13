const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    console.log('Connecting to database...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '005_add_invoices_and_admin_settings.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await pool.query(migration);
    
    console.log('✓ Migration completed successfully');
    
    // Verify tables created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('invoices', 'admin_settings')
      ORDER BY table_name
    `);
    
    console.log('Tables created:', result.rows.map(r => r.table_name).join(', '));
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
