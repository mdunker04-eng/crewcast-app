// ═══════════════════════════════════════════════════════
// CrewCast — Shift Swap Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pool } = require('../db');
const { notifyEmployee, notifyBusinessAdmins } = require('./push');

const router = express.Router();

// ── GET /api/swaps ──
// Get swap requests (employee sees own, admin sees all)
router.get('/', authenticate, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'admin' || req.user.role === 'owner') {
      ({ rows } = await pool.query(`
        SELECT sr.*,
          req.first_name as requester_first, req.last_name as requester_last,
          tgt.first_name as target_first, tgt.last_name as target_last,
          sh.date, sh.start_time, sh.end_time, sh.station,
          s.name as schedule_name
        FROM swap_requests sr
        JOIN employees req ON sr.requester_id = req.id
        LEFT JOIN employees tgt ON sr.target_id = tgt.id
        JOIN shifts sh ON sr.shift_id = sh.id
        JOIN schedules s ON sh.schedule_id = s.id
        WHERE s.business_id = $1
        ORDER BY sr.created_at DESC
      `, [req.user.businessId]));
    } else {
      ({ rows } = await pool.query(`
        SELECT sr.*,
          req.first_name as requester_first, req.last_name as requester_last,
          tgt.first_name as target_first, tgt.last_name as target_last,
          sh.date, sh.start_time, sh.end_time, sh.station,
          s.name as schedule_name
        FROM swap_requests sr
        JOIN employees req ON sr.requester_id = req.id
        LEFT JOIN employees tgt ON sr.target_id = tgt.id
        JOIN shifts sh ON sr.shift_id = sh.id
        JOIN schedules s ON sh.schedule_id = s.id
        WHERE (sr.requester_id = $1 OR sr.target_id = $1) AND s.business_id = $2
        ORDER BY sr.created_at DESC
      `, [req.user.id, req.user.businessId]));
    }

    res.json(rows);
  } catch (err) {
    console.error('Get swaps error:', err);
    res.status(500).json({ error: 'Failed to get swaps' });
  }
});

// ── POST /api/swaps ──
// Request a shift swap
router.post('/', authenticate, async (req, res) => {
  try {
    const { shiftId, targetId, reason } = req.body;
    if (!shiftId) return res.status(400).json({ error: 'Shift ID required' });

    // Verify the shift belongs to this employee
    const { rows } = await pool.query(`
      SELECT sh.* FROM shifts sh
      JOIN schedules s ON sh.schedule_id = s.id
      WHERE sh.id = $1 AND sh.employee_id = $2 AND s.business_id = $3
    `, [shiftId, req.user.id, req.user.businessId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Shift not found' });

    const { rows: insertRows } = await pool.query(`
      INSERT INTO swap_requests (shift_id, requester_id, target_id, reason)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [shiftId, req.user.id, targetId || null, reason || null]);

    // Mark shift as swap-pending
    await pool.query('UPDATE shifts SET status = $1 WHERE id = $2', ['swap-pending', shiftId]);

    // Notify target employee about the swap request
    const shift = rows[0];
    const requesterName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
    if (targetId) {
      notifyEmployee(targetId, '🔄 Swap Request',
        `${requesterName} wants to swap their ${shift.station || ''} shift on ${shift.date}`,
        '/employee/swaps'
      ).catch(() => {});
    }
    // Notify admins
    notifyBusinessAdmins(req.user.businessId, '🔄 New Swap Request',
      `${requesterName} requested a swap for ${shift.station || ''} on ${shift.date}`,
      '/admin/swaps'
    ).catch(() => {});

    res.json({ id: insertRows[0].id, status: 'open' });
  } catch (err) {
    console.error('Create swap error:', err);
    res.status(500).json({ error: 'Failed to create swap request' });
  }
});

// ── PUT /api/swaps/:id ──
// Accept, decline, or cancel a swap (target employee or admin)
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'declined', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { rows } = await pool.query(`
      SELECT sr.*, sh.schedule_id, sh.employee_id as shift_owner, sh.date, sh.start_time, sh.end_time, sh.station
      FROM swap_requests sr
      JOIN shifts sh ON sr.shift_id = sh.id
      JOIN schedules s ON sh.schedule_id = s.id
      WHERE sr.id = $1 AND s.business_id = $2
    `, [req.params.id, req.user.businessId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Swap not found' });

    const swap = rows[0];

    // Only target, requester (cancel), or admin can update
    const isTarget = swap.target_id === req.user.id;
    const isRequester = swap.requester_id === req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'owner';

    if (status === 'cancelled' && !isRequester && !isAdmin) {
      return res.status(403).json({ error: 'Only the requester can cancel' });
    }
    if (status === 'accepted' && !isTarget && !isAdmin) {
      return res.status(403).json({ error: 'Only the target can accept' });
    }
    if (status === 'declined' && !isTarget && !isAdmin) {
      return res.status(403).json({ error: 'Only the target can decline' });
    }

    await pool.query(
      'UPDATE swap_requests SET status = $1, resolved_at = NOW() WHERE id = $2',
      [status, req.params.id]
    );

    if (status === 'accepted' && swap.target_id) {
      // Swap the shift assignment
      await pool.query(
        "UPDATE shifts SET employee_id = $1, status = 'confirmed' WHERE id = $2",
        [swap.target_id, swap.shift_id]
      );
    } else if (status === 'declined' || status === 'cancelled') {
      // Restore shift to confirmed
      await pool.query(
        "UPDATE shifts SET status = 'confirmed' WHERE id = $1",
        [swap.shift_id]
      );
    }

    // Notify requester about swap outcome
    try {
      if (status === 'accepted') {
        notifyEmployee(swap.requester_id, '✅ Swap Accepted',
          `Your ${swap.station || ''} shift swap on ${swap.date} was accepted!`,
          '/employee/schedule'
        ).catch(() => {});
      } else if (status === 'declined') {
        notifyEmployee(swap.requester_id, '❌ Swap Declined',
          `Your ${swap.station || ''} shift swap on ${swap.date} was declined.`,
          '/employee/swaps'
        ).catch(() => {});
      }
    } catch (e) {}

    res.json({ success: true, status });
  } catch (err) {
    console.error('Update swap error:', err);
    res.status(500).json({ error: 'Failed to update swap' });
  }
});

module.exports = router;
