const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../db/connection'); // Use db.query() instead of get()/run()
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for profile photo uploads (in-memory storage for now)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const mimeType = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimeType && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpeg, jpg, png, gif) are allowed'));
  }
});

// GET /api/jobs/my-jobs - Get customer's jobs with filtering
router.get('/my-jobs', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    
    let sql = `
      SELECT 
        j.*,
        jt.name as job_type_name,
        jt.category as job_type_category,
        assigned.name as assigned_tradie_name,
        assigned.phone as assigned_tradie_phone,
        assigned.email as assigned_tradie_email
      FROM jobs j
      LEFT JOIN job_types jt ON j.job_type_id = jt.id
      LEFT JOIN users assigned ON j.assigned_tradie_id = assigned.id
      WHERE j.poster_id = ?
    `;
    
    const params = [req.user.id];
    
    if (status && status !== 'all') {
      sql += ' AND j.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY j.created_at DESC';
    
    const jobs = await query(sql, params);
    
    // Parse photos JSON
    jobs.forEach(job => {
      if (job.photos) {
        try {
          job.photos = JSON.parse(job.photos);
        } catch (e) {
          job.photos = [];
        }
      }
    });
    
    res.json(jobs);
  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({ error: 'Failed to get jobs' });
  }
});

// PUT /api/jobs/:id/assign - Assign tradie to job
router.put('/:id/assign',
  authenticateToken,
  [body('tradie_id').isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { tradie_id } = req.body;

      // Verify job belongs to customer
      const job = await query('SELECT * FROM jobs WHERE id = $1 AND poster_id = $2', [id, req.user.id]).then(r => r[0]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found or not authorized' });
      }

      // Verify tradie is unlocked
      const unlocked = await query(`SELECT id FROM contact_transactions 
         WHERE from_user_id = $1 AND to_user_id = $2 AND type IN ('poster-unlock-tradie', 'poster-3-pack', 'poster-20-pack')`, [req.user.id, tradie_id]).then(r => r[0]);
      
      if (!unlocked) {
        return res.status(403).json({ error: 'Tradie must be unlocked before assignment' });
      }

      // Assign tradie and update status
      await query('UPDATE jobs SET assigned_tradie_id = $1, status = $2, updated_at = datetime(\'now\') WHERE id = $3', [tradie_id, 'in-progress', id]);

      // Get updated job
      const updatedJob = await query(`SELECT j.*, u.name as assigned_tradie_name 
         FROM jobs j 
         LEFT JOIN users u ON j.assigned_tradie_id = u.id 
         WHERE j.id = $1`, [id]).then(r => r[0]);

      res.json({
        message: 'Tradie assigned successfully',
        job: updatedJob
      });
    } catch (error) {
      console.error('Assign tradie error:', error);
      res.status(500).json({ error: 'Failed to assign tradie' });
    }
  }
);

