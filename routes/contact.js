const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, get, run } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Contact transaction costs
const CONTACT_COSTS = {
  'send-profile': 1,           // Tradie Unlock - tasker sends profile to poster
  'full-contact': 2,           // Task Unlock - tasker gets full job details
  'poster-unlock-tradie': 1,   // Poster unlocks single tradie
  'poster-3-pack': 0,          // Part of package (tracked in poster_packages)
  'poster-20-pack': 0          // Part of package (tracked in poster_packages)
};

// POST /api/contact/send-profile - Tasker sends profile to poster (Tradie Unlock - 1 credit)
router.post('/send-profile',
  authenticateToken,
  [body('job_id').isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { job_id } = req.body;

      // Verify job exists
      const job = await get('SELECT * FROM jobs WHERE id = ?', [job_id]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Check if already sent
      const existing = await get(
        `SELECT id FROM contact_transactions 
         WHERE from_user_id = ? AND job_id = ? AND type = 'send-profile'`,
        [req.user.id, job_id]
      );
      if (existing) {
        return res.status(409).json({ error: 'Profile already sent for this job' });
      }

      // Check credits
      if (req.user.credits < CONTACT_COSTS['send-profile']) {
        return res.status(402).json({ 
          error: 'Insufficient credits',
          required: CONTACT_COSTS['send-profile'],
          available: req.user.credits
        });
      }

      // Deduct credits
      await run(
        'UPDATE users SET credits = credits - ? WHERE id = ?',
        [CONTACT_COSTS['send-profile'], req.user.id]
      );

      // Create transaction
      await run(
        `INSERT INTO contact_transactions (from_user_id, to_user_id, job_id, type, credits_used, created_at)
         VALUES (?, ?, ?, 'send-profile', ?, datetime('now'))`,
        [req.user.id, job.user_id, job_id, CONTACT_COSTS['send-profile']]
      );

      res.json({ 
        message: 'Profile sent to poster successfully',
        credits_used: CONTACT_COSTS['send-profile'],
        credits_remaining: req.user.credits - CONTACT_COSTS['send-profile']
      });
    } catch (error) {
      console.error('Send profile error:', error);
      res.status(500).json({ error: 'Failed to send profile' });
    }
  }
);

// POST /api/contact/full-contact - Tasker gets full job details (Task Unlock - 2 credits)
router.post('/full-contact',
  authenticateToken,
  [body('job_id').isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { job_id } = req.body;

      // Verify job exists
      const job = await get(
        `SELECT j.*, u.email as poster_email, u.phone as poster_phone
         FROM jobs j
         LEFT JOIN users u ON j.user_id = u.id
         WHERE j.id = ?`,
        [job_id]
      );
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Check if already purchased
      const existing = await get(
        `SELECT id FROM contact_transactions 
         WHERE from_user_id = ? AND job_id = ? AND type = 'full-contact'`,
        [req.user.id, job_id]
      );
      if (existing) {
        return res.status(409).json({ error: 'Full contact already purchased for this job' });
      }

      // Check credits
      if (req.user.credits < CONTACT_COSTS['full-contact']) {
        return res.status(402).json({ 
          error: 'Insufficient credits',
          required: CONTACT_COSTS['full-contact'],
          available: req.user.credits
        });
      }

      // Deduct credits
      await run(
        'UPDATE users SET credits = credits - ? WHERE id = ?',
        [CONTACT_COSTS['full-contact'], req.user.id]
      );

      // Create transaction
      await run(
        `INSERT INTO contact_transactions (from_user_id, to_user_id, job_id, type, credits_used, created_at)
         VALUES (?, ?, ?, 'full-contact', ?, datetime('now'))`,
        [req.user.id, job.user_id, job_id, CONTACT_COSTS['full-contact']]
      );

      // Parse photos
      if (job.photos) {
        try {
          job.photos = JSON.parse(job.photos);
        } catch (e) {
          job.photos = [];
        }
      }

      res.json({ 
        message: 'Full contact unlocked successfully',
        credits_used: CONTACT_COSTS['full-contact'],
        credits_remaining: req.user.credits - CONTACT_COSTS['full-contact'],
        job: {
          id: job.id,
          title: job.title,
          full_description: job.full_description,
          poster_email: job.poster_email,
          poster_phone: job.poster_phone,
          photos: job.photos
        }
      });
    } catch (error) {
      console.error('Full contact error:', error);
      res.status(500).json({ error: 'Failed to unlock full contact' });
    }
  }
);

