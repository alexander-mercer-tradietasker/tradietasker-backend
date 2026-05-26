const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../db/connection'); // Use db.query() instead of get()/run()
const { query, isPostgres } = require('../db/connection');
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
    console.log('[Register] Request received:', { email: req.body.email, role: req.body.role });
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('[Register] Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, phone, role = 'poster' } = req.body;
      console.log('[Register] After validation:', { email, name, phone, role });

      // Check if user already exists
      const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]).then(r => r[0]);
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user with profile_completed flag
      // For taskers, profile_completed starts as false (they need to complete profile)
      // For posters, it starts as true (they don't need additional setup)
      const profileCompleted = role === 'poster' ? 1 : 0;
      
      // Use password_hash for PostgreSQL, password for SQLite
      const passwordColumn = isPostgres ? 'password_hash' : 'password';
      
      const isPostgresEnv = !!process.env.DATABASE_URL;
      let user;
      
      if (isPostgresEnv) {
        // Postgres: Use RETURNING clause
        user = await query(`INSERT INTO users (email, ${passwordColumn}, name, phone, role, tier, credits, profile_completed)
           VALUES ($1, $2, $3, $4, $5, 'free', 0, $6)
           RETURNING id, email, name, phone, role, tier, credits, profile_completed`, [email, passwordHash, name, phone || null, role, profileCompleted]).then(r => r[0]);
      } else {
        // SQLite: Use lastID
        const result = await query(`INSERT INTO users (email, ${passwordColumn}, name, phone, role, tier, credits, profile_completed)
           VALUES ($1, $2, $3, $4, $5, 'free', 0, $6)`, [email, passwordHash, name, phone || null, role, profileCompleted]);
        user = await query('SELECT id, email, name, phone, role, tier, credits, profile_completed FROM users WHERE id = $1', [result.lastID]).then(r => r[0]);
      }

      // Generate token
      const token = generateToken(user.id);

      res.status(201).json({
        message: 'User registered successfully',
        user,
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      console.error('Stack:', error.stack);
      res.status(500).json({ 
        error: 'Registration failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
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
      const user = await query('SELECT * FROM users WHERE email = $1', [email]).then(r => r[0]);
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
