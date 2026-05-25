const express = require('express');
const { query, run } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// Generate unique referral code
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// GET /api/referrals/my-code - Get current user's referral code
router.get('/my-code', authenticateToken, async (req, res) => {
  try {
    const user = await query(
      'SELECT referral_code, referral_credit_earned FROM users WHERE id = ?',
      [req.user.id]
    );

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate referral code if user doesn't have one
    if (!user[0].referral_code) {
      let code = generateReferralCode();
      let attempts = 0;
      
      // Ensure unique code
      while (attempts < 10) {
        const existing = await query(
          'SELECT id FROM users WHERE referral_code = ?',
          [code]
        );
        
        if (existing.length === 0) {
          break;
        }
        
        code = generateReferralCode();
        attempts++;
      }

      await run(
        'UPDATE users SET referral_code = ? WHERE id = ?',
        [code, req.user.id]
      );

      user[0].referral_code = code;
    }

    // Get referral statistics
    const stats = await query(`
      SELECT 
        COUNT(*) as total_referrals,
        SUM(credit_awarded) as total_credits_earned
      FROM referrals
      WHERE referrer_id = ?
    `, [req.user.id]);

    res.json({ 
      referralCode: user[0].referral_code,
      creditsEarned: user[0].referral_credit_earned || 0,
      stats: stats[0]
    });
  } catch (error) {
    console.error('Get referral code error:', error);
    res.status(500).json({ error: 'Failed to get referral code' });
  }
});

// GET /api/referrals/my-referrals - Get list of users I referred
router.get('/my-referrals', authenticateToken, async (req, res) => {
  try {
    const referrals = await query(`
      SELECT 
        u.name,
        u.created_at as joined_at,
        r.credit_awarded,
        r.created_at as referral_date
      FROM referrals r
      INNER JOIN users u ON r.referred_user_id = u.id
      WHERE r.referrer_id = ?
      ORDER BY r.created_at DESC
    `, [req.user.id]);

    res.json({ referrals });
  } catch (error) {
    console.error('Get my referrals error:', error);
    res.status(500).json({ error: 'Failed to get referrals' });
  }
});

// POST /api/referrals/apply - Apply referral code during signup
router.post('/apply', async (req, res) => {
  try {
    const { referralCode, userId } = req.body;

    if (!referralCode || !userId) {
      return res.status(400).json({ error: 'Referral code and user ID are required' });
    }

    // Check if referral system is enabled
    const settings = await query(
      'SELECT * FROM referral_settings ORDER BY id DESC LIMIT 1'
    );

    if (settings.length === 0 || !settings[0].enabled) {
      return res.status(400).json({ error: 'Referral system is currently disabled' });
    }

    // Find the referrer by code
    const referrer = await query(
      'SELECT id FROM users WHERE referral_code = ?',
      [referralCode.toUpperCase()]
    );

    if (referrer.length === 0) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    const referrerId = referrer[0].id;

    // Can't refer yourself
    if (referrerId === parseInt(userId)) {
      return res.status(400).json({ error: 'You cannot use your own referral code' });
    }

    // Check if this user was already referred
    const existingReferral = await query(
      'SELECT id FROM users WHERE id = ? AND referred_by IS NOT NULL',
      [userId]
    );

    if (existingReferral.length > 0) {
      return res.status(400).json({ error: 'You have already been referred by someone' });
    }

    const creditAmount = settings[0].credit_per_referral;

    // Start transaction: update user, create referral record, award credits
    await run(
      'UPDATE users SET referred_by = ? WHERE id = ?',
      [referrerId, userId]
    );

    await run(
      'INSERT INTO referrals (referrer_id, referred_user_id, credit_awarded) VALUES (?, ?, ?)',
      [referrerId, userId, creditAmount]
    );

    // Award credits to referrer
    await run(
      'UPDATE users SET credits = credits + ?, referral_credit_earned = referral_credit_earned + ? WHERE id = ?',
      [creditAmount, creditAmount, referrerId]
    );

    res.json({ 
      message: 'Referral applied successfully',
      creditsAwarded: creditAmount
    });
  } catch (error) {
    console.error('Apply referral error:', error);
    res.status(500).json({ error: 'Failed to apply referral code' });
  }
});

module.exports = router;
