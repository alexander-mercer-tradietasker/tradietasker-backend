const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, get, run } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/reviews - Leave a review
router.post('/',
  authenticateToken,
  [
    body('job_id').isInt(),
    body('reviewee_id').isInt(),
    body('stars').isInt({ min: 1, max: 5 }),
    body('comment').optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { job_id, reviewee_id, stars, comment } = req.body;

      // Verify job exists
      const job = await get('SELECT * FROM jobs WHERE id = ?', [job_id]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Verify reviewee exists
      const reviewee = await get('SELECT id FROM users WHERE id = ?', [reviewee_id]);
      if (!reviewee) {
        return res.status(404).json({ error: 'Reviewee not found' });
      }

      // Check if already reviewed
      const existing = await get(
        `SELECT id FROM reviews 
         WHERE job_id = ? AND reviewer_id = ? AND reviewee_id = ?`,
        [job_id, req.user.id, reviewee_id]
      );
      if (existing) {
        return res.status(409).json({ error: 'Review already submitted for this job/user combination' });
      }

      // Verify user is involved in the job (poster or tasker)
      const isPoster = job.user_id === req.user.id;
      const isTasker = job.awarded_to_user_id === req.user.id;

      if (!isPoster && !isTasker) {
        return res.status(403).json({ error: 'Not authorized to review this job' });
      }

      // Create review
      await run(
        `INSERT INTO reviews (job_id, reviewer_id, reviewee_id, stars, comment, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [job_id, req.user.id, reviewee_id, stars, comment || null]
      );

      // Award credits to both reviewer and reviewee
      await run('UPDATE users SET credits = credits + 1 WHERE id = ?', [req.user.id]);
      await run('UPDATE users SET credits = credits + 1 WHERE id = ?', [reviewee_id]);

      res.status(201).json({ 
        message: 'Review submitted successfully',
        credits_awarded: 1,
        message_extra: 'Both you and the reviewee received 1 credit'
      });
    } catch (error) {
      console.error('Submit review error:', error);
      res.status(500).json({ error: 'Failed to submit review' });
    }
  }
);

// GET /api/reviews/job/:jobId - Get reviews for a job
router.get('/job/:jobId', async (req, res) => {
  try {
    const reviews = await query(
      `SELECT 
        r.*,
        reviewer.name as reviewer_name,
        reviewee.name as reviewee_name
      FROM reviews r
      JOIN users reviewer ON r.reviewer_id = reviewer.id
      JOIN users reviewee ON r.reviewee_id = reviewee.id
      WHERE r.job_id = ?
      ORDER BY r.created_at DESC`,
      [req.params.jobId]
    );

    res.json({ reviews });
  } catch (error) {
    console.error('Get job reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

// GET /api/reviews/user/:userId - Get reviews for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const reviews = await query(
      `SELECT 
        r.*,
        reviewer.name as reviewer_name,
        j.title as job_title
      FROM reviews r
      JOIN users reviewer ON r.reviewer_id = reviewer.id
      JOIN jobs j ON r.job_id = j.id
      WHERE r.reviewee_id = ?
      ORDER BY r.created_at DESC`,
      [req.params.userId]
    );

    // Calculate rating stats
    const stats = await get(
      `SELECT 
        COUNT(*) as review_count,
        AVG(stars) as avg_rating,
        SUM(CASE WHEN stars = 5 THEN 1 ELSE 0 END) as five_star,
        SUM(CASE WHEN stars = 4 THEN 1 ELSE 0 END) as four_star,
        SUM(CASE WHEN stars = 3 THEN 1 ELSE 0 END) as three_star,
        SUM(CASE WHEN stars = 2 THEN 1 ELSE 0 END) as two_star,
        SUM(CASE WHEN stars = 1 THEN 1 ELSE 0 END) as one_star
      FROM reviews
      WHERE reviewee_id = ?`,
      [req.params.userId]
    );

    res.json({ 
      reviews,
      stats: {
        ...stats,
        avg_rating: stats.avg_rating ? parseFloat(stats.avg_rating).toFixed(1) : null
      }
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

module.exports = router;
