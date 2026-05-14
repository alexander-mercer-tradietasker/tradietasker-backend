const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query, get, run } = require('../db/connection');
const { authenticateToken, optionalAuth, generateToken } = require('../middleware/auth');

const router = express.Router();

// Helper: Calculate tier-based visibility delay
function getTierDelay(tier) {
  const delays = {
    free: 24,
    bronze: 3,
    silver: 2,
    gold: 1,
    platinum: 0,
    god: 0
  };
  return delays[tier] || 24;
}

// GET /api/jobs - Browse jobs (filtered by tier, location, profession)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      postcode, 
      radius_km = 25, 
      profession_id,
      job_type_id,
      status = 'open',
      limit = 50,
      offset = 0
    } = req.query;

    const userTier = req.user ? req.user.tier : 'free';
    const delayHours = getTierDelay(userTier);

    let sql = `
      SELECT 
        j.*,
        jt.name as job_type_name,
        jt.category as job_type_category,
        u.name as poster_name,
        u.tier as poster_tier
      FROM jobs j
      LEFT JOIN job_types jt ON j.job_type_id = jt.id
      LEFT JOIN users u ON j.user_id = u.id
      WHERE j.status = ?
    `;
    const params = [status];

    // Tier-based visibility (unless god tier)
    if (userTier !== 'god') {
      sql += ` AND j.is_god_tier = 0`;
      
      if (delayHours > 0) {
        sql += ` AND j.created_at <= datetime('now', '-${delayHours} hours')`;
      }
    }

    // Filter by job type
    if (job_type_id) {
      sql += ' AND j.job_type_id = ?';
      params.push(job_type_id);
    }

    // Filter by profession (match job type to profession category)
    if (profession_id && req.user) {
      // Get profession category
      const profession = await get('SELECT category FROM professions WHERE id = ?', [profession_id]);
      if (profession) {
        sql += ` AND jt.category IN (
          SELECT DISTINCT p.category FROM professions p WHERE p.id = ?
        )`;
        params.push(profession_id);
      }
    }

    // TODO: Geographic filtering by postcode + radius
    // This requires postcode geocoding or distance calculation
    // For now, just filter by exact postcode if provided
    if (postcode) {
      sql += ' AND j.postcode = ?';
      params.push(postcode);
    }

    sql += ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const jobs = await query(sql, params);

    // Hide full description unless contacted
    const sanitizedJobs = jobs.map(job => {
      const sanitized = { ...job };
      
      // Only show short_description to paid tiers
      if (userTier === 'free') {
        delete sanitized.short_description;
      }
      
      // Never show full_description in browse view
      delete sanitized.full_description;
      
      // Parse photos JSON
      if (sanitized.photos) {
        try {
          sanitized.photos = JSON.parse(sanitized.photos);
        } catch (e) {
          sanitized.photos = [];
        }
      }

      return sanitized;
    });

    res.json({ 
      jobs: sanitizedJobs,
      count: sanitizedJobs.length,
      userTier,
      earlyAccessHours: delayHours
    });
  } catch (error) {
    console.error('Browse jobs error:', error);
    res.status(500).json({ error: 'Failed to browse jobs' });
  }
});

