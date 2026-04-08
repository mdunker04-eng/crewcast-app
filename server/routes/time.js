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
    const { stationId, roleId } = req.body;
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

    // Resolve pay role: explicit > employee default > null
    let payRoleId = roleId || null;
    if (!payRoleId) {
      const { rows: empRows } = await pool.query(
        'SELECT default_pay_role_id FROM employees WHERE id = $1', [empId]
      );
      payRoleId = empRows[0]?.default_pay_role_id || null;
    }

    const { rows: entry } = await pool.query(
      `INSERT INTO time_entries (business_id, employee_id, shift_id, station_id, pay_role_id, clock_in, clock_in_method)
       VALUES ($1, $2, $3, $4, $5, NOW(), 'manual') RETURNING *`,
      [req.user.businessId, empId, shiftRows[0]?.id || null, stationId || null, payRoleId]
    );

    res.json({ action: 'clock_in', entry: entry[0] });
  } catch (err) {
    console.error('Clock in error:', err);
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

// ── POST /api/time/clock-out — Manual clock out (with optional tip entry) ──
router.post('/clock-out', authenticate, async (req, res) => {
  try {
    const { tipCash, tipCard } = req.body;
    const { rows: open } = await pool.query(
      'SELECT id FROM time_entries WHERE employee_id = $1 AND business_id = $2 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
      [req.user.id, req.user.businessId]
    );
    if (open.length === 0) return res.status(400).json({ error: 'Not clocked in' });

    await pool.query(
      'UPDATE time_entries SET clock_out = NOW(), tip_cash = $2, tip_card = $3 WHERE id = $1',
      [open[0].id, parseFloat(tipCash) || 0, parseFloat(tipCard) || 0]
    );
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
              te.tip_cash, te.tip_card, te.break_minutes,
              e.first_name, e.last_name, e.phone,
              s.name as station_name,
              pr.name as role_name, pr.base_rate, pr.is_tipped
       FROM time_entries te
       JOIN employees e ON te.employee_id = e.id
       LEFT JOIN stations s ON te.station_id = s.id
       LEFT JOIN pay_roles pr ON te.pay_role_id = pr.id
       WHERE te.business_id = $1 AND te.clock_in::date >= $2 AND te.clock_in::date <= $3
       ORDER BY e.last_name, e.first_name, te.clock_in`,
      [req.user.businessId, startDate, endDate]
    );

    // Build CSV
    const header = 'Last Name,First Name,Phone,Role,Base Rate,Station,Clock In,Clock Out,Hours,Break Min,Tip Cash,Tip Card,Total Tips,Method,Notes';
    const csvRows = rows.map(r => {
      const hours = r.clock_out
        ? ((new Date(r.clock_out) - new Date(r.clock_in)) / 3600000).toFixed(2)
        : 'OPEN';
      const clockIn = new Date(r.clock_in).toLocaleString('en-US');
      const clockOut = r.clock_out ? new Date(r.clock_out).toLocaleString('en-US') : '';
      const tipCash = parseFloat(r.tip_cash) || 0;
      const tipCard = parseFloat(r.tip_card) || 0;
      return `"${r.last_name}","${r.first_name}","${r.phone}","${r.role_name || ''}","${r.base_rate || ''}","${r.station_name || ''}","${clockIn}","${clockOut}","${hours}","${r.break_minutes || 0}","${tipCash.toFixed(2)}","${tipCard.toFixed(2)}","${(tipCash + tipCard).toFixed(2)}","${r.clock_in_method}","${(r.notes || '').replace(/"/g, '""')}"`;
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

// ═══════════════════════════════════════════════════════
// Restaurant Features: Break Alerts, Overtime, Tips
// ═══════════════════════════════════════════════════════

// ── GET /api/time/break-alerts — Employees approaching break threshold (admin) ──
router.get('/break-alerts', authenticate, requireAdmin, async (req, res) => {
  try {
    // Get business break rules (or use defaults)
    const { rows: rules } = await pool.query(
      'SELECT * FROM break_rules WHERE business_id = $1 AND active = true LIMIT 1',
      [req.user.businessId]
    );
    const hoursBeforeBreak = rules.length > 0 ? parseFloat(rules[0].hours_before_break) : 6;
    const breakDuration = rules.length > 0 ? rules[0].break_duration_minutes : 30;

    // Find currently clocked-in employees who haven't taken a break
    const { rows: active } = await pool.query(
      `SELECT te.id, te.employee_id, te.clock_in, te.break_start, te.break_end, te.break_minutes,
              e.first_name, e.last_name, s.name as station_name
       FROM time_entries te
       JOIN employees e ON te.employee_id = e.id
       LEFT JOIN stations s ON te.station_id = s.id
       WHERE te.business_id = $1 AND te.clock_out IS NULL
       ORDER BY te.clock_in ASC`,
      [req.user.businessId]
    );

    const now = new Date();
    const alerts = [];
    for (const entry of active) {
      const hoursWorked = (now - new Date(entry.clock_in)) / 3600000;
      const hadBreak = entry.break_minutes > 0 || entry.break_end;
      const timeUntilRequired = hoursBeforeBreak - hoursWorked;

      if (!hadBreak && hoursWorked >= (hoursBeforeBreak - 0.5)) {
        alerts.push({
          entryId: entry.id,
          employeeId: entry.employee_id,
          firstName: entry.first_name,
          lastName: entry.last_name,
          stationName: entry.station_name,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          severity: hoursWorked >= hoursBeforeBreak ? 'violation' : 'warning',
          message: hoursWorked >= hoursBeforeBreak
            ? `Over ${hoursBeforeBreak}h without a ${breakDuration}-min break`
            : `${Math.round(timeUntilRequired * 60)}min until ${breakDuration}-min break required`
        });
      }
    }

    res.json({
      alerts,
      rule: { hoursBeforeBreak, breakDuration, state: rules[0]?.state_code || 'US' }
    });
  } catch (err) {
    console.error('Break alerts error:', err);
    res.status(500).json({ error: 'Failed to get break alerts' });
  }
});

// ── POST /api/time/start-break — Employee starts a break ──
router.post('/start-break', authenticate, async (req, res) => {
  try {
    const { rows: open } = await pool.query(
      'SELECT id FROM time_entries WHERE employee_id = $1 AND business_id = $2 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
      [req.user.id, req.user.businessId]
    );
    if (open.length === 0) return res.status(400).json({ error: 'Not clocked in' });

    await pool.query('UPDATE time_entries SET break_start = NOW() WHERE id = $1', [open[0].id]);
    res.json({ success: true, breakStarted: new Date() });
  } catch (err) {
    console.error('Start break error:', err);
    res.status(500).json({ error: 'Failed to start break' });
  }
});

// ── POST /api/time/end-break — Employee ends a break ──
router.post('/end-break', authenticate, async (req, res) => {
  try {
    const { rows: open } = await pool.query(
      'SELECT id, break_start FROM time_entries WHERE employee_id = $1 AND business_id = $2 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
      [req.user.id, req.user.businessId]
    );
    if (open.length === 0) return res.status(400).json({ error: 'Not clocked in' });
    if (!open[0].break_start) return res.status(400).json({ error: 'No active break' });

    const breakMinutes = Math.round((new Date() - new Date(open[0].break_start)) / 60000);
    await pool.query(
      'UPDATE time_entries SET break_end = NOW(), break_minutes = $2 WHERE id = $1',
      [open[0].id, breakMinutes]
    );
    res.json({ success: true, breakMinutes });
  } catch (err) {
    console.error('End break error:', err);
    res.status(500).json({ error: 'Failed to end break' });
  }
});

// ── GET /api/time/overtime-warnings — Weekly hours approaching overtime (admin) ──
router.get('/overtime-warnings', authenticate, requireAdmin, async (req, res) => {
  try {
    const weekOf = req.query.weekOf || new Date().toISOString().split('T')[0];
    // Get Monday of the specified week
    const d = new Date(weekOf);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const monStr = monday.toISOString().split('T')[0];
    const sunStr = sunday.toISOString().split('T')[0];

    // Get actual hours worked this week per employee
    const { rows: worked } = await pool.query(
      `SELECT te.employee_id, e.first_name, e.last_name,
              SUM(EXTRACT(EPOCH FROM (COALESCE(te.clock_out, NOW()) - te.clock_in)) / 3600) as hours_worked,
              COUNT(te.id) as shift_count
       FROM time_entries te
       JOIN employees e ON te.employee_id = e.id
       WHERE te.business_id = $1 AND te.clock_in::date >= $2 AND te.clock_in::date <= $3
       GROUP BY te.employee_id, e.first_name, e.last_name
       ORDER BY hours_worked DESC`,
      [req.user.businessId, monStr, sunStr]
    );

    // Get scheduled (but not yet worked) hours for rest of week
    const today = new Date().toISOString().split('T')[0];
    const { rows: scheduled } = await pool.query(
      `SELECT sh.employee_id,
              SUM(EXTRACT(EPOCH FROM (
                (sh.date || ' ' || sh.end_time)::timestamp -
                (sh.date || ' ' || sh.start_time)::timestamp
              )) / 3600) as scheduled_hours
       FROM shifts sh
       JOIN schedules sc ON sh.schedule_id = sc.id
       WHERE sc.business_id = $1 AND sh.date > $2 AND sh.date <= $3 AND sc.status = 'published'
       GROUP BY sh.employee_id`,
      [req.user.businessId, today, sunStr]
    );

    const scheduledMap = {};
    for (const s of scheduled) {
      scheduledMap[s.employee_id] = parseFloat(s.scheduled_hours) || 0;
    }

    const warnings = [];
    const OT_THRESHOLD = 40;
    for (const w of worked) {
      const hoursWorked = parseFloat(w.hours_worked) || 0;
      const remainingScheduled = scheduledMap[w.employee_id] || 0;
      const projectedTotal = hoursWorked + remainingScheduled;

      if (hoursWorked >= OT_THRESHOLD) {
        warnings.push({
          employeeId: w.employee_id,
          firstName: w.first_name,
          lastName: w.last_name,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          projectedTotal: Math.round(projectedTotal * 100) / 100,
          overtimeHours: Math.round((hoursWorked - OT_THRESHOLD) * 100) / 100,
          severity: 'overtime',
          message: `Already at ${hoursWorked.toFixed(1)}h — ${(hoursWorked - OT_THRESHOLD).toFixed(1)}h overtime`
        });
      } else if (projectedTotal >= OT_THRESHOLD) {
        warnings.push({
          employeeId: w.employee_id,
          firstName: w.first_name,
          lastName: w.last_name,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          projectedTotal: Math.round(projectedTotal * 100) / 100,
          severity: 'warning',
          message: `At ${hoursWorked.toFixed(1)}h, projected ${projectedTotal.toFixed(1)}h with remaining shifts`
        });
      } else if (hoursWorked >= 32) {
        warnings.push({
          employeeId: w.employee_id,
          firstName: w.first_name,
          lastName: w.last_name,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          projectedTotal: Math.round(projectedTotal * 100) / 100,
          severity: 'approaching',
          message: `At ${hoursWorked.toFixed(1)}h — ${(OT_THRESHOLD - hoursWorked).toFixed(1)}h until overtime`
        });
      }
    }

    res.json({ warnings, weekOf: monStr, weekEnd: sunStr });
  } catch (err) {
    console.error('Overtime warnings error:', err);
    res.status(500).json({ error: 'Failed to get overtime warnings' });
  }
});

// ── GET /api/time/tip-summary — Tip totals by employee and date range (admin) ──
router.get('/tip-summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });

    const { rows } = await pool.query(
      `SELECT te.employee_id, e.first_name, e.last_name,
              pr.name as role_name, pr.is_tipped,
              COUNT(te.id) as shifts,
              SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600) as total_hours,
              SUM(te.tip_cash) as total_tip_cash,
              SUM(te.tip_card) as total_tip_card,
              SUM(te.tip_cash + te.tip_card) as total_tips
       FROM time_entries te
       JOIN employees e ON te.employee_id = e.id
       LEFT JOIN pay_roles pr ON te.pay_role_id = pr.id
       WHERE te.business_id = $1 AND te.clock_in::date >= $2 AND te.clock_in::date <= $3 AND te.clock_out IS NOT NULL
       GROUP BY te.employee_id, e.first_name, e.last_name, pr.name, pr.is_tipped
       ORDER BY total_tips DESC`,
      [req.user.businessId, startDate, endDate]
    );

    // Calculate totals
    let grandTotalCash = 0, grandTotalCard = 0;
    for (const r of rows) {
      grandTotalCash += parseFloat(r.total_tip_cash) || 0;
      grandTotalCard += parseFloat(r.total_tip_card) || 0;
    }

    res.json({
      employees: rows,
      totals: {
        cash: Math.round(grandTotalCash * 100) / 100,
        card: Math.round(grandTotalCard * 100) / 100,
        combined: Math.round((grandTotalCash + grandTotalCard) * 100) / 100
      }
    });
  } catch (err) {
    console.error('Tip summary error:', err);
    res.status(500).json({ error: 'Failed to get tip summary' });
  }
});

