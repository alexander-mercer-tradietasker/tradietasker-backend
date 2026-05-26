require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration() {
  const sql = fs.readFileSync('./migrations/010_create_credit_packages.sql', 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('✅ Migration 010 completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
