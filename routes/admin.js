const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query, get, run } = require('../db/connection');
const { generateAdminToken, authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/admin/login - admin authentication
router.post('/login', 
  [
    body('username').notEmpty().trim(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      // Get admin user
      const admin = await get('SELECT * FROM admin_users WHERE username = ?', [username]);
      if (!admin) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, admin.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      await run('UPDATE admin_users SET last_login = datetime("now") WHERE id = ?', [admin.id]);

      // Generate token
      const token = generateAdminToken(admin.id);

      // Log activity
      await run(
        'INSERT INTO admin_activity_log (admin_id, action, details, created_at) VALUES (?, ?, ?, datetime("now"))',
        [admin.id, 'login', 'Admin login']
      );

      res.json({
        message: 'Login successful',
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email
        }
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// GET /api/admin/users - list all users with pagination
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      tier, 
      role 
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let sql = `
      SELECT 
        id, name, email, role, tier, credits, 
        phone, business_name, service_postcode,
        created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    const params = [];
    
    if (search) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR business_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (tier) {
      sql += ' AND tier = ?';
      params.push(tier);
    }
    
    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }
    
    // Get total count
    const countSql = sql.replace('SELECT id, name, email, role, tier, credits, phone, business_name, service_postcode, created_at, updated_at', 'SELECT COUNT(*) as count');
    const countResult = await get(countSql, params);
    const total = countResult.count;
    
    // Get paginated results
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const users = await query(sql, params);
    
    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// POST /api/admin/users - create new user (including god-tier)
router.post('/users',
  authenticateAdmin,
  [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['poster', 'tasker', 'both']),
    body('tier').isIn(['free', 'bronze', 'silver', 'gold', 'platinum', 'god']),
    body('credits').isInt({ min: 0 }).optional()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password, role, tier, credits = 0 } = req.body;

      // Check if user already exists
      const existingUser = await get('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const result = await run(
        `INSERT INTO users (name, email, password_hash, role, tier, credits, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [name, email, passwordHash, role, tier, credits]
      );

      // Get created user
      const user = await get('SELECT id, name, email, role, tier, credits, created_at FROM users WHERE id = ?', [result.lastID]);

      // Log activity
      await run(
        'INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
        [req.admin.id, 'create_user', 'user', user.id, `Created ${tier} user: ${email}`]
      );

      res.status(201).json({
        message: 'User created successfully',
        user
      });
    } catch (error) {
      console.error('Admin create user error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

// PUT /api/admin/users/:id - update user tier/credits
router.put('/users/:id',
  authenticateAdmin,
  [
    body('tier').isIn(['free', 'bronze', 'silver', 'gold', 'platinum', 'god']).optional(),
    body('credits').isInt({ min: 0 }).optional(),
    body('name').trim().notEmpty().optional(),
    body('role').isIn(['poster', 'tasker', 'both']).optional()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.params.id;
      const updates = {};
      const allowedFields = ['tier', 'credits', 'name', 'role'];
      
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // Get current user
      const currentUser = await get('SELECT * FROM users WHERE id = ?', [userId]);
      if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Build update query
      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updates), userId];

      await run(
        `UPDATE users SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
        values
      );

      // Get updated user
      const user = await get('SELECT id, name, email, role, tier, credits, updated_at FROM users WHERE id = ?', [userId]);

      // Log activity
      const changes = Object.entries(updates).map(([key, value]) => `${key}: ${currentUser[key]} → ${value}`).join(', ');
      await run(
        'INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
        [req.admin.id, 'update_user', 'user', userId, `Updated user: ${changes}`]
      );

      res.json({
        message: 'User updated successfully',
        user
      });
    } catch (error) {
      console.error('Admin update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// DELETE /api/admin/users/:id - delete user
router.delete('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Get user for logging
    const user = await get('SELECT name, email FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user (this should cascade to related tables)
    const result = await run('DELETE FROM users WHERE id = ?', [userId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log activity
    await run(
      'INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      [req.admin.id, 'delete_user', 'user', userId, `Deleted user: ${user.name} (${user.email})`]
    );

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// POST /api/admin/promo-codes - create promo code
router.post('/promo-codes',
  authenticateAdmin,
  [
    body('code').notEmpty().trim().toUpperCase(),
    body('discount_percent').isFloat({ min: 0, max: 100 }),
    body('expires_at').optional().isISO8601(),
    body('usage_limit').optional().isInt({ min: 1 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { code, discount_percent, expires_at, usage_limit } = req.body;

      // Check if code already exists
      const existingCode = await get('SELECT id FROM promo_codes WHERE code = ?', [code]);
      if (existingCode) {
        return res.status(409).json({ error: 'Promo code already exists' });
      }

      // Create promo code
      const result = await run(
        `INSERT INTO promo_codes (code, discount_percent, expires_at, usage_limit, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [code, discount_percent, expires_at || null, usage_limit || null]
      );

      // Get created promo code
      const promoCode = await get('SELECT * FROM promo_codes WHERE id = ?', [result.lastID]);

      // Log activity
      await run(
        'INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
        [req.admin.id, 'create_promo_code', 'promo_code', promoCode.id, `Created promo code: ${code} (${discount_percent}%)`]
      );

      res.status(201).json({
        message: 'Promo code created successfully',
        promoCode
      });
    } catch (error) {
      console.error('Admin create promo code error:', error);
      res.status(500).json({ error: 'Failed to create promo code' });
    }
  }
);

// GET /api/admin/promo-codes - list promo codes
router.get('/promo-codes', authenticateAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      active_only = false
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT 
        pc.*,
        COUNT(pu.id) as times_used
      FROM promo_codes pc
      LEFT JOIN promo_usage pu ON pc.id = pu.promo_code_id
    `;
    const params = [];

    if (active_only === 'true') {
      sql += ' WHERE pc.is_active = 1 AND (pc.expires_at IS NULL OR pc.expires_at > datetime("now"))';
    }

    sql += ' GROUP BY pc.id ORDER BY pc.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const promoCodes = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as count FROM promo_codes';
    if (active_only === 'true') {
      countSql += ' WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > datetime("now"))';
    }
    const countResult = await get(countSql);
    const total = countResult.count;

    res.json({
      promoCodes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin get promo codes error:', error);
    res.status(500).json({ error: 'Failed to get promo codes' });
  }
});

// GET /api/admin/stats - dashboard statistics
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = {};
    
    // User counts
    const userStats = await query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN tier = 'god' THEN 1 END) as god_users,
        COUNT(CASE WHEN tier = 'bronze' THEN 1 END) as bronze_users,
        COUNT(CASE WHEN tier = 'silver' THEN 1 END) as silver_users,
        COUNT(CASE WHEN tier = 'gold' THEN 1 END) as gold_users,
        COUNT(CASE WHEN tier = 'platinum' THEN 1 END) as platinum_users,
        COUNT(CASE WHEN tier = 'free' THEN 1 END) as free_users,
        COUNT(CASE WHEN role IN ('tasker', 'both') THEN 1 END) as taskers,
        COUNT(CASE WHEN role = 'poster' THEN 1 END) as posters
      FROM users
    `);
    stats.users = userStats[0];
    
    // Promo code stats
    const promoStats = await query(`
      SELECT 
        COUNT(*) as total_codes,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_codes,
        SUM(usage_count) as total_usage
      FROM promo_codes
    `);
    stats.promoCodes = promoStats[0];
    
    // Recent activity
    const recentActivity = await query(`
      SELECT 
        aal.action,
        aal.details,
        aal.created_at,
        au.username as admin_username
      FROM admin_activity_log aal
      JOIN admin_users au ON aal.admin_id = au.id
      ORDER BY aal.created_at DESC
      LIMIT 10
    `);
    stats.recentActivity = recentActivity;
    
    res.json(stats);
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============================================
// TIER MANAGEMENT ENDPOINTS
// ============================================

// GET /api/admin/tiers - Get all tiers with site-wide discount
router.get('/tiers', authenticateAdmin, async (req, res) => {
  try {
    const tiers = await query(`
      SELECT * FROM subscription_tiers
      ORDER BY 
        CASE tier_name
          WHEN 'free' THEN 1
          WHEN 'bronze' THEN 2
          WHEN 'silver' THEN 3
          WHEN 'gold' THEN 4
          WHEN 'platinum' THEN 5
          WHEN 'god' THEN 6
        END
    `);

    const siteWideDiscount = await get(
      'SELECT * FROM site_wide_discount ORDER BY id DESC LIMIT 1',
      []
    );

    res.json({
      tiers,
      siteWideDiscount: siteWideDiscount || { percent: 0, dollar: 0, enabled: false }
    });
  } catch (error) {
    console.error('Get tiers error:', error);
    res.status(500).json({ error: 'Failed to get tiers' });
  }
});

// GET /api/admin/tiers/:tier - Get single tier configuration
router.get('/tiers/:tier', authenticateAdmin, async (req, res) => {
  try {
    const { tier } = req.params;
    
    const tierConfig = await get(
      'SELECT * FROM subscription_tiers WHERE tier_name = ?',
      [tier]
    );

    if (!tierConfig) {
      return res.status(404).json({ error: 'Tier not found' });
    }

    res.json(tierConfig);
  } catch (error) {
    console.error('Get tier error:', error);
    res.status(500).json({ error: 'Failed to get tier' });
  }
});

// PUT /api/admin/tiers/:tier - Update tier configuration
router.put('/tiers/:tier',
  authenticateAdmin,
  [
    body('subscription_cost_excl_tax').isFloat({ min: 0 }).optional(),
    body('tier_discount_enabled').isBoolean().optional(),
    body('tier_discount_percent').isFloat({ min: 0, max: 100 }).optional(),
    body('tier_discount_dollar').isFloat({ min: 0 }).optional(),
    body('tier_discount_expiry').optional(),
    body('base_credits').isInt({ min: 0 }).optional(),
    body('base_credits_multiplier').isInt({ min: 1 }).optional(),
    body('bonus_credits').isInt({ min: 0 }).optional(),
    body('bonus_credits_multiplier').isInt({ min: 1 }).optional(),
    body('additional_bonus_credits').isInt({ min: 0 }).optional(),
    body('additional_bonus_credits_multiplier').isInt({ min: 1 }).optional(),
    body('job_view_delay_minutes').isInt({ min: 0, max: 1440 }).optional()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { tier } = req.params;

      // Check tier exists
      const existing = await get(
        'SELECT id FROM subscription_tiers WHERE tier_name = ?',
        [tier]
      );

      if (!existing) {
        return res.status(404).json({ error: 'Tier not found' });
      }

      // Build update query dynamically
      const allowedFields = [
        'subscription_cost_excl_tax',
        'tier_discount_enabled',
        'tier_discount_percent',
        'tier_discount_dollar',
        'tier_discount_expiry',
        'base_credits',
        'base_credits_multiplier',
        'bonus_credits',
        'bonus_credits_multiplier',
        'additional_bonus_credits',
        'additional_bonus_credits_multiplier',
        'job_view_delay_minutes'
      ];

      const updates = [];
      const values = [];

      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(req.body[field]);
        }
      });

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      // Add updated_at
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(tier);

      await query(
        `UPDATE subscription_tiers SET ${updates.join(', ')} WHERE tier_name = ?`,
        values
      );

      // Log activity
      await query(
        'INSERT INTO admin_activity_log (admin_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
        [req.admin.id, 'update_tier', 'tier', existing.id, `Updated ${tier} tier configuration`]
      );

      // Get updated tier
      const updated = await get(
        'SELECT * FROM subscription_tiers WHERE tier_name = ?',
        [tier]
      );

      res.json(updated);
    } catch (error) {
      console.error('Update tier error:', error);
      res.status(500).json({ error: 'Failed to update tier' });
    }
  }
);

