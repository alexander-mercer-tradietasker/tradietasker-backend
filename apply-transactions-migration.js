require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    console.log('Reading migration file...');
    const migration = fs.readFileSync(
      path.join(__dirname, 'migrations', '005_create_transactions.sql'),
      'utf8'
    );
    
    console.log('Applying migration...');
    await client.query(migration);
    
    console.log('✓ Migration applied successfully');
    
    // Verify table exists
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transactions'
      ORDER BY ordinal_position
    `);
    
    console.log('\nTransactions table schema:');
    result.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    
    client.release();
  } catch (error) {
    console.error('Error applying migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

applyMigration().catch(console.error);
