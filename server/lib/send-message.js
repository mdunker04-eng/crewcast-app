// ═══════════════════════════════════════════════════════
// CrewCast — Message Send Helper
// Push-first, SMS-fallback. Used by manual sends, campaigns, and any
// outbound path that needs to reach an employee.
// ═══════════════════════════════════════════════════════

const webpush = require('web-push');
const { pool } = require('../db');

const PUSH_FRESH_DAYS = 30; // Push subscription considered "fresh" if < 30d old

// ── Twilio client (lazy) ──
function getTwilio() {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return null;
}

// ── Variable substitution ──
// Replaces {{firstName}} etc. in a template body.
function renderBody(template, vars) {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] != null ? String(vars[key]) : `{{${key}}}`;
  });
}

// ── Core send ──
// Opts:
//   employee:    { id, business_id, first_name, phone, sms_opt_out }
//   body:        already-substituted message text
//   channel:     'push_first_sms_fallback' (default) | 'push_only' | 'sms_only'
//   businessName: for push notification title
//   campaignRunId: optional, linked to campaign_runs row
// Returns: { messageId, channelUsed, status, error? }
async function sendMessage({ employee, body, channel = 'push_first_sms_fallback', businessName = 'CrewCast', campaignRunId = null }) {
  if (!employee || !body) throw new Error('employee and body required');

  // Respect STOP
  if (employee.sms_opt_out && channel !== 'push_only') {
    const msg = await recordMessage({
      businessId: employee.business_id,
      employeeId: employee.id,
      direction: 'outbound',
      channelRow: 'sms',
      body,
      status: 'failed',
      error: 'employee opted out (STOP)',
      campaignRunId,
    });
    return { messageId: msg.id, channelUsed: null, status: 'failed', error: 'opted out' };
  }

  const wantsPush = channel === 'push_only' || channel === 'push_first_sms_fallback';
  const wantsSms = channel === 'sms_only' || channel === 'push_first_sms_fallback';

  // Try push first if allowed
  if (wantsPush) {
    const sub = await getFreshPushSubscription(employee.id);
    if (sub) {
      const pushResult = await tryPush(sub, {
        title: businessName,
        body,
        url: '/',
      });
      if (pushResult.ok) {
        const msg = await recordMessage({
          businessId: employee.business_id,
          employeeId: employee.id,
          direction: 'outbound',
          channelRow: 'push',
          body,
          status: 'sent',
          pushSubId: sub.id,
          campaignRunId,
        });
        return { messageId: msg.id, channelUsed: 'push', status: 'sent' };
      }
      // Push failed → fall through to SMS if allowed
      if (!wantsSms) {
        const msg = await recordMessage({
          businessId: employee.business_id,
          employeeId: employee.id,
          direction: 'outbound',
          channelRow: 'push',
          body,
          status: 'failed',
          error: pushResult.error,
          pushSubId: sub.id,
          campaignRunId,
        });
        return { messageId: msg.id, channelUsed: null, status: 'failed', error: pushResult.error };
      }
    } else if (!wantsSms) {
      // Push-only but no subscription
      const msg = await recordMessage({
        businessId: employee.business_id,
        employeeId: employee.id,
        direction: 'outbound',
        channelRow: 'push',
        body,
        status: 'failed',
        error: 'no push subscription',
        campaignRunId,
      });
      return { messageId: msg.id, channelUsed: null, status: 'failed', error: 'no push subscription' };
    }
  }

  // SMS send
  if (wantsSms) {
    const smsResult = await trySms(employee.phone, body);
    const msg = await recordMessage({
      businessId: employee.business_id,
      employeeId: employee.id,
      direction: 'outbound',
      channelRow: 'sms',
      body,
      status: smsResult.ok ? 'sent' : 'failed',
      error: smsResult.ok ? null : smsResult.error,
      twilioSid: smsResult.sid || null,
      campaignRunId,
    });
    return {
      messageId: msg.id,
      channelUsed: smsResult.ok ? 'sms' : null,
      status: smsResult.ok ? 'sent' : 'failed',
      error: smsResult.error,
    };
  }

  throw new Error('No viable channel');
}

// ── Helpers ──

async function getFreshPushSubscription(employeeId) {
  const { rows } = await pool.query(
    `SELECT id, subscription, created_at
     FROM push_subscriptions
     WHERE employee_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [employeeId]
  );
  if (rows.length === 0) return null;

  const ageDays = (Date.now() - new Date(rows[0].created_at).getTime()) / 86400000;
  if (ageDays > PUSH_FRESH_DAYS) return null;

  try {
    return { id: rows[0].id, sub: JSON.parse(rows[0].subscription) };
  } catch (_) {
    return null;
  }
}

async function tryPush(subRecord, payload) {
  try {
    await webpush.sendNotification(subRecord.sub, JSON.stringify({
      ...payload,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
    }));
    return { ok: true };
  } catch (err) {
    // 404/410 means the subscription is dead — clean it up.
    if (err.statusCode === 404 || err.statusCode === 410) {
      await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [subRecord.id]).catch(() => {});
    }
    return { ok: false, error: err.message || 'push failed' };
  }
}

// Prefer Messaging Service SID (A2P 10DLC + Advanced Opt-Out); fall back to raw from-number.
function getTwilioSender() {
  const msgSvc = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (msgSvc) return { messagingServiceSid: msgSvc };
  if (process.env.TWILIO_FROM_NUMBER) return { from: process.env.TWILIO_FROM_NUMBER };
  return null;
}

async function trySms(phone, body) {
  const twilio = getTwilio();
  const sender = getTwilioSender();
  if (!twilio || !sender) {
    return { ok: false, error: 'Twilio not configured' };
  }
  const digits = (phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return { ok: false, error: 'invalid phone number' };

  try {
    const msg = await twilio.messages.create({
      body,
      ...sender,
      to: '+1' + digits,
    });
    return { ok: true, sid: msg.sid };
  } catch (err) {
    return { ok: false, error: err.message || 'sms failed' };
  }
}

async function recordMessage({
  businessId, employeeId, direction, channelRow, body,
  status, error = null, twilioSid = null, pushSubId = null, campaignRunId = null,
}) {
  const { rows } = await pool.query(
    `INSERT INTO messages
       (business_id, employee_id, direction, channel, body,
        status, sent_at, error, twilio_sid, push_sub_id, campaign_run_id)
     VALUES ($1, $2, $3, $4, $5, $6,
             CASE WHEN $6 = 'sent' THEN NOW() ELSE NULL END,
             $7, $8, $9, $10)
     RETURNING id`,
    [businessId, employeeId, direction, channelRow, body, status, error, twilioSid, pushSubId, campaignRunId]
  );
  return { id: rows[0].id };
}

module.exports = { sendMessage, renderBody };
