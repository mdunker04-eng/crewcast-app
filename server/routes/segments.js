// ═══════════════════════════════════════════════════════
// CrewCast — Segments Routes (saved audience filters)
// ═══════════════════════════════════════════════════════

const express = require('express');
const { pool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { resolveFilter, resolveSegment } = require('../lib/segments');

const router = express.Router();
router.use(authenticate, requireAdmin);

// GET /api/segments
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, filter, created_at FROM segments
       WHERE business_id = $1 ORDER BY created_at DESC`,
      [req.user.businessId]
    );
    res.json({ segments: rows });
  } catch (err) {
    console.error('List segments error:', err);
    res.status(500).json({ error: 'Failed to load segments' });
  }
});

// POST /api/segments
router.post('/', async (req, res) => {
  try {
    const { name, filter } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { rows } = await pool.query(
      `INSERT INTO segments (business_id, name, filter) VALUES ($1, $2, $3)
       RETURNING id, name, filter`,
      [req.user.businessId, name, filter || {}]
    );
    res.json({ segment: rows[0] });
  } catch (err) {
    console.error('Create segment error:', err);
    res.status(500).json({ error: 'Failed to create segment' });
  }
});

// PUT /api/segments/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, filter } = req.body;
    const { rows } = await pool.query(
      `UPDATE segments SET name = COALESCE($1, name), filter = COALESCE($2, filter)
       WHERE id = $3 AND business_id = $4
       RETURNING id, name, filter`,
      [name, filter, req.params.id, req.user.businessId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ segment: rows[0] });
  } catch (err) {
    console.error('Update segment error:', err);
    res.status(500).json({ error: 'Failed to update segment' });
  }
});

// DELETE /api/segments/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM segments WHERE id = $1 AND business_id = $2`,
      [req.params.id, req.user.businessId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete segment error:', err);
    res.status(500).json({ error: 'Failed to delete segment' });
  }
});

// POST /api/segments/preview
// Given a filter, return matching employee IDs + count (no save).
router.post('/preview', async (req, res) => {
  try {
    const { filter } = req.body;
    const ids = await resolveFilter(filter || {}, req.user.businessId);
    res.json({ count: ids.length, employeeIds: ids });
  } catch (err) {
    console.error('Preview segment error:', err);
    res.status(500).json({ error: 'Failed to preview' });
  }
});

// GET /api/segments/:id/resolve — returns current members
router.get('/:id/resolve', async (req, res) => {
  try {
    const ids = await resolveSegment(req.params.id, req.user.businessId);
    res.json({ count: ids.length, employeeIds: ids });
  } catch (err) {
    console.error('Resolve segment error:', err);
    res.status(500).json({ error: 'Failed to resolve segment' });
  }
});

module.exports = router;
