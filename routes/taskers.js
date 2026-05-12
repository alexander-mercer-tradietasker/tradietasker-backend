const express = require('express');
const { query, get } = require('../db/connection');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/taskers - Browse tasker profiles
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      profession_id,
      postcode,
      radius_km = 25,
      min_rating,
      limit = 50,
      offset = 0
    } = req.query;

    let sql = `
      SELECT 
        u.id,
        u.name,
        u.tier,
        u.service_postcode,
        u.service_radius_km,
        u.profile_photo_url,
        u.business_name,
        COUNT(DISTINCT r.id) as review_count,
        AVG(r.stars) as avg_rating,
        GROUP_CONCAT(DISTINCT p.name) as professions
      FROM users u
      LEFT JOIN reviews r ON u.id = r.reviewee_id
      LEFT JOIN user_professions up ON u.id = up.user_id
      LEFT JOIN professions p ON up.profession_id = p.id
      WHERE u.role IN ('tasker', 'both')
    `;
    const params = [];

    // Filter by profession
    if (profession_id) {
      sql += ` AND EXISTS (
        SELECT 1 FROM user_professions up2
        WHERE up2.user_id = u.id AND up2.profession_id = ?
      )`;
      params.push(profession_id);
    }

    // Filter by postcode (exact match for now)
    if (postcode) {
      sql += ' AND u.service_postcode = ?';
      params.push(postcode);
    }

    sql += ' GROUP BY u.id';

    // Filter by minimum rating
    if (min_rating) {
      sql += ' HAVING avg_rating >= ?';
      params.push(parseFloat(min_rating));
    }

    sql += ' ORDER BY avg_rating DESC, review_count DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const taskers = await query(sql, params);

    // Check which taskers user has unlocked
    const sanitizedTaskers = await Promise.all(
      taskers.map(async (tasker) => {
        let isUnlocked = false;

        if (req.user) {
          const contact = await get(
            `SELECT id FROM contact_transactions 
             WHERE from_user_id = ? AND to_user_id = ? AND type IN ('poster-unlock-tradie', 'send-profile')`,
            [req.user.id, tasker.id]
          );
          isUnlocked = !!contact;
        }

        // Hide contact details unless unlocked or god tier
        const sanitized = {
          id: tasker.id,
          name: tasker.name,
          tier: tasker.tier,
          service_postcode: tasker.service_postcode,
          service_radius_km: tasker.service_radius_km,
          profile_photo_url: tasker.profile_photo_url,
          business_name: tasker.business_name,
          review_count: tasker.review_count,
          avg_rating: tasker.avg_rating ? parseFloat(tasker.avg_rating).toFixed(1) : null,
          professions: tasker.professions ? tasker.professions.split(',') : [],
          is_unlocked: isUnlocked
        };

        return sanitized;
      })
    );

    res.json({ 
      taskers: sanitizedTaskers,
      count: sanitizedTaskers.length
    });
  } catch (error) {
    console.error('Browse taskers error:', error);
    res.status(500).json({ error: 'Failed to browse taskers' });
  }
});

// GET /api/taskers/:id - Get tasker profile
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const tasker = await get(
      `SELECT 
        u.*,
        COUNT(DISTINCT r.id) as review_count,
        AVG(r.stars) as avg_rating
      FROM users u
      LEFT JOIN reviews r ON u.id = r.reviewee_id
      WHERE u.id = ? AND u.role IN ('tasker', 'both')
      GROUP BY u.id`,
      [req.params.id]
    );

    if (!tasker) {
      return res.status(404).json({ error: 'Tasker not found' });
    }

    // Get professions
    const professions = await query(
      `SELECT p.id, p.name, p.category, p.requires_licence, up.licence_number, up.state
       FROM user_professions up
       JOIN professions p ON up.profession_id = p.id
       WHERE up.user_id = ?`,
      [req.params.id]
    );

    // Get qualifications
    const qualifications = await query(
      'SELECT * FROM user_qualifications WHERE user_id = ?',
      [req.params.id]
    );

    // Get recent reviews
    const reviews = await query(
      `SELECT 
        r.stars,
        r.comment,
        r.created_at,
        reviewer.name as reviewer_name,
        j.title as job_title
      FROM reviews r
      JOIN users reviewer ON r.reviewer_id = reviewer.id
      JOIN jobs j ON r.job_id = j.id
      WHERE r.reviewee_id = ?
      ORDER BY r.created_at DESC
      LIMIT 10`,
      [req.params.id]
    );

    // Check if user has unlocked this tasker
    let isUnlocked = false;
    if (req.user) {
      const contact = await get(
        `SELECT id FROM contact_transactions 
         WHERE from_user_id = ? AND to_user_id = ? AND type IN ('poster-unlock-tradie', 'send-profile')`,
        [req.user.id, req.params.id]
      );
      isUnlocked = !!contact;
    }

    // Privacy controls
    const isOwner = req.user && req.user.id === tasker.id;
    const isGod = req.user && req.user.tier === 'god';

    // Remove sensitive fields
    delete tasker.password_hash;
    delete tasker.credits;

    if (!isOwner && !isUnlocked && !isGod) {
      // Hide full contact details
      delete tasker.email;
      delete tasker.phone;
      delete tasker.residential_address;
      delete tasker.residential_suburb;
      delete tasker.residential_state;
      delete tasker.residential_postcode;
      delete tasker.postal_address;
      delete tasker.postal_postcode;
      delete tasker.date_of_birth;
      delete tasker.abn;
      delete tasker.business_address;
      delete tasker.business_phone;
      delete tasker.business_email;
    }

    res.json({ 
      tasker: {
        ...tasker,
        avg_rating: tasker.avg_rating ? parseFloat(tasker.avg_rating).toFixed(1) : null,
        professions,
        qualifications,
        reviews,
        is_unlocked: isUnlocked
      }
    });
  } catch (error) {
    console.error('Get tasker error:', error);
    res.status(500).json({ error: 'Failed to get tasker' });
  }
});

module.exports = router;
