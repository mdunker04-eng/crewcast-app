// ═══════════════════════════════════════════════════════
// CrewCast — Admin Compliance Dashboard
// Break alerts, overtime warnings, tip summary
// ═══════════════════════════════════════════════════════

async function renderCompliance(app) {
  document.body.classList.add('admin-mode');
  const today = new Date().toISOString().split('T')[0];

  app.innerHTML = UI.adminShell('compliance', `
    <div class="page" style="padding-bottom:80px">
      <div class="page-header">
        <h1>Compliance</h1>
      </div>

      <div id="break-alerts-section">
        <div class="semi" style="margin-bottom:8px">Break Alerts</div>
        <div id="break-alerts">${UI.loading()}</div>
      </div>

      <div id="overtime-section" style="margin-top:24px">
        <div class="semi" style="margin-bottom:8px">Overtime Warnings (This Week)</div>
        <div id="overtime-warnings">${UI.loading()}</div>
      </div>

      <div id="tip-section" style="margin-top:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
          <div class="semi">Tip Summary</div>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="date" id="tip-start" class="input" value="${today}" style="width:auto">
            <span class="text-muted">to</span>
            <input type="date" id="tip-end" class="input" value="${today}" style="width:auto">
            <button class="btn btn-secondary btn-sm" onclick="loadTipSummary()">Load</button>
          </div>
        </div>
        <div id="tip-summary"></div>
      </div>
    </div>
  `);

  loadBreakAlerts();
  loadOvertimeWarnings();
  loadTipSummary();
}

async function loadBreakAlerts() {
  const container = document.getElementById('break-alerts');
  if (!container) return;
  try {
    const data = await API.getBreakAlerts();
    if (data.alerts.length === 0) {
      container.innerHTML = `<div class="card" style="padding:16px;text-align:center">
        <span style="color:var(--green,#10b981)">&#10003;</span> No break violations — all employees compliant
        <div class="text-xs text-muted" style="margin-top:4px">Rule: ${data.rule.hoursBeforeBreak}h before ${data.rule.breakDuration}-min break required (${data.rule.state})</div>
      </div>`;
      return;
    }
    container.innerHTML = data.alerts.map(a => `
      <div class="card" style="padding:12px;margin-bottom:6px;border-left:4px solid ${a.severity === 'violation' ? 'var(--red,#ef4444)' : 'var(--amber,#f59e0b)'}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <span class="semi">${a.firstName} ${a.lastName}</span>
            <span class="text-sm text-muted">${a.stationName ? ' at ' + a.stationName : ''}</span>
          </div>
          <span class="badge ${a.severity === 'violation' ? 'badge-red' : 'badge-amber'}">${a.severity === 'violation' ? 'VIOLATION' : 'WARNING'}</span>
        </div>
        <div class="text-sm" style="margin-top:4px">${a.message}</div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:16px"><p class="text-muted">${err.message}</p></div>`;
  }
}

async function loadOvertimeWarnings() {
  const container = document.getElementById('overtime-warnings');
  if (!container) return;
  try {
    const data = await API.getOvertimeWarnings();
    if (data.warnings.length === 0) {
      container.innerHTML = `<div class="card" style="padding:16px;text-align:center">
        <span style="color:var(--green,#10b981)">&#10003;</span> No overtime concerns this week
        <div class="text-xs text-muted" style="margin-top:4px">Week of ${data.weekOf} to ${data.weekEnd}</div>
      </div>`;
      return;
    }
    container.innerHTML = data.warnings.map(w => {
      const color = w.severity === 'overtime' ? 'var(--red,#ef4444)' : w.severity === 'warning' ? 'var(--amber,#f59e0b)' : 'var(--blue,#3b82f6)';
      const label = w.severity === 'overtime' ? 'OVERTIME' : w.severity === 'warning' ? 'PROJECTED OT' : 'APPROACHING';
      return `
        <div class="card" style="padding:12px;margin-bottom:6px;border-left:4px solid ${color}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="semi">${w.firstName} ${w.lastName}</span>
            <span class="badge" style="background:${color};color:white;font-size:10px">${label}</span>
          </div>
          <div class="text-sm" style="margin-top:4px">${w.message}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:16px"><p class="text-muted">${err.message}</p></div>`;
  }
}

async function loadTipSummary() {
  const container = document.getElementById('tip-summary');
  if (!container) return;
  const startDate = document.getElementById('tip-start')?.value;
  const endDate = document.getElementById('tip-end')?.value;
  if (!startDate || !endDate) return;

  container.innerHTML = UI.loading();
  try {
    const data = await API.getTipSummary({ startDate, endDate });
    if (data.employees.length === 0) {
      container.innerHTML = `<div class="card" style="padding:16px;text-align:center"><p class="text-muted">No tip data for this period</p></div>`;
      return;
    }

    container.innerHTML = `
      <div class="card" style="padding:16px;margin-bottom:12px;display:flex;gap:24px;flex-wrap:wrap">
        <div><div class="text-xs text-muted">Cash Tips</div><div class="semi" style="font-size:18px">$${data.totals.cash.toFixed(2)}</div></div>
        <div><div class="text-xs text-muted">Card Tips</div><div class="semi" style="font-size:18px">$${data.totals.card.toFixed(2)}</div></div>
        <div><div class="text-xs text-muted">Total Tips</div><div class="semi" style="font-size:18px;color:var(--green,#10b981)">$${data.totals.combined.toFixed(2)}</div></div>
      </div>
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr><th>Employee</th><th>Role</th><th>Shifts</th><th>Hours</th><th>Cash</th><th>Card</th><th>Total Tips</th><th>$/hr</th></tr>
          </thead>
          <tbody>
            ${data.employees.map(e => {
              const hours = parseFloat(e.total_hours) || 0;
              const totalTips = parseFloat(e.total_tips) || 0;
              const perHour = hours > 0 ? (totalTips / hours).toFixed(2) : '—';
              return `
                <tr>
                  <td class="semi">${e.first_name} ${e.last_name}</td>
                  <td>${e.role_name || '<span class="text-muted">—</span>'}${e.is_tipped ? ' <span style="font-size:10px;color:var(--green,#10b981)">tipped</span>' : ''}</td>
                  <td>${e.shifts}</td>
                  <td>${hours.toFixed(1)}h</td>
                  <td>$${parseFloat(e.total_tip_cash).toFixed(2)}</td>
                  <td>$${parseFloat(e.total_tip_card).toFixed(2)}</td>
                  <td class="semi">$${totalTips.toFixed(2)}</td>
                  <td class="text-muted">$${perHour}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:16px"><p class="text-muted">${err.message}</p></div>`;
  }
}
