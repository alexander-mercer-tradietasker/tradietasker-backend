const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { get } = require('../db/connection');

const router = express.Router();

// POST /api/admin-auth/login - Admin login
router.post('/login',
  [
    body('username').trim().notEmpty(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      // Find user by email (using username field)
      const user = await get('SELECT * FROM users WHERE email = ?', [username]);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if user is god tier
      if (user.tier !== 'god') {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const token = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          role: user.role,
          tier: user.tier
        },
        process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tier: user.tier
        }
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

module.exports = router;