// POST /api/contact/unlock-tradie - Poster unlocks single tradie from browse
router.post('/unlock-tradie',
  authenticateToken,
  [body('tasker_id').isInt(), body('job_id').isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tasker_id, job_id } = req.body;

      // Verify tasker exists
      const tasker = await get(
        `SELECT u.*, 
          GROUP_CONCAT(DISTINCT p.name) as professions
         FROM users u
         LEFT JOIN user_professions up ON u.id = up.user_id
         LEFT JOIN professions p ON up.profession_id = p.id
         WHERE u.id = ?
         GROUP BY u.id`,
        [tasker_id]
      );
      if (!tasker) {
        return res.status(404).json({ error: 'Tasker not found' });
      }

      // Check if already unlocked
      const existing = await get(
        `SELECT id FROM contact_transactions 
         WHERE from_user_id = ? AND to_user_id = ? AND job_id = ? AND type = 'poster-unlock-tradie'`,
        [req.user.id, tasker_id, job_id]
      );
      if (existing) {
        return res.status(409).json({ error: 'Tradie already unlocked' });
      }

      // Check credits
      if (req.user.credits < CONTACT_COSTS['poster-unlock-tradie']) {
        return res.status(402).json({ 
          error: 'Insufficient credits',
          required: CONTACT_COSTS['poster-unlock-tradie'],
          available: req.user.credits
        });
      }

      // Deduct credits
      await run(
        'UPDATE users SET credits = credits - ? WHERE id = ?',
        [CONTACT_COSTS['poster-unlock-tradie'], req.user.id]
      );

      // Create transaction
      await run(
        `INSERT INTO contact_transactions (from_user_id, to_user_id, job_id, type, credits_used, created_at)
         VALUES (?, ?, ?, 'poster-unlock-tradie', ?, datetime('now'))`,
        [req.user.id, tasker_id, job_id, CONTACT_COSTS['poster-unlock-tradie']]
      );

      // Remove password hash
      delete tasker.password;

      res.json({ 
        message: 'Tradie unlocked successfully',
        credits_used: CONTACT_COSTS['poster-unlock-tradie'],
        credits_remaining: req.user.credits - CONTACT_COSTS['poster-unlock-tradie'],
        tasker
      });
    } catch (error) {
      console.error('Unlock tradie error:', error);
      res.status(500).json({ error: 'Failed to unlock tradie' });
    }
  }
);

// POST /api/contact/3-tradie-pack - Poster buys 3-Tradie Unlock Starter Pack ($5.50)
router.post('/3-tradie-pack',
  authenticateToken,
  [body('job_id').isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { job_id } = req.body;

      // Verify job exists and is owned by user
      const job = await get('SELECT * FROM jobs WHERE id = ?', [job_id]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      if (job.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized for this job' });
      }

      // Check if package already exists for this job
      const existing = await get(
        `SELECT id FROM poster_packages 
         WHERE user_id = ? AND job_id = ? AND type = '3-tradie' AND is_active = 1`,
        [req.user.id, job_id]
      );
      if (existing) {
        return res.status(409).json({ error: '3-tradie pack already active for this job' });
      }

      // TODO: Integrate with Stripe payment ($5.50)
      // For now, just create the package (mock payment success)

      // Create package
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

      await run(
        `INSERT INTO poster_packages (user_id, job_id, type, tradies_unlocked, tradies_limit, expires_at, is_active, created_at)
         VALUES (?, ?, '3-tradie', 0, 3, ?, 1, datetime('now'))`,
        [req.user.id, job_id, expiresAt.toISOString()]
      );

      res.status(201).json({ 
        message: '3-Tradie Unlock Starter Pack purchased successfully',
        amount_paid: 5.50,
        tradies_remaining: 3,
        expires_at: expiresAt
      });
    } catch (error) {
      console.error('3-tradie pack error:', error);
      res.status(500).json({ error: 'Failed to purchase package' });
    }
  }
);

