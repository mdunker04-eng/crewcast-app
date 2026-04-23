// ═══════════════════════════════════════════════════════
// CrewCast — Messages Routes
// Admin inbox + manual compose/send to segments.
// ═══════════════════════════════════════════════════════

const express = require('express');
const { pool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendMessage, renderBody } = require('../lib/send-message');
const { resolveSegment } = require('../lib/segments');

const router = express.Router();
router.use(authenticate, requireAdmin);

// ── GET /api/messages/threads ──
// Admin inbox: one row per employee with latest message + unread count.
router.get('/threads', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `WITH ranked AS (
         SELECT m.*,
                ROW_NUMBER() OVER (
                  PARTITION BY m.employee_id ORDER BY m.created_at DESC
                ) AS rn
         FROM messages m
         WHERE m.business_id = $1 AND m.employee_id IS NOT NULL
       ),
       unread AS (
         SELECT employee_id, COUNT(*)::int AS n
         FROM messages
         WHERE business_id = $1 AND direction = 'inbound' AND read_at IS NULL
         GROUP BY employee_id
       )
       SELECT r.employee_id,
              e.first_name, e.last_name, e.phone,
              r.body AS last_body,
              r.direction AS last_direction,
              r.channel AS last_channel,
              r.created_at AS last_at,
              COALESCE(u.n, 0) AS unread
       FROM ranked r
       JOIN employees e ON e.id = r.employee_id
       LEFT JOIN unread u ON u.employee_id = r.employee_id
       WHERE r.rn = 1
       ORDER BY COALESCE(u.n, 0) > 0 DESC, r.created_at DESC`,
      [req.user.businessId]
    );
    res.json({ threads: rows });
  } catch (err) {
    console.error('List threads error:', err);
    res.status(500).json({ error: 'Failed to load inbox' });
  }
});

// ── GET /api/messages/threads/:employeeId ──
router.get('/threads/:employeeId', async (req, res) => {
  try {
    const empId = parseInt(req.params.employeeId, 10);
    if (!empId) return res.status(400).json({ error: 'Invalid employee' });

    // Verify the employee belongs to this business
    const { rows: empRows } = await pool.query(
      `SELECT id, first_name, last_name, phone
       FROM employees WHERE id = $1 AND business_id = $2`,
      [empId, req.user.businessId]
    );
    if (empRows.length === 0) return res.status(404).json({ error: 'Employee not found' });

    const { rows } = await pool.query(
      `SELECT id, direction, channel, body, status, sent_at, delivered_at, read_at, created_at, error
       FROM messages
       WHERE business_id = $1 AND employee_id = $2
       ORDER BY created_at ASC`,
      [req.user.businessId, empId]
    );
    res.json({ employee: empRows[0], messages: rows });
  } catch (err) {
    console.error('Get thread error:', err);
    res.status(500).json({ error: 'Failed to load thread' });
  }
});

// ── POST /api/messages/threads/:employeeId/read ──
// Mark all inbound messages from this employee as read.
router.post('/threads/:employeeId/read', async (req, res) => {
  try {
    await pool.query(
      `UPDATE messages SET read_at = NOW()
       WHERE business_id = $1 AND employee_id = $2
         AND direction = 'inbound' AND read_at IS NULL`,
      [req.user.businessId, req.params.employeeId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// ── POST /api/messages/send ──
// Manual send to one employee, a list, or a segment.
// Body: { employeeIds?: number[], segmentId?: number, body: string, channel?: string }
router.post('/send', async (req, res) => {
  try {
    const { employeeIds, segmentId, body, channel } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body required' });

    // Resolve recipient list
    let ids = Array.isArray(employeeIds) ? employeeIds.slice() : [];
    if (segmentId) {
      const extra = await resolveSegment(segmentId, req.user.businessId);
      ids = [...new Set([...ids, ...extra])];
    }
    if (ids.length === 0) return res.status(400).json({ error: 'No recipients' });

    // Load recipient records scoped to this business
    const { rows: recipients } = await pool.query(
      `SELECT id, business_id, first_name, phone, sms_opt_out
       FROM employees
       WHERE business_id = $1 AND id = ANY($2::int[]) AND active = true`,
      [req.user.businessId, ids]
    );

    const results = [];
    for (const emp of recipients) {
      const rendered = renderBody(body, {
        firstName: emp.first_name,
        businessName: req.user.businessName,
      });
      try {
        const r = await sendMessage({
          employee: emp,
          body: rendered,
          channel: channel || 'push_first_sms_fallback',
          businessName: req.user.businessName,
        });
        results.push({ employeeId: emp.id, ...r });
      } catch (err) {
        results.push({ employeeId: emp.id, status: 'failed', error: err.message });
      }
    }

    const summary = {
      total: results.length,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      byChannel: {
        push: results.filter(r => r.channelUsed === 'push').length,
        sms: results.filter(r => r.channelUsed === 'sms').length,
      },
    };
    res.json({ ...summary, results });
  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ error: 'Send failed' });
  }
});

// ── GET /api/messages/unread-count ──
router.get('/unread-count', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM messages
       WHERE business_id = $1 AND direction = 'inbound' AND read_at IS NULL`,
      [req.user.businessId]
    );
    res.json({ unread: rows[0].n });
  } catch (err) {
    console.error('Unread count error:', err);
    res.json({ unread: 0 });
  }
});

module.exports = router;
