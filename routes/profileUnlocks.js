const express = require('express');
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// POST /api/profile-unlocks/purchase - Purchase profile unlock
router.post('/purchase', async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { profileId } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    // Check if buyer has enough credits
    const buyer = await query('SELECT credits FROM users WHERE id = $1', [buyerId]).then(r => r[0]);
    
    if (!buyer) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get profile unlock cost from settings
    const setting = await query("SELECT value FROM settings WHERE key = 'profile_unlock_cost'");
    const unlockCost = setting ? parseInt(setting.value) : 50; // Default 50 credits

    if (buyer.credits < unlockCost) {
      return res.status(400).json({ 
        error: 'Insufficient credits',
        required: unlockCost,
        available: buyer.credits
      });
    }

    // Check if already unlocked
    const existing = await query('SELECT * FROM profile_unlocks WHERE buyer_id = $1 AND profile_id = $2', [buyerId, profileId]).then(r => r[0]);

    if (existing) {
      return res.status(400).json({ error: 'Profile already unlocked' });
    }

    // Check if profile exists
    const profile = await query('SELECT id, name, email, phone FROM users WHERE id = $1', [profileId]).then(r => r[0]);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Deduct credits
    await query('UPDATE users SET credits = credits - $1 WHERE id = $2 RETURNING *', [unlockCost, buyerId]);

    // Record unlock
    await query('INSERT INTO profile_unlocks (buyer_id, profile_id, cost) VALUES ($1, $2, $3)', [buyerId, profileId, unlockCost]);

    // Record transaction
    await query(`INSERT INTO transactions (user_id, type, amount, description, balance_after) 
       VALUES ($1, $2, $3, $4, $5)`, [
        buyerId,
        'profile_unlock',
        -unlockCost,
        `Unlocked profile: ${profile.name}`,
        buyer.credits - unlockCost
      ]);

    res.json({
      success: true,
      message: 'Profile unlocked successfully',
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone
      },
      creditsRemaining: buyer.credits - unlockCost
    });

  } catch (error) {
    console.error('Profile unlock purchase error:', error);
    res.status(500).json({ error: 'Failed to purchase profile unlock' });
  }
});

// GET /api/profile-unlocks/active - Get all unlocked profiles for current user
router.get('/active', async (req, res) => {
  try {
    const unlocks = await query(
      `SELECT 
        pu.*,
        u.name,
        u.email,
        u.phone,
        u.profile_picture
      FROM profile_unlocks pu
      JOIN users u ON pu.profile_id = u.id
      WHERE pu.buyer_id = $1
      ORDER BY pu.created_at DESC`,
      [req.user.id]
    );

    res.json(unlocks);
  } catch (error) {
    console.error('Get active unlocks error:', error);
    res.status(500).json({ error: 'Failed to retrieve unlocked profiles' });
  }
});

// GET /api/profile-unlocks/status/:profileId - Check if profile is unlocked
router.get('/status/:profileId', async (req, res) => {
  try {
    const unlock = await query('SELECT * FROM profile_unlocks WHERE buyer_id = $1 AND profile_id = $2', [req.user.id, req.params.profileId]).then(r => r[0]);

    res.json({ 
      unlocked: !!unlock,
      unlockedAt: unlock?.created_at || null
    });
  } catch (error) {
    console.error('Check unlock status error:', error);
    res.status(500).json({ error: 'Failed to check unlock status' });
  }
});

module.exports = router;
