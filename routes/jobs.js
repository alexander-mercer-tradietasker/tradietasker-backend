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
          `INSERT INTO users (email, password, name, phone, role, tier, credits, created_at)
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
        photos = []
      } = req.body;

      // Verify job type exists
      const jobType = await get('SELECT id FROM job_types WHERE id = ?', [job_type_id]);
      if (!jobType) {
        return res.status(404).json({ error: 'Job type not found' });
      }

      // Create job
      const jobResult = await run(
        `INSERT INTO jobs (
          user_id, job_type_id, title, short_description, full_description,
          budget, postcode, suburb, state, photos, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now'))`,
        [
          userId,
          job_type_id,
          title,
          short_description,
          full_description,
          budget || null,
          postcode,
          suburb,
          state,
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

// GET /api/jobs/my-jobs - Get all jobs posted by the logged-in customer
router.get('/my-jobs', authenticateToken, async (req, res) => {
  try {
    const {
      status,
      limit = 50,
      offset = 0
    } = req.query;

    let sql = `
      SELECT 
        j.*,
        jt.name as job_type_name,
        jt.category as job_type_category,
        u.name as assigned_tradie_name,
        u.email as assigned_tradie_email,
        u.phone as assigned_tradie_phone
      FROM jobs j
      LEFT JOIN job_types jt ON j.job_type_id = jt.id
      LEFT JOIN users u ON j.assigned_tradie_id = u.id
      WHERE j.user_id = ?
    `;
    const params = [req.user.id];

    // Filter by status if provided
    if (status && status !== 'all') {
      sql += ' AND j.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const jobs = await query(sql, params);

    // Parse photos JSON
    const sanitizedJobs = jobs.map(job => {
      const sanitized = { ...job };
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
      count: sanitizedJobs.length
    });
  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

// PUT /api/jobs/:id/assign - Assign a tradie to a job (move from open to in-progress)
router.put('/:id/assign',
  authenticateToken,
  [body('tradie_id').isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tradie_id } = req.body;

      // Verify ownership
      const job = await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to update this job' });
      }

      // Verify tradie exists and customer has unlocked them for this job
      const tradie = await get('SELECT id FROM users WHERE id = ?', [tradie_id]);
      if (!tradie) {
        return res.status(404).json({ error: 'Tradie not found' });
      }

      // Check if customer has unlocked this tradie
      const unlocked = await get(
        `SELECT id FROM contact_transactions 
         WHERE from_user_id = ? AND to_user_id = ? AND job_id = ? 
         AND type IN ('poster-unlock-tradie', 'poster-3-pack', 'poster-20-pack')`,
        [req.user.id, tradie_id, req.params.id]
      );

      if (!unlocked) {
        return res.status(403).json({ 
          error: 'You must unlock this tradie before assigning them to the job' 
        });
      }

      // Assign tradie and move to in-progress
      await run(
        `UPDATE jobs 
         SET status = 'in-progress', 
             assigned_tradie_id = ?, 
             updated_at = datetime('now') 
         WHERE id = ?`,
        [tradie_id, req.params.id]
      );

      res.json({ 
        message: 'Job assigned successfully',
        tradie_id,
        status: 'in-progress'
      });
    } catch (error) {
      console.error('Assign job error:', error);
      res.status(500).json({ error: 'Failed to assign job' });
    }
  }
);

// PUT /api/jobs/:id/complete - Mark job as completed (triggers review prompt on frontend)
router.put('/:id/complete', authenticateToken, async (req, res) => {
  try {
    // Verify ownership
    const job = await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this job' });
    }

    if (job.status !== 'in-progress') {
      return res.status(400).json({ 
        error: 'Job must be in-progress to mark as complete' 
      });
    }

    // Mark as complete
    await run(
      `UPDATE jobs 
       SET status = 'complete', 
           completed_at = datetime('now'),
           updated_at = datetime('now') 
       WHERE id = ?`,
      [req.params.id]
    );

    res.json({ 
      message: 'Job marked as complete',
      status: 'complete',
      assigned_tradie_id: job.assigned_tradie_id,
      should_prompt_review: true
    });
  } catch (error) {
    console.error('Complete job error:', error);
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// PUT /api/jobs/:id/cancel - Cancel a job
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    // Verify ownership (customer or admin)
    const job = await get('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.user_id !== req.user.id && req.user.tier !== 'god') {
      return res.status(403).json({ error: 'Not authorized to cancel this job' });
    }

    if (job.status === 'cancelled') {
      return res.status(400).json({ error: 'Job is already cancelled' });
    }

    if (job.status === 'complete') {
      return res.status(400).json({ error: 'Cannot cancel a completed job' });
    }

    // Cancel the job
    await run(
      `UPDATE jobs 
       SET status = 'cancelled', 
           updated_at = datetime('now') 
       WHERE id = ?`,
      [req.params.id]
    );

    res.json({ 
      message: 'Job cancelled successfully',
      status: 'cancelled'
    });
  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// GET /api/jobs/my-jobs - Get tradie's jobs (jobs they've unlocked or been assigned to)
router.get('/my-jobs', authenticateToken, async (req, res) => {
  try {
    const { status, budget_min, budget_max, location, date_from, date_to, filter = 'all' } = req.query;

    // Get jobs where:
    // 1. Tradie has unlocked the customer (contact_transactions)
    // 2. Tradie has been assigned (jobs.awarded_to_user_id)
    // 3. Tradie has applied (applications)
    
    let sql = `
      SELECT DISTINCT
        j.*,
        jt.name as job_type_name,
        jt.category as job_type_category,
        u.name as poster_name,
        u.email as poster_email,
        u.phone as poster_phone,
        CASE
          WHEN j.awarded_to_user_id = ? THEN 'assigned'
          WHEN a.id IS NOT NULL THEN 'applied'
          WHEN ct.id IS NOT NULL THEN 'unlocked'
          ELSE 'other'
        END as tradie_relationship
      FROM jobs j
      LEFT JOIN job_types jt ON j.job_type_id = jt.id
      LEFT JOIN users u ON j.poster_id = u.id
      LEFT JOIN contact_transactions ct ON ct.job_id = j.id AND ct.from_user_id = ?
      LEFT JOIN applications a ON a.job_id = j.id AND a.tradie_id = ?
      WHERE (
        j.awarded_to_user_id = ? 
        OR ct.id IS NOT NULL 
        OR a.id IS NOT NULL
      )
    `;
    const params = [req.user.id, req.user.id, req.user.id, req.user.id];

    // Apply filters
    if (filter === 'applied') {
      sql += ' AND a.id IS NOT NULL';
    } else if (filter === 'assigned') {
      sql += ' AND j.awarded_to_user_id = ?';
      params.push(req.user.id);
    } else if (filter === 'completed') {
      sql += ' AND j.status = \'complete\'';
    }

    if (status && filter === 'all') {
      sql += ' AND j.status = ?';
      params.push(status);
    }

    if (budget_min) {
      sql += ' AND CAST(j.budget AS DECIMAL) >= ?';
      params.push(budget_min);
    }

    if (budget_max) {
      sql += ' AND CAST(j.budget AS DECIMAL) <= ?';
      params.push(budget_max);
    }

    if (location) {
      sql += ' AND (j.suburb LIKE ? OR j.postcode LIKE ?)';
      params.push(`%${location}%`, `%${location}%`);
    }

    if (date_from) {
      sql += ' AND j.created_at >= ?';
      params.push(date_from);
    }

    if (date_to) {
      sql += ' AND j.created_at <= ?';
      params.push(date_to);
    }

    sql += ' ORDER BY j.created_at DESC';

    const jobs = await query(sql, params);

    // Parse photos
    jobs.forEach(job => {
      if (job.photos) {
        try {
          job.photos = JSON.parse(job.photos);
        } catch (e) {
          job.photos = [];
        }
      }
    });

    res.json({ 
      jobs,
      count: jobs.length
    });
  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

module.exports = router;
