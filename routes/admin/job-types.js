const express = require('express');
const { query, run } = require('../../db/connection');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/job-types - List all job types
router.get('/', async (req, res) => {
  try {
    const jobTypes = await query(
      'SELECT * FROM job_types ORDER BY name'
    );

    res.json({ jobTypes });
  } catch (error) {
    console.error('Get job types error:', error);
    res.status(500).json({ error: 'Failed to get job types' });
  }
});

// POST /api/admin/job-types - Create new job type
router.post('/', async (req, res) => {
  try {
    const { name, category, description } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    // Check if job type already exists
    const existing = await query('SELECT id FROM job_types WHERE LOWER(name) = LOWER($1)',
      [name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Job type already exists' });
    }

    const result = await query('INSERT INTO job_types (name, category, description) VALUES ($1, $2, $3) RETURNING id', [name, category, description || null]);

    const jobType = await query('SELECT * FROM job_types WHERE id = $1',
      [result.lastID]
    );

    res.status(201).json({ 
      message: 'Job type created successfully',
      jobType: jobType[0]
    });
  } catch (error) {
    console.error('Create job type error:', error);
    res.status(500).json({ error: 'Failed to create job type' });
  }
});

// PUT /api/admin/job-types/:id - Update job type
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    // Check if job type exists
    const existing = await query('SELECT id FROM job_types WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Job type not found' })[0];
    }

    await query('UPDATE job_types SET name = $1, category = $2, description = $3 WHERE id = $4', [name, category, description || null, id]);

    const jobType = await query('SELECT * FROM job_types WHERE id = $1',
      [id]
    );

    res.json({ 
      message: 'Job type updated successfully',
      jobType: jobType[0]
    });
  } catch (error) {
    console.error('Update job type error:', error);
    res.status(500).json({ error: 'Failed to update job type' });
  }
});

// DELETE /api/admin/job-types/:id - Delete job type
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if job type exists
    const existing = await query('SELECT id FROM job_types WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Job type not found' });
    }

    // Check if job type is used in any jobs
    const jobsUsingType = await query('SELECT COUNT(*) as count FROM jobs WHERE job_type_id = $1',
      [id]
    );

    if (jobsUsingType[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete job type that is used in jobs',
        jobCount: jobsUsingType[0].count
      });
    }

    await query('DELETE FROM job_types WHERE id = $1', [id]);

    res.json({ message: 'Job type deleted successfully' });
  } catch (error) {
    console.error('Delete job type error:', error);
    res.status(500).json({ error: 'Failed to delete job type' });
  }
});

module.exports = router;