// POST /api/contact/20-tradie-pack - Poster buys 20-Tradie Unlock Pro Pack ($22)
router.post('/20-tradie-pack',
  authenticateToken,
  [body('job_id').isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { job_id } = req.body;

      // Verify job exists and is owned by user
      const job = await get('SELECT * FROM jobs WHERE id = ?', [job_id]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      if (job.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized for this job' });
      }

      // Check if package already exists for this job
      const existing = await get(
        `SELECT id FROM poster_packages 
         WHERE user_id = ? AND job_id = ? AND type = '20-tradie' AND is_active = 1`,
        [req.user.id, job_id]
      );
      if (existing) {
        return res.status(409).json({ error: '20-tradie pack already active for this job' });
      }

      // TODO: Integrate with Stripe payment ($22)
      // For now, just create the package (mock payment success)

      // Create package
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

      await run(
        `INSERT INTO poster_packages (user_id, job_id, type, tradies_unlocked, tradies_limit, expires_at, is_active, created_at)
         VALUES (?, ?, '20-tradie', 0, 20, ?, 1, datetime('now'))`,
        [req.user.id, job_id, expiresAt.toISOString()]
      );

      res.status(201).json({ 
        message: '20-Tradie Unlock Pro Pack purchased successfully',
        amount_paid: 22.00,
        tradies_remaining: 20,
        expires_at: expiresAt
      });
    } catch (error) {
      console.error('20-tradie pack error:', error);
      res.status(500).json({ error: 'Failed to purchase package' });
    }
  }
);

// GET /api/contact/my-contacts - List contacts unlocked
router.get('/my-contacts', authenticateToken, async (req, res) => {
  try {
    const contacts = await query(
      `SELECT 
        ct.*,
        j.title as job_title,
        CASE 
          WHEN ct.from_user_id = ? THEN to_user.name
          ELSE from_user.name
        END as contact_name,
        CASE 
          WHEN ct.from_user_id = ? THEN to_user.email
          ELSE from_user.email
        END as contact_email,
        CASE 
          WHEN ct.from_user_id = ? THEN to_user.phone
          ELSE from_user.phone
        END as contact_phone
      FROM contact_transactions ct
      JOIN jobs j ON ct.job_id = j.id
      LEFT JOIN users from_user ON ct.from_user_id = from_user.id
      LEFT JOIN users to_user ON ct.to_user_id = to_user.id
      WHERE ct.from_user_id = ? OR ct.to_user_id = ?
      ORDER BY ct.created_at DESC`,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
    );

    res.json({ contacts });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to get contacts' });
  }
});

// GET /api/contact/unlocked-tradies - Get all tradies the customer has unlocked
router.get('/unlocked-tradies', authenticateToken, async (req, res) => {
  try {
    const tradies = await query(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.business_name,
        u.profile_photo_url,
        GROUP_CONCAT(DISTINCT p.name) as professions,
        ct.created_at as unlock_date,
        ct.job_id,
        j.title as job_title,
        COALESCE(AVG(r.stars), 0) as avg_rating,
        COUNT(DISTINCT r.id) as review_count
      FROM contact_transactions ct
      JOIN users u ON ct.to_user_id = u.id
      LEFT JOIN jobs j ON ct.job_id = j.id
      LEFT JOIN user_professions up ON u.id = up.user_id
      LEFT JOIN professions p ON up.profession_id = p.id
      LEFT JOIN reviews r ON r.reviewee_id = u.id
      WHERE ct.from_user_id = ? 
        AND ct.type IN ('poster-unlock-tradie', 'poster-3-pack', 'poster-20-pack')
      GROUP BY u.id, ct.created_at, ct.job_id, j.title
      ORDER BY ct.created_at DESC`,
      [req.user.id]
    );

    // Format the response
    const formattedTradies = tradies.map(tradie => ({
      id: tradie.id,
      name: tradie.name,
      email: tradie.email,
      phone: tradie.phone,
      business_name: tradie.business_name,
      profile_photo_url: tradie.profile_photo_url,
      professions: tradie.professions ? tradie.professions.split(',') : [],
      rating: parseFloat(tradie.avg_rating).toFixed(1),
      review_count: tradie.review_count,
      unlock_date: tradie.unlock_date,
      job_id: tradie.job_id,
      job_title: tradie.job_title
    }));

    res.json({ 
      tradies: formattedTradies,
      count: formattedTradies.length
    });
  } catch (error) {
    console.error('Get unlocked tradies error:', error);
    res.status(500).json({ error: 'Failed to get unlocked tradies' });
  }
});

module.exports = router;
