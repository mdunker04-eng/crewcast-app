// ═══════════════════════════════════════════════════════
// CrewCast — Time Tracking Routes
// QR badge scanning, clock in/out, timesheets, kiosks
// ═══════════════════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ── QR Code Secret (used to hash employee QR codes) ──
const QR_SECRET = process.env.QR_SECRET || 'crewcast-qr-2026';

function generateQRPayload(employeeId, businessId) {
  const hash = crypto.createHmac('sha256', QR_SECRET)
    .update(`${employeeId}-${businessId}`)
    .digest('hex')
    .substring(0, 12);
  return JSON.stringify({ eid: employeeId, bid: businessId, h: hash });
}

function verifyQRPayload(payload) {
  try {
    const data = JSON.parse(payload);
    const expected = crypto.createHmac('sha256', QR_SECRET)
      .update(`${data.eid}-${data.bid}`)
      .digest('hex')
      .substring(0, 12);
    if (data.h !== expected) return null;
    return { employeeId: data.eid, businessId: data.bid };
  } catch {
    return null;
  }
}

// ── GET /api/time/qr/:employeeId — Generate QR payload for an employee ──
router.get('/qr/:employeeId', authenticate, async (req, res) => {
  try {
    const empId = parseInt(req.params.employeeId);
    // Employees can get their own QR, admins can get any
    if (req.user.id !== empId && req.user.role !== 'admin' && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { rows } = await pool.query(
      'SELECT id, first_name, last_name, business_id FROM employees WHERE id = $1 AND business_id = $2',
      [empId, req.user.businessId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Employee not found' });

    const emp = rows[0];
    const payload = generateQRPayload(emp.id, emp.business_id);
    res.json({
      payload,
      employee: { id: emp.id, firstName: emp.first_name, lastName: emp.last_name }
    });
  } catch (err) {
    console.error('QR generate error:', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// ── POST /api/time/scan — Process a QR scan (clock in or clock out) ──
router.post('/scan', authenticate, async (req, res) => {
  try {
    const { payload, stationId, kioskId } = req.body;
    if (!payload) return res.status(400).json({ error: 'QR payload required' });

    const verified = verifyQRPayload(payload);
    if (!verified) return res.status(400).json({ error: 'Invalid QR code' });
    if (verified.businessId !== req.user.businessId) {
      return res.status(403).json({ error: 'QR code is for a different business' });
    }

    // Check if employee exists and is active
    const { rows: empRows } = await pool.query(
      'SELECT id, first_name, last_name, active FROM employees WHERE id = $1 AND business_id = $2',
      [verified.employeeId, req.user.businessId]
    );
    if (empRows.length === 0 || !empRows[0].active) {
      return res.status(404).json({ error: 'Employee not found or inactive' });
    }
    const emp = empRows[0];

    // Check if currently clocked in (has an open time entry)
    const { rows: openEntries } = await pool.query(
      'SELECT id, clock_in, station_id FROM time_entries WHERE employee_id = $1 AND business_id = $2 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
      [emp.id, req.user.businessId]
    );

    if (openEntries.length > 0) {
      // CLOCK OUT
      const entry = openEntries[0];
      await pool.query(
        'UPDATE time_entries SET clock_out = NOW() WHERE id = $1',
        [entry.id]
      );
      const { rows: updated } = await pool.query('SELECT * FROM time_entries WHERE id = $1', [entry.id]);
      return res.json({
        action: 'clock_out',
        employee: { id: emp.id, firstName: emp.first_name, lastName: emp.last_name },
        entry: updated[0]
      });
    } else {
      // CLOCK IN — find today's shift for this employee if any
      const today = new Date().toISOString().split('T')[0];
      const { rows: shiftRows } = await pool.query(
        `SELECT s.id, s.station FROM shifts s
         JOIN schedules sc ON s.schedule_id = sc.id
         WHERE s.employee_id = $1 AND sc.business_id = $2 AND s.date = $3
         ORDER BY s.start_time ASC LIMIT 1`,
        [emp.id, req.user.businessId, today]
      );

      const shiftId = shiftRows.length > 0 ? shiftRows[0].id : null;
      const resolvedStationId = stationId || null;

      const { rows: newEntry } = await pool.query(
        `INSERT INTO time_entries (business_id, employee_id, shift_id, station_id, kiosk_id, clock_in, clock_in_method)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6) RETURNING *`,
        [req.user.businessId, emp.id, shiftId, resolvedStationId, kioskId || null, kioskId ? 'qr_kiosk' : 'qr_mobile']
      );

      return res.json({
        action: 'clock_in',
        employee: { id: emp.id, firstName: emp.first_name, lastName: emp.last_name },
        entry: newEntry[0]
      });
    }
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: 'Failed to process scan' });
  }
});

// ── POST /api/time/clock-in — Manual clock in (employee self-service) ──
router.post('/clock-in', authenticate, async (req, res) => {
  try {
    const { stationId } = req.body;
    const empId = req.user.id;

    // Check if already clocked in
    const { rows: open } = await pool.query(
      'SELECT id FROM time_entries WHERE employee_id = $1 AND business_id = $2 AND clock_out IS NULL',
      [empId, req.user.businessId]
    );
    if (open.length > 0) return res.status(400).json({ error: 'Already clocked in' });

    // Find today's shift
    const today = new Date().toISOString().split('T')[0];
    const { rows: shiftRows } = await pool.query(
      `SELECT s.id FROM shifts s JOIN schedules sc ON s.schedule_id = sc.id
       WHERE s.employee_id = $1 AND sc.business_id = $2 AND s.date = $3
       ORDER BY s.start_time ASC LIMIT 1`,
      [empId, req.user.businessId, today]
    );

    const { rows: entry } = await pool.query(
      `INSERT INTO time_entries (business_id, employee_id, shift_id, station_id, clock_in, clock_in_method)
       VALUES ($1, $2, $3, $4, NOW(), 'manual') RETURNING *`,
      [req.user.businessId, empId, shiftRows[0]?.id || null, stationId || null]
    );

    res.json({ action: 'clock_in', entry: entry[0] });
  } catch (err) {
    console.error('Clock in error:', err);
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

// ── POST /api/time/clock-out — Manual clock out ──
router.post('/clock-out', authenticate, async (req, res) => {
  try {
    const { rows: open } = await pool.query(
      'SELECT id FROM time_entries WHERE employee_id = $1 AND business_id = $2 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
      [req.user.id, req.user.businessId]
    );
    if (open.length === 0) return res.status(400).json({ error: 'Not clocked in' });

    await pool.query('UPDATE time_entries SET clock_out = NOW() WHERE id = $1', [open[0].id]);
    const { rows: entry } = await pool.query('SELECT * FROM time_entries WHERE id = $1', [open[0].id]);

    res.json({ action: 'clock_out', entry: entry[0] });
  } catch (err) {
    console.error('Clock out error:', err);
    res.status(500).json({ error: 'Failed to clock out' });
  }
});

// ── GET /api/time/status — Current clock-in status for logged-in employee ──
router.get('/status', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT te.*, s.name as station_name FROM time_entries te
       LEFT JOIN stations s ON te.station_id = s.id
       WHERE te.employee_id = $1 AND te.business_id = $2 AND te.clock_out IS NULL
       ORDER BY te.clock_in DESC LIMIT 1`,
      [req.user.id, req.user.businessId]
    );
    res.json({ clockedIn: rows.length > 0, entry: rows[0] || null });
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// ── GET /api/time/active — All currently clocked-in employees (admin) ──
router.get('/active', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT te.id, te.employee_id, te.station_id, te.clock_in, te.clock_in_method,
              e.first_name, e.last_name,
              s.name as station_name
       FROM time_entries te
       JOIN employees e ON te.employee_id = e.id
       LEFT JOIN stations s ON te.station_id = s.id
       WHERE te.business_id = $1 AND te.clock_out IS NULL
       ORDER BY te.clock_in ASC`,
      [req.user.businessId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Active error:', err);
    res.status(500).json({ error: 'Failed to get active employees' });
  }
});

// ── GET /api/time/entries — Timesheet entries for a date range (admin) ──
router.get('/entries', authenticate, requireAdmin, async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    let whereDate;
    let params = [req.user.businessId];

    if (date) {
      whereDate = `AND te.clock_in::date = $2`;
      params.push(date);
    } else if (startDate && endDate) {
      whereDate = `AND te.clock_in::date >= $2 AND te.clock_in::date <= $3`;
      params.push(startDate, endDate);
    } else {
      // Default to today
      whereDate = `AND te.clock_in::date = CURRENT_DATE`;
    }

    const { rows } = await pool.query(
      `SELECT te.*, e.first_name, e.last_name, s.name as station_name
       FROM time_entries te
       JOIN employees e ON te.employee_id = e.id
       LEFT JOIN stations s ON te.station_id = s.id
       WHERE te.business_id = $1 ${whereDate}
       ORDER BY te.clock_in DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Entries error:', err);
    res.status(500).json({ error: 'Failed to get time entries' });
  }
});

// ── PUT /api/time/entries/:id — Admin edit a time entry ──
router.put('/entries/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { clockIn, clockOut, stationId, notes } = req.body;
    const entryId = parseInt(req.params.id);

    // Verify entry belongs to this business
    const { rows: existing } = await pool.query(
      'SELECT id FROM time_entries WHERE id = $1 AND business_id = $2',
      [entryId, req.user.businessId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Entry not found' });

    const updates = [];
    const vals = [];
    let idx = 1;

    if (clockIn) { updates.push(`clock_in = $${idx++}`); vals.push(clockIn); }
    if (clockOut) { updates.push(`clock_out = $${idx++}`); vals.push(clockOut); }
    if (stationId !== undefined) { updates.push(`station_id = $${idx++}`); vals.push(stationId); }
    if (notes !== undefined) { updates.push(`notes = $${idx++}`); vals.push(notes); }

    updates.push(`edited_by = $${idx++}`); vals.push(req.user.id);
    updates.push(`edited_at = NOW()`);
    vals.push(entryId);

    await pool.query(
      `UPDATE time_entries SET ${updates.join(', ')} WHERE id = $${idx}`,
      vals
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Edit entry error:', err);
    res.status(500).json({ error: 'Failed to edit entry' });
  }
});

// ── GET /api/time/export — CSV export for payroll (admin) ──
router.get('/export', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });

    const { rows } = await pool.query(
      `SELECT te.clock_in, te.clock_out, te.clock_in_method, te.notes,
              e.first_name, e.last_name, e.phone,
              s.name as station_name
       FROM time_entries te
       JOIN employees e ON te.employee_id = e.id
       LEFT JOIN stations s ON te.station_id = s.id
       WHERE te.business_id = $1 AND te.clock_in::date >= $2 AND te.clock_in::date <= $3
       ORDER BY e.last_name, e.first_name, te.clock_in`,
      [req.user.businessId, startDate, endDate]
    );

    // Build CSV
    const header = 'Last Name,First Name,Phone,Station,Clock In,Clock Out,Hours,Method,Notes';
    const csvRows = rows.map(r => {
      const hours = r.clock_out
        ? ((new Date(r.clock_out) - new Date(r.clock_in)) / 3600000).toFixed(2)
        : 'OPEN';
      const clockIn = new Date(r.clock_in).toLocaleString('en-US');
      const clockOut = r.clock_out ? new Date(r.clock_out).toLocaleString('en-US') : '';
      return `"${r.last_name}","${r.first_name}","${r.phone}","${r.station_name || ''}","${clockIn}","${clockOut}","${hours}","${r.clock_in_method}","${(r.notes || '').replace(/"/g, '""')}"`;
    });

    const csv = [header, ...csvRows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=timesheet_${startDate}_${endDate}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export' });
  }
});

// ── GET /api/time/dashboard — Live station dashboard data (admin) ──
router.get('/dashboard', authenticate, requireAdmin, async (req, res) => {
  try {
    // Get all active stations with staff counts
    const { rows: stations } = await pool.query(
      `SELECT s.id, s.name, s.staff_needed,
              COUNT(te.id) as clocked_in_count
       FROM stations s
       LEFT JOIN time_entries te ON te.station_id = s.id AND te.business_id = s.business_id AND te.clock_out IS NULL
       WHERE s.business_id = $1 AND s.active = true
       GROUP BY s.id, s.name, s.staff_needed
       ORDER BY s.sort_order, s.name`,
      [req.user.businessId]
    );

    // Get today's late/no-show counts
    const today = new Date().toISOString().split('T')[0];
    const { rows: scheduled } = await pool.query(
      `SELECT sh.employee_id, sh.start_time, e.first_name, e.last_name,
              te.id as time_entry_id
       FROM shifts sh
       JOIN schedules sc ON sh.schedule_id = sc.id
       JOIN employees e ON sh.employee_id = e.id
       LEFT JOIN time_entries te ON te.employee_id = sh.employee_id AND te.business_id = sc.business_id AND te.clock_in::date = $2 AND te.clock_out IS NULL
       WHERE sc.business_id = $1 AND sh.date = $2 AND sc.status = 'published'`,
      [req.user.businessId, today]
    );

    const now = new Date();
    const lateThreshold = 15; // minutes
    let lateCount = 0;
    let noShowCount = 0;
    const lateEmployees = [];

    for (const s of scheduled) {
      if (s.time_entry_id) continue; // clocked in, all good
      const [h, m] = s.start_time.split(':').map(Number);
      const shiftStart = new Date(now);
      shiftStart.setHours(h, m, 0, 0);
      const diff = (now - shiftStart) / 60000; // minutes
      if (diff > 60) {
        noShowCount++;
      } else if (diff > lateThreshold) {
        lateCount++;
        lateEmployees.push({ firstName: s.first_name, lastName: s.last_name, minutesLate: Math.round(diff) });
      }
    }

    res.json({ stations, lateCount, noShowCount, lateEmployees, totalScheduled: scheduled.length });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

// ── Kiosk Management ──
router.post('/kiosks', authenticate, requireAdmin, async (req, res) => {
  try {
    const { deviceName, stationId, pinCode } = req.body;
    if (!deviceName) return res.status(400).json({ error: 'Device name required' });

    const { rows } = await pool.query(
      `INSERT INTO kiosks (business_id, device_name, station_id, pin_code) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.businessId, deviceName, stationId || null, pinCode || null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Kiosk create error:', err);
    res.status(500).json({ error: 'Failed to create kiosk' });
  }
});

router.get('/kiosks', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT k.*, s.name as station_name FROM kiosks k
       LEFT JOIN stations s ON k.station_id = s.id
       WHERE k.business_id = $1 ORDER BY k.created_at`,
      [req.user.businessId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Kiosk list error:', err);
    res.status(500).json({ error: 'Failed to list kiosks' });
  }
});

// ── POST /api/time/kiosk-scan — Scan from kiosk (uses kiosk PIN for auth instead of user token) ──
router.post('/kiosk-scan', async (req, res) => {
  try {
    const { kioskId, pinCode, payload, stationId } = req.body;
    if (!kioskId || !payload) return res.status(400).json({ error: 'kioskId and payload required' });

    // Verify kiosk
    const { rows: kiosks } = await pool.query(
      'SELECT * FROM kiosks WHERE id = $1 AND is_active = true',
      [kioskId]
    );
    if (kiosks.length === 0) return res.status(404).json({ error: 'Kiosk not found or inactive' });
    const kiosk = kiosks[0];

    // Verify PIN if kiosk has one
    if (kiosk.pin_code && kiosk.pin_code !== pinCode) {
      return res.status(403).json({ error: 'Invalid kiosk PIN' });
    }

    // Verify QR payload
    const verified = verifyQRPayload(payload);
    if (!verified) return res.status(400).json({ error: 'Invalid QR code' });
    if (verified.businessId !== kiosk.business_id) {
      return res.status(403).json({ error: 'QR code is for a different business' });
    }

    // Get employee
    const { rows: empRows } = await pool.query(
      'SELECT id, first_name, last_name, active FROM employees WHERE id = $1 AND business_id = $2',
      [verified.employeeId, kiosk.business_id]
    );
    if (empRows.length === 0 || !empRows[0].active) {
      return res.status(404).json({ error: 'Employee not found or inactive' });
    }
    const emp = empRows[0];

    const resolvedStation = stationId || kiosk.station_id;

    // Check if clocked in
    const { rows: openEntries } = await pool.query(
      'SELECT id FROM time_entries WHERE employee_id = $1 AND business_id = $2 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
      [emp.id, kiosk.business_id]
    );

    if (openEntries.length > 0) {
      // Clock out
      await pool.query('UPDATE time_entries SET clock_out = NOW() WHERE id = $1', [openEntries[0].id]);
      const { rows: updated } = await pool.query('SELECT * FROM time_entries WHERE id = $1', [openEntries[0].id]);
      // Update kiosk last_seen
      await pool.query('UPDATE kiosks SET last_seen = NOW() WHERE id = $1', [kioskId]);
      return res.json({
        action: 'clock_out',
        employee: { id: emp.id, firstName: emp.first_name, lastName: emp.last_name },
        entry: updated[0]
      });
    } else {
      // Clock in
      const today = new Date().toISOString().split('T')[0];
      const { rows: shiftRows } = await pool.query(
        `SELECT s.id FROM shifts s JOIN schedules sc ON s.schedule_id = sc.id
         WHERE s.employee_id = $1 AND sc.business_id = $2 AND s.date = $3
         ORDER BY s.start_time ASC LIMIT 1`,
        [emp.id, kiosk.business_id, today]
      );

      const { rows: newEntry } = await pool.query(
        `INSERT INTO time_entries (business_id, employee_id, shift_id, station_id, kiosk_id, clock_in, clock_in_method)
         VALUES ($1, $2, $3, $4, $5, NOW(), 'qr_kiosk') RETURNING *`,
        [kiosk.business_id, emp.id, shiftRows[0]?.id || null, resolvedStation, kioskId]
      );
      await pool.query('UPDATE kiosks SET last_seen = NOW() WHERE id = $1', [kioskId]);

      return res.json({
        action: 'clock_in',
        employee: { id: emp.id, firstName: emp.first_name, lastName: emp.last_name },
        entry: newEntry[0]
      });
    }
  } catch (err) {
    console.error('Kiosk scan error:', err);
    res.status(500).json({ error: 'Failed to process kiosk scan' });
  }
});

module.exports = router;
