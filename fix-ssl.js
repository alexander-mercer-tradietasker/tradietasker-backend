const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
pool.query('SELECT NOW()').then(() => {
  console.log('✓ SSL connection works');
  process.exit(0);
}).catch(e => {
  console.error('✗ Failed:', e.message);
  process.exit(1);
});
