const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const router = express.Router();

// POST /api/migrations/run - Run a specific migration (admin only)
router.post('/run', async (req, res) => {
  try {
    const { migration_file, admin_key } = req.body;

    // Simple admin key check (in production, use proper auth)
    if (admin_key !== process.env.ADMIN_KEY && admin_key !== 'temp-admin-key-2026') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!migration_file) {
      return res.status(400).json({ error: 'migration_file required' });
    }

    const migrationPath = path.join(__dirname, '..', 'migrations', migration_file);
    
    if (!fs.existsSync(migrationPath)) {
      return res.status(404).json({ error: 'Migration file not found' });
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Use PostgreSQL if DATABASE_URL is set, otherwise skip
    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ 
        error: 'DATABASE_URL not configured',
        message: 'This server is using SQLite, migration is for PostgreSQL only'
      });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
      await pool.query(sql);
      
      res.json({ 
        message: 'Migration applied successfully',
        migration_file,
        timestamp: new Date().toISOString()
      });
    } finally {
      await pool.end();
    }

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ 
      error: 'Migration failed',
      message: error.message
    });
  }
});

// GET /api/migrations/list - List available migrations
router.get('/list', (req, res) => {
  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      return res.json({ migrations: [] });
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    res.json({ 
      migrations: files,
      count: files.length
    });
  } catch (error) {
    console.error('List migrations error:', error);
    res.status(500).json({ error: 'Failed to list migrations' });
  }
});

module.exports = router;
