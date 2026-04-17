// ═══════════════════════════════════════════════════════
// CrewCast — SMS Routes (Twilio)
// Bulk invite, shift reminders, fallback notifications
// ═══════════════════════════════════════════════════════

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pool } = require('../db');

const router = express.Router();

// ── Twilio client (lazy init) ──
let twilioClient = null;
function getTwilio() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

function getTwilioFrom() {
  return process.env.TWILIO_FROM_NUMBER || '';
}

// ── GET /api/sms/status ──
// Check if Twilio is configured
router.get('/status', authenticate, requireAdmin, (req, res) => {
  const configured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
  res.json({ configured });
});

// ── POST /api/sms/send-invite ──
// Send invite SMS to a single employee
router.post('/send-invite', authenticate, requireAdmin, async (req, res) => {
  try {
    const { employeeId } = req.body;
    const twilio = getTwilio();
    if (!twilio) return res.status(400).json({ error: 'SMS not configured. Add Twilio credentials in environment variables.' });

    const { rows } = await pool.query(
      `SELECT e.*, b.name as business_name, b.slug as business_slug
       FROM employees e JOIN businesses b ON e.business_id = b.id
       WHERE e.id = $1 AND e.business_id = $2`,
      [employeeId, req.user.businessId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Employee not found' });

    const emp = rows[0];
    if (emp.pin_hash) return res.json({ skipped: true, reason: 'Already set up' });
    if (!emp.phone) return res.json({ skipped: true, reason: 'No phone number' });

    const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;
    const joinUrl = `${baseUrl}/join/${emp.business_slug}`;

    await twilio.messages.create({
      body: `${emp.business_name} uses CrewCast for scheduling! Set up your account: ${joinUrl}\n\nUse this link on your phone to view shifts, clock in, and more.`,
      from: getTwilioFrom(),
      to: '+1' + emp.phone.replace(/\D/g, '').slice(-10),
    });

    // Track that we sent an invite SMS
    await pool.query(
      `UPDATE employees SET settings = jsonb_set(COALESCE(settings, '{}'), '{inviteSentAt}', to_jsonb(NOW()::text)) WHERE id = $1`,
      [emp.id]
    ).catch(() => {}); // settings column may not exist yet, that's ok

    res.json({ sent: true, to: emp.first_name });
  } catch (err) {
    console.error('Send invite error:', err);
    res.status(500).json({ error: 'Failed to send SMS: ' + err.message });
  }
});

// ── POST /api/sms/send-bulk-invites ──
// Send invite SMS to all employees who haven't set up yet
router.post('/send-bulk-invites', authenticate, requireAdmin, async (req, res) => {
  try {
    const twilio = getTwilio();
    if (!twilio) return res.status(400).json({ error: 'SMS not configured. Add Twilio credentials in environment variables.' });

    const { rows: employees } = await pool.query(
      `SELECT e.*, b.name as business_name, b.slug as business_slug
       FROM employees e JOIN businesses b ON e.business_id = b.id
       WHERE e.business_id = $1 AND e.active = true AND e.pin_hash IS NULL AND e.phone IS NOT NULL`,
      [req.user.businessId]
    );

    if (employees.length === 0) return res.json({ sent: 0, message: 'All employees are already set up!' });

    const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;
    let sent = 0, failed = 0, skipped = 0;
    const errors = [];

    for (const emp of employees) {
      const digits = emp.phone.replace(/\D/g, '').slice(-10);
      if (digits.length !== 10) { skipped++; continue; }

      const joinUrl = `${baseUrl}/join/${emp.business_slug}`;
      try {
        await twilio.messages.create({
          body: `${emp.business_name} uses CrewCast for scheduling! Set up your account: ${joinUrl}\n\nUse this link on your phone to view shifts, clock in, and more.`,
          from: getTwilioFrom(),
          to: '+1' + digits,
        });
        sent++;
      } catch (e) {
        failed++;
        errors.push(`${emp.first_name} ${emp.last_name}: ${e.message}`);
      }
    }

    res.json({ sent, failed, skipped, total: employees.length, errors: errors.slice(0, 10) });
  } catch (err) {
    console.error('Bulk invite error:', err);
    res.status(500).json({ error: 'Bulk invite failed: ' + err.message });
  }
});

// ── POST /api/sms/notify ──
// Send an SMS notification (shift reminder, schedule published, etc.)
// Falls back to SMS when push not available
router.post('/notify', authenticate, requireAdmin, async (req, res) => {
  try {
    const { employeeIds, message } = req.body;
    const twilio = getTwilio();
    if (!twilio) return res.status(400).json({ error: 'SMS not configured' });
    if (!message) return res.status(400).json({ error: 'Message required' });
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'No employees specified' });
    }

    const { rows: employees } = await pool.query(
      `SELECT id, first_name, last_name, phone FROM employees
       WHERE id = ANY($1) AND business_id = $2 AND active = true`,
      [employeeIds, req.user.businessId]
    );

    let sent = 0, failed = 0;
    for (const emp of employees) {
      const digits = emp.phone?.replace(/\D/g, '').slice(-10);
      if (!digits || digits.length !== 10) continue;

      try {
        await twilio.messages.create({
          body: message,
          from: getTwilioFrom(),
          to: '+1' + digits,
        });
        sent++;
      } catch (e) {
        failed++;
      }
    }

    res.json({ sent, failed, total: employees.length });
  } catch (err) {
    console.error('SMS notify error:', err);
    res.status(500).json({ error: 'Notification failed' });
  }
});

// ── GET /api/sms/invite-csv ──
// Download CSV of all employees with invite links (no Twilio needed)
router.get('/invite-csv', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.first_name, e.last_name, e.phone, e.invite_token,
              (e.pin_hash IS NOT NULL) as has_setup, b.slug as business_slug
       FROM employees e JOIN businesses b ON e.business_id = b.id
       WHERE e.business_id = $1 AND e.active = true
       ORDER BY e.last_name, e.first_name`,
      [req.user.businessId]
    );

    const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;
    let csv = 'First Name,Last Name,Phone,Status,Invite Link\n';
    for (const emp of rows) {
      const status = emp.has_setup ? 'Active' : 'Pending';
      const inviteUrl = emp.invite_token ? `${baseUrl}/invite/${emp.invite_token}` : '';
      const phone = emp.phone || '';
      csv += `"${emp.first_name}","${emp.last_name}","${phone}","${status}","${inviteUrl}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=crewcast-invites.csv');
    res.send(csv);
  } catch (err) {
    console.error('Invite CSV error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ── GET /api/sms/onboard-stats ──
// Onboarding progress stats
router.get('/onboard-stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE pin_hash IS NOT NULL) as setup_complete,
        COUNT(*) FILTER (WHERE pin_hash IS NULL) as pending,
        COUNT(*) FILTER (WHERE phone IS NULL OR phone = '') as no_phone
      FROM employees
      WHERE business_id = $1 AND active = true AND role != 'admin'
    `, [req.user.businessId]);

    res.json(rows[0]);
  } catch (err) {
    console.error('Onboard stats error:', err);
    res.status(500).json({ error: 'Stats failed' });
  }
});

module.exports = router;
