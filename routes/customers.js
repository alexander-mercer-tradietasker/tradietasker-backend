const express = require('express');
const { query, get } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers/my-customers - Get customers the tradie has unlocked
router.get('/my-customers', authenticateToken, async (req, res) => {
  try {
    // Get all customers this tradie has unlocked via contact transactions
    const sql = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.phone,
        j.id as job_id,
        j.title as job_title,
        ct.created_at as unlock_date,
        ct.type as unlock_type
      FROM contact_transactions ct
      JOIN users u ON ct.to_user_id = u.id
      JOIN jobs j ON ct.job_id = j.id
      WHERE ct.from_user_id = ?
      ORDER BY ct.created_at DESC
    `;

    const customers = await query(sql, [req.user.id]);

    res.json(customers);
  } catch (error) {
    console.error('Get my customers error:', error);
    res.status(500).json({ error: 'Failed to get customers' });
  }
});

// GET /api/customers/:id - Get customer details (if unlocked)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if tradie has unlocked this customer
    const unlock = await query(`SELECT ct.* FROM contact_transactions ct
       WHERE ct.from_user_id = $1 AND ct.to_user_id = $2`, [req.user.id, req.params.id]).then(r => r[0]);

    if (!unlock) {
      return res.status(403).json({ error: 'Customer not unlocked' });
    }

    // Get customer details
    const customer = await query(`SELECT id, name, email, phone, residential_address, residential_suburb, 
              residential_state, residential_postcode
       FROM users WHERE id = $1`, [req.params.id]).then(r => r[0]);

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get jobs associated with this customer
    const jobs = await query(`SELECT j.*, jt.name as job_type_name
       FROM jobs j
       LEFT JOIN job_types jt ON j.job_type_id = jt.id
       WHERE j.poster_id = $1
       ORDER BY j.created_at DESC`,
      [req.params.id]
    );

    res.json({
      customer,
      jobs,
      unlock_date: unlock.created_at
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Failed to get customer' });
  }
});

module.exports = router;
