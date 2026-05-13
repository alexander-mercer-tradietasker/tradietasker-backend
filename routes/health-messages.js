const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ postgres: false, message: 'Using SQLite' });
    }

    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false
    });

    // Check if messages table exists
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'messages'
      );
    `);

    const exists = result.rows[0].exists;
    
    // If exists, count messages
    let count = 0;
    if (exists) {
      const countResult = await pool.query('SELECT COUNT(*) as count FROM messages');
      count = parseInt(countResult.rows[0].count);
    }

    await pool.end();

    res.json({
      postgres: true,
      messagesTableExists: exists,
      messageCount: count,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: error.message,
      postgres: !!process.env.DATABASE_URL
    });
  }
});

module.exports = router;
