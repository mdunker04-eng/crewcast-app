// ═══════════════════════════════════════════════════════
// CrewCast — Availability Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pool } = require('../db');

const router = express.Router();

// ── GET /api/availability ──
// Get my availability (employee) or all availability (admin)
router.get('/', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;

    if (req.user.role === 'admin' || req.user.role === 'owner') {
      // Admin: see all employees' availability
      let query = `
        SELECT a.*, e.first_name, e.last_name, e.phone
        FROM availability a
        JOIN employees e ON a.employee_id = e.id
        WHERE e.business_id = $1
      `;
      const params = [req.user.businessId];
      let paramIdx = 2;

      if (startDate) { query += ` AND a.date >= $${paramIdx}`; params.push(startDate); paramIdx++; }
      if (endDate) { query += ` AND a.date <= $${paramIdx}`; params.push(endDate); paramIdx++; }
      if (employeeId) { query += ` AND a.employee_id = $${paramIdx}`; params.push(employeeId); paramIdx++; }

      query += ' ORDER BY a.date, e.last_name';
      const { rows } = await pool.query(query, params);
      res.json(rows);
    } else {
      // Employee: see own availability
      let query = 'SELECT * FROM availability WHERE employee_id = $1';
      const params = [req.user.id];
      let paramIdx = 2;

      if (startDate) { query += ` AND date >= $${paramIdx}`; params.push(startDate); paramIdx++; }
      if (endDate) { query += ` AND date <= $${paramIdx}`; params.push(endDate); paramIdx++; }

      query += ' ORDER BY date';
      const { rows } = await pool.query(query, params);
      res.json(rows);
    }
  } catch (err) {
    console.error('Get availability error:', err);
    res.status(500).json({ error: 'Failed to get availability' });
  }
});

// ── PUT /api/availability ──
// Set availability for a date (or multiple dates)
router.put('/', authenticate, async (req, res) => {
  try {
    const { dates } = req.body;
    // dates = [{ date: '2026-05-03', available: true, startTime: '09:00', endTime: '17:00', notes: '', timeBlocks: [{start,end},...] }]

    if (!Array.isArray(dates)) {
      return res.status(400).json({ error: 'Expected array of dates' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const d of dates) {
        const timeBlocks = d.timeBlocks ? JSON.stringify(d.timeBlocks) : null;
        await client.query(`
          INSERT INTO availability (employee_id, date, available, start_time, end_time, notes, time_blocks, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT(employee_id, date)
          DO UPDATE SET available = EXCLUDED.available, start_time = EXCLUDED.start_time,
            end_time = EXCLUDED.end_time, notes = EXCLUDED.notes, time_blocks = EXCLUDED.time_blocks, updated_at = NOW()
        `, [
          req.user.id,
          d.date,
          d.available ? true : false,
          d.startTime || null,
          d.endTime || null,
          d.notes || null,
          timeBlocks,
        ]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ updated: dates.length });
  } catch (err) {
    console.error('Update availability error:', err);
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// ── GET /api/availability/summary ──
// Admin: summary of who's available on a given date
router.get('/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date required' });

    // Get all active employees and their availability for this date
    const { rows: employees } = await pool.query(`
      SELECT e.id, e.first_name, e.last_name, e.phone, e.skills,
        a.available, a.start_time, a.end_time, a.notes as avail_notes, a.time_blocks
      FROM employees e
      LEFT JOIN availability a ON e.id = a.employee_id AND a.date = $1
      WHERE e.business_id = $2 AND e.active = true
      ORDER BY CASE WHEN a.available = true THEN 0 WHEN a.available IS NULL THEN 1 ELSE 2 END,
               e.last_name
    `, [date, req.user.businessId]);

    const available = employees.filter(e => e.available === true);
    const unknown = employees.filter(e => e.available === null);
    const unavailable = employees.filter(e => e.available === false);

    res.json({
      date,
      total: employees.length,
      available: available.length,
      unknown: unknown.length,
      unavailable: unavailable.length,
      employees: employees.map(e => {
        let timeBlocks = null;
        if (e.time_blocks) {
          try { timeBlocks = JSON.parse(e.time_blocks); } catch (err) {}
        }
        return {
          ...e,
          skills: JSON.parse(e.skills || '{}'),
          status: e.available === true ? 'available' : e.available === false ? 'unavailable' : 'unknown',
          timeBlocks,
        };
      }),
    });
  } catch (err) {
    console.error('Availability summary error:', err);
    res.status(500).json({ error: 'Failed to get availability summary' });
  }
});

module.exports = router;
