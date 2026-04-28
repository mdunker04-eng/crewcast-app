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
      SELECT e.id, e.first_name, e.last_name, e.phone, e.role, e.skills, e.active, e.rating,
             (e.pin_hash IS NOT NULL) as has_pin, e.invite_token, e.created_at,
             EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.employee_id = e.id) as has_push
      FROM employees e
      WHERE e.business_id = $1
      ORDER BY e.last_name, e.first_name
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
      hasPush: e.has_push,
      inviteToken: e.invite_token,
      rating: e.rating,
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

    // Auto-set 3-star rating in EVERY category for new employee
    const newEmpId = rows[0].id;
    try {
      const { rows: allCats } = await pool.query(
        'SELECT id FROM station_categories WHERE business_id = $1',
        [req.user.businessId]
      );
      for (const cat of allCats) {
        await pool.query(
          'INSERT INTO employee_category_ratings (employee_id, category_id, rating) VALUES ($1, $2, 3) ON CONFLICT DO NOTHING',
          [newEmpId, cat.id]
        );
      }
    } catch (e) { /* non-critical */ }

    res.json({
      id: newEmpId,
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
    const { firstName, lastName, phone, role, skills, active, rating } = req.body;
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
        active = COALESCE($6, active),
        rating = COALESCE($7, rating)
      WHERE id = $8
    `, [
      firstName || null,
      lastName || null,
      phone || null,
      role || null,
      skills ? JSON.stringify(skills) : null,
      active !== undefined ? active : null,
      rating !== undefined ? rating : null,
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

// ── POST /api/employees/:id/reactivate ──
// Re-enable a previously deactivated employee.
router.post('/:id/reactivate', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'UPDATE employees SET active = true WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Reactivate employee error:', err);
    res.status(500).json({ error: 'Failed to reactivate employee' });
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
    const results = { added: 0, skipped: 0, failed: 0, errors: [] };

    try {
      await client.query('BEGIN');
      for (const emp of empList) {
        const token = crypto.randomBytes(16).toString('hex');
        // Use a SAVEPOINT so a single bad row (missing phone, bad data, etc.)
        // doesn't abort the whole batch.
        await client.query('SAVEPOINT sp_emp');
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
          await client.query('RELEASE SAVEPOINT sp_emp');
          results.added++;
        } catch (e) {
          await client.query('ROLLBACK TO SAVEPOINT sp_emp');
          if (e.code === '23505') {
            results.skipped++; // duplicate, skip
          } else {
            results.failed++;
            results.errors.push({
              name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || '(unnamed)',
              phone: emp.phone || '(no phone)',
              reason: e.message || 'unknown error',
            });
          }
        }
      }
      // Auto-set 3-star rating in EVERY category for all newly added employees
      const { rows: allCats } = await client.query(
        'SELECT id FROM station_categories WHERE business_id = $1',
        [req.user.businessId]
      );
      if (allCats.length > 0 && results.added > 0) {
        // Backfill ratings for every active employee × every category (idempotent)
        const { rows: allEmps } = await client.query(
          'SELECT id FROM employees WHERE business_id = $1 AND active = true', [req.user.businessId]
        );
        for (const e of allEmps) {
          for (const cat of allCats) {
            await client.query(
              'INSERT INTO employee_category_ratings (employee_id, category_id, rating) VALUES ($1, $2, 3) ON CONFLICT (employee_id, category_id) DO NOTHING',
              [e.id, cat.id]
            );
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

// ══════════════════════════════════════
// EMPLOYEE SELF-SERVICE: MY STATION PREFERENCES
// (Must be before /:id routes so "me" isn't matched as :id)
// ══════════════════════════════════════

// ── GET /api/employees/me/station-preferences ──
router.get('/me/station-preferences', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT es.station_id, es.preferred, es.rank, s.name as station_name, s.description
      FROM employee_stations es
      JOIN stations s ON es.station_id = s.id
      WHERE es.employee_id = $1
      ORDER BY es.rank ASC, s.name
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error('Get my station prefs error:', err);
    res.status(500).json({ error: 'Failed to get station preferences' });
  }
});

// ── PUT /api/employees/me/station-preferences ──
router.put('/me/station-preferences', authenticate, async (req, res) => {
  try {
    const { stations } = req.body;
    if (!Array.isArray(stations)) {
      return res.status(400).json({ error: 'Expected array of station preferences' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM employee_stations WHERE employee_id = $1', [req.user.id]);
      for (const s of stations) {
        await client.query(`
          INSERT INTO employee_stations (employee_id, station_id, preferred, rank)
          VALUES ($1, $2, $3, $4)
        `, [req.user.id, s.stationId, s.rank <= 3, s.rank]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ success: true, count: stations.length });
  } catch (err) {
    console.error('Update my station prefs error:', err);
    res.status(500).json({ error: 'Failed to update station preferences' });
  }
});

// ══════════════════════════════════════
// EMPLOYEE-STATION SKILLS (Admin)
// ══════════════════════════════════════

// ── GET /api/employees/:id/stations ──
// Get which stations an employee is trained for
router.get('/:id/stations', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT es.*, s.name as station_name, s.description as station_description
      FROM employee_stations es
      JOIN stations s ON es.station_id = s.id
      WHERE es.employee_id = $1
      ORDER BY es.rank ASC NULLS LAST, s.name
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error('Get employee stations error:', err);
    res.status(500).json({ error: 'Failed to get employee stations' });
  }
});

// ── PUT /api/employees/:id/stations ──
// Update an employee's station assignments (replace all)
router.put('/:id/stations', authenticate, requireAdmin, async (req, res) => {
  try {
    const { stationIds } = req.body; // array of { stationId, preferred }
    if (!Array.isArray(stationIds)) {
      return res.status(400).json({ error: 'Expected array of station assignments' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Remove existing
      await client.query('DELETE FROM employee_stations WHERE employee_id = $1', [req.params.id]);
      // Add new
      for (const s of stationIds) {
        const stId = s.stationId || s;
        const pref = s.preferred || false;
        const rank = s.rank || null;
        await client.query(`
          INSERT INTO employee_stations (employee_id, station_id, preferred, rank)
          VALUES ($1, $2, $3, $4)
        `, [req.params.id, stId, pref, rank]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ success: true, count: stationIds.length });
  } catch (err) {
    console.error('Update employee stations error:', err);
    res.status(500).json({ error: 'Failed to update employee stations' });
  }
});

// ── GET /api/employees/by-station/:stationId ──
// Get all employees trained for a specific station
router.get('/by-station/:stationId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.id, e.first_name, e.last_name, e.phone, es.preferred, es.rank
      FROM employee_stations es
      JOIN employees e ON es.employee_id = e.id
      WHERE es.station_id = $1 AND e.business_id = $2 AND e.active = true
      ORDER BY es.rank ASC NULLS LAST, es.preferred DESC, e.last_name
    `, [req.params.stationId, req.user.businessId]);
    res.json(rows);
  } catch (err) {
    console.error('Get employees by station error:', err);
    res.status(500).json({ error: 'Failed to get employees' });
  }
});