// GET /api/admin/tiers/preview-price/:tier - Preview tier pricing with discounts
router.get('/tiers/preview-price/:tier', authenticateAdmin, async (req, res) => {
  try {
    const { tier } = req.params;

    const tierConfig = await get(
      'SELECT * FROM subscription_tiers WHERE tier_name = ?',
      [tier]
    );

    if (!tierConfig) {
      return res.status(404).json({ error: 'Tier not found' });
    }

    const siteWideDiscount = await get(
      'SELECT * FROM site_wide_discount WHERE enabled = 1 ORDER BY id DESC LIMIT 1',
      []
    );

    let finalPrice = parseFloat(tierConfig.subscription_cost_excl_tax);
    const breakdown = {
      baseCost: finalPrice,
      tierDiscount: 0,
      siteWideDiscount: 0,
      finalPrice: 0
    };

    // Apply tier discount if enabled and not expired
    if (tierConfig.tier_discount_enabled) {
      const now = new Date();
      const expiry = tierConfig.tier_discount_expiry ? new Date(tierConfig.tier_discount_expiry) : null;
      
      if (!expiry || expiry > now) {
        if (tierConfig.tier_discount_percent > 0) {
          breakdown.tierDiscount = finalPrice * (tierConfig.tier_discount_percent / 100);
          finalPrice -= breakdown.tierDiscount;
        } else if (tierConfig.tier_discount_dollar > 0) {
          breakdown.tierDiscount = Math.min(tierConfig.tier_discount_dollar, finalPrice);
          finalPrice -= breakdown.tierDiscount;
        }
      }
    }

    // Apply site-wide discount if enabled
    if (siteWideDiscount && siteWideDiscount.enabled) {
      const expiry = siteWideDiscount.expiry ? new Date(siteWideDiscount.expiry) : null;
      const now = new Date();
      
      if (!expiry || expiry > now) {
        if (siteWideDiscount.percent > 0) {
          breakdown.siteWideDiscount = finalPrice * (siteWideDiscount.percent / 100);
          finalPrice -= breakdown.siteWideDiscount;
        } else if (siteWideDiscount.dollar > 0) {
          breakdown.siteWideDiscount = Math.min(siteWideDiscount.dollar, finalPrice);
          finalPrice -= breakdown.siteWideDiscount;
        }
      }
    }

    breakdown.finalPrice = Math.max(0, finalPrice);

    res.json(breakdown);
  } catch (error) {
    console.error('Preview price error:', error);
    res.status(500).json({ error: 'Failed to preview price' });
  }
});

module.exports = router;