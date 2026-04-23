// ═══════════════════════════════════════════════════════
// CrewCast — Segment Evaluator
// Resolves a segment filter JSON to a list of employee IDs.
// ═══════════════════════════════════════════════════════

const { pool } = require('../db');

// filter shape (all fields optional, combined with AND):
// {
//   status: 'active' | 'pending_onboarding' | 'all',
//   seasonId: number,
//   stationIds: number[],
//   returning: boolean,        // true = has shifts in a previous season
//   repliedToCampaignStep: { campaignId, stepIndex, within: number },
//   didNotReplyToCampaignStep: { campaignId, stepIndex, within: number },
//   tags: string[],
//   employeeIds: number[],     // explicit list
// }

async function resolveFilter(filter, businessId) {
  filter = filter || {};
  const clauses = ['e.business_id = $1', 'e.active = true'];
  const params = [businessId];

  // Status
  if (filter.status === 'pending_onboarding') {
    clauses.push(`NOT EXISTS (
      SELECT 1 FROM sessions s WHERE s.employee_id = e.id
    )`);
  }

  // Stations trained on
  if (Array.isArray(filter.stationIds) && filter.stationIds.length) {
    params.push(filter.stationIds);
    clauses.push(`EXISTS (
      SELECT 1 FROM employee_stations es
      WHERE es.employee_id = e.id AND es.station_id = ANY($${params.length}::int[])
    )`);
  }

  // Explicit IDs
  if (Array.isArray(filter.employeeIds) && filter.employeeIds.length) {
    params.push(filter.employeeIds);
    clauses.push(`e.id = ANY($${params.length}::int[])`);
  }

  // Tags (stored in employee settings JSONB)
  if (Array.isArray(filter.tags) && filter.tags.length) {
    params.push(filter.tags);
    clauses.push(`e.settings ? 'tags' AND (e.settings->'tags') ?| $${params.length}::text[]`);
  }

  // Opt-out: always exclude STOP'd employees
  clauses.push('COALESCE(e.sms_opt_out, false) = false');

  const q = `SELECT e.id FROM employees e WHERE ${clauses.join(' AND ')}`;
  const { rows } = await pool.query(q, params);
  let ids = rows.map(r => r.id);

  // Campaign-reply filters run as a post-filter (simpler SQL).
  if (filter.repliedToCampaignStep) {
    const r = await campaignResponders(filter.repliedToCampaignStep, businessId);
    ids = ids.filter(id => r.has(id));
  }
  if (filter.didNotReplyToCampaignStep) {
    const r = await campaignResponders(filter.didNotReplyToCampaignStep, businessId);
    ids = ids.filter(id => !r.has(id));
  }

  return ids;
}

// Load segment by id and resolve
async function resolveSegment(segmentId, businessId) {
  const { rows } = await pool.query(
    `SELECT filter FROM segments WHERE id = $1 AND business_id = $2`,
    [segmentId, businessId]
  );
  if (rows.length === 0) return [];
  return resolveFilter(rows[0].filter, businessId);
}

// Helper: set of employee IDs that replied within N days of a campaign step send.
// "Replied" = any inbound message from the employee after the campaign_run sent_at.
async function campaignResponders({ campaignId, stepIndex, within }, businessId) {
  const withinDays = Number(within) > 0 ? Number(within) : 14;
  const { rows } = await pool.query(
    `SELECT DISTINCT cr.employee_id
     FROM campaign_runs cr
     JOIN campaigns c ON c.id = cr.campaign_id AND c.business_id = $1
     WHERE cr.campaign_id = $2
       AND cr.step_index = $3
       AND cr.sent_at IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM messages m
         WHERE m.employee_id = cr.employee_id
           AND m.direction = 'inbound'
           AND m.created_at > cr.sent_at
           AND m.created_at < cr.sent_at + ($4::int || ' days')::interval
       )`,
    [businessId, campaignId, stepIndex, withinDays]
  );
  return new Set(rows.map(r => r.employee_id));
}

module.exports = { resolveFilter, resolveSegment };
