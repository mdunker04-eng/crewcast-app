// ═══════════════════════════════════════════════════════
// CrewCast — Shift Swap Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// ── GET /api/swaps ──
// Get swap requests (employee sees own, admin sees all)
router.get('/', authenticate, (req, res) => {
  let swaps;
  if (req.user.role === 'admin' || req.user.role === 'owner') {
    swaps = db.prepare(`
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
      WHERE s.business_id = ?
      ORDER BY sr.created_at DESC
    `).all(req.user.businessId);
  } else {
    swaps = db.prepare(`
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
      WHERE (sr.requester_id = ? OR sr.target_id = ?) AND s.business_id = ?
      ORDER BY sr.created_at DESC
    `).all(req.user.id, req.user.id, req.user.businessId);
  }

  res.json(swaps);
});

// ── POST /api/swaps ──
// Request a shift swap
router.post('/', authenticate, (req, res) => {
  const { shiftId, targetId, reason } = req.body;
  if (!shiftId) return res.status(400).json({ error: 'Shift ID required' });

  // Verify the shift belongs to this employee
  const shift = db.prepare(`
    SELECT sh.* FROM shifts sh
    JOIN schedules s ON sh.schedule_id = s.id
    WHERE sh.id = ? AND sh.employee_id = ? AND s.business_id = ?
  `).get(shiftId, req.user.id, req.user.businessId);

  if (!shift) return res.status(404).json({ error: 'Shift not found' });

  const result = db.prepare(`
    INSERT INTO swap_requests (shift_id, requester_id, target_id, reason)
    VALUES (?, ?, ?, ?)
  `).run(shiftId, req.user.id, targetId || null, reason || null);

  // Mark shift as swap-pending
  db.prepare('UPDATE shifts SET status = ? WHERE id = ?').run('swap-pending', shiftId);

  res.json({ id: result.lastInsertRowid, status: 'open' });
});

// ── PUT /api/swaps/:id ──
// Accept, decline, or cancel a swap (target employee or admin)
router.put('/:id', authenticate, (req, res) => {
  const { status } = req.body;
  if (!['accepted', 'declined', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const swap = db.prepare(`
    SELECT sr.*, sh.schedule_id, sh.employee_id as shift_owner, sh.date, sh.start_time, sh.end_time, sh.station
    FROM swap_requests sr
    JOIN shifts sh ON sr.shift_id = sh.id
    JOIN schedules s ON sh.schedule_id = s.id
    WHERE sr.id = ? AND s.business_id = ?
  `).get(req.params.id, req.user.businessId);

  if (!swap) return res.status(404).json({ error: 'Swap not found' });

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

  db.prepare('UPDATE swap_requests SET status = ?, resolved_at = datetime(\'now\') WHERE id = ?')
    .run(status, req.params.id);

  if (status === 'accepted' && swap.target_id) {
    // Swap the shift assignment
    db.prepare('UPDATE shifts SET employee_id = ?, status = \'confirmed\' WHERE id = ?')
      .run(swap.target_id, swap.shift_id);
  } else if (status === 'declined' || status === 'cancelled') {
    // Restore shift to confirmed
    db.prepare('UPDATE shifts SET status = \'confirmed\' WHERE id = ?')
      .run(swap.shift_id);
  }

  res.json({ success: true, status });
});

module.exports = router;
