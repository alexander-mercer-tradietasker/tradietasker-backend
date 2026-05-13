const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query, get, run } = require('../db/connection');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register - Register new user
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').notEmpty().trim(),
    body('role').isIn(['poster', 'tasker', 'both']).optional(),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, phone, role = 'poster' } = req.body;

      // Check if user already exists
      const existingUser = await get('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user with profile_completed flag
      // For taskers, profile_completed starts as false (they need to complete profile)
      // For posters, it starts as true (they don't need additional setup)
      const profileCompleted = role === 'poster' ? 1 : 0;
      
      const result = await run(
        `INSERT INTO users (email, password_hash, name, phone, role, tier, credits, profile_completed)
         VALUES (?, ?, ?, ?, ?, 'free', 0, ?)`,
        [email, passwordHash, name, phone || null, role, profileCompleted]
      );

      // Get created user
      const user = await get('SELECT id, email, name, phone, role, tier, credits, profile_completed FROM users WHERE id = ?', [result.lastID]);

      // Generate token
      const token = generateToken(user.id);

      res.status(201).json({
        message: 'User registered successfully',
        user,
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// POST /api/auth/login - Login
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Get user
      const user = await get('SELECT * FROM users WHERE email = ?', [email]);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check if password_hash exists
      if (!user.password_hash) {
        console.error('Login error: password_hash is missing for user:', user.email);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate token
      const token = generateToken(user.id);

      // Don't send password hash
      delete user.password_hash;

      res.json({
        message: 'Login successful',
        user,
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

module.exports = router;
