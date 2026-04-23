// ═══════════════════════════════════════════════════════
// CrewCast — Campaigns Routes
// Multi-step reminder campaigns anchored to a season's start_date.
// ═══════════════════════════════════════════════════════

const express = require('express');
const { pool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendMessage, renderBody } = require('../lib/send-message');
const { resolveFilter } = require('../lib/segments');

const router = express.Router();
router.use(authenticate, requireAdmin);

// ── Helpers ──
function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map((s, i) => ({
    offsetDays: Number(s.offsetDays ?? s.offset_days ?? 0),
    body: String(s.body || ''),
    channel: s.channel || 'push_first_sms_fallback',
    timeoutMinutes: Number(s.timeoutMinutes ?? s.timeout_minutes ?? 120),
    label: s.label || `Step ${i + 1}`,
  }));
}

// ── GET /api/campaigns ──
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.season_id, c.steps, c.segment_filter, c.send_mode,
              c.active, c.created_at, c.updated_at,
              s.name AS season_name, s.start_date AS season_start_date
       FROM campaigns c
       LEFT JOIN seasons s ON s.id = c.season_id
       WHERE c.business_id = $1
       ORDER BY c.active DESC, c.updated_at DESC`,
      [req.user.businessId]
    );
    res.json({ campaigns: rows });
  } catch (err) {
    console.error('List campaigns error:', err);
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

// ── POST /api/campaigns ──
router.post('/', async (req, res) => {
  try {
    const { name, seasonId, steps, segmentFilter, sendMode, active } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { rows } = await pool.query(
      `INSERT INTO campaigns
        (business_id, name, season_id, steps, segment_filter, send_mode, active)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true))
       RETURNING id, name, season_id, steps, segment_filter, send_mode, active`,
      [
        req.user.businessId, name, seasonId || null,
        JSON.stringify(normalizeSteps(steps)),
        JSON.stringify(segmentFilter || {}),
        sendMode === 'auto' ? 'auto' : 'require_approval',
        active,
      ]
    );
    res.json({ campaign: rows[0] });
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// ── PUT /api/campaigns/:id ──
router.put('/:id', async (req, res) => {
  try {
    const { name, seasonId, steps, segmentFilter, sendMode, active } = req.body;
    const stepsJson = steps != null ? JSON.stringify(normalizeSteps(steps)) : null;
    const filterJson = segmentFilter != null ? JSON.stringify(segmentFilter) : null;
    const { rows } = await pool.query(
      `UPDATE campaigns
       SET name = COALESCE($1, name),
           season_id = $2,
           steps = COALESCE($3::jsonb, steps),
           segment_filter = COALESCE($4::jsonb, segment_filter),
           send_mode = COALESCE($5, send_mode),
           active = COALESCE($6, active),
           updated_at = NOW()
       WHERE id = $7 AND business_id = $8
       RETURNING id, name, season_id, steps, segment_filter, send_mode, active`,
      [name, seasonId ?? null, stepsJson, filterJson, sendMode, active, req.params.id, req.user.businessId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ campaign: rows[0] });
  } catch (err) {
    console.error('Update campaign error:', err);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// ── DELETE /api/campaigns/:id ──
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM campaigns WHERE id = $1 AND business_id = $2`,
      [req.params.id, req.user.businessId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete campaign error:', err);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// ── GET /api/campaigns/pending-approval ──
// Groups pending_approval runs by (campaign, step_index) into batches.
router.get('/pending-approval', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         cr.campaign_id, cr.step_index,
         c.name AS campaign_name, c.steps,
         MIN(cr.scheduled_for) AS scheduled_for,
         COUNT(*)::int AS recipient_count,
         JSONB_AGG(JSONB_BUILD_OBJECT(
           'runId', cr.id,
           'employeeId', cr.employee_id,
           'firstName', e.first_name,
           'lastName', e.last_name
         )) AS recipients
       FROM campaign_runs cr
       JOIN campaigns c ON c.id = cr.campaign_id
       JOIN employees e ON e.id = cr.employee_id
       WHERE c.business_id = $1 AND cr.status = 'pending_approval'
       GROUP BY cr.campaign_id, cr.step_index, c.name, c.steps
       ORDER BY MIN(cr.scheduled_for) ASC`,
      [req.user.businessId]
    );

    const batches = rows.map(r => {
      const stepObj = Array.isArray(r.steps) ? r.steps[r.step_index] : null;
      return {
        campaignId: r.campaign_id,
        campaignName: r.campaign_name,
        stepIndex: r.step_index,
        stepLabel: stepObj?.label || `Step ${r.step_index + 1}`,
        messagePreview: stepObj?.body || '',
        offsetDays: stepObj?.offsetDays ?? null,
        scheduledFor: r.scheduled_for,
        recipientCount: r.recipient_count,
        recipients: r.recipients,
      };
    });

    res.json({ batches });
  } catch (err) {
    console.error('Pending approval error:', err);
    res.status(500).json({ error: 'Failed to load pending approvals' });
  }
});

// ── POST /api/campaigns/:campaignId/approve/:stepIndex ──
// Approve and send all pending_approval runs for this batch.
// Body: { excludeRunIds?: number[], overrideBody?: string }
router.post('/:campaignId/approve/:stepIndex', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.campaignId, 10);
    const stepIndex = parseInt(req.params.stepIndex, 10);
    const { excludeRunIds = [], overrideBody } = req.body || {};

    const { rows: camp } = await pool.query(
      `SELECT c.*, b.name AS business_name
       FROM campaigns c JOIN businesses b ON b.id = c.business_id
       WHERE c.id = $1 AND c.business_id = $2`,
      [campaignId, req.user.businessId]
    );
    if (camp.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = camp[0];
    const step = Array.isArray(campaign.steps) ? campaign.steps[stepIndex] : null;
    if (!step) return res.status(400).json({ error: 'Invalid step' });

    const effectiveBody = overrideBody || step.body;

    // Fetch pending runs for this batch
    const { rows: runs } = await pool.query(
      `SELECT cr.id AS run_id, cr.employee_id,
              e.id, e.business_id, e.first_name, e.phone, e.sms_opt_out
       FROM campaign_runs cr
       JOIN employees e ON e.id = cr.employee_id
       WHERE cr.campaign_id = $1 AND cr.step_index = $2
         AND cr.status = 'pending_approval'
         AND ($3::int[] IS NULL OR cr.id <> ALL($3::int[]))`,
      [campaignId, stepIndex, excludeRunIds.length ? excludeRunIds : null]
    );

    // Cancel excluded runs explicitly
    if (excludeRunIds.length) {
      await pool.query(
        `UPDATE campaign_runs SET status = 'cancelled'
         WHERE campaign_id = $1 AND step_index = $2 AND id = ANY($3::int[])`,
        [campaignId, stepIndex, excludeRunIds]
      );
    }

    const results = [];
    for (const row of runs) {
      const rendered = renderBody(effectiveBody, {
        firstName: row.first_name,
        businessName: campaign.business_name,
        seasonName: '', // TODO enrich with season when implementing builder
        startDate: '',
      });
      const r = await sendMessage({
        employee: {
          id: row.id,
          business_id: row.business_id,
          first_name: row.first_name,
          phone: row.phone,
          sms_opt_out: row.sms_opt_out,
        },
        body: rendered,
        channel: step.channel || 'push_first_sms_fallback',
        businessName: campaign.business_name,
        campaignRunId: row.run_id,
      });
      await pool.query(
        `UPDATE campaign_runs
         SET status = $1, approved_by = $2, approved_at = NOW(), sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE NULL END
         WHERE id = $3`,
        [r.status === 'sent' ? 'sent' : 'failed', req.user.id, row.run_id]
      );
      results.push({ runId: row.run_id, employeeId: row.id, ...r });
    }

    res.json({
      total: results.length,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    });
  } catch (err) {
    console.error('Approve batch error:', err);
    res.status(500).json({ error: 'Approval failed' });
  }
});

// ── POST /api/campaigns/:campaignId/test/:stepIndex ──
// "Send to me first as a test" — sends this step to the admin only.
router.post('/:campaignId/test/:stepIndex', async (req, res) => {
  try {
    const { rows: camp } = await pool.query(
      `SELECT c.*, b.name AS business_name
       FROM campaigns c JOIN businesses b ON b.id = c.business_id
       WHERE c.id = $1 AND c.business_id = $2`,
      [req.params.campaignId, req.user.businessId]
    );
    if (camp.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = camp[0];
    const step = Array.isArray(campaign.steps) ? campaign.steps[req.params.stepIndex] : null;
    if (!step) return res.status(400).json({ error: 'Invalid step' });

    const { rows: admin } = await pool.query(
      `SELECT id, business_id, first_name, phone, sms_opt_out
       FROM employees WHERE id = $1`,
      [req.user.id]
    );
    if (admin.length === 0) return res.status(404).json({ error: 'Admin not found' });

    const rendered = renderBody(step.body, {
      firstName: admin[0].first_name,
      businessName: campaign.business_name,
      seasonName: '',
      startDate: '',
    });
    const r = await sendMessage({
      employee: admin[0],
      body: `[TEST] ${rendered}`,
      channel: step.channel || 'push_first_sms_fallback',
      businessName: campaign.business_name,
    });
    res.json(r);
  } catch (err) {
    console.error('Test send error:', err);
    res.status(500).json({ error: 'Test send failed' });
  }
});

// ── GET /api/campaigns/:id/report ──
// Per-step: sent / replied / no-reply counts.
router.get('/:id/report', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT step_index,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
              COUNT(*) FILTER (WHERE status = 'replied')::int AS replied,
              COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
              COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
              COUNT(*) FILTER (WHERE status = 'pending_approval')::int AS pending
       FROM campaign_runs cr
       WHERE cr.campaign_id = $1
         AND EXISTS (SELECT 1 FROM campaigns c WHERE c.id = cr.campaign_id AND c.business_id = $2)
       GROUP BY step_index
       ORDER BY step_index`,
      [req.params.id, req.user.businessId]
    );
    res.json({ steps: rows });
  } catch (err) {
    console.error('Campaign report error:', err);
    res.status(500).json({ error: 'Failed to load report' });
  }
});

module.exports = router;
