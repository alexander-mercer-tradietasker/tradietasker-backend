const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// One-time migration endpoint for messages table
router.post('/messages', async (req, res) => {
  try {
    // Check if using PostgreSQL
    if (!process.env.DATABASE_URL) {
      return res.json({ 
        success: false, 
        message: 'Not using PostgreSQL, migration not needed' 
      });
    }

    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Check if messages table exists
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
      );
    `);

    if (checkTable.rows[0].exists) {
      await pool.end();
      return res.json({ 
        success: true, 
        message: 'Messages table already exists',
        alreadyExists: true
      });
    }

    // Apply migration
    const migrationPath = path.join(__dirname, '..', 'migrations', '004_create_messages.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    // Verify
    const verify = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
      );
    `);

    await pool.end();

    res.json({ 
      success: true, 
      message: 'Messages table created successfully',
      verified: verify.rows[0].exists
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
