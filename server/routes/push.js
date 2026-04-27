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

// Helper: look up business name (cached briefly per request lifetime).
async function getBusinessName(businessId) {
  if (!businessId) return '';
  try {
    const { rows } = await pool.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
    return (rows[0] && rows[0].name) || '';
  } catch (e) { return ''; }
}

// Helper: prefix the title with the business name so employees know
// which workplace the notification is for. iOS shows the title in bold
// at the top of the banner; "from CrewCast" appears below it from the
// PWA name. Multi-tenant deployments need the business name *in* the
// title to be unambiguous.
function brandTitle(businessName, title) {
  if (!businessName) return title;
  // Avoid double-branding if the caller already included it.
  if (title && title.toLowerCase().includes(businessName.toLowerCase())) return title;
  return `${businessName} · ${title}`;
}

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

    const businessName = await getBusinessName(req.user.businessId);
    const payload = JSON.stringify({
      title: brandTitle(businessName, title),
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
    `SELECT ps.*, e.business_id, b.name as business_name
     FROM push_subscriptions ps
     JOIN employees e ON ps.employee_id = e.id
     LEFT JOIN businesses b ON e.business_id = b.id
     WHERE ps.employee_id = $1`,
    [employeeId]
  );

  const businessName = (rows[0] && rows[0].business_name) || '';
  const payload = JSON.stringify({
    title: brandTitle(businessName, title),
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

    const businessName = await getBusinessName(businessId);
    const payload = JSON.stringify({
      title: brandTitle(businessName, title),
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
  } catch (e) { console.log('notifyBusinessAdmins error:', e.message); }
}

// ── POST /api/push/shift-reminders ──
// Automated shift reminders — call daily via cron/scheduler
// Sends day-before (evening) and morning-of reminders
// Push first, SMS fallback for employees without push subscriptions
router.post('/shift-reminders', async (req, res) => {
  try {
    const { type } = req.body; // 'day-before' or 'morning-of'
    const cronSecret = req.headers['x-cron-secret'] || req.body.secret;

    // Auth: either admin token OR cron secret
    const authHeader = req.headers.authorization;
    let isAuthed = false;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { rows } = await pool.query(
        `SELECT e.* FROM sessions s JOIN employees e ON s.employee_id = e.id
         WHERE s.token = $1 AND s.expires_at > NOW() AND e.role IN ('admin','owner')`, [token]
      );
      if (rows.length > 0) isAuthed = true;
    }
    if (cronSecret && cronSecret === (process.env.CRON_SECRET || 'crewcast-cron-2026')) {
      isAuthed = true;
    }
    if (!isAuthed) return res.status(401).json({ error: 'Unauthorized' });

    // Determine target date based on reminder type
    const now = new Date();
    let targetDate;
    if (type === 'day-before') {
      // Tomorrow's shifts
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      targetDate = tomorrow.toISOString().split('T')[0];
    } else {
      // Today's shifts (morning-of)
      targetDate = now.toISOString().split('T')[0];
    }

    // Get all shifts for the target date across all businesses
    const { rows: shifts } = await pool.query(`
      SELECT sh.id, sh.employee_id, sh.date, sh.start_time, sh.end_time, sh.station,
             e.first_name, e.last_name, e.phone, e.business_id,
             b.name as business_name, b.slug as business_slug, b.settings as biz_settings
      FROM shifts sh
      JOIN employees e ON sh.employee_id = e.id
      JOIN schedules sc ON sh.schedule_id = sc.id
      JOIN businesses b ON sc.business_id = b.id
      WHERE sh.date = $1
        AND sh.status IN ('confirmed', 'pending')
        AND e.active = true
      ORDER BY sh.start_time
    `, [targetDate]);

    if (shifts.length === 0) {
      return res.json({ sent: 0, message: 'No shifts found for ' + targetDate });
    }

    // Group shifts by employee
    const byEmployee = {};
    for (const sh of shifts) {
      if (!byEmployee[sh.employee_id]) byEmployee[sh.employee_id] = [];
      byEmployee[sh.employee_id].push(sh);
    }

    let pushSent = 0, smsSent = 0, failed = 0;

    // Check if Twilio is configured for SMS fallback
    let twilioClient = null;
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
      try {
        const twilio = require('twilio');
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      } catch (e) {}
    }

    for (const [empId, empShifts] of Object.entries(byEmployee)) {
      const emp = empShifts[0]; // grab employee info from first shift
      const shiftCount = empShifts.length;

      // Check if reminders are enabled for this business
      let bizSettings = {};
      try { bizSettings = typeof emp.biz_settings === 'string' ? JSON.parse(emp.biz_settings) : (emp.biz_settings || {}); } catch (e) {}
      if (bizSettings.shiftReminders === false) continue;

      // Build message
      const timeStr = empShifts.map(s => {
        const start = formatTime12(s.start_time);
        return s.station ? `${s.station} at ${start}` : start;
      }).join(', ');

      let title, body;
      if (type === 'day-before') {
        title = `📅 Tomorrow's Shift${shiftCount > 1 ? 's' : ''}`;
        body = `Hey ${emp.first_name}! You're scheduled ${shiftCount > 1 ? 'for' : 'at'} ${timeStr} tomorrow.`;
      } else {
        title = `⏰ Shift Reminder`;
        body = `${emp.first_name}, your shift${shiftCount > 1 ? 's are' : ' is'} today: ${timeStr}. See you soon!`;
      }

      // Try push first
      const { rows: subs } = await pool.query(
        'SELECT * FROM push_subscriptions WHERE employee_id = $1', [empId]
      );

      let pushSucceeded = false;
      if (subs.length > 0) {
        const payload = JSON.stringify({
          title: brandTitle(emp.business_name, title),
          body,
          url: '/schedule',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-72.png',
        });

        for (const sub of subs) {
          try {
            await webpush.sendNotification(JSON.parse(sub.subscription), payload);
            pushSucceeded = true;
            pushSent++;
          } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
            }
          }
        }
      }

      // SMS fallback if push failed or no subscription
      if (!pushSucceeded && twilioClient && emp.phone) {
        const digits = emp.phone.replace(/\D/g, '').slice(-10);
        if (digits.length === 10) {
          try {
            await twilioClient.messages.create({
              body: `${title}\n${body}`,
              from: process.env.TWILIO_FROM_NUMBER,
              to: '+1' + digits,
            });
            smsSent++;
          } catch (e) {
            failed++;
          }
        }
      }
    }

    res.json({
      targetDate,
      type: type || 'morning-of',
      employees: Object.keys(byEmployee).length,
      pushSent, smsSent, failed,
    });
  } catch (err) {
    console.error('Shift reminders error:', err);
    res.status(500).json({ error: 'Reminder run failed: ' + err.message });
  }
});

function formatTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const hr12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return `${hr12}:${m} ${ampm}`;
}

// ── POST /api/push/schedule-published ──
// Notify all employees in a schedule that it's been published
router.post('/schedule-published', authenticate, requireAdmin, async (req, res) => {
  try {
    const { scheduleId, scheduleName, startDate, endDate } = req.body;
    if (!scheduleId) return res.status(400).json({ error: 'Schedule ID required' });

    // Get all employees with shifts in this schedule
    const { rows: shiftEmployees } = await pool.query(`
      SELECT DISTINCT sh.employee_id, e.first_name, e.phone
      FROM shifts sh
      JOIN employees e ON sh.employee_id = e.id
      WHERE sh.schedule_id = $1 AND e.active = true
    `, [scheduleId]);

    const title = '📅 New Schedule Published!';
    const body = scheduleName
      ? `${scheduleName} is ready — check your shifts!`
      : `A new schedule (${startDate || 'upcoming'}) is ready — check your shifts!`;

    let pushSent = 0, smsSent = 0;

    // Check Twilio for SMS fallback
    let twilioClient = null;
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
      try {
        const twilio = require('twilio');
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      } catch (e) {}
    }

    for (const emp of shiftEmployees) {
      let sent = false;
      try {
        await notifyEmployee(emp.employee_id, title, body, '/schedule');
        pushSent++;
        sent = true;
      } catch (e) {}

      // SMS fallback
      if (!sent && twilioClient && emp.phone) {
        const digits = emp.phone.replace(/\D/g, '').slice(-10);
        if (digits.length === 10) {
          try {
            await twilioClient.messages.create({
              body: `${title}\n${body}`,
              from: process.env.TWILIO_FROM_NUMBER,
              to: '+1' + digits,
            });
            smsSent++;
          } catch (e) {}
        }
      }
    }

    res.json({ employees: shiftEmployees.length, pushSent, smsSent });
  } catch (err) {
    console.error('Schedule published notify error:', err);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

module.exports = router;
module.exports.notifyEmployee = notifyEmployee;
module.exports.notifyBusinessAdmins = notifyBusinessAdmins;
