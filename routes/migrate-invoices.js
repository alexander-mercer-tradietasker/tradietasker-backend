const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Simple auth - only allow from specific IP or with secret key
const MIGRATION_SECRET = process.env.MIGRATION_SECRET || 'change-me-in-production';

router.post('/run', async (req, res) => {
  try {
    // Check authorization
    const authHeader = req.headers['x-migration-secret'];
    if (authHeader !== MIGRATION_SECRET) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '005_add_invoices_and_admin_settings.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    // Run migration
    await pool.query(migration);

    // Verify tables created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('invoices', 'admin_settings')
      ORDER BY table_name
    `);

    await pool.end();

    res.json({
      success: true,
      message: 'Migration completed successfully',
      tables: result.rows.map(r => r.table_name)
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
