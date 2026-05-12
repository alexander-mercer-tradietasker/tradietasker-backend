const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, get, run } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/me - Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't send password hash
    delete user.password_hash;

    // Get professions
    const professions = await query(
      `SELECT p.id, p.name, p.category, p.requires_licence, up.licence_number, up.state
       FROM user_professions up
       JOIN professions p ON up.profession_id = p.id
       WHERE up.user_id = ?`,
      [req.user.id]
    );

    // Get job types
    const jobTypes = await query(
      `SELECT jt.id, jt.name, jt.category
       FROM user_job_types ujt
       JOIN job_types jt ON ujt.job_type_id = jt.id
       WHERE ujt.user_id = ?`,
      [req.user.id]
    );

    // Get qualifications
    const qualifications = await query(
      'SELECT * FROM user_qualifications WHERE user_id = ?',
      [req.user.id]
    );

    // Get active subscription
    const subscription = await get(
      `SELECT * FROM subscriptions 
       WHERE user_id = ? AND is_active = 1 
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    res.json({
      ...user,
      professions,
      jobTypes,
      qualifications,
      subscription
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// PUT /api/users/me - Update user profile
router.put('/me', 
  authenticateToken,
  [
    body('name').optional().trim().notEmpty(),
    body('phone').optional(),
    body('date_of_birth').optional().isDate(),
    body('residential_address').optional(),
    body('residential_suburb').optional(),
    body('residential_state').optional(),
    body('residential_postcode').optional(),
    body('postal_address').optional(),
    body('postal_postcode').optional(),
    body('abn').optional(),
    body('business_name').optional(),
    body('business_address').optional(),
    body('business_phone').optional(),
    body('business_email').optional().isEmail(),
    body('service_radius_km').optional().isInt({ min: 1, max: 500 }),
    body('service_postcode').optional(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const allowedFields = [
        'name', 'phone', 'date_of_birth', 
        'residential_address', 'residential_suburb', 'residential_state', 'residential_postcode',
        'postal_address', 'postal_postcode',
        'abn', 'business_name', 'business_address', 'business_phone', 'business_email',
        'profile_photo_url', 'business_logo_url',
        'service_radius_km', 'service_postcode'
      ];

      const updates = {};
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // Build update query
      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updates), req.user.id];

      await run(
        `UPDATE users SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
        values
      );

      // Get updated user
      const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
      delete user.password_hash;

      res.json({
        message: 'Profile updated successfully',
        user
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

// POST /api/users/me/abn-lookup - Lookup ABN from Australian Business Register
router.post('/me/abn-lookup',
  authenticateToken,
  [body('abn').matches(/^\d{11}$/)],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { abn } = req.body;

      // TODO: Integrate with ABR API
      // For now, return mock data
      res.json({
        abn,
        business_name: 'Mock Business Name',
        business_address: '123 Mock St, Sydney NSW 2000',
        message: 'ABN lookup not yet integrated with ABR API'
      });
    } catch (error) {
      console.error('ABN lookup error:', error);
      res.status(500).json({ error: 'ABN lookup failed' });
    }
  }
);

// POST /api/users/me/professions - Add profession
router.post('/me/professions',
  authenticateToken,
  [
    body('profession_id').isInt(),
    body('licence_number').optional(),
    body('state').optional().isIn(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { profession_id, licence_number, state } = req.body;

      // Check if profession exists
      const profession = await get('SELECT * FROM professions WHERE id = ?', [profession_id]);
      if (!profession) {
        return res.status(404).json({ error: 'Profession not found' });
      }

      // Check if already added
      const existing = await get(
        'SELECT id FROM user_professions WHERE user_id = ? AND profession_id = ?',
        [req.user.id, profession_id]
      );
      if (existing) {
        return res.status(409).json({ error: 'Profession already added' });
      }

      // Add profession
      await run(
        `INSERT INTO user_professions (user_id, profession_id, licence_number, state, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [req.user.id, profession_id, licence_number || null, state || null]
      );

      res.status(201).json({ message: 'Profession added successfully' });
    } catch (error) {
      console.error('Add profession error:', error);
      res.status(500).json({ error: 'Failed to add profession' });
    }
  }
);

// DELETE /api/users/me/professions/:id - Remove profession
router.delete('/me/professions/:id', authenticateToken, async (req, res) => {
  try {
    const result = await run(
      'DELETE FROM user_professions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Profession not found' });
    }

    res.json({ message: 'Profession removed successfully' });
  } catch (error) {
    console.error('Remove profession error:', error);
    res.status(500).json({ error: 'Failed to remove profession' });
  }
});

// POST /api/users/me/job-types - Add job types
router.post('/me/job-types',
  authenticateToken,
  [body('job_type_id').isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { job_type_id } = req.body;

      // Check if job type exists
      const jobType = await get('SELECT * FROM job_types WHERE id = ?', [job_type_id]);
      if (!jobType) {
        return res.status(404).json({ error: 'Job type not found' });
      }

      // Check if already added
      const existing = await get(
        'SELECT id FROM user_job_types WHERE user_id = ? AND job_type_id = ?',
        [req.user.id, job_type_id]
      );
      if (existing) {
        return res.status(409).json({ error: 'Job type already added' });
      }

      // Add job type
      await run(
        `INSERT INTO user_job_types (user_id, job_type_id, created_at)
         VALUES (?, ?, datetime('now'))`,
        [req.user.id, job_type_id]
      );

      res.status(201).json({ message: 'Job type added successfully' });
    } catch (error) {
      console.error('Add job type error:', error);
      res.status(500).json({ error: 'Failed to add job type' });
    }
  }
);

// POST /api/users/me/qualifications - Add qualification
router.post('/me/qualifications',
  authenticateToken,
  [
    body('type').isIn(['tafe', 'university', 'other']),
    body('name').notEmpty().trim(),
    body('year_obtained').optional().isInt({ min: 1950, max: new Date().getFullYear() }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { type, name, year_obtained } = req.body;

      await run(
        `INSERT INTO user_qualifications (user_id, type, name, year_obtained, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [req.user.id, type, name, year_obtained || null]
      );

      res.status(201).json({ message: 'Qualification added successfully' });
    } catch (error) {
      console.error('Add qualification error:', error);
      res.status(500).json({ error: 'Failed to add qualification' });
    }
  }
);

module.exports = router;