// PUT /api/jobs/:id/complete - Mark job complete
router.put('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify job belongs to customer and is in-progress
    const job = await query('SELECT * FROM jobs WHERE id = $1 AND poster_id = $2 AND status = $3', [id, req.user.id, 'in-progress']).then(r => r[0]);
    
    if (!job) {
      return res.status(404).json({ 
        error: 'Job not found, not authorized, or not in progress' 
      });
    }

    // Update job status
    await query('UPDATE jobs SET status = $1, completed_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = $2', ['complete', id]);

    res.json({
      message: 'Job marked as complete. Please rate and review the tradie.',
      job_id: id,
      assigned_tradie_id: job.assigned_tradie_id,
      review_required: true
    });
  } catch (error) {
    console.error('Complete job error:', error);
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// PUT /api/users/me - Update user profile (including prefs)
router.put('/profile',
  authenticateToken,
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail(),
    body('phone').optional(),
    body('residential_address').optional(),
    body('notification_prefs').optional().isObject(),
    body('marketing_prefs').optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const allowedFields = [
        'name', 'email', 'phone', 'residential_address', 
        'residential_suburb', 'residential_state', 'residential_postcode',
        'postal_address', 'postal_postcode'
      ];

      const updates = {};
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      // Handle JSON preferences
      if (req.body.notification_prefs) {
        updates.notification_prefs = JSON.stringify(req.body.notification_prefs);
      }
      if (req.body.marketing_prefs) {
        updates.marketing_prefs = JSON.stringify(req.body.marketing_prefs);
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // Build update query
      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updates), req.user.id];

      await query(`UPDATE users SET ${setClause}, updated_at = datetime('now') WHERE id = $1`,
        values
      );

      // Get updated user
      const user = await query('SELECT * FROM users WHERE id = $1', [req.user.id]).then(r => r[0]);
      delete user.password_hash;

      // Parse JSON fields
      if (user.notification_prefs) {
        user.notification_prefs = JSON.parse(user.notification_prefs);
      }
      if (user.marketing_prefs) {
        user.marketing_prefs = JSON.parse(user.marketing_prefs);
      }

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

// POST /api/users/me/password - Change password
router.post('/password',
  authenticateToken,
  [
    body('current_password').notEmpty(),
    body('new_password').isLength({ min: 6 }),
    body('confirm_password').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { current_password, new_password, confirm_password } = req.body;

      // Check if new passwords match
      if (new_password !== confirm_password) {
        return res.status(400).json({ error: 'New passwords do not match' });
      }

      // Get current user with password hash
      const user = await query('SELECT * FROM users WHERE id = $1', [req.user.id]).then(r => r[0]);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isValid = await bcrypt.compare(current_password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const newHash = await bcrypt.hash(new_password, 10);

      // Update password
      await query(
        `UPDATE users SET password_hash = $2, updated_at = datetime('now') WHERE id = $3`, [newHash, req.user.id]);

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

// POST /api/users/me/photo - Upload profile photo
router.post('/photo',
  authenticateToken,
  upload.single('photo'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No photo file uploaded' });
      }

      // In production, upload to S3/CloudFlare R2/etc and get URL
      // For now, we'll store as base64 data URL (not recommended for production)
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      
      // Check size after base64 encoding (should be < 150KB ideally)
      if (base64Image.length > 200 * 1024) {
        return res.status(413).json({ 
          error: 'Image too large after encoding. Please use a smaller image.' 
        });
      }

      await query(`UPDATE users SET profile_photo_url = $1, updated_at = datetime('now') WHERE id = $2`, [base64Image, req.user.id]);

      res.json({ 
        message: 'Profile photo updated successfully',
        photo_url: base64Image.substring(0, 100) + '...' // Don't return full base64 in response
      });
    } catch (error) {
      console.error('Upload photo error:', error);
      res.status(500).json({ error: 'Failed to upload photo' });
    }
  }
);

// GET /api/customer-dashboard/overview - Get comprehensive dashboard data
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    // Get user details
    const user = await query('SELECT id, name, email, phone, credits, residential_address FROM users WHERE id = $1', [req.user.id]).then(r => r[0]);

    // Get contacted tradies
    const contactedTradies = await query(`
      SELECT 
        u.id,
        u.name,
        u.phone,
        u.email,
        ct.created_at as contacted_at,
        ct.contact_type,
        j.id as job_id,
        j.title as job_title
      FROM contact_transactions ct
      LEFT JOIN users u ON ct.receiver_id = u.id
      LEFT JOIN jobs j ON ct.job_id = j.id
      WHERE ct.sender_id = $1
      ORDER BY ct.created_at DESC
      LIMIT 10
    `, [req.user.id]);

    // Get active jobs with applications
    const activeJobs = await query(`
      SELECT 
        j.id,
        j.title,
        j.description,
        j.budget,
        j.status,
        j.created_at,
        COUNT(DISTINCT ja.id) as application_count,
        assigned.name as assigned_tradie_name
      FROM jobs j
      LEFT JOIN job_applications ja ON j.id = ja.job_id
      LEFT JOIN users assigned ON j.assigned_tradie_id = assigned.id
      WHERE j.poster_id = ? AND j.status IN ('open', 'in-progress')
      GROUP BY j.id, j.title, j.description, j.budget, j.status, j.created_at, assigned.name
      ORDER BY j.created_at DESC
    `, [req.user.id]);

    // Get completed jobs and reviews
    const completedJobs = await query(`
      SELECT 
        j.id,
        j.title,
        j.status,
        j.completed_at,
        assigned.name as assigned_tradie_name,
        assigned.id as assigned_tradie_id,
        r.id as review_id,
        r.rating,
        r.comment
      FROM jobs j
      LEFT JOIN users assigned ON j.assigned_tradie_id = assigned.id
      LEFT JOIN reviews r ON j.id = r.job_id AND r.reviewer_id = ?
      WHERE j.poster_id = ? AND j.status = 'complete'
      ORDER BY j.completed_at DESC
      LIMIT 10
    `, [req.user.id, req.user.id]);

    res.json({
      user,
      contactedTradies,
      activeJobs,
      completedJobs,
      stats: {
        totalJobs: activeJobs.length + completedJobs.length,
        activeJobs: activeJobs.length,
        completedJobs: completedJobs.length,
        totalContacts: contactedTradies.length
      }
    });
  } catch (error) {
    console.error('Get customer dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to get dashboard overview' });
  }
});

module.exports = router;
