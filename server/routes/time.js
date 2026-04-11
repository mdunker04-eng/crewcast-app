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


// ── Dedupe helper: if client sent a punch_id we've already seen, return existing entry ──
async function findExistingPunch(businessId, employeeId, clientPunchId) {
  if (!clientPunchId) return null;
  const { rows } = await pool.query(
    'SELECT * FROM time_entries WHERE employee_id = $1 AND client_punch_id = $2 LIMIT 1',
    [employeeId, clientPunchId]
  );
  return rows[0] || null;
}

// ── Parse an ISO timestamp or fall back to NOW(). Used for offline-queued punches. ──
function resolvePunchTime(punchTime) {
  if (!punchTime) return null;
  const t = new Date(punchTime);
  if (isNaN(t.getTime())) return null;
  // Safety: reject timestamps more than 48h old or in the future (clock drift guard)
  const now = Date.now();
  if (t.getTime() > now + 5 * 60 * 1000) return null; // 5 min future tolerance
  if (t.getTime() < now - 48 * 3600 * 1000) return null; // 48 h past tolerance
  return t.toISOString();
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
// Supports offline-queue replay: pass clientPunchId for dedupe, punchTime for original timestamp.
router.post('/clock-in', authenticate, async (req, res) => {
  try {
    const { stationId, clientPunchId, punchTime } = req.body;
    const empId = req.user.id;

    // Dedupe: if this client punch was already processed, return it (idempotent replay)
    const existing = await findExistingPunch(req.user.businessId, empId, clientPunchId);
    if (existing) return res.json({ action: 'clock_in', entry: existing, deduped: true });

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

    // Use client punch time if valid (for offline replay), else server NOW()
    const punchTs = resolvePunchTime(punchTime);
    const { rows: entry } = await pool.query(
      `INSERT INTO time_entries (business_id, employee_id, shift_id, station_id, clock_in, clock_in_method, client_punch_id)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6, $7) RETURNING *`,
      [req.user.businessId, empId, shiftRows[0]?.id || null, stationId || null,
       punchTs, punchTs ? 'manual_offline' : 'manual', clientPunchId || null]
    );

    res.json({ action: 'clock_in', entry: entry[0] });
  } catch (err) {
    console.error('Clock in error:', err);
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

// ── POST /api/time/clock-out — Manual clock out ──
// Supports offline-queue replay via punchTime.
router.post('/clock-out', authenticate, async (req, res) => {
  try {
    const { punchTime } = req.body;
    const { rows: open } = await pool.query(
      'SELECT id FROM time_entries WHERE employee_id = $1 AND business_id = $2 AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
      [req.user.id, req.user.businessId]
    );
    if (open.length === 0) return res.status(400).json({ error: 'Not clocked in' });

    const punchTs = resolvePunchTime(punchTime);
    await pool.query(
      'UPDATE time_entries SET clock_out = COALESCE($2::timestamptz, NOW()) WHERE id = $1',
      [open[0].id, punchTs]
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



// ─────────────────────────────────────────────────────────
// ── BADGE PRINTING (PDF) ──
// ─────────────────────────────────────────────────────────

// ── GET /api/time/badges-pdf — Generate a printable PDF of employee QR badges ──
// Uses pdfkit. 4 badges per page. Admin can print and laminate these.
router.get('/badges-pdf', authenticate, requireAdmin, async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const QRCode = require('qrcode');

    const { rows: employees } = await pool.query(
      `SELECT id, first_name, last_name, business_id FROM employees
       WHERE business_id = $1 AND active = true
       ORDER BY last_name, first_name`,
      [req.user.businessId]
    );

    const { rows: bizRows } = await pool.query(
      'SELECT name FROM businesses WHERE id = $1',
      [req.user.businessId]
    );
    const bizName = bizRows[0]?.name || 'CrewCAST';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="crewcast-badges.pdf"');

    const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
    doc.pipe(res);

    // Layout: 2 columns x 2 rows = 4 badges per page
    const pageW = 612 - 72; // letter width minus margins
    const pageH = 792 - 72;
    const badgeW = pageW / 2 - 10;
    const badgeH = pageH / 2 - 10;

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const idx = i % 4;
      if (i > 0 && idx === 0) doc.addPage();

      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 36 + col * (badgeW + 20);
      const y = 36 + row * (badgeH + 20);

      // Badge border
      doc.lineWidth(1).rect(x, y, badgeW, badgeH).stroke();

      // Header
      doc.fontSize(10).fillColor('#666').text(bizName, x + 12, y + 10, { width: badgeW - 24, align: 'center' });
      doc.fontSize(16).fillColor('#000').text(`${emp.first_name} ${emp.last_name}`,
        x + 12, y + 28, { width: badgeW - 24, align: 'center' });

      // QR code
      const payload = generateQRPayload(emp.id, emp.business_id);
      const qrDataUrl = await QRCode.toDataURL(payload, { margin: 0, width: 160 });
      const qrBuf = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      doc.image(qrBuf, x + (badgeW - 160) / 2, y + 55, { width: 160, height: 160 });

      // Footer: employee ID + instruction
      doc.fontSize(9).fillColor('#666')
        .text(`ID ${emp.id}`, x + 12, y + badgeH - 28, { width: badgeW - 24, align: 'center' })
        .text('Show to kiosk scanner', x + 12, y + badgeH - 16, { width: badgeW - 24, align: 'center' });
    }

    doc.end();
  } catch (err) {
    console.error('Badges PDF error:', err);
    res.status(500).json({ error: 'Failed to generate badges PDF: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────
// ── WHEN I WORK RECONCILIATION ──
// ─────────────────────────────────────────────────────────

// Parse a CSV row respecting quoted fields
function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

// Normalize a phone number to just digits
function normPhone(s) {
  return (s || '').replace(/\D/g, '').slice(-10);
}

// Normalize a name for matching
function normName(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// ── POST /api/time/reconcile — Compare CrewCAST hours vs WIW CSV ──
// Body: { csv: "<raw csv text>", startDate: "2026-05-02", endDate: "2026-05-03" }
router.post('/reconcile', authenticate, requireAdmin, async (req, res) => {
  try {
    const { csv, startDate, endDate } = req.body;
    if (!csv || !startDate || !endDate) {
      return res.status(400).json({ error: 'csv, startDate, endDate required' });
    }

    // Parse WIW CSV
    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return res.status(400).json({ error: 'CSV has no data rows' });

    const header = parseCSVLine(lines[0]).map(h => h.trim());
    const colIdx = (...names) => {
      for (const n of names) {
        const i = header.findIndex(h => h.toLowerCase() === n.toLowerCase());
        if (i >= 0) return i;
      }
      return -1;
    };
    const iFirst = colIdx('First Name', 'first_name', 'FirstName');
    const iLast = colIdx('Last Name', 'last_name', 'LastName');
    const iPhone = colIdx('Phone', 'phone', 'Phone Number');
    const iDate = colIdx('Date', 'date');
    const iHours = colIdx('Total Hours', 'Hours', 'hours', 'total_hours');
    const iClockIn = colIdx('Clock In', 'clock_in');
    const iClockOut = colIdx('Clock Out', 'clock_out');

    if (iFirst < 0 || iLast < 0 || iDate < 0 || iHours < 0) {
      return res.status(400).json({
        error: 'CSV missing required columns (First Name, Last Name, Date, Total Hours)',
        headerFound: header
      });
    }

    // Aggregate WIW hours per (employee, date)
    const wiwByKey = new Map();
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 2) continue;
      const first = normName(row[iFirst]);
      const last = normName(row[iLast]);
      const phone = iPhone >= 0 ? normPhone(row[iPhone]) : '';
      const date = (row[iDate] || '').trim();
      const hours = parseFloat(row[iHours]) || 0;
      const clockIn = iClockIn >= 0 ? row[iClockIn] : '';
      const clockOut = iClockOut >= 0 ? row[iClockOut] : '';
      const key = `${phone}|${first}|${last}|${date}`;
      if (!wiwByKey.has(key)) {
        wiwByKey.set(key, { first, last, phone, date, hours: 0, shifts: 0, clockIn, clockOut });
      }
      const agg = wiwByKey.get(key);
      agg.hours += hours;
      agg.shifts += 1;
    }

    // Load CrewCAST time entries in the window, joined to employees
    const { rows: ccEntries } = await pool.query(
      `SELECT te.*, e.first_name, e.last_name, e.phone
       FROM time_entries te
       JOIN employees e ON te.employee_id = e.id
       WHERE te.business_id = $1
         AND te.clock_in::date >= $2 AND te.clock_in::date <= $3
       ORDER BY te.clock_in`,
      [req.user.businessId, startDate, endDate]
    );

    // Aggregate CC hours per (employee, date)
    const ccByKey = new Map();
    for (const e of ccEntries) {
      const first = normName(e.first_name);
      const last = normName(e.last_name);
      const phone = normPhone(e.phone);
      const date = new Date(e.clock_in).toISOString().split('T')[0];
      const hours = e.clock_out
        ? (new Date(e.clock_out) - new Date(e.clock_in)) / 3600000
        : 0;
      const key = `${phone}|${first}|${last}|${date}`;
      if (!ccByKey.has(key)) {
        ccByKey.set(key, { first, last, phone, date, hours: 0, shifts: 0, openShifts: 0 });
      }
      const agg = ccByKey.get(key);
      agg.hours += hours;
      agg.shifts += 1;
      if (!e.clock_out) agg.openShifts += 1;
    }

    // Build reconciliation rows
    const allKeys = new Set([...wiwByKey.keys(), ...ccByKey.keys()]);
    const rows = [];
    let totalWiw = 0, totalCc = 0, matches = 0, mismatches = 0;
    let wiwOnly = 0, ccOnly = 0;

    for (const k of allKeys) {
      const wiw = wiwByKey.get(k);
      const cc = ccByKey.get(k);
      const first = (wiw || cc).first;
      const last = (wiw || cc).last;
      const phone = (wiw || cc).phone;
      const date = (wiw || cc).date;
      const wiwHours = wiw ? wiw.hours : 0;
      const ccHours = cc ? cc.hours : 0;
      const diff = ccHours - wiwHours;
      const pctDiff = wiwHours > 0 ? Math.abs(diff) / wiwHours * 100 : (ccHours > 0 ? 100 : 0);

      let status = 'match';
      let reason = '';
      if (!wiw) { status = 'cc_only'; reason = 'No WIW record for this shift'; ccOnly++; }
      else if (!cc) { status = 'wiw_only'; reason = 'No CrewCAST clock-in recorded'; wiwOnly++; }
      else if (Math.abs(diff) < 0.1) { status = 'match'; matches++; }
      else if (pctDiff < 2) { status = 'close'; reason = `Within 2% (${pctDiff.toFixed(1)}%)`; matches++; }
      else { status = 'mismatch'; reason = `${pctDiff.toFixed(1)}% off (${diff > 0 ? '+' : ''}${diff.toFixed(2)}h)`; mismatches++; }

      if (cc && cc.openShifts > 0) { reason += (reason ? '; ' : '') + `${cc.openShifts} open shift(s) in CrewCAST`; }

      totalWiw += wiwHours;
      totalCc += ccHours;
      rows.push({
        firstName: first, lastName: last, phone, date,
        wiwHours: Number(wiwHours.toFixed(2)),
        ccHours: Number(ccHours.toFixed(2)),
        diff: Number(diff.toFixed(2)),
        pctDiff: Number(pctDiff.toFixed(1)),
        status, reason
      });
    }

    rows.sort((a, b) => {
      const order = { mismatch: 0, wiw_only: 1, cc_only: 2, close: 3, match: 4 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return a.lastName.localeCompare(b.lastName);
    });

    const summary = {
      totalWiwHours: Number(totalWiw.toFixed(2)),
      totalCcHours: Number(totalCc.toFixed(2)),
      totalDiff: Number((totalCc - totalWiw).toFixed(2)),
      totalPctDiff: totalWiw > 0 ? Number((Math.abs(totalCc - totalWiw) / totalWiw * 100).toFixed(2)) : 0,
      matches,
      mismatches,
      wiwOnly,
      ccOnly,
      totalShifts: rows.length
    };

    res.json({ summary, rows });
  } catch (err) {
    console.error('Reconcile error:', err);
    res.status(500).json({ error: 'Reconcile failed: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────
// ── LATE / NO-SHOW DETECTION + PUSH ALERTS ──
// ─────────────────────────────────────────────────────────

// ── GET /api/time/late-check — Returns currently late/no-show shifts, optionally pushes alerts ──
// Admin can poll this, or a cron job can hit it with ?notify=1 to trigger push notifications to Steve.
router.get('/late-check', authenticate, requireAdmin, async (req, res) => {
  try {
    const { notify } = req.query;
    const lateThreshold = 15; // minutes late
    const noShowThreshold = 60; // minutes late = no-show

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Find shifts today that should have started, where the employee is not clocked in
    const { rows: shifts } = await pool.query(
      `SELECT s.id as shift_id, s.employee_id, s.start_time, s.station,
              e.first_name, e.last_name
       FROM shifts s
       JOIN schedules sc ON s.schedule_id = sc.id
       JOIN employees e ON s.employee_id = e.id
       WHERE sc.business_id = $1 AND s.date = $2
         AND NOT EXISTS (
           SELECT 1 FROM time_entries te
           WHERE te.shift_id = s.id OR (te.employee_id = s.employee_id AND te.clock_in::date = $2)
         )`,
      [req.user.businessId, today]
    );

    const late = [];
    const noShow = [];
    for (const s of shifts) {
      if (!s.start_time) continue;
      const [h, m] = s.start_time.split(':').map(Number);
      const shiftStart = new Date(now);
      shiftStart.setHours(h, m, 0, 0);
      const minsLate = Math.round((now - shiftStart) / 60000);
      if (minsLate > noShowThreshold) {
        noShow.push({ ...s, minutesLate: minsLate });
      } else if (minsLate > lateThreshold) {
        late.push({ ...s, minutesLate: minsLate });
      }
    }

    // If notify=1, send push notification to all admins
    let pushed = 0;
    if (notify === '1' && (late.length > 0 || noShow.length > 0)) {
      try {
        const webpush = require('web-push');
        const { rows: subs } = await pool.query(
          `SELECT ps.* FROM push_subscriptions ps
           JOIN employees e ON ps.employee_id = e.id
           WHERE e.business_id = $1 AND (e.role = 'admin' OR e.role = 'owner')`,
          [req.user.businessId]
        );
        const title = noShow.length > 0
          ? `${noShow.length} no-show${noShow.length > 1 ? 's' : ''}, ${late.length} late`
          : `${late.length} employee${late.length > 1 ? 's' : ''} running late`;
        const bodyLines = [
          ...noShow.slice(0, 3).map(s => `NO-SHOW: ${s.first_name} ${s.last_name} (${s.station || 'unassigned'})`),
          ...late.slice(0, 3).map(s => `LATE: ${s.first_name} ${s.last_name} ${s.minutesLate}m`)
        ];
        const payload = JSON.stringify({
          title,
          body: bodyLines.join('\n'),
          url: '/admin/time-dashboard'
        });
        for (const sub of subs) {
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            }, payload);
            pushed++;
          } catch (e) {
            console.error('Push send failed:', e.message);
          }
        }
      } catch (e) {
        console.error('Push notify error:', e.message);
      }
    }

    res.json({
      checkedAt: now.toISOString(),
      lateCount: late.length,
      noShowCount: noShow.length,
      late,
      noShow,
      pushedTo: pushed
    });
  } catch (err) {
    console.error('Late check error:', err);
    res.status(500).json({ error: 'Late check failed: ' + err.message });
  }
});

module.exports = router;