// POST /api/jobs - Post a job (create account if poster doesn't have one)
router.post('/',
  [
    body('title').notEmpty().trim(),
    body('short_description').notEmpty().trim(),
    body('full_description').notEmpty().trim(),
    body('budget').optional().isFloat({ min: 0 }),
    body('postcode').notEmpty().matches(/^\d{4}$/),
    body('suburb').notEmpty().trim(),
    body('state').isIn(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']),
    body('job_type_id').isInt(),
    body('photos').optional().isArray(),
    // Account creation fields (if no token)
    body('email').optional().isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 6 }),
    body('name').optional().trim(),
    body('phone').optional(),
  ],
  optionalAuth,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let userId = req.user ? req.user.id : null;
      let token = null;

      // If no user, create account
      if (!userId) {
        const { email, password, name, phone } = req.body;
        
        if (!email || !password || !name) {
          return res.status(400).json({ 
            error: 'Email, password, and name required for account creation' 
          });
        }

        // Check if user exists
        const existingUser = await get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
          return res.status(409).json({ error: 'Email already registered. Please login.' });
        }

        // Create user
        const passwordHash = await bcrypt.hash(password, 10);
        const userResult = await run(
          `INSERT INTO users (email, password_hash, name, phone, role, tier, credits, created_at)
           VALUES (?, ?, ?, ?, 'poster', 'free', 0, datetime('now'))`,
          [email, passwordHash, name, phone || null]
        );

        userId = userResult.lastID;
        token = generateToken(userId);
      }

      const {
        title,
        short_description,
        full_description,
        budget,
        postcode,
        suburb,
        state,
        job_type_id,
        urgency = 'flexible',
        photos = []
      } = req.body;

      // Verify job type exists and get category
      const jobType = await get('SELECT id, category FROM job_types WHERE id = ?', [job_type_id]);
      if (!jobType) {
        return res.status(404).json({ error: 'Job type not found' });
      }

      // Get poster name from user
      const poster = await get('SELECT name FROM users WHERE id = ?', [userId]);
      const posterName = poster ? poster.name : 'Anonymous';

      // Build location string
      const location = `${suburb}, ${state}`;

      // Use short_description as main description
      const description = short_description;

      // Create job
      const jobResult = await run(
        `INSERT INTO jobs (
          user_id, job_type_id, title, poster_name, category, description,
          short_description, full_description, location, budget, postcode, 
          suburb, state, urgency, photos, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now'))`,
        [
          userId,
          job_type_id,
          title,
          posterName,
          jobType.category,
          description,
          short_description,
          full_description,
          location,
          budget || null,
          postcode,
          suburb,
          state,
          urgency,
          JSON.stringify(photos)
        ]
      );

      const job = await get('SELECT * FROM jobs WHERE id = ?', [jobResult.lastID]);

      res.status(201).json({
        message: 'Job posted successfully',
        job,
        ...(token && { token, message: 'Account created and job posted' })
      });
    } catch (error) {
      console.error('Post job error:', error);
      res.status(500).json({ error: 'Failed to post job' });
    }
  }
);

// GET /api/jobs/:id - Get job details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const job = await get(
      `SELECT 
        j.*,
        jt.name as job_type_name,
        jt.category as job_type_category,
        u.name as poster_name,
        u.email as poster_email,
        u.phone as poster_phone
      FROM jobs j
      LEFT JOIN job_types jt ON j.job_type_id = jt.id
      LEFT JOIN users u ON j.user_id = u.id
      WHERE j.id = ?`,
      [req.params.id]
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Parse photos
    if (job.photos) {
      try {
        job.photos = JSON.parse(job.photos);
      } catch (e) {
        job.photos = [];
      }
    }

    // Check if user has purchased full contact
    let hasFullContact = false;
    if (req.user) {
      const contact = await get(
        `SELECT id FROM contact_transactions 
         WHERE from_user_id = ? AND job_id = ? AND type IN ('full-contact', 'poster-unlock-tradie')`,
        [req.user.id, job.id]
      );
      hasFullContact = !!contact;
    }

    // Hide full details unless user is poster, has full contact, or is god tier
    const isOwner = req.user && req.user.id === job.user_id;
    const isGod = req.user && req.user.tier === 'god';

    if (!isOwner && !hasFullContact && !isGod) {
      // Hide full description and contact details
      delete job.full_description;
      delete job.poster_email;
      delete job.poster_phone;
    }

    res.json({ job, hasFullContact });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

// PUT /api/jobs/:id/status - Update job status
router.put('/:id/status',
  authenticateToken,
  [body('status').isIn(['open', 'awarded', 'in-progress', 'complete', 'cancelled'])],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { status } = req.body;

      // Verify ownership
      const job = await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.user_id !== req.user.id && req.user.tier !== 'god') {
        return res.status(403).json({ error: 'Not authorized to update this job' });
      }

      // Update status
      await run(
        `UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        [status, req.params.id]
      );

      // If marking complete, set completed_at
      if (status === 'complete') {
        await run(
          `UPDATE jobs SET completed_at = datetime('now') WHERE id = ?`,
          [req.params.id]
        );
      }

      res.json({ message: 'Job status updated successfully', status });
    } catch (error) {
      console.error('Update job status error:', error);
      res.status(500).json({ error: 'Failed to update job status' });
    }
  }
);

// POST /api/jobs/:id/award - Award job to a tasker
router.post('/:id/award',
  authenticateToken,
  [body('tasker_id').isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tasker_id } = req.body;

      // Verify ownership
      const job = await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to award this job' });
      }

      // Verify tasker exists
      const tasker = await get('SELECT id FROM users WHERE id = ?', [tasker_id]);
      if (!tasker) {
        return res.status(404).json({ error: 'Tasker not found' });
      }

      // Award job
      await run(
        `UPDATE jobs SET status = 'awarded', awarded_to_user_id = ?, updated_at = datetime('now') WHERE id = ?`,
        [tasker_id, req.params.id]
      );

      res.json({ 
        message: 'Job awarded successfully',
        tasker_id
      });
    } catch (error) {
      console.error('Award job error:', error);
      res.status(500).json({ error: 'Failed to award job' });
    }
  }
);

module.exports = router;
