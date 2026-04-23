// ═══════════════════════════════════════════════════════
// CrewCast — Campaign Scheduler
// Generates campaign_runs for due steps and auto-sends ones
// whose campaign has send_mode = 'auto'.
//
// Runs every 15 minutes from server/index.js.
// ═══════════════════════════════════════════════════════

const { pool } = require('../db');
const { resolveFilter } = require('./segments');
const { sendMessage, renderBody } = require('./send-message');

// How far ahead to pre-generate runs. Anything whose scheduled_for is
// <= NOW() + LOOKAHEAD_MINUTES becomes a run row (idempotent via unique index).
const LOOKAHEAD_MINUTES = 60;

async function tickCampaigns() {
  const startedAt = Date.now();
  let generated = 0, sent = 0, failed = 0;

  try {
    // 1) Load all active campaigns with a linked season (step offsets are anchored to season.start_date)
    const { rows: campaigns } = await pool.query(
      `SELECT c.id, c.business_id, c.name, c.steps, c.segment_filter,
              c.send_mode, c.season_id,
              s.name AS season_name, s.start_date AS season_start,
              b.name AS business_name
       FROM campaigns c
       JOIN businesses b ON b.id = c.business_id
       LEFT JOIN seasons s ON s.id = c.season_id
       WHERE c.active = true AND c.season_id IS NOT NULL`
    );

    for (const camp of campaigns) {
      const steps = Array.isArray(camp.steps) ? camp.steps : [];
      if (steps.length === 0) continue;
      if (!camp.season_start) continue;

      // Resolve audience once per campaign tick
      let employeeIds = [];
      try {
        employeeIds = await resolveFilter(camp.segment_filter || {}, camp.business_id);
      } catch (err) {
        console.error(`[CampaignCron] Segment resolve failed for campaign ${camp.id}:`, err.message);
        continue;
      }
      if (employeeIds.length === 0) continue;

      // 2) For each step, compute scheduled_for and insert run rows if due soon
      for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
        const step = steps[stepIndex] || {};
        const offsetDays = Number(step.offsetDays ?? step.offset_days ?? 0);
        // scheduled_for = season.start_date + offsetDays  (midnight UTC anchor)
        const scheduledFor = new Date(camp.season_start);
        scheduledFor.setUTCDate(scheduledFor.getUTCDate() + offsetDays);

        const lookaheadMs = LOOKAHEAD_MINUTES * 60 * 1000;
        if (scheduledFor.getTime() > Date.now() + lookaheadMs) continue; // not due yet

        const initialStatus = camp.send_mode === 'auto' ? 'queued' : 'pending_approval';

        // Bulk insert — unique index (campaign_id, step_index, employee_id) prevents dupes.
        const { rowCount } = await pool.query(
          `INSERT INTO campaign_runs
             (campaign_id, step_index, employee_id, scheduled_for, status)
           SELECT $1, $2, e_id, $3, $4
           FROM unnest($5::int[]) AS e_id
           ON CONFLICT (campaign_id, step_index, employee_id) DO NOTHING`,
          [camp.id, stepIndex, scheduledFor.toISOString(), initialStatus, employeeIds]
        );
        generated += rowCount;
      }
    }

    // 3) Send queued runs whose scheduled_for has passed
    const { rows: dueRuns } = await pool.query(
      `SELECT cr.id AS run_id, cr.campaign_id, cr.step_index, cr.employee_id,
              c.steps, c.send_mode, c.season_id,
              s.name AS season_name, s.start_date AS season_start,
              b.name AS business_name,
              e.id, e.business_id, e.first_name, e.phone, e.sms_opt_out
       FROM campaign_runs cr
       JOIN campaigns c ON c.id = cr.campaign_id
       JOIN businesses b ON b.id = c.business_id
       LEFT JOIN seasons s ON s.id = c.season_id
       JOIN employees e ON e.id = cr.employee_id
       WHERE cr.status = 'queued' AND cr.scheduled_for <= NOW()
       ORDER BY cr.scheduled_for ASC
       LIMIT 500`
    );

    for (const row of dueRuns) {
      const steps = Array.isArray(row.steps) ? row.steps : [];
      const step = steps[row.step_index];
      if (!step) {
        await pool.query(
          `UPDATE campaign_runs SET status = 'failed' WHERE id = $1`,
          [row.run_id]
        );
        failed++;
        continue;
      }

      const rendered = renderBody(step.body || '', {
        firstName: row.first_name,
        businessName: row.business_name,
        seasonName: row.season_name || '',
        startDate: row.season_start
          ? new Date(row.season_start).toISOString().slice(0, 10)
          : '',
      });

      try {
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
          businessName: row.business_name,
          campaignRunId: row.run_id,
        });
        await pool.query(
          `UPDATE campaign_runs
           SET status = $1,
               sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE sent_at END
           WHERE id = $2`,
          [r.status === 'sent' ? 'sent' : 'failed', row.run_id]
        );
        if (r.status === 'sent') sent++; else failed++;
      } catch (err) {
        await pool.query(
          `UPDATE campaign_runs SET status = 'failed' WHERE id = $1`,
          [row.run_id]
        );
        failed++;
        console.error(`[CampaignCron] Send failed run ${row.run_id}:`, err.message);
      }
    }

    const elapsed = Date.now() - startedAt;
    if (generated > 0 || sent > 0 || failed > 0) {
      console.log(
        `[CampaignCron] tick ${elapsed}ms — generated=${generated} sent=${sent} failed=${failed}`
      );
    }
    return { generated, sent, failed, elapsedMs: elapsed };
  } catch (err) {
    console.error('[CampaignCron] tick error:', err);
    return { generated, sent, failed, error: err.message };
  }
}

module.exports = { tickCampaigns };
