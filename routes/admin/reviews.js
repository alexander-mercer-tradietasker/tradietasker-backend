const express = require('express');
const { query, run } = require('../../db/connection');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

// GET /api/admin/reviews - List all reviews with filters
router.get('/', async (req, res) => {
  try {
    const { jobId, userId, rating, flagged, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        r.*,
        u.name as reviewer_name,
        u.email as reviewer_email,
        j.title as job_title
      FROM reviews r
      LEFT JOIN users u ON r.reviewer_id = u.id
      LEFT JOIN jobs j ON r.job_id = j.id
      WHERE 1=1
    `;
    const params = [];

    if (jobId) {
      sql += ' AND r.job_id = ?';
      params.push(jobId);
    }

    if (userId) {
      sql += ' AND (r.reviewer_id = ? OR r.reviewee_id = ?)';
      params.push(userId, userId);
    }

    if (rating) {
      sql += ' AND r.rating = ?';
      params.push(rating);
    }

    if (flagged === 'true') {
      sql += ' AND r.is_flagged = TRUE';
    }

    sql += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const reviews = await query(sql, params);

    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM reviews r WHERE 1=1';
    const countParams = [];

    if (jobId) {
      countSql += ' AND r.job_id = ?';
      countParams.push(jobId);
    }

    if (userId) {
      countSql += ' AND (r.reviewer_id = ? OR r.reviewee_id = ?)';
      countParams.push(userId, userId);
    }

    if (rating) {
      countSql += ' AND r.rating = ?';
      countParams.push(rating);
    }

    if (flagged === 'true') {
      countSql += ' AND r.is_flagged = TRUE';
    }

    const countResult = await query(countSql, countParams);
    const total = countResult[0].total;

    res.json({ 
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

// GET /api/admin/reviews/:id - Get single review details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const review = await query(`
      SELECT 
        r.*,
        reviewer.name as reviewer_name,
        reviewer.email as reviewer_email,
        reviewee.name as reviewee_name,
        reviewee.email as reviewee_email,
        j.title as job_title
      FROM reviews r
      LEFT JOIN users reviewer ON r.reviewer_id = reviewer.id
      LEFT JOIN users reviewee ON r.reviewee_id = reviewee.id
      LEFT JOIN jobs j ON r.job_id = j.id
      WHERE r.id = ?
    `, [id]);

    if (review.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json({ review: review[0] });
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({ error: 'Failed to get review' });
  }
});

// PUT /api/admin/reviews/:id/flag - Flag review as inappropriate
router.put('/:id/flag', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await run(
      'UPDATE reviews SET is_flagged = TRUE, flag_reason = ?, flagged_at = CURRENT_TIMESTAMP WHERE id = ?',
      [reason || 'Flagged by admin', id]
    );

    res.json({ message: 'Review flagged successfully' });
  } catch (error) {
    console.error('Flag review error:', error);
    res.status(500).json({ error: 'Failed to flag review' });
  }
});

// PUT /api/admin/reviews/:id/unflag - Unflag review
router.put('/:id/unflag', async (req, res) => {
  try {
    const { id } = req.params;

    await run(
      'UPDATE reviews SET is_flagged = FALSE, flag_reason = NULL, flagged_at = NULL WHERE id = ?',
      [id]
    );

    res.json({ message: 'Review unflagged successfully' });
  } catch (error) {
    console.error('Unflag review error:', error);
    res.status(500).json({ error: 'Failed to unflag review' });
  }
});

// DELETE /api/admin/reviews/:id - Delete review
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await run('DELETE FROM reviews WHERE id = ?', [id]);

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// GET /api/admin/reviews/stats - Get review statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        COUNT(CASE WHEN is_flagged = TRUE THEN 1 END) as flagged_count,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_count
      FROM reviews
    `);

    res.json({ stats: stats[0] });
  } catch (error) {
    console.error('Get review stats error:', error);
    res.status(500).json({ error: 'Failed to get review statistics' });
  }
});

module.exports = router;
