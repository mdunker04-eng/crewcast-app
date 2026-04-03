// ═══════════════════════════════════════════════════════
// CrewCast — Availability Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// ── GET /api/availability ──
// Get my availability (employee) or all availability (admin)
router.get('/', authenticate, (req, res) => {
  const { startDate, endDate, employeeId } = req.query;

  if (req.user.role === 'admin' || req.user.role === 'owner') {
    // Admin: see all employees' availability
    let query = `
      SELECT a.*, e.first_name, e.last_name, e.phone
      FROM availability a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.business_id = ?
    `;
    const params = [req.user.businessId];

    if (startDate) { query += ' AND a.date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND a.date <= ?'; params.push(endDate); }
    if (employeeId) { query += ' AND a.employee_id = ?'; params.push(employeeId); }

    query += ' ORDER BY a.date, e.last_name';
    res.json(db.prepare(query).all(...params));
  } else {
    // Employee: see own availability
    let query = 'SELECT * FROM availability WHERE employee_id = ?';
    const params = [req.user.id];

    if (startDate) { query += ' AND date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND date <= ?'; params.push(endDate); }

    query += ' ORDER BY date';
    res.json(db.prepare(query).all(...params));
  }
});

// ── PUT /api/availability ──
// Set availability for a date (or multiple dates)
router.put('/', authenticate, (req, res) => {
  const { dates } = req.body;
  // dates = [{ date: '2026-05-03', available: true, startTime: '09:00', endTime: '17:00', notes: '' }]

  if (!Array.isArray(dates)) {
    return res.status(400).json({ error: 'Expected array of dates' });
  }

  const upsert = db.prepare(`
    INSERT INTO availability (employee_id, date, available, start_time, end_time, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(employee_id, date)
    DO UPDATE SET available = excluded.available, start_time = excluded.start_time,
      end_time = excluded.end_time, notes = excluded.notes, updated_at = datetime('now')
  `);

  const updateMany = db.transaction((list) => {
    for (const d of list) {
      upsert.run(
        req.user.id,
        d.date,
        d.available ? 1 : 0,
        d.startTime || null,
        d.endTime || null,
        d.notes || null
      );
    }
  });

  updateMany(dates);
  res.json({ updated: dates.length });
});

// ── GET /api/availability/summary ──
// Admin: summary of who's available on a given date
router.get('/summary', authenticate, requireAdmin, (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date required' });

  // Get all active employees and their availability for this date
  const employees = db.prepare(`
    SELECT e.id, e.first_name, e.last_name, e.phone, e.skills,
      a.available, a.start_time, a.end_time, a.notes as avail_notes
    FROM employees e
    LEFT JOIN availability a ON e.id = a.employee_id AND a.date = ?
    WHERE e.business_id = ? AND e.active = 1
    ORDER BY CASE WHEN a.available = 1 THEN 0 WHEN a.available IS NULL THEN 1 ELSE 2 END,
             e.last_name
  `).all(date, req.user.businessId);

  const available = employees.filter(e => e.available === 1);
  const unknown = employees.filter(e => e.available === null);
  const unavailable = employees.filter(e => e.available === 0);

  res.json({
    date,
    total: employees.length,
    available: available.length,
    unknown: unknown.length,
    unavailable: unavailable.length,
    employees: employees.map(e => ({
      ...e,
      skills: JSON.parse(e.skills || '{}'),
      status: e.available === 1 ? 'available' : e.available === 0 ? 'unavailable' : 'unknown',
    })),
  });
});

module.exports = router;
