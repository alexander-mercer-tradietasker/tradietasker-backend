const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// POST /api/reviews - Create a review
router.post('/',
  authenticateToken,
  [
    body('job_id').isInt(),
    body('reviewee_id').isInt(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('review_text').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { job_id, reviewee_id, rating, review_text } = req.body;
      const reviewer_id = req.user.id;

      // Verify job exists and is completed
      const job = await query('SELECT * FROM jobs WHERE id = $1', [job_id]).then(r => r[0]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.status !== 'complete' && job.status !== 'completed') {
        return res.status(400).json({ error: 'Can only review completed jobs' });
      }

      // Verify reviewer is either the customer or the assigned tradie
      const isCustomer = job.user_id === reviewer_id;
      const isTradie = job.assigned_tradie_id === reviewer_id;

      if (!isCustomer && !isTradie) {
        return res.status(403).json({ 
          error: 'Only the customer or assigned tradie can review this job' 
        });
      }

      // Verify reviewee is the other party
      if (isCustomer && reviewee_id !== job.assigned_tradie_id) {
        return res.status(400).json({ 
          error: 'Customer can only review the assigned tradie' 
        });
      }

      if (isTradie && reviewee_id !== job.user_id) {
        return res.status(400).json({ 
          error: 'Tradie can only review the customer' 
        });
      }

      // Check if review already exists
      const existingReview = await query('SELECT id FROM reviews WHERE job_id = $1 AND reviewer_id = $2 AND reviewee_id = $3', [job_id, reviewer_id, reviewee_id]).then(r => r[0])[0];

      if (existingReview) {
        return res.status(409).json({ error: 'You have already reviewed this job' });
      }

      // Create review
      const result = await query(`INSERT INTO reviews (job_id, reviewer_id, reviewee_id, rating, review_text, created_at)
         VALUES ($1, $2, $3, $4, $5, datetime('now'))`, [job_id, reviewer_id, reviewee_id, rating, review_text || null]);

      const review = await query('SELECT * FROM reviews WHERE id = $1', [result.lastID]).then(r => r[0]);

      res.status(201).json({
        message: 'Review submitted successfully',
        review
      });
    } catch (error) {
      console.error('Create review error:', error);
      res.status(500).json({ error: 'Failed to create review' });
    }
  }
);

// GET /api/reviews/user/:userId - Get all reviews for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const reviews = await query(`SELECT 
        r.*,
        reviewer.name as reviewer_name,
        reviewer.role as reviewer_role,
        j.title as job_title,
        j.id as job_id
      FROM reviews r
      LEFT JOIN users reviewer ON r.reviewer_id = reviewer.id
      LEFT JOIN jobs j ON r.job_id = j.id
      WHERE r.reviewee_id = $1
      ORDER BY r.created_at DESC`,
      [userId]
    );

    // Calculate average rating
    let avgRating = 0;
    if (reviews.length > 0) {
      const total = reviews.reduce((sum, r) => sum + r.rating, 0);
      avgRating = (total / reviews.length).toFixed(1);
    }

    res.json({
      reviews,
      count: reviews.length,
      average_rating: parseFloat(avgRating)
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

// GET /api/reviews/job/:jobId - Get all reviews for a job
router.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const reviews = await query(`SELECT 
        r.*,
        reviewer.name as reviewer_name,
        reviewer.role as reviewer_role,
        reviewee.name as reviewee_name,
        reviewee.role as reviewee_role
      FROM reviews r
      LEFT JOIN users reviewer ON r.reviewer_id = reviewer.id
      LEFT JOIN users reviewee ON r.reviewee_id = reviewee.id
      WHERE r.job_id = $1
      ORDER BY r.created_at DESC`,
      [jobId]
    );

    res.json({
      reviews,
      count: reviews.length
    });
  } catch (error) {
    console.error('Get job reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

// Helper function to send review request email to tradie
async function sendReviewRequestEmail(tradieEmail, tradieName, customerName, jobTitle, jobId) {
  if (!process.env.SMTP_USER) {
    console.log('Email not configured, skipping review request email');
    return;
  }

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: tradieEmail,
    subject: `Please review your completed job: ${jobTitle}`,
    html: `
      <h2>Job Completed - Please Leave a Review</h2>
      <p>Hi ${tradieName},</p>
      <p>The customer ${customerName} has marked the job "<strong>${jobTitle}</strong>" as complete.</p>
      <p>Please take a moment to review your experience with this customer.</p>
      <p><a href="${process.env.FRONTEND_URL || 'https://tradietasker.com.au'}/jobs/${jobId}">Review this job</a></p>
      <p>Thanks,<br>TradieTasker Team</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Review request email sent to ${tradieEmail}`);
  } catch (error) {
    console.error('Failed to send review request email:', error.message);
  }
}

// POST /api/reviews/send-request/:jobId - Send review request email to tradie (called when job completed)
router.post('/send-request/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;

    // Get job details
    const job = await query(`SELECT 
        j.*,
        customer.name as customer_name,
        tradie.name as tradie_name,
        tradie.email as tradie_email
      FROM jobs j
      LEFT JOIN users customer ON j.user_id = customer.id
      LEFT JOIN users tradie ON j.assigned_tradie_id = tradie.id
      WHERE j.id = $1`, [jobId]).then(r => r[0])[0];

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify requester is the customer
    if (job.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!job.tradie_email) {
      return res.status(400).json({ error: 'No tradie assigned to this job' });
    }

    // Send email
    await sendReviewRequestEmail(
      job.tradie_email,
      job.tradie_name,
      job.customer_name,
      job.title,
      jobId
    );

    res.json({ message: 'Review request sent successfully' });
  } catch (error) {
    console.error('Send review request error:', error);
    res.status(500).json({ error: 'Failed to send review request' });
  }
});

module.exports = router;
