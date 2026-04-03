// ═══════════════════════════════════════════════════════
// CrewCast — Employee Routes (Admin)
// ═══════════════════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const { authenticate, requireAdmin } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// ── GET /api/employees ──
// List all employees for the business
router.get('/', authenticate, requireAdmin, (req, res) => {
  const employees = db.prepare(`
    SELECT id, first_name, last_name, phone, role, skills, active,
           pin_hash IS NOT NULL as has_pin, invite_token, created_at
    FROM employees
    WHERE business_id = ?
    ORDER BY last_name, first_name
  `).all(req.user.businessId);

  res.json(employees.map(e => ({
    id: e.id,
    firstName: e.first_name,
    lastName: e.last_name,
    phone: e.phone,
    role: e.role,
    skills: JSON.parse(e.skills || '{}'),
    active: !!e.active,
    hasPin: !!e.has_pin,
    inviteToken: e.invite_token,
    createdAt: e.created_at,
  })));
});

// ── POST /api/employees ──
// Add a new employee
router.post('/', authenticate, requireAdmin, (req, res) => {
  const { firstName, lastName, phone, role, skills } = req.body;
  if (!firstName || !lastName || !phone) {
    return res.status(400).json({ error: 'First name, last name, and phone required' });
  }

  const inviteToken = crypto.randomBytes(16).toString('hex');

  try {
    const result = db.prepare(`
      INSERT INTO employees (business_id, first_name, last_name, phone, role, skills, invite_token)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.businessId,
      firstName,
      lastName,
      phone,
      role || 'employee',
      JSON.stringify(skills || {}),
      inviteToken
    );

    res.json({
      id: result.lastInsertRowid,
      firstName,
      lastName,
      phone,
      role: role || 'employee',
      inviteToken,
      inviteUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/invite/${inviteToken}`,
    });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Employee with this phone already exists' });
    }
    throw err;
  }
});

// ── PUT /api/employees/:id ──
// Update employee
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const { firstName, lastName, phone, role, skills, active } = req.body;
  const emp = db.prepare('SELECT * FROM employees WHERE id = ? AND business_id = ?')
    .get(req.params.id, req.user.businessId);

  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  db.prepare(`
    UPDATE employees SET
      first_name = COALESCE(?, first_name),
      last_name = COALESCE(?, last_name),
      phone = COALESCE(?, phone),
      role = COALESCE(?, role),
      skills = COALESCE(?, skills),
      active = COALESCE(?, active)
    WHERE id = ?
  `).run(
    firstName || null,
    lastName || null,
    phone || null,
    role || null,
    skills ? JSON.stringify(skills) : null,
    active !== undefined ? (active ? 1 : 0) : null,
    req.params.id
  );

  res.json({ success: true });
});

// ── DELETE /api/employees/:id ──
// Deactivate employee (soft delete)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  db.prepare('UPDATE employees SET active = 0 WHERE id = ? AND business_id = ?')
    .run(req.params.id, req.user.businessId);
  res.json({ success: true });
});

// ── POST /api/employees/bulk ──
// Bulk import employees (from intake form JSON)
router.post('/bulk', authenticate, requireAdmin, (req, res) => {
  const { employees: empList } = req.body;
  if (!Array.isArray(empList)) {
    return res.status(400).json({ error: 'Expected array of employees' });
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO employees (business_id, first_name, last_name, phone, role, skills, invite_token)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const results = { added: 0, skipped: 0 };
  const insertMany = db.transaction((list) => {
    for (const emp of list) {
      const token = crypto.randomBytes(16).toString('hex');
      const r = insert.run(
        req.user.businessId,
        emp.firstName || emp.first_name,
        emp.lastName || emp.last_name,
        emp.phone,
        emp.role || 'employee',
        JSON.stringify(emp.skills || {}),
        token
      );
      if (r.changes > 0) results.added++;
      else results.skipped++;
    }
  });

  insertMany(empList);
  res.json(results);
});

module.exports = router;
