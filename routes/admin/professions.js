const express = require('express');
const { query, run } = require('../../db/connection');
const { authenticateAdmin } = require('../../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// GET /api/admin/professions - List all professions
router.get('/', async (req, res) => {
  try {
    const professions = await query(
      'SELECT * FROM professions ORDER BY name'
    );

    res.json({ professions });
  } catch (error) {
    console.error('Get professions error:', error);
    res.status(500).json({ error: 'Failed to get professions' });
  }
});

// POST /api/admin/professions - Create new profession
router.post('/', async (req, res) => {
  try {
    const { name, category, description } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    // Check if profession already exists
    const existing = await query(
      'SELECT id FROM professions WHERE LOWER(name) = LOWER(?)',
      [name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Profession already exists' });
    }

    const result = await run(
      'INSERT INTO professions (name, category, description) VALUES (?, ?, ?) RETURNING id',
      [name, category, description || null]
    );

    const profession = await query(
      'SELECT * FROM professions WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({ 
      message: 'Profession created successfully',
      profession: profession[0]
    });
  } catch (error) {
    console.error('Create profession error:', error);
    res.status(500).json({ error: 'Failed to create profession' });
  }
});

// PUT /api/admin/professions/:id - Update profession
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    // Check if profession exists
    const existing = await query(
      'SELECT id FROM professions WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Profession not found' });
    }

    await run(
      'UPDATE professions SET name = ?, category = ?, description = ? WHERE id = ?',
      [name, category, description || null, id]
    );

    const profession = await query(
      'SELECT * FROM professions WHERE id = ?',
      [id]
    );

    res.json({ 
      message: 'Profession updated successfully',
      profession: profession[0]
    });
  } catch (error) {
    console.error('Update profession error:', error);
    res.status(500).json({ error: 'Failed to update profession' });
  }
});

// DELETE /api/admin/professions/:id - Delete profession
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if profession exists
    const existing = await query(
      'SELECT id FROM professions WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Profession not found' });
    }

    // Check if profession is used in any jobs
    const jobsUsingProfession = await query(
      'SELECT COUNT(*) as count FROM jobs WHERE profession_id = ?',
      [id]
    );

    if (jobsUsingProfession[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete profession that is used in jobs',
        jobCount: jobsUsingProfession[0].count
      });
    }

    await run('DELETE FROM professions WHERE id = ?', [id]);

    res.json({ message: 'Profession deleted successfully' });
  } catch (error) {
    console.error('Delete profession error:', error);
    res.status(500).json({ error: 'Failed to delete profession' });
  }
});

module.exports = router;
