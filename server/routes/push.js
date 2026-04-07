// ═══════════════════════════════════════════════════════
// CrewCast — Push Notification Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const webpush = require('web-push');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pool } = require('../db');

const router = express.Router();

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@crewcast.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ── GET /api/push/vapid-key ──
// Get public VAPID key for client subscription
router.get('/vapid-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || '' });
});

// ── POST /api/push/subscribe ──
// Save push subscription for the logged-in user
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'Subscription required' });

    // Remove old subscriptions for this employee
    await pool.query('DELETE FROM push_subscriptions WHERE employee_id = $1', [req.user.id]);

    await pool.query(`
      INSERT INTO push_subscriptions (employee_id, subscription)
      VALUES ($1, $2)
    `, [req.user.id, JSON.stringify(subscription)]);

    res.json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// ── POST /api/push/send ──
// Send notification to specific employees (admin)
router.post('/send', authenticate, requireAdmin, async (req, res) => {
  try {
    const { employeeIds, title, body, url } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'Title and body required' });

    let rows;
    if (employeeIds && employeeIds.length > 0) {
      const placeholders = employeeIds.map((_, i) => `$${i + 1}`).join(',');
      ({ rows } = await pool.query(`
        SELECT ps.*, e.first_name, e.last_name
        FROM push_subscriptions ps
        JOIN employees e ON ps.employee_id = e.id
        WHERE ps.employee_id IN (${placeholders}) AND e.business_id = $${employeeIds.length + 1}
      `, [...employeeIds, req.user.businessId]));
    } else {
      // Send to all employees in the business
      ({ rows } = await pool.query(`
        SELECT ps.*, e.first_name, e.last_name
        FROM push_subscriptions ps
        JOIN employees e ON ps.employee_id = e.id
        WHERE e.business_id = $1 AND e.active = true
      `, [req.user.businessId]));
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
    });

    let sent = 0;
    let failed = 0;

    const promises = rows.map(async (sub) => {
      try {
        await webpush.sendNotification(JSON.parse(sub.subscription), payload);
        sent++;
      } catch (err) {
        failed++;
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired, remove it
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        }
      }
    });

    await Promise.all(promises);
    res.json({ sent, failed, total: rows.length });
  } catch (err) {
    console.error('Send push error:', err);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// Helper: send notification to a single employee (used internally)
async function notifyEmployee(employeeId, title, body, url) {
  const { rows } = await pool.query(
    'SELECT * FROM push_subscriptions WHERE employee_id = $1',
    [employeeId]
  );

  const payload = JSON.stringify({
    title,
    body,
    url: url || '/',
    icon: '/icons/icon-192.png',
  });

  for (const sub of rows) {
    try {
      await webpush.sendNotification(JSON.parse(sub.subscription), payload);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
      }
    }
  }
}

// Helper: notify all admin/owner employees in a business
async function notifyBusinessAdmins(businessId, title, body, url) {
  try {
    const { rows } = await pool.query(`
      SELECT ps.* FROM push_subscriptions ps
      JOIN employees e ON ps.employee_id = e.id
      WHERE e.business_id = $1 AND e.role IN ('admin', 'owner') AND e.active = true
    `, [businessId]);

    const payload = JSON.stringify({
      title, body, url: url || '/',
      icon: '/icons/icon-192.png',
    });

    for (const sub of rows) {
      try {
        await webpush.sendNotification(JSON.parse(sub.subscription), payload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        }
      }
    }
  } catch (e) { console.log('notifyBusinessAdmins error:', e.message); }
}

module.exports = router;
module.exports.notifyEmployee = notifyEmployee;
module.exports.notifyBusinessAdmins = notifyBusinessAdmins;
