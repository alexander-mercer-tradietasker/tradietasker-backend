require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Override with Railway DATABASE_URL if provided as env var
const DATABASE_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: No DATABASE_URL found. Please set RAILWAY_DATABASE_URL or DATABASE_URL');
  process.exit(1);
}

async function applyMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Railway PostgreSQL database...');
    const client = await pool.connect();
    
    console.log('Reading migration file...');
    const migration = fs.readFileSync(
      path.join(__dirname, 'migrations', '005_create_transactions.sql'),
      'utf8'
    );
    
    console.log('Checking if transactions table exists...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'transactions'
      )
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('⚠ Transactions table already exists');
    } else {
      console.log('Applying migration...');
      await client.query(migration);
      console.log('✓ Migration applied successfully');
    }
    
    // Verify table schema
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
    
    // Check if there are any transactions
    const countResult = await client.query('SELECT COUNT(*) as count FROM transactions');
    console.log(`\nExisting transactions: ${countResult.rows[0].count}`);
    
    client.release();
  } catch (error) {
    console.error('Error applying migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

applyMigration().catch(console.error);
