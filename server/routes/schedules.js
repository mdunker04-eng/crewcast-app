// ═══════════════════════════════════════════════════════
// CrewCast — Schedule & Shift Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// ══════════════════════════════════════
// SCHEDULES
// ══════════════════════════════════════

// ── GET /api/schedules ──
// List schedules for the business
router.get('/', authenticate, (req, res) => {
  const schedules = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM shifts WHERE schedule_id = s.id) as total_shifts,
      (SELECT COUNT(*) FROM shifts WHERE schedule_id = s.id AND status = 'confirmed') as confirmed,
      (SELECT COUNT(*) FROM shifts WHERE schedule_id = s.id AND status = 'declined') as declined,
      (SELECT COUNT(*) FROM shifts WHERE schedule_id = s.id AND status = 'pending') as pending
    FROM schedules s
    WHERE s.business_id = ?
    ORDER BY s.start_date DESC
  `).all(req.user.businessId);

  res.json(schedules);
});

// ── POST /api/schedules ──
// Create a new schedule (admin)
router.post('/', authenticate, requireAdmin, (req, res) => {
  const { name, startDate, endDate, notes } = req.body;
  if (!name || !startDate || !endDate) {
    return res.status(400).json({ error: 'Name, start date, and end date required' });
  }

  const result = db.prepare(`
    INSERT INTO schedules (business_id, name, start_date, end_date, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.businessId, name, startDate, endDate, notes || null);

  res.json({ id: result.lastInsertRowid, name, startDate, endDate, status: 'draft' });
});

// ── PUT /api/schedules/:id ──
// Update schedule (status, name, etc)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const { name, status, notes } = req.body;
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ? AND business_id = ?')
    .get(req.params.id, req.user.businessId);

  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

  db.prepare(`
    UPDATE schedules SET
      name = COALESCE(?, name),
      status = COALESCE(?, status),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(name || null, status || null, notes || null, req.params.id);

  res.json({ success: true });
});

// ── DELETE /api/schedules/:id ──
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM shifts WHERE schedule_id = ? AND schedule_id IN (SELECT id FROM schedules WHERE business_id = ?)')
    .run(req.params.id, req.user.businessId);
  db.prepare('DELETE FROM schedules WHERE id = ? AND business_id = ?')
    .run(req.params.id, req.user.businessId);
  res.json({ success: true });
});

// ══════════════════════════════════════
// SHIFTS
// ══════════════════════════════════════

// ── GET /api/schedules/:id/shifts ──
// Get all shifts for a schedule (admin sees all, employee sees own)
router.get('/:id/shifts', authenticate, (req, res) => {
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ? AND business_id = ?')
    .get(req.params.id, req.user.businessId);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

  let shifts;
  if (req.user.role === 'admin' || req.user.role === 'owner') {
    shifts = db.prepare(`
      SELECT sh.*, e.first_name, e.last_name, e.phone
      FROM shifts sh
      JOIN employees e ON sh.employee_id = e.id
      WHERE sh.schedule_id = ?
      ORDER BY sh.date, sh.start_time, e.last_name
    `).all(req.params.id);
  } else {
    shifts = db.prepare(`
      SELECT sh.*, e.first_name, e.last_name
      FROM shifts sh
      JOIN employees e ON sh.employee_id = e.id
      WHERE sh.schedule_id = ? AND sh.employee_id = ?
      ORDER BY sh.date, sh.start_time
    `).all(req.params.id, req.user.id);
  }

  res.json({ schedule, shifts });
});

// ── POST /api/schedules/:id/shifts ──
// Add shifts to a schedule (admin)
router.post('/:id/shifts', authenticate, requireAdmin, (req, res) => {
  const { shifts } = req.body;
  if (!Array.isArray(shifts)) {
    return res.status(400).json({ error: 'Expected array of shifts' });
  }

  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ? AND business_id = ?')
    .get(req.params.id, req.user.businessId);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

  const insert = db.prepare(`
    INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, station, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((list) => {
    for (const sh of list) {
      insert.run(
        req.params.id,
        sh.employeeId,
        sh.date,
        sh.startTime || '09:00',
        sh.endTime || '17:00',
        sh.station || null,
        sh.notes || null
      );
    }
  });

  insertMany(shifts);
  res.json({ added: shifts.length });
});

// ── PUT /api/shifts/:id/respond ──
// Employee confirms or declines a shift
router.put('/:scheduleId/shifts/:shiftId/respond', authenticate, (req, res) => {
  const { status, notes } = req.body;
  if (!['confirmed', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Status must be confirmed or declined' });
  }

  const shift = db.prepare(`
    SELECT sh.* FROM shifts sh
    JOIN schedules s ON sh.schedule_id = s.id
    WHERE sh.id = ? AND sh.employee_id = ? AND s.business_id = ?
  `).get(req.params.shiftId, req.user.id, req.user.businessId);

  if (!shift) return res.status(404).json({ error: 'Shift not found' });

  db.prepare(`
    UPDATE shifts SET status = ?, notes = COALESCE(?, notes), responded_at = datetime('now')
    WHERE id = ?
  `).run(status, notes || null, req.params.shiftId);

  res.json({ success: true, status });
});

// ── GET /api/my-shifts ──
// Get all upcoming shifts for the logged-in employee
router.get('/my-shifts', authenticate, (req, res) => {
  const shifts = db.prepare(`
    SELECT sh.*, s.name as schedule_name, s.status as schedule_status
    FROM shifts sh
    JOIN schedules s ON sh.schedule_id = s.id
    WHERE sh.employee_id = ? AND s.business_id = ? AND s.status = 'published'
      AND sh.date >= date('now')
    ORDER BY sh.date, sh.start_time
  `).all(req.user.id, req.user.businessId);

  res.json(shifts);
});

module.exports = router;
