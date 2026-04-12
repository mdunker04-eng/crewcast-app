// ═══════════════════════════════════════════════════════
// CrewCast — WIW Reconciliation Page (v1 parallel-pilot)
//
// Steve keeps When I Work as system of record for payroll.
// This page lets an admin upload a WIW export CSV, pick a
// date range, and see side-by-side comparison of punches.
//
// The point of v1 is LEARNING: where does CrewCAST differ
// from WIW, and why? If we reach ≥95% match across the
// spring season, we have the confidence to cut over in fall.
// ═══════════════════════════════════════════════════════

async function renderWiwReconcile(app) {
  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <a href="/admin" class="btn btn-ghost btn-sm">&larr; Admin</a>
        <h1>WIW Reconciliation</h1>
      </div>

      <div class="card" style="padding:20px;margin-bottom:20px">
        <div class="semi" style="margin-bottom:4px">Upload When I Work Export</div>
        <div class="text-sm text-muted" style="margin-bottom:16px">
          Export from WIW as CSV (any format with employee name, phone, date, clock-in, clock-out).
          CrewCAST will aggregate daily hours per employee and compare them to punches logged here during the pilot.
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">
          <div style="flex:1;min-width:220px">
            <label class="text-sm semi">WIW CSV file</label>
            <input type="file" id="wiw-file" accept=".csv,text/csv" class="input" />
          </div>
          <div style="min-width:160px">
            <label class="text-sm semi">Start date</label>
            <input type="date" id="wiw-start" class="input" />
          </div>
          <div style="min-width:160px">
            <label class="text-sm semi">End date</label>
            <input type="date" id="wiw-end" class="input" />
          </div>
          <button class="btn btn-primary" onclick="runWiwReconcile()">Reconcile</button>
        </div>

        <div id="wiw-status" class="text-sm text-muted" style="margin-top:12px"></div>
      </div>

      <div id="wiw-summary"></div>
      <div id="wiw-results"></div>
    </div>
  `;

  // Default date range: last 7 days ending today
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  document.getElementById('wiw-start').value = weekAgo.toISOString().slice(0, 10);
  document.getElementById('wiw-end').value = today.toISOString().slice(0, 10);
}

async function runWiwReconcile() {
  const fileInput = document.getElementById('wiw-file');
  const startDate = document.getElementById('wiw-start').value;
  const endDate = document.getElementById('wiw-end').value;
  const statusEl = document.getElementById('wiw-status');
  const summaryEl = document.getElementById('wiw-summary');
  const resultsEl = document.getElementById('wiw-results');

  if (!fileInput.files || fileInput.files.length === 0) {
    UI.toast('Pick a CSV file first', 'error');
    return;
  }
  if (!startDate || !endDate) {
    UI.toast('Pick start and end dates', 'error');
    return;
  }

  const file = fileInput.files[0];
  statusEl.textContent = 'Reading CSV…';
  summaryEl.innerHTML = '';
  resultsEl.innerHTML = UI.loading();

  try {
    const csvText = await file.text();
    statusEl.textContent = 'Uploading to server for reconciliation…';

    const result = await API.post('/api/time/reconcile', {
      csv: csvText,
      startDate,
      endDate
    });

    statusEl.textContent = '';
    renderWiwSummary(result.summary || {});
    renderWiwResultsTable(result.rows || []);
  } catch (err) {
    statusEl.textContent = '';
    resultsEl.innerHTML = `<div class="card" style="padding:16px;color:#ef4444">Reconcile failed: ${err.message}</div>`;
  }
}

function renderWiwSummary(summary) {
  const el = document.getElementById('wiw-summary');
  if (!el) return;

  const matchRate = summary.total ? Math.round((summary.match / summary.total) * 100) : 0;
  const matchColor = matchRate >= 95 ? '#10b981' : matchRate >= 85 ? '#f59e0b' : '#ef4444';

  el.innerHTML = `
    <div class="card" style="padding:20px;margin-bottom:16px">
      <div class="semi" style="margin-bottom:12px;font-size:16px">Pilot Scoreboard</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
        <div style="padding:12px;background:var(--bg-secondary,#1e293b);border-radius:8px">
          <div class="text-xs text-muted">Match Rate</div>
          <div style="font-size:28px;font-weight:700;color:${matchColor}">${matchRate}%</div>
        </div>
        <div style="padding:12px;background:var(--bg-secondary,#1e293b);border-radius:8px">
          <div class="text-xs text-muted">Exact Matches</div>
          <div style="font-size:22px;font-weight:600">${summary.match || 0}</div>
        </div>
        <div style="padding:12px;background:var(--bg-secondary,#1e293b);border-radius:8px">
          <div class="text-xs text-muted">Close (&lt;2%)</div>
          <div style="font-size:22px;font-weight:600">${summary.close || 0}</div>
        </div>
        <div style="padding:12px;background:var(--bg-secondary,#1e293b);border-radius:8px">
          <div class="text-xs text-muted">Mismatches</div>
          <div style="font-size:22px;font-weight:600;color:#f59e0b">${summary.mismatch || 0}</div>
        </div>
        <div style="padding:12px;background:var(--bg-secondary,#1e293b);border-radius:8px">
          <div class="text-xs text-muted">WIW only</div>
          <div style="font-size:22px;font-weight:600;color:#ef4444">${summary.wiw_only || 0}</div>
        </div>
        <div style="padding:12px;background:var(--bg-secondary,#1e293b);border-radius:8px">
          <div class="text-xs text-muted">CrewCAST only</div>
          <div style="font-size:22px;font-weight:600;color:#3b82f6">${summary.cc_only || 0}</div>
        </div>
        <div style="padding:12px;background:var(--bg-secondary,#1e293b);border-radius:8px">
          <div class="text-xs text-muted">WIW total hours</div>
          <div style="font-size:22px;font-weight:600">${(summary.wiwHours || 0).toFixed(1)}</div>
        </div>
        <div style="padding:12px;background:var(--bg-secondary,#1e293b);border-radius:8px">
          <div class="text-xs text-muted">CrewCAST total</div>
          <div style="font-size:22px;font-weight:600">${(summary.ccHours || 0).toFixed(1)}</div>
        </div>
      </div>
      <div class="text-xs text-muted" style="margin-top:12px">
        Pilot goal: ≥95% match rate across the spring season. Below 95% = investigate before cutover.
      </div>
    </div>
  `;
}

function renderWiwResultsTable(rows) {
  const el = document.getElementById('wiw-results');
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = `<div class="card" style="padding:16px;text-align:center" class="text-muted">No rows to compare.</div>`;
    return;
  }

  // Sort: mismatches / only-one-side first, then by name
  const order = { mismatch: 0, wiw_only: 1, cc_only: 2, close: 3, match: 4 };
  rows.sort((a, b) => {
    const oa = order[a.status] ?? 9;
    const ob = order[b.status] ?? 9;
    if (oa !== ob) return oa - ob;
    return (a.name || '').localeCompare(b.name || '');
  });

  const badge = (status) => {
    const map = {
      match:    { bg: '#10b981', fg: '#fff', label: 'Match' },
      close:    { bg: '#10b981', fg: '#fff', label: 'Close' },
      mismatch: { bg: '#f59e0b', fg: '#fff', label: 'Mismatch' },
      wiw_only: { bg: '#ef4444', fg: '#fff', label: 'WIW only' },
      cc_only:  { bg: '#3b82f6', fg: '#fff', label: 'CC only' },
    };
    const s = map[status] || { bg: '#64748b', fg: '#fff', label: status };
    return `<span style="background:${s.bg};color:${s.fg};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">${s.label}</span>`;
  };

  const fmtHours = (h) => h == null ? '—' : (Number(h).toFixed(2) + 'h');

  el.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center">
        <div class="semi">Daily Comparison (${rows.length} rows)</div>
        <button class="btn btn-ghost btn-sm" onclick="exportWiwResultsCSV()">Export CSV</button>
      </div>
      <div style="overflow-x:auto">
        <table class="table" style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:var(--bg-secondary,#1e293b);text-align:left">
              <th style="padding:10px 12px;font-size:12px;text-transform:uppercase;color:var(--text-muted,#94a3b8)">Status</th>
              <th style="padding:10px 12px;font-size:12px;text-transform:uppercase;color:var(--text-muted,#94a3b8)">Date</th>
              <th style="padding:10px 12px;font-size:12px;text-transform:uppercase;color:var(--text-muted,#94a3b8)">Employee</th>
              <th style="padding:10px 12px;font-size:12px;text-transform:uppercase;color:var(--text-muted,#94a3b8);text-align:right">WIW hrs</th>
              <th style="padding:10px 12px;font-size:12px;text-transform:uppercase;color:var(--text-muted,#94a3b8);text-align:right">CC hrs</th>
              <th style="padding:10px 12px;font-size:12px;text-transform:uppercase;color:var(--text-muted,#94a3b8);text-align:right">Δ</th>
              <th style="padding:10px 12px;font-size:12px;text-transform:uppercase;color:var(--text-muted,#94a3b8)">Note</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr style="border-top:1px solid rgba(255,255,255,0.05)">
                <td style="padding:10px 12px">${badge(r.status)}</td>
                <td style="padding:10px 12px;font-variant-numeric:tabular-nums">${r.date || ''}</td>
                <td style="padding:10px 12px">${r.name || ''}${r.phone ? `<div class="text-xs text-muted">${r.phone}</div>` : ''}</td>
                <td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums">${fmtHours(r.wiwHours)}</td>
                <td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums">${fmtHours(r.ccHours)}</td>
                <td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums;color:${r.delta > 0.02 ? '#f59e0b' : 'inherit'}">${r.delta == null ? '—' : (r.delta > 0 ? '+' : '') + Number(r.delta).toFixed(2) + 'h'}</td>
                <td style="padding:10px 12px;font-size:12px;color:var(--text-muted,#94a3b8)">${r.note || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Stash rows on window so the export handler can grab them
  window._wiwRows = rows;
}

function exportWiwResultsCSV() {
  const rows = window._wiwRows || [];
  if (!rows.length) return;
  const header = ['status', 'date', 'name', 'phone', 'wiwHours', 'ccHours', 'delta', 'note'];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(header.map(k => esc(r[k])).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crewcast-wiw-reconcile-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