// ══════════════════════════════════════
// STATION CATEGORIES & CATEGORY RATINGS
// ══════════════════════════════════════

// ── GET /api/employees/categories ──
// Get all station categories for the business
router.get('/categories/list', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sc.*,
        (SELECT json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name)
         FROM stations s WHERE s.category_id = sc.id AND s.active = true) as stations
      FROM station_categories sc
      WHERE sc.business_id = $1
      ORDER BY sc.sort_order, sc.name
    `, [req.user.businessId]);
    res.json(rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// ── GET /api/employees/:id/category-ratings ──
// Get category ratings for a specific employee
router.get('/:id/category-ratings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ecr.category_id, ecr.rating, sc.name as category_name, sc.icon
      FROM employee_category_ratings ecr
      JOIN station_categories sc ON ecr.category_id = sc.id
      WHERE ecr.employee_id = $1
      ORDER BY sc.sort_order
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error('Get category ratings error:', err);
    res.status(500).json({ error: 'Failed to get category ratings' });
  }
});

// ── PUT /api/employees/:id/category-ratings ──
// Set category rating for an employee
router.put('/:id/category-ratings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { categoryId, rating } = req.body;
    if (!categoryId) return res.status(400).json({ error: 'categoryId required' });

    if (rating === null || rating === 0) {
      await pool.query(
        'DELETE FROM employee_category_ratings WHERE employee_id = $1 AND category_id = $2',
        [req.params.id, categoryId]
      );
    } else {
      await pool.query(`
        INSERT INTO employee_category_ratings (employee_id, category_id, rating, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (employee_id, category_id) DO UPDATE SET rating = $3, updated_at = NOW()
      `, [req.params.id, categoryId, rating]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Set category rating error:', err);
    res.status(500).json({ error: 'Failed to set category rating' });
  }
});

// ── GET /api/employees/all-category-ratings ──
// Get all category ratings for all employees (for list view)
router.get('/all-ratings/list', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ecr.employee_id, ecr.category_id, ecr.rating, sc.name as category_name, sc.icon
      FROM employee_category_ratings ecr
      JOIN station_categories sc ON ecr.category_id = sc.id
      WHERE sc.business_id = $1
      ORDER BY sc.sort_order
    `, [req.user.businessId]);

    // Group by employee_id
    const byEmployee = {};
    for (const r of rows) {
      if (!byEmployee[r.employee_id]) byEmployee[r.employee_id] = [];
      byEmployee[r.employee_id].push(r);
    }
    res.json(byEmployee);
  } catch (err) {
    console.error('Get all ratings error:', err);
    res.status(500).json({ error: 'Failed to get ratings' });
  }
});

