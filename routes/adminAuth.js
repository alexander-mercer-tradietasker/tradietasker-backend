const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Hardcoded admin credentials (hash generated from 'admin123')
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$F51Mlem5XR1F4SKdyI3wTe2bvNGojidNnDVJIztXfX6IZ36sFJS7q';

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

      // Check username
      if (username !== ADMIN_USERNAME) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const token = jwt.sign(
        { 
          username: ADMIN_USERNAME,
          role: 'admin'
        },
        process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          username: ADMIN_USERNAME,
          role: 'admin'
        }
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

module.exports = router;
