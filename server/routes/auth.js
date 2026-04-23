// ═══════════════════════════════════════════════════════
// CrewCast — Auth Routes
// Phone-only for personal devices (magic link), PIN for admin + kiosk
// ═══════════════════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── Session lifetime ──
// 1 year for all new sessions. Refreshed to "1 year from now" on every app open.
const SESSION_TTL_SQL = "NOW() + INTERVAL '1 year'";

// ── Helper: build the user payload returned to the client ──
function userPayload(employee) {
  return {
    id: employee.id,
    firstName: employee.first_name,
    lastName: employee.last_name,
    phone: employee.phone,
    role: employee.role,
    businessId: employee.business_id,
    businessName: employee.business_name,
    businessSlug: employee.business_slug,
  };
}

// ── Helper: create a session row and return the opaque token ──
async function createSession(employeeId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (employee_id, token, expires_at)
     VALUES ($1, $2, ${SESSION_TTL_SQL})`,
    [employeeId, token]
  );
  return token;
}

// ── Helper: last-10-digits phone matcher ──
function digits10(phone) {
  return (phone || '').replace(/\D/g, '').slice(-10);
}

// ── Helper: lazy Twilio client ──
function getTwilio() {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return null;
}

// ── POST /api/auth/login ──
// Phone + PIN login. Used for:
//   - Admin / owner logins (higher-privilege accounts still require PIN)
//   - Kiosk mode (shared device clock-in). Pass deviceType: 'kiosk'.
// Regular employees on personal devices should use POST /magic-link instead.
router.post('/login', async (req, res) => {
  try {
    const { phone, pin, businessSlug, deviceType } = req.body;
    if (!phone || !pin) {
      return res.status(400).json({ error: 'Phone and PIN required' });
    }

    const digits = digits10(phone);

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
    const employee = employees.find(e => digits10(e.phone) === digits);

    if (!employee) {
      return res.status(401).json({ error: 'Phone number not found' });
    }

    if (!employee.pin_hash) {
      return res.status(401).json({ error: 'PIN not set for this account.' });
    }

    if (!bcrypt.compareSync(pin, employee.pin_hash)) {
      return res.status(401).json({ error: 'Incorrect PIN' });
    }

    // Personal-device employees shouldn't be here — nudge them to magic link.
    // Admins/owners bypass this (PIN is required for higher-privilege accounts).
    const isPrivileged = employee.role === 'admin' || employee.role === 'owner';
    if (!isPrivileged && deviceType !== 'kiosk') {
      return res.status(400).json({
        error: 'Use the "Text me a link" option to sign in on your phone.',
        useMagicLink: true,
      });
    }

    const token = await createSession(employee.id);
    res.json({ token, user: userPayload(employee) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/auth/setup ──
// First-time setup via invite token. PIN is optional (kept around only for
// admin-initiated kiosk-capable accounts). For normal employees: no PIN, no
// friction — invite token in, session out.
router.post('/setup', async (req, res) => {
  try {
    const { inviteToken, pin } = req.body;
    if (!inviteToken) {
      return res.status(400).json({ error: 'Invite token required' });
    }

    if (pin && (pin.length < 4 || pin.length > 6)) {
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

    // Optional PIN (only if the employee chose to set one up for kiosk use).
    if (pin) {
      const pinHash = bcrypt.hashSync(pin, 10);
      await pool.query('UPDATE employees SET pin_hash = $1 WHERE id = $2', [pinHash, employee.id]);
    }

    const token = await createSession(employee.id);
    res.json({ token, user: userPayload(employee) });
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

    // Save initial settings with contact info from registration
    const initialSettings = {
      businessName,
      contactName: `${firstName} ${lastName}`,
      contactPhone: digits,
      contactEmail: email || null,
    };
    await pool.query('UPDATE businesses SET settings = $1 WHERE id = $2', [
      JSON.stringify(initialSettings),
      businessId,
    ]);

    // Create admin employee
    const pinHash = bcrypt.hashSync(pin, 10);
    const { rows: empRows } = await pool.query(`
      INSERT INTO employees (business_id, first_name, last_name, phone, pin_hash, role)
      VALUES ($1, $2, $3, $4, $5, 'admin')
      RETURNING id
    `, [businessId, firstName, lastName, digits, pinHash]);

    const employeeId = empRows[0].id;

    // Create session
    const token = await createSession(employeeId);

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

// ── POST /api/auth/join-lookup ──
// QR / invite-link join page: employee enters phone → find them, return invite
// token so the client can complete /setup without a PIN.
router.post('/join-lookup', async (req, res) => {
  try {
    const { phone, businessSlug } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    const digits = digits10(phone);
    if (digits.length !== 10) return res.status(400).json({ error: 'Enter a valid 10-digit phone number' });

    let query = `
      SELECT e.id, e.first_name, e.last_name, e.phone, e.pin_hash, e.invite_token
      FROM employees e
      JOIN businesses b ON e.business_id = b.id
      WHERE e.active = true
    `;
    const params = [];
    if (businessSlug) {
      params.push(businessSlug);
      query += ` AND b.slug = $${params.length}`;
    }

    const { rows } = await pool.query(query, params);
    const employee = rows.find(e => digits10(e.phone) === digits);

    if (!employee) {
      return res.status(404).json({ error: 'Phone number not found. Check with your manager that you\'ve been added to the system.' });
    }

    res.json({
      firstName: employee.first_name,
      inviteToken: employee.invite_token,
    });
  } catch (err) {
    console.error('Join lookup error:', err);
    res.status(500).json({ error: 'Lookup failed' });
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

// ─────────────────────────────────────────────────────────────
// Magic-link auth (phone-only login for personal devices)
// ─────────────────────────────────────────────────────────────

// ── POST /api/auth/magic-link ──
// Employee enters their phone; we text them a single-use /m/:token URL.
// Rate-limited to 3 requests per phone per hour.
router.post('/magic-link', async (req, res) => {
  try {
    const { phone, businessSlug } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    const digits = digits10(phone);
    if (digits.length !== 10) {
      return res.status(400).json({ error: 'Enter a valid 10-digit phone number' });
    }

    // Find employee
    let query = `
      SELECT e.id, e.first_name, e.phone, b.name as business_name, b.slug as business_slug
      FROM employees e
      JOIN businesses b ON e.business_id = b.id
      WHERE e.active = true
    `;
    const params = [];
    if (businessSlug) {
      params.push(businessSlug);
      query += ` AND b.slug = $${params.length}`;
    }

    const { rows } = await pool.query(query, params);
    const employee = rows.find(e => digits10(e.phone) === digits);

    // Always return the same success response even if not found — avoids
    // leaking which phone numbers are in the system. SMS just won't arrive.
    const genericOk = { sent: true };

    if (!employee) return res.json(genericOk);

    // Rate limit: max 3 requests per employee per hour
    const { rows: recent } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM magic_tokens
       WHERE employee_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [employee.id]
    );
    if (recent[0].n >= 3) {
      return res.status(429).json({
        error: 'Too many link requests. Try again in an hour.',
      });
    }

    // Generate + store token (15-min TTL)
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO magic_tokens (employee_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
      [employee.id, token]
    );

    // Send SMS (if Twilio is configured)
    const twilio = getTwilio();
    if (twilio && process.env.TWILIO_FROM_NUMBER) {
      const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;
      const link = `${baseUrl}/m/${token}`;
      try {
        await twilio.messages.create({
          body: `${employee.business_name} CrewCast sign-in link (expires in 15 min): ${link}`,
          from: process.env.TWILIO_FROM_NUMBER,
          to: '+1' + digits,
        });
      } catch (smsErr) {
        console.error('Magic-link SMS failed:', smsErr.message);
        // Don't leak SMS errors to the client — the token is already stored.
      }
    } else {
      // Dev mode: log the link so we can click it manually.
      console.log(`[magic-link] Dev mode — no Twilio. Link: /m/${token}`);
    }

    res.json(genericOk);
  } catch (err) {
    console.error('Magic-link error:', err);
    res.status(500).json({ error: 'Could not send link' });
  }
});

// ── POST /api/auth/magic-consume ──
// Client calls this after loading /m/:token. Validates + burns the token,
// returns a fresh session.
router.post('/magic-consume', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    // Fetch + validate token (single-query race-safe consume)
    const { rows } = await pool.query(
      `UPDATE magic_tokens
       SET used_at = NOW()
       WHERE token = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       RETURNING employee_id`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'This link has expired or already been used. Request a new one.' });
    }

    const employeeId = rows[0].employee_id;

    // Load employee profile for session response
    const { rows: empRows } = await pool.query(
      `SELECT e.*, b.slug as business_slug, b.name as business_name
       FROM employees e JOIN businesses b ON e.business_id = b.id
       WHERE e.id = $1 AND e.active = true`,
      [employeeId]
    );
    if (empRows.length === 0) {
      return res.status(401).json({ error: 'Account not active' });
    }

    const sessionToken = await createSession(employeeId);
    res.json({ token: sessionToken, user: userPayload(empRows[0]) });
  } catch (err) {
    console.error('Magic-consume error:', err);
    res.status(500).json({ error: 'Sign-in failed' });
  }
});

// ── POST /api/auth/refresh ──
// Extends the current session to 1 year from now. Called on app open so
// active users keep a rolling 1-year window.
router.post('/refresh', authenticate, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    await pool.query(
      `UPDATE sessions SET expires_at = ${SESSION_TTL_SQL} WHERE token = $1`,
      [token]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

module.exports = router;