// ── PUT /api/employees/:id/station-rating ──
// Set per-station rating for an employee
router.put('/:id/station-rating', authenticate, requireAdmin, async (req, res) => {
  try {
    const { stationId, rating } = req.body;
    if (!stationId) return res.status(400).json({ error: 'stationId required' });

    if (rating === null || rating === undefined || rating === 0) {
      await pool.query(
        'UPDATE employee_stations SET rating = NULL WHERE employee_id = $1 AND station_id = $2',
        [req.params.id, stationId]
      );
    } else {
      await pool.query(
        'UPDATE employee_stations SET rating = $1 WHERE employee_id = $2 AND station_id = $3',
        [rating, req.params.id, stationId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Set station rating error:', err);
    res.status(500).json({ error: 'Failed to set station rating' });
  }
});

// ── PUT /api/employees/:id/pin-station ──
// Pin/unpin an employee to a specific station for auto-fill
router.put('/:id/pin-station', authenticate, requireAdmin, async (req, res) => {
  try {
    const { stationId, pinned } = req.body;
    if (!stationId) return res.status(400).json({ error: 'stationId required' });

    // Ensure employee_stations row exists
    const { rows } = await pool.query(
      'SELECT id FROM employee_stations WHERE employee_id = $1 AND station_id = $2',
      [req.params.id, stationId]
    );
    if (rows.length === 0) {
      // Create the association and pin
      await pool.query(
        'INSERT INTO employee_stations (employee_id, station_id, pinned) VALUES ($1, $2, $3)',
        [req.params.id, stationId, pinned !== false]
      );
    } else {
      await pool.query(
        'UPDATE employee_stations SET pinned = $1 WHERE employee_id = $2 AND station_id = $3',
        [pinned !== false, req.params.id, stationId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Pin station error:', err);
    res.status(500).json({ error: 'Failed to pin station' });
  }
});

// ── GET /api/employees/pinned ──
// Get all pinned employee-station pairs for this business
router.get('/pinned/list', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT es.employee_id, es.station_id, es.pinned,
        e.first_name, e.last_name, s.name as station_name
      FROM employee_stations es
      JOIN employees e ON es.employee_id = e.id
      JOIN stations s ON es.station_id = s.id
      WHERE e.business_id = $1 AND es.pinned = true AND e.active = true
      ORDER BY s.name, e.last_name
    `, [req.user.businessId]);
    res.json(rows);
  } catch (err) {
    console.error('Get pinned error:', err);
    res.status(500).json({ error: 'Failed to get pinned employees' });
  }
});

// ── GET /api/employees/:id/station-ratings ──
// Get per-station ratings for an employee
router.get('/:id/station-ratings', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT es.station_id, es.rating, s.name as station_name
      FROM employee_stations es
      JOIN stations s ON es.station_id = s.id
      WHERE es.employee_id = $1 AND es.rating IS NOT NULL
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error('Get station ratings error:', err);
    res.status(500).json({ error: 'Failed to get station ratings' });
  }
});

module.exports = router;
