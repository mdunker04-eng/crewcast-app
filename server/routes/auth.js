// ═══════════════════════════════════════════════════════
// CrewCast — Auth Routes
// Phone + PIN login, invite token setup
// ═══════════════════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/login ──
// Login with phone + PIN
router.post('/login', (req, res) => {
  const { phone, pin, businessSlug } = req.body;
  if (!phone || !pin) {
    return res.status(400).json({ error: 'Phone and PIN required' });
  }

  const digits = phone.replace(/\D/g, '').slice(-10);

  // Find employee by phone (and optionally business)
  let query = `
    SELECT e.*, b.slug as business_slug, b.name as business_name
    FROM employees e
    JOIN businesses b ON e.business_id = b.id
    WHERE e.active = 1
  `;
  const params = [];

  if (businessSlug) {
    query += ' AND b.slug = ?';
    params.push(businessSlug);
  }

  const employees = db.prepare(query).all(...params);

  // Match by last 10 digits of phone
  const employee = employees.find(e => {
    const empDigits = e.phone.replace(/\D/g, '').slice(-10);
    return empDigits === digits;
  });

  if (!employee) {
    return res.status(401).json({ error: 'Phone number not found' });
  }

  if (!employee.pin_hash) {
    return res.status(401).json({ error: 'PIN not set. Use your invite link first.' });
  }

  if (!bcrypt.compareSync(pin, employee.pin_hash)) {
    return res.status(401).json({ error: 'Incorrect PIN' });
  }

  // Create session token
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`
    INSERT INTO sessions (employee_id, token, expires_at)
    VALUES (?, ?, datetime('now', '+30 days'))
  `).run(employee.id, token);

  res.json({
    token,
    user: {
      id: employee.id,
      firstName: employee.first_name,
      lastName: employee.last_name,
      phone: employee.phone,
      role: employee.role,
      businessId: employee.business_id,
      businessName: employee.business_name,
      businessSlug: employee.business_slug,
    },
  });
});

// ── POST /api/auth/setup ──
// First-time setup via invite token — set your PIN
router.post('/setup', (req, res) => {
  const { inviteToken, pin } = req.body;
  if (!inviteToken || !pin) {
    return res.status(400).json({ error: 'Invite token and PIN required' });
  }

  if (pin.length < 4 || pin.length > 6) {
    return res.status(400).json({ error: 'PIN must be 4-6 digits' });
  }

  const employee = db.prepare(`
    SELECT e.*, b.slug as business_slug, b.name as business_name
    FROM employees e
    JOIN businesses b ON e.business_id = b.id
    WHERE e.invite_token = ? AND e.active = 1
  `).get(inviteToken);

  if (!employee) {
    return res.status(404).json({ error: 'Invalid invite link' });
  }

  // Hash and save PIN
  const pinHash = bcrypt.hashSync(pin, 10);
  db.prepare('UPDATE employees SET pin_hash = ? WHERE id = ?').run(pinHash, employee.id);

  // Create session
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`
    INSERT INTO sessions (employee_id, token, expires_at)
    VALUES (?, ?, datetime('now', '+30 days'))
  `).run(employee.id, token);

  res.json({
    token,
    user: {
      id: employee.id,
      firstName: employee.first_name,
      lastName: employee.last_name,
      phone: employee.phone,
      role: employee.role,
      businessId: employee.business_id,
      businessName: employee.business_name,
      businessSlug: employee.business_slug,
    },
  });
});

// ── GET /api/auth/me ──
// Get current user info
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ── POST /api/auth/logout ──
router.post('/logout', authenticate, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ success: true });
});

module.exports = router;
