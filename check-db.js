const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
});

async function checkDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('\n=== Checking Database Tables ===\n');
    
    // Check if tables exist
    const tables = ['tiers', 'tax_rates', 'site_settings', 'promo_codes', 'users'];
    for (const table of tables) {
      const result = await client.query(
        `SELECT COUNT(*) FROM ${table}`
      );
      console.log(`${table}: ${result.rows[0].count} records`);
    }
    
    // Get tiers
    console.log('\n=== Tiers Data ===');
    const tiers = await client.query('SELECT tier_name, subscription_cost_excl_tax, job_view_delay_minutes FROM tiers ORDER BY subscription_cost_excl_tax');
    console.log(tiers.rows);
    
    // Get tax rates
    console.log('\n=== Tax Rates Data ===');
    const taxes = await client.query('SELECT * FROM tax_rates');
    console.log(taxes.rows);
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkDatabase().catch(console.error);
