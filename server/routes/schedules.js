// ═══════════════════════════════════════════════════════
// CrewCast — Schedule & Shift Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pool } = require('../db');
const { notifyEmployee, notifyBusinessAdmins } = require('./push');

const router = express.Router();

// ══════════════════════════════════════
// SCHEDULES
// ══════════════════════════════════════

// ── GET /api/schedules ──
// List schedules for the business
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM shifts WHERE schedule_id = s.id) as total_shifts,
        (SELECT COUNT(*) FROM shifts WHERE schedule_id = s.id AND status = 'confirmed') as confirmed,
        (SELECT COUNT(*) FROM shifts WHERE schedule_id = s.id AND status = 'declined') as declined,
        (SELECT COUNT(*) FROM shifts WHERE schedule_id = s.id AND status = 'pending') as pending
      FROM schedules s
      WHERE s.business_id = $1
      ORDER BY s.start_date DESC
    `, [req.user.businessId]);

    res.json(rows);
  } catch (err) {
    console.error('List schedules error:', err);
    res.status(500).json({ error: 'Failed to list schedules' });
  }
});

// ── POST /api/schedules ──
// Create a new schedule (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, startDate, endDate, notes } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Name, start date, and end date required' });
    }

    const { rows } = await pool.query(`
      INSERT INTO schedules (business_id, name, start_date, end_date, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [req.user.businessId, name, startDate, endDate, notes || null]);

    res.json({ id: rows[0].id, name, startDate, endDate, status: 'draft' });
  } catch (err) {
    console.error('Create schedule error:', err);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// ── PUT /api/schedules/:id ──
// Update schedule (status, name, etc)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, status, notes } = req.body;
    const { rows } = await pool.query(
      'SELECT * FROM schedules WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Schedule not found' });

    const oldStatus = rows[0].status;

    await pool.query(`
      UPDATE schedules SET
        name = COALESCE($1, name),
        status = COALESCE($2, status),
        notes = COALESCE($3, notes)
      WHERE id = $4
    `, [name || null, status || null, notes || null, req.params.id]);

    // Auto-notify all assigned employees when schedule is published
    if (status === 'published' && oldStatus !== 'published') {
      try {
        const scheduleName = name || rows[0].name;
        const { rows: shiftRows } = await pool.query(
          'SELECT DISTINCT employee_id FROM shifts WHERE schedule_id = $1 AND employee_id IS NOT NULL',
          [req.params.id]
        );
        for (const row of shiftRows) {
          notifyEmployee(row.employee_id, '📅 New Schedule Posted', `${scheduleName} has been published. Check your shifts!`, `/employee/schedule`).catch(() => {});
        }
      } catch (e) { console.log('Publish notify error:', e.message); }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update schedule error:', err);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// ── DELETE /api/schedules/:id ──
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM shifts WHERE schedule_id = $1 AND schedule_id IN (SELECT id FROM schedules WHERE business_id = $2)',
      [req.params.id, req.user.businessId]
    );
    await pool.query(
      'DELETE FROM schedules WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Delete schedule error:', err);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// ══════════════════════════════════════
// SHIFTS
// ══════════════════════════════════════

// ── GET /api/schedules/:id/shifts ──
// Get all shifts for a schedule (admin sees all, employee sees own)
router.get('/:id/shifts', authenticate, async (req, res) => {
  try {
    const { rows: schedRows } = await pool.query(
      'SELECT * FROM schedules WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (schedRows.length === 0) return res.status(404).json({ error: 'Schedule not found' });

    let shifts;
    if (req.user.role === 'admin' || req.user.role === 'owner') {
      const { rows } = await pool.query(`
        SELECT sh.*, e.first_name, e.last_name, e.phone
        FROM shifts sh
        JOIN employees e ON sh.employee_id = e.id
        WHERE sh.schedule_id = $1
        ORDER BY sh.date, sh.start_time, e.last_name
      `, [req.params.id]);
      shifts = rows;
    } else {
      const { rows } = await pool.query(`
        SELECT sh.*, e.first_name, e.last_name
        FROM shifts sh
        JOIN employees e ON sh.employee_id = e.id
        WHERE sh.schedule_id = $1 AND sh.employee_id = $2
        ORDER BY sh.date, sh.start_time
      `, [req.params.id, req.user.id]);
      shifts = rows;
    }

    res.json({ schedule: schedRows[0], shifts });
  } catch (err) {
    console.error('Get shifts error:', err);
    res.status(500).json({ error: 'Failed to get shifts' });
  }
});

// ── POST /api/schedules/:id/shifts ──
// Add shifts to a schedule (admin)
router.post('/:id/shifts', authenticate, requireAdmin, async (req, res) => {
  try {
    const { shifts } = req.body;
    if (!Array.isArray(shifts)) {
      return res.status(400).json({ error: 'Expected array of shifts' });
    }

    const { rows: schedRows } = await pool.query(
      'SELECT * FROM schedules WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (schedRows.length === 0) return res.status(404).json({ error: 'Schedule not found' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const sh of shifts) {
        await client.query(`
          INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, station, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          req.params.id,
          sh.employeeId,
          sh.date,
          sh.startTime || '09:00',
          sh.endTime || '17:00',
          sh.station || null,
          sh.notes || null
        ]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ added: shifts.length });
  } catch (err) {
    console.error('Add shifts error:', err);
    res.status(500).json({ error: 'Failed to add shifts' });
  }
});

// ── PUT /api/shifts/:id/respond ──
// Employee confirms or declines a shift
router.put('/:scheduleId/shifts/:shiftId/respond', authenticate, async (req, res) => {
  try {
    const { status, notes, decline_reason } = req.body;
    if (!['confirmed', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Status must be confirmed or declined' });
    }

    const { rows } = await pool.query(`
      SELECT sh.* FROM shifts sh
      JOIN schedules s ON sh.schedule_id = s.id
      WHERE sh.id = $1 AND sh.employee_id = $2 AND s.business_id = $3
    `, [req.params.shiftId, req.user.id, req.user.businessId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Shift not found' });

    await pool.query(`
      UPDATE shifts SET status = $1, notes = COALESCE($2, notes),
        decline_reason = $3, responded_at = NOW()
      WHERE id = $4
    `, [status, notes || null, status === 'declined' ? (decline_reason || null) : null, req.params.shiftId]);

    // Notify admins when an employee declines a shift
    if (status === 'declined') {
      try {
        const shift = rows[0];
        const empName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
        notifyBusinessAdmins(req.user.businessId,
          '⚠️ Shift Declined',
          `${empName} declined their ${shift.station || ''} shift on ${shift.date}`,
          `/admin/schedule/${shift.schedule_id}`
        ).catch(() => {});
      } catch (e) {}
    }

    res.json({ success: true, status });
  } catch (err) {
    console.error('Respond to shift error:', err);
    res.status(500).json({ error: 'Failed to respond to shift' });
  }
});

// ── GET /api/my-shifts ──
// Get all upcoming shifts for the logged-in employee
router.get('/my-shifts', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sh.*, s.name as schedule_name, s.status as schedule_status
      FROM shifts sh
      JOIN schedules s ON sh.schedule_id = s.id
      WHERE sh.employee_id = $1 AND s.business_id = $2 AND s.status = 'published'
        AND sh.date >= CURRENT_DATE::TEXT
      ORDER BY sh.date, sh.start_time
    `, [req.user.id, req.user.businessId]);

    res.json(rows);
  } catch (err) {
    console.error('My shifts error:', err);
    res.status(500).json({ error: 'Failed to get shifts' });
  }
});

module.exports = router;
