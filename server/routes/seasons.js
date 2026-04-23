// ═══════════════════════════════════════════════════════
// CrewCast — Seasons Routes
// Multi-season support. Campaigns anchor to a season's start_date.
// ═══════════════════════════════════════════════════════

const express = require('express');
const { pool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require an authenticated admin.
router.use(authenticate, requireAdmin);

// ── GET /api/seasons ──
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, start_date, end_date, active, created_at
       FROM seasons WHERE business_id = $1
       ORDER BY start_date DESC NULLS LAST, id DESC`,
      [req.user.businessId]
    );
    res.json({ seasons: rows });
  } catch (err) {
    console.error('Get seasons error:', err);
    res.status(500).json({ error: 'Failed to load seasons' });
  }
});

// ── POST /api/seasons ──
router.post('/', async (req, res) => {
  try {
    const { name, startDate, endDate, active } = req.body;
    if (!name || !startDate) {
      return res.status(400).json({ error: 'Name and start date required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO seasons (business_id, name, start_date, end_date, active)
       VALUES ($1, $2, $3, $4, COALESCE($5, true))
       RETURNING id, name, start_date, end_date, active`,
      [req.user.businessId, name, startDate, endDate || null, active]
    );
    res.json({ season: rows[0] });
  } catch (err) {
    console.error('Create season error:', err);
    res.status(500).json({ error: 'Failed to create season' });
  }
});

// ── PUT /api/seasons/:id ──
router.put('/:id', async (req, res) => {
  try {
    const { name, startDate, endDate, active } = req.body;
    const { rows } = await pool.query(
      `UPDATE seasons
       SET name = COALESCE($1, name),
           start_date = COALESCE($2, start_date),
           end_date = $3,
           active = COALESCE($4, active)
       WHERE id = $5 AND business_id = $6
       RETURNING id, name, start_date, end_date, active`,
      [name, startDate, endDate ?? null, active, req.params.id, req.user.businessId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Season not found' });
    res.json({ season: rows[0] });
  } catch (err) {
    console.error('Update season error:', err);
    res.status(500).json({ error: 'Failed to update season' });
  }
});

// ── DELETE /api/seasons/:id ──
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM seasons WHERE id = $1 AND business_id = $2`,
      [req.params.id, req.user.businessId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Season not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete season error:', err);
    res.status(500).json({ error: 'Failed to delete season' });
  }
});

module.exports = router;
