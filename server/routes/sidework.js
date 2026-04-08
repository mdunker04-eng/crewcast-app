// ═══════════════════════════════════════════════════════
// CrewCast — Side Work / Closing Duties Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET all tasks for this business
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT st.*, s.name as station_name, pr.name as role_name
       FROM sidework_tasks st
       LEFT JOIN stations s ON s.id = st.station_id
       LEFT JOIN pay_roles pr ON pr.id = st.pay_role_id
       WHERE st.business_id = $1
       ORDER BY st.category, st.sort_order, st.name`,
      [req.user.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Sidework list error:', err);
    res.status(500).json({ error: 'Failed to load tasks' });
  }
});

// CREATE a task (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, category, stationId, payRoleId, sortOrder } = req.body;
  if (!name) return res.status(400).json({ error: 'Task name is required' });
  try {
    const result = await pool.query(
      `INSERT INTO sidework_tasks (business_id, name, category, station_id, pay_role_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.businessId, name, category || 'closing', stationId || null, payRoleId || null, sortOrder || 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Sidework create error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// BULK create tasks
router.post('/bulk', authenticate, requireAdmin, async (req, res) => {
  const { tasks } = req.body;
  if (!tasks || !tasks.length) return res.status(400).json({ error: 'No tasks provided' });
  try {
    let added = 0;
    for (const t of tasks) {
      await pool.query(
        `INSERT INTO sidework_tasks (business_id, name, category, station_id, pay_role_id, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.businessId, t.name, t.category || 'closing', t.stationId || null, t.payRoleId || null, t.sortOrder || added]
      );
      added++;
    }
    res.json({ added });
  } catch (err) {
    console.error('Sidework bulk error:', err);
    res.status(500).json({ error: 'Failed to bulk add tasks' });
  }
});

// UPDATE a task
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { name, category, stationId, payRoleId, sortOrder, active } = req.body;
  try {
    await pool.query(
      `UPDATE sidework_tasks SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        station_id = $3,
        pay_role_id = $4,
        sort_order = COALESCE($5, sort_order),
        active = COALESCE($6, active)
       WHERE id = $7 AND business_id = $8`,
      [name, category, stationId || null, payRoleId || null, sortOrder, active, req.params.id, req.user.businessId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Sidework update error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE a task
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM sidework_tasks WHERE id = $1 AND business_id = $2`,
      [req.params.id, req.user.businessId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Sidework delete error:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// COMPLETE a task (employee)
router.post('/:id/complete', authenticate, async (req, res) => {
  const { notes } = req.body;
  const shiftDate = new Date().toISOString().split('T')[0];
  try {
    await pool.query(
      `INSERT INTO sidework_completions (task_id, employee_id, shift_date, notes)
       VALUES ($1, $2, $3, $4)`,
      [req.params.id, req.user.id, shiftDate, notes || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Sidework complete error:', err);
    res.status(500).json({ error: 'Failed to mark task complete' });
  }
});

// GET completions for a date
router.get('/completions', authenticate, async (req, res) => {
  const { date } = req.query;
  const shiftDate = date || new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(
      `SELECT sc.*, e.first_name, e.last_name, st.name as task_name
       FROM sidework_completions sc
       JOIN employees e ON e.id = sc.employee_id
       JOIN sidework_tasks st ON st.id = sc.task_id
       WHERE st.business_id = $1 AND sc.shift_date = $2
       ORDER BY sc.completed_at DESC`,
      [req.user.businessId, shiftDate]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Sidework completions error:', err);
    res.status(500).json({ error: 'Failed to load completions' });
  }
});

module.exports = router;