// ── GET /api/time/labor-cost — Labor cost summary for date range (admin) ──
router.get('/labor-cost', authenticate, requireAdmin, async (req, res) => {
  try {
    const { start, end } = req.query;
    const bizId = req.user.businessId;
    const startDate = start || new Date().toISOString().split('T')[0];
    const endDate = end || startDate;

    // Get all completed time entries with pay role info
    const { rows } = await pool.query(`
      SELECT te.employee_id, e.name as employee_name,
             te.clock_in, te.clock_out, te.tip_cash, te.tip_card, te.break_minutes,
             pr.name as role_name, pr.base_rate, pr.is_tipped, pr.overtime_eligible,
             EXTRACT(EPOCH FROM (te.clock_out - te.clock_in))/3600.0 as raw_hours
      FROM time_entries te
      JOIN employees e ON e.id = te.employee_id
      LEFT JOIN pay_roles pr ON pr.id = te.pay_role_id
      WHERE te.business_id = $1
        AND te.clock_out IS NOT NULL
        AND DATE(te.clock_in) >= $2
        AND DATE(te.clock_in) <= $3
      ORDER BY te.clock_in
    `, [bizId, startDate, endDate]);

    let totalHours = 0;
    let totalLaborCost = 0;
    let totalTips = 0;
    const byRole = {};
    const byDay = {};
    const byEmployee = {};

    for (const r of rows) {
      const breakHrs = (r.break_minutes || 0) / 60;
      const hours = Math.max(0, (parseFloat(r.raw_hours) || 0) - breakHrs);
      const rate = parseFloat(r.base_rate) || 0;
      const cost = hours * rate;
      const tips = (parseFloat(r.tip_cash) || 0) + (parseFloat(r.tip_card) || 0);
      const day = new Date(r.clock_in).toISOString().split('T')[0];
      const roleName = r.role_name || 'Unassigned';

      totalHours += hours;
      totalLaborCost += cost;
      totalTips += tips;

      // By role
      if (!byRole[roleName]) byRole[roleName] = { hours: 0, cost: 0, tips: 0, count: 0 };
      byRole[roleName].hours += hours;
      byRole[roleName].cost += cost;
      byRole[roleName].tips += tips;
      byRole[roleName].count++;

      // By day
      if (!byDay[day]) byDay[day] = { hours: 0, cost: 0, tips: 0, entries: 0 };
      byDay[day].hours += hours;
      byDay[day].cost += cost;
      byDay[day].tips += tips;
      byDay[day].entries++;

      // By employee
      if (!byEmployee[r.employee_id]) byEmployee[r.employee_id] = { name: r.employee_name, hours: 0, cost: 0, tips: 0, entries: 0 };
      byEmployee[r.employee_id].hours += hours;
      byEmployee[r.employee_id].cost += cost;
      byEmployee[r.employee_id].tips += tips;
      byEmployee[r.employee_id].entries++;
    }

    // Round everything
    const round2 = v => Math.round(v * 100) / 100;

    res.json({
      period: { start: startDate, end: endDate },
      totals: { hours: round2(totalHours), laborCost: round2(totalLaborCost), tips: round2(totalTips), entries: rows.length },
      byRole: Object.entries(byRole).map(([name, d]) => ({ name, hours: round2(d.hours), cost: round2(d.cost), tips: round2(d.tips), shifts: d.count })),
      byDay: Object.entries(byDay).map(([date, d]) => ({ date, hours: round2(d.hours), cost: round2(d.cost), tips: round2(d.tips), entries: d.entries })),
      byEmployee: Object.values(byEmployee).map(d => ({ name: d.name, hours: round2(d.hours), cost: round2(d.cost), tips: round2(d.tips), shifts: d.entries }))
        .sort((a, b) => b.cost - a.cost)
    });
  } catch (err) {
    console.error('Labor cost error:', err);
    res.status(500).json({ error: 'Failed to get labor cost data' });
  }
});

