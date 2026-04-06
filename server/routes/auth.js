// ═══════════════════════════════════════════════════════
// CrewCast — Auth Routes
// Phone + PIN login, invite token setup
// ═══════════════════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/login ──
// Login with phone + PIN
router.post('/login', async (req, res) => {
  try {
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
      WHERE e.active = true
    `;
    const params = [];

    if (businessSlug) {
      params.push(businessSlug);
      query += ` AND b.slug = $${params.length}`;
    }

    const { rows: employees } = await pool.query(query, params);

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
    await pool.query(`
      INSERT INTO sessions (employee_id, token, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '30 days')
    `, [employee.id, token]);

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
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/auth/setup ──
// First-time setup via invite token — set your PIN
router.post('/setup', async (req, res) => {
  try {
    const { inviteToken, pin } = req.body;
    if (!inviteToken || !pin) {
      return res.status(400).json({ error: 'Invite token and PIN required' });
    }

    if (pin.length < 4 || pin.length > 6) {
      return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    }

    const { rows } = await pool.query(`
      SELECT e.*, b.slug as business_slug, b.name as business_name
      FROM employees e
      JOIN businesses b ON e.business_id = b.id
      WHERE e.invite_token = $1 AND e.active = true
    `, [inviteToken]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invalid invite link' });
    }

    const employee = rows[0];

    // Hash and save PIN
    const pinHash = bcrypt.hashSync(pin, 10);
    await pool.query('UPDATE employees SET pin_hash = $1 WHERE id = $2', [pinHash, employee.id]);

    // Create session
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(`
      INSERT INTO sessions (employee_id, token, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '30 days')
    `, [employee.id, token]);

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
  } catch (err) {
    console.error('Setup error:', err);
    res.status(500).json({ error: 'Setup failed' });
  }
});

// ── POST /api/auth/register ──
// New business signup — creates business + admin account
router.post('/register', async (req, res) => {
  try {
    const { businessName, firstName, lastName, phone, email, pin } = req.body;

    if (!businessName || !firstName || !lastName || !phone || !pin) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (pin.length < 4 || pin.length > 6) {
      return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    }

    const digits = phone.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) {
      return res.status(400).json({ error: 'Enter a valid 10-digit phone number' });
    }

    // Generate slug from business name
    let slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    // Check uniqueness, append random suffix if needed
    const { rows: existing } = await pool.query('SELECT id FROM businesses WHERE slug = $1', [slug]);
    if (existing.length > 0) {
      slug += '-' + crypto.randomBytes(3).toString('hex');
    }

    // Create business
    const { rows: bizRows } = await pool.query(`
      INSERT INTO businesses (name, slug, owner_name, owner_phone, owner_email)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [businessName, slug, `${firstName} ${lastName}`, digits, email || null]);

    const businessId = bizRows[0].id;

    // Create admin employee
    const pinHash = bcrypt.hashSync(pin, 10);
    const { rows: empRows } = await pool.query(`
      INSERT INTO employees (business_id, first_name, last_name, phone, pin_hash, role)
      VALUES ($1, $2, $3, $4, $5, 'admin')
      RETURNING id
    `, [businessId, firstName, lastName, digits, pinHash]);

    const employeeId = empRows[0].id;

    // Create session
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(`
      INSERT INTO sessions (employee_id, token, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '30 days')
    `, [employeeId, token]);

    res.json({
      token,
      user: {
        id: employeeId,
        firstName,
        lastName,
        phone: digits,
        role: 'admin',
        businessId,
        businessName,
        businessSlug: slug,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === '23505' && err.constraint === 'employees_business_id_phone_key') {
      return res.status(400).json({ error: 'This phone number is already registered' });
    }
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── GET /api/auth/me ──
// Get current user info
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ── POST /api/auth/logout ──
router.post('/logout', authenticate, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
