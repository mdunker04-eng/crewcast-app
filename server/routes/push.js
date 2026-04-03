// ═══════════════════════════════════════════════════════
// CrewCast — Push Notification Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const webpush = require('web-push');
const { authenticate, requireAdmin } = require('../middleware/auth');
const db = require('../db');

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
router.post('/subscribe', authenticate, (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'Subscription required' });

  // Remove old subscriptions for this employee
  db.prepare('DELETE FROM push_subscriptions WHERE employee_id = ?').run(req.user.id);

  db.prepare(`
    INSERT INTO push_subscriptions (employee_id, subscription)
    VALUES (?, ?)
  `).run(req.user.id, JSON.stringify(subscription));

  res.json({ success: true });
});

// ── POST /api/push/send ──
// Send notification to specific employees (admin)
router.post('/send', authenticate, requireAdmin, (req, res) => {
  const { employeeIds, title, body, url } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Title and body required' });

  let subs;
  if (employeeIds && employeeIds.length > 0) {
    const placeholders = employeeIds.map(() => '?').join(',');
    subs = db.prepare(`
      SELECT ps.*, e.first_name, e.last_name
      FROM push_subscriptions ps
      JOIN employees e ON ps.employee_id = e.id
      WHERE ps.employee_id IN (${placeholders}) AND e.business_id = ?
    `).all(...employeeIds, req.user.businessId);
  } else {
    // Send to all employees in the business
    subs = db.prepare(`
      SELECT ps.*, e.first_name, e.last_name
      FROM push_subscriptions ps
      JOIN employees e ON ps.employee_id = e.id
      WHERE e.business_id = ? AND e.active = 1
    `).all(req.user.businessId);
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

  const promises = subs.map(async (sub) => {
    try {
      await webpush.sendNotification(JSON.parse(sub.subscription), payload);
      sent++;
    } catch (err) {
      failed++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired, remove it
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      }
    }
  });

  Promise.all(promises).then(() => {
    res.json({ sent, failed, total: subs.length });
  });
});

// Helper: send notification to a single employee (used internally)
async function notifyEmployee(employeeId, title, body, url) {
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE employee_id = ?')
    .all(employeeId);

  const payload = JSON.stringify({
    title,
    body,
    url: url || '/',
    icon: '/icons/icon-192.png',
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(JSON.parse(sub.subscription), payload);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      }
    }
  }
}

module.exports = router;
module.exports.notifyEmployee = notifyEmployee;
