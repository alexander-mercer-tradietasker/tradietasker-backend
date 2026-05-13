const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Apply authentication to all routes
router.use(authenticateToken);

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  }
});

// Middleware to verify tradie role
const verifyTradie = (req, res, next) => {
  if (!req.user || (req.user.role !== 'tasker' && req.user.role !== 'both')) {
    return res.status(403).json({ error: 'Access denied. Tradie role required.' });
  }
  next();
};

// ============================================
// GET /api/tradie-dashboard/jobs/my-jobs
// Get all jobs the tradie has unlocked or been assigned to
// ============================================
router.get('/jobs/my-jobs', verifyTradie, async (req, res) => {
  try {
    const tradieId = req.user.id;
    const { status, minBudget, maxBudget, location, datePosted } = req.query;

    let sql = `
      SELECT DISTINCT 
        j.id, 
        j.title, 
        j.description,
        j.budget_min,
        j.budget_max,
        j.location,
        j.suburb,
        j.postcode,
        j.status,
        j.created_at,
        u.name as customer_name,
        u.phone as customer_phone,
        u.email as customer_email
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN profile_unlocks pu ON pu.job_id = j.id AND pu.unlocked_by_user_id = ?
      WHERE (pu.id IS NOT NULL OR j.assigned_to_user_id = ?)
    `;

    const params = [tradieId, tradieId];

    // Apply filters
    if (status && status !== 'All') {
      sql += ` AND j.status = ?`;
      params.push(status);
    }

    if (minBudget) {
      sql += ` AND j.budget_max >= ?`;
      params.push(parseInt(minBudget));
    }

    if (maxBudget) {
      sql += ` AND j.budget_min <= ?`;
      params.push(parseInt(maxBudget));
    }

    if (location) {
      sql += ` AND (j.suburb LIKE ? OR j.postcode LIKE ?)`;
      const locationPattern = `%${location}%`;
      params.push(locationPattern, locationPattern);
    }

    if (datePosted) {
      const date = new Date(datePosted);
      sql += ` AND DATE(j.created_at) >= DATE(?)`;
      params.push(date.toISOString().split('T')[0]);
    }

    sql += ` ORDER BY j.created_at DESC`;

    const jobs = await query(sql, params);

    res.json({ jobs });
  } catch (error) {
    console.error('Error fetching tradie jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// ============================================
// GET /api/tradie-dashboard/customers/my-customers
// Get all customers the tradie has unlocked
// ============================================
router.get('/customers/my-customers', verifyTradie, async (req, res) => {
  try {
    const tradieId = req.user.id;

    const sql = `
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.phone,
        j.title as job_title,
        j.id as job_id,
        pu.unlocked_at
      FROM profile_unlocks pu
      JOIN users u ON pu.unlocked_user_id = u.id
      LEFT JOIN jobs j ON pu.job_id = j.id
      WHERE pu.unlocked_by_user_id = ?
      ORDER BY pu.unlocked_at DESC
    `;

    const customers = await query(sql, [tradieId]);

    res.json({ customers });
  } catch (error) {
    console.error('Error fetching tradie customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// ============================================
// GET /api/tradie-dashboard/users/me/profile
// Get tradie profile
// ============================================
router.get('/users/me/profile', verifyTradie, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user details
    const userResult = await query(
      `SELECT 
        id, name, email, phone, 
        business_name, business_logo, profile_photo,
        abn, business_address, business_phone, business_email,
        service_radius_km, service_postcode,
        notification_prefs,
        created_at
      FROM users 
      WHERE id = ?`,
      [userId]
    );

    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult[0];

    // Get professions
    const professions = await query(
      `SELECT p.id, p.name, up.licence_number, up.state
       FROM user_professions up
       JOIN professions p ON up.profession_id = p.id
       WHERE up.user_id = ?`,
      [userId]
    );

    // Get service areas (job types)
    const serviceAreas = await query(
      `SELECT jt.id, jt.name, jt.category
       FROM user_job_types ujt
       JOIN job_types jt ON ujt.job_type_id = jt.id
       WHERE ujt.user_id = ?`,
      [userId]
    );

    // Get qualifications
    const qualifications = await query(
      `SELECT id, type, name, issuer, year_obtained, expiry_date, created_at
       FROM user_qualifications
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    // Parse notification_prefs if it's a string
    if (user.notification_prefs && typeof user.notification_prefs === 'string') {
      try {
        user.notification_prefs = JSON.parse(user.notification_prefs);
      } catch (e) {
        user.notification_prefs = { email: true, sms: false };
      }
    }

    res.json({
      user,
      professions,
      serviceAreas,
      qualifications
    });
  } catch (error) {
    console.error('Error fetching tradie profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ============================================
// PUT /api/tradie-dashboard/users/me/profile
// Update tradie profile
// ============================================
router.put('/users/me/profile', verifyTradie, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      email,
      phone,
      business_name,
      abn,
      business_address,
      business_phone,
      business_email,
      service_radius_km,
      service_postcode,
      notification_prefs
    } = req.body;

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (business_name !== undefined) { updates.push('business_name = ?'); params.push(business_name); }
    if (abn !== undefined) { updates.push('abn = ?'); params.push(abn); }
    if (business_address !== undefined) { updates.push('business_address = ?'); params.push(business_address); }
    if (business_phone !== undefined) { updates.push('business_phone = ?'); params.push(business_phone); }
    if (business_email !== undefined) { updates.push('business_email = ?'); params.push(business_email); }
    if (service_radius_km !== undefined) { updates.push('service_radius_km = ?'); params.push(service_radius_km); }
    if (service_postcode !== undefined) { updates.push('service_postcode = ?'); params.push(service_postcode); }
    if (notification_prefs !== undefined) {
      updates.push('notification_prefs = ?');
      params.push(JSON.stringify(notification_prefs));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(userId);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await query(sql, params);

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating tradie profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============================================
// POST /api/tradie-dashboard/users/me/password
// Change password
// ============================================
router.post('/users/me/password', verifyTradie, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get current password hash
    const userResult = await query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    
    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, userResult[0].password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ============================================
// POST /api/tradie-dashboard/users/me/photo
// Upload profile photo
// ============================================
router.post('/users/me/photo', verifyTradie, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'profiles');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const filename = `profile-${userId}-${Date.now()}.jpg`;
    const filepath = path.join(uploadsDir, filename);

    // Resize and compress image
    await sharp(req.file.buffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(filepath);

    // Update database
    const photoUrl = `/uploads/profiles/${filename}`;
    await query('UPDATE users SET profile_photo = ? WHERE id = ?', [photoUrl, userId]);

    res.json({ 
      message: 'Profile photo uploaded successfully',
      photoUrl 
    });
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// ============================================
// POST /api/tradie-dashboard/users/me/logo
// Upload business logo
// ============================================
router.post('/users/me/logo', verifyTradie, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'logos');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const filename = `logo-${userId}-${Date.now()}.jpg`;
    const filepath = path.join(uploadsDir, filename);

    // Resize and compress image
    await sharp(req.file.buffer)
      .resize(300, 300, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .jpeg({ quality: 80 })
      .toFile(filepath);

    // Update database
    const logoUrl = `/uploads/logos/${filename}`;
    await query('UPDATE users SET business_logo = ? WHERE id = ?', [logoUrl, userId]);

    res.json({ 
      message: 'Business logo uploaded successfully',
      logoUrl 
    });
  } catch (error) {
    console.error('Error uploading business logo:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// ============================================
// POST /api/tradie-dashboard/users/me/qualifications
// Add qualification
// ============================================
router.post('/users/me/qualifications', verifyTradie, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, name, issuer, year_obtained, expiry_date } = req.body;

    if (!type || !name) {
      return res.status(400).json({ error: 'Type and name are required' });
    }

    const sql = `
      INSERT INTO user_qualifications 
      (user_id, type, name, issuer, year_obtained, expiry_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    const result = await query(sql, [
      userId, 
      type, 
      name, 
      issuer || null,
      year_obtained || null,
      expiry_date || null
    ]);

    res.json({ 
      message: 'Qualification added successfully',
      id: result.lastID || result.insertId
    });
  } catch (error) {
    console.error('Error adding qualification:', error);
    res.status(500).json({ error: 'Failed to add qualification' });
  }
});

// ============================================
// DELETE /api/tradie-dashboard/users/me/qualifications/:id
// Remove qualification
// ============================================
router.delete('/users/me/qualifications/:id', verifyTradie, async (req, res) => {
  try {
    const userId = req.user.id;
    const qualificationId = req.params.id;

    const result = await query(
      'DELETE FROM user_qualifications WHERE id = ? AND user_id = ?',
      [qualificationId, userId]
    );

    if (result.affectedRows === 0 && result.changes === 0) {
      return res.status(404).json({ error: 'Qualification not found' });
    }

    res.json({ message: 'Qualification removed successfully' });
  } catch (error) {
    console.error('Error removing qualification:', error);
    res.status(500).json({ error: 'Failed to remove qualification' });
  }
});

// ============================================
// GET /api/tradie-dashboard/profile-status
// Check if tradie profile is completed
// ============================================
router.get('/profile-status', verifyTradie, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await query(
      'SELECT profile_completed FROM users WHERE id = ?',
      [userId]
    );
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      profile_completed: user[0].profile_completed || false 
    });
  } catch (error) {
    console.error('Error checking profile status:', error);
    res.status(500).json({ error: 'Failed to check profile status' });
  }
});

// ============================================
// POST /api/tradie-dashboard/complete-profile
// Complete tradie profile after initial registration
// ============================================
router.post('/complete-profile', verifyTradie, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      // Personal details (if not already provided)
      date_of_birth,
      residential_address,
      residential_suburb,
      residential_state,
      residential_postcode,
      
      // Business info
      abn,
      business_name,
      business_address,
      business_phone,
      business_email,
      
      // Service area
      service_postcode,
      service_radius_km,
      
      // Professions and job types (arrays of IDs)
      selected_professions,
      selected_job_types,
      
      // Qualifications (text field or array)
      qualifications,
      
      // Subscription tier
      tier,
    } = req.body;

    // Start transaction
    await query('BEGIN TRANSACTION');

    try {
      // Update user basic info
      const updateFields = [];
      const updateParams = [];
      
      if (date_of_birth) {
        updateFields.push('date_of_birth = ?');
        updateParams.push(date_of_birth);
      }
      if (residential_address) {
        updateFields.push('residential_address = ?');
        updateParams.push(residential_address);
      }
      if (residential_suburb) {
        updateFields.push('residential_suburb = ?');
        updateParams.push(residential_suburb);
      }
      if (residential_state) {
        updateFields.push('residential_state = ?');
        updateParams.push(residential_state);
      }
      if (residential_postcode) {
        updateFields.push('residential_postcode = ?');
        updateParams.push(residential_postcode);
      }
      if (abn) {
        updateFields.push('abn = ?');
        updateParams.push(abn);
      }
      if (business_name) {
        updateFields.push('business_name = ?');
        updateParams.push(business_name);
      }
      if (business_address) {
        updateFields.push('business_address = ?');
        updateParams.push(business_address);
      }
      if (business_phone) {
        updateFields.push('business_phone = ?');
        updateParams.push(business_phone);
      }
      if (business_email) {
        updateFields.push('business_email = ?');
        updateParams.push(business_email);
      }
      if (service_postcode) {
        updateFields.push('service_postcode = ?');
        updateParams.push(service_postcode);
      }
      if (service_radius_km) {
        updateFields.push('service_radius_km = ?');
        updateParams.push(service_radius_km);
      }
      if (tier) {
        updateFields.push('tier = ?');
        updateParams.push(tier);
      }
      
      // Always mark profile as completed
      updateFields.push('profile_completed = ?');
      updateParams.push(true);
      
      updateParams.push(userId);
      
      const updateSQL = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
      await query(updateSQL, updateParams);

      // Add professions
      if (selected_professions && Array.isArray(selected_professions)) {
        for (const professionId of selected_professions) {
          await query(
            `INSERT INTO user_professions (user_id, profession_id, state)
             VALUES (?, ?, 'NSW')
             ON CONFLICT (user_id, profession_id) DO NOTHING`,
            [userId, professionId]
          );
        }
      }

      // Add job types
      if (selected_job_types && Array.isArray(selected_job_types)) {
        for (const jobTypeId of selected_job_types) {
          await query(
            `INSERT INTO user_job_types (user_id, job_type_id)
             VALUES (?, ?)
             ON CONFLICT (user_id, job_type_id) DO NOTHING`,
            [userId, jobTypeId]
          );
        }
      }

      // Add qualifications if provided as text
      if (qualifications && typeof qualifications === 'string' && qualifications.trim()) {
        // Split by newlines and add each as a qualification
        const qualLines = qualifications.split('\n').filter(q => q.trim());
        for (const qual of qualLines) {
          await query(
            `INSERT INTO user_qualifications (user_id, type, name)
             VALUES (?, 'other', ?)`,
            [userId, qual.trim()]
          );
        }
      }

      // Commit transaction
      await query('COMMIT');

      // Get updated user
      const updatedUser = await query(
        'SELECT id, email, name, phone, role, tier, credits, profile_completed FROM users WHERE id = ?',
        [userId]
      );

      res.json({
        message: 'Profile completed successfully',
        user: updatedUser[0],
      });
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error completing profile:', error);
    res.status(500).json({ error: 'Failed to complete profile' });
  }
});

module.exports = router;
