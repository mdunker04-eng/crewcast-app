// ═══════════════════════════════════════════════════════
// CrewCast — Employee Routes (Admin)
// ═══════════════════════════════════════════════════════

const express = require('express');
const crypto = require('crypto');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pool } = require('../db');

const router = express.Router();

// ── GET /api/employees ──
// List all employees for the business
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, first_name, last_name, phone, role, skills, active,
             (pin_hash IS NOT NULL) as has_pin, invite_token, created_at
      FROM employees
      WHERE business_id = $1
      ORDER BY last_name, first_name
    `, [req.user.businessId]);

    res.json(rows.map(e => ({
      id: e.id,
      firstName: e.first_name,
      lastName: e.last_name,
      phone: e.phone,
      role: e.role,
      skills: JSON.parse(e.skills || '{}'),
      active: e.active,
      hasPin: e.has_pin,
      inviteToken: e.invite_token,
      createdAt: e.created_at,
    })));
  } catch (err) {
    console.error('List employees error:', err);
    res.status(500).json({ error: 'Failed to list employees' });
  }
});

// ── POST /api/employees ──
// Add a new employee
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { firstName, lastName, phone, role, skills } = req.body;
    if (!firstName || !lastName || !phone) {
      return res.status(400).json({ error: 'First name, last name, and phone required' });
    }

    const inviteToken = crypto.randomBytes(16).toString('hex');

    const { rows } = await pool.query(`
      INSERT INTO employees (business_id, first_name, last_name, phone, role, skills, invite_token)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      req.user.businessId,
      firstName,
      lastName,
      phone,
      role || 'employee',
      JSON.stringify(skills || {}),
      inviteToken
    ]);

    res.json({
      id: rows[0].id,
      firstName,
      lastName,
      phone,
      role: role || 'employee',
      inviteToken,
      inviteUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/invite/${inviteToken}`,
    });
  } catch (err) {
    if (err.code === '23505') { // Postgres unique violation
      return res.status(409).json({ error: 'Employee with this phone already exists' });
    }
    console.error('Add employee error:', err);
    res.status(500).json({ error: 'Failed to add employee' });
  }
});

// ── PUT /api/employees/:id ──
// Update employee
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { firstName, lastName, phone, role, skills, active } = req.body;
    const { rows } = await pool.query(
      'SELECT * FROM employees WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Employee not found' });

    await pool.query(`
      UPDATE employees SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        role = COALESCE($4, role),
        skills = COALESCE($5, skills),
        active = COALESCE($6, active)
      WHERE id = $7
    `, [
      firstName || null,
      lastName || null,
      phone || null,
      role || null,
      skills ? JSON.stringify(skills) : null,
      active !== undefined ? active : null,
      req.params.id
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('Update employee error:', err);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// ── DELETE /api/employees/:id ──
// Deactivate employee (soft delete)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'UPDATE employees SET active = false WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Delete employee error:', err);
    res.status(500).json({ error: 'Failed to deactivate employee' });
  }
});

// ── POST /api/employees/bulk ──
// Bulk import employees (from intake form JSON)
router.post('/bulk', authenticate, requireAdmin, async (req, res) => {
  try {
    const { employees: empList } = req.body;
    if (!Array.isArray(empList)) {
      return res.status(400).json({ error: 'Expected array of employees' });
    }

    const client = await pool.connect();
    const results = { added: 0, skipped: 0 };

    try {
      await client.query('BEGIN');
      for (const emp of empList) {
        const token = crypto.randomBytes(16).toString('hex');
        try {
          await client.query(`
            INSERT INTO employees (business_id, first_name, last_name, phone, role, skills, invite_token)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            req.user.businessId,
            emp.firstName || emp.first_name,
            emp.lastName || emp.last_name,
            emp.phone,
            emp.role || 'employee',
            JSON.stringify(emp.skills || {}),
            token
          ]);
          results.added++;
        } catch (e) {
          if (e.code === '23505') {
            results.skipped++; // duplicate, skip
          } else {
            throw e;
          }
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json(results);
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Bulk import failed' });
  }
});

module.exports = router;
