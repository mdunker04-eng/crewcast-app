// ═══════════════════════════════════════════════════════
// CrewCast — Pay Roles Routes (Restaurant)
// Manage tipped/non-tipped roles with base rates
// ═══════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ── GET / — List all pay roles for this business ──
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM pay_roles WHERE business_id = $1 ORDER BY sort_order, name',
      [req.user.businessId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Pay roles list error:', err);
    res.status(500).json({ error: 'Failed to list pay roles' });
  }
});

// ── POST / — Create a pay role ──
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, baseRate, isTipped, overtimeEligible } = req.body;
    if (!name || baseRate === undefined) {
      return res.status(400).json({ error: 'Name and base rate required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO pay_roles (business_id, name, base_rate, is_tipped, overtime_eligible)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.businessId, name, parseFloat(baseRate), isTipped !== false, overtimeEligible !== false]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Role name already exists' });
    console.error('Pay role create error:', err);
    res.status(500).json({ error: 'Failed to create pay role' });
  }
});

// ── PUT /:id — Update a pay role ──
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, baseRate, isTipped, overtimeEligible, active } = req.body;
    const id = parseInt(req.params.id);
    const { rows: existing } = await pool.query(
      'SELECT id FROM pay_roles WHERE id = $1 AND business_id = $2', [id, req.user.businessId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Role not found' });

    const updates = [];
    const vals = [];
    let idx = 1;
    if (name !== undefined) { updates.push(`name = $${idx++}`); vals.push(name); }
    if (baseRate !== undefined) { updates.push(`base_rate = $${idx++}`); vals.push(parseFloat(baseRate)); }
    if (isTipped !== undefined) { updates.push(`is_tipped = $${idx++}`); vals.push(isTipped); }
    if (overtimeEligible !== undefined) { updates.push(`overtime_eligible = $${idx++}`); vals.push(overtimeEligible); }
    if (active !== undefined) { updates.push(`active = $${idx++}`); vals.push(active); }

    if (updates.length === 0) return res.json({ success: true });
    vals.push(id);
    await pool.query(`UPDATE pay_roles SET ${updates.join(', ')} WHERE id = $${idx}`, vals);
    res.json({ success: true });
  } catch (err) {
    console.error('Pay role update error:', err);
    res.status(500).json({ error: 'Failed to update pay role' });
  }
});

// ── DELETE /:id — Delete a pay role ──
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await pool.query('DELETE FROM pay_roles WHERE id = $1 AND business_id = $2', [id, req.user.businessId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Pay role delete error:', err);
    res.status(500).json({ error: 'Failed to delete pay role' });
  }
});

module.exports = router;