// ── Tip Pool Rules CRUD ──

// GET all tip pool rules with shares
router.get('/tip-pools', authenticate, requireAdmin, async (req, res) => {
  try {
    const rules = await pool.query(
      `SELECT * FROM tip_pool_rules WHERE business_id = $1 ORDER BY name`,
      [req.user.businessId]
    );
    // Get shares for each rule
    const result = [];
    for (const rule of rules.rows) {
      const shares = await pool.query(
        `SELECT tps.*, pr.name as role_name FROM tip_pool_shares tps
         JOIN pay_roles pr ON pr.id = tps.pay_role_id
         WHERE tps.rule_id = $1 ORDER BY pr.name`,
        [rule.id]
      );
      result.push({ ...rule, shares: shares.rows });
    }
    res.json(result);
  } catch (err) {
    console.error('Tip pool list error:', err);
    res.status(500).json({ error: 'Failed to load tip pools' });
  }
});

// CREATE a tip pool rule
router.post('/tip-pools', authenticate, requireAdmin, async (req, res) => {
  const { name, poolPercentage, shares } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ruleRes = await client.query(
      `INSERT INTO tip_pool_rules (business_id, name, pool_percentage)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.businessId, name, poolPercentage || 100]
    );
    const ruleId = ruleRes.rows[0].id;

    if (shares && shares.length > 0) {
      for (const s of shares) {
        await client.query(
          `INSERT INTO tip_pool_shares (rule_id, pay_role_id, share_percentage)
           VALUES ($1, $2, $3)`,
          [ruleId, s.payRoleId, s.sharePercentage]
        );
      }
    }
    await client.query('COMMIT');
    res.json(ruleRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Tip pool create error:', err);
    res.status(500).json({ error: 'Failed to create tip pool' });
  } finally {
    client.release();
  }
});

// UPDATE a tip pool rule
router.put('/tip-pools/:id', authenticate, requireAdmin, async (req, res) => {
  const { name, poolPercentage, active, shares } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE tip_pool_rules SET name = COALESCE($1, name),
       pool_percentage = COALESCE($2, pool_percentage),
       active = COALESCE($3, active)
       WHERE id = $4 AND business_id = $5`,
      [name, poolPercentage, active, req.params.id, req.user.businessId]
    );

    if (shares) {
      await client.query(`DELETE FROM tip_pool_shares WHERE rule_id = $1`, [req.params.id]);
      for (const s of shares) {
        await client.query(
          `INSERT INTO tip_pool_shares (rule_id, pay_role_id, share_percentage)
           VALUES ($1, $2, $3)`,
          [req.params.id, s.payRoleId, s.sharePercentage]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Tip pool update error:', err);
    res.status(500).json({ error: 'Failed to update tip pool' });
  } finally {
    client.release();
  }
});

// DELETE a tip pool rule
router.delete('/tip-pools/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM tip_pool_rules WHERE id = $1 AND business_id = $2`,
      [req.params.id, req.user.businessId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Tip pool delete error:', err);
    res.status(500).json({ error: 'Failed to delete tip pool' });
  }
});

module.exports = router;
