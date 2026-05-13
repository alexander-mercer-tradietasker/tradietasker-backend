require('dotenv').config();
const { query } = require('./db/connection');

async function checkSchema() {
  try {
    const schema = await query(`PRAGMA table_info(users)`);
    console.log('Users table columns:');
    schema.forEach(col => {
      console.log(`  ${col.name}: ${col.type}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();
