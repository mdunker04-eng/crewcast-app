// ═══════════════════════════════════════════════════════
// CrewCast — Admin Labor Cost Dashboard
// Real-time labor cost tracking for restaurants
// ═══════════════════════════════════════════════════════

async function renderLaborDashboard(app) {
  document.body.classList.add('admin-mode');
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  app.innerHTML = UI.adminShell('labor-dashboard', `
    <div class="page" style="padding-bottom:80px">
      <div class="page-header">
        <h1>Labor Dashboard</h1>
        <p class="subtitle">Track labor costs, tips, and staffing efficiency</p>
      </div>

      <!-- Date Range -->
      <div class="card mb-3" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div style="display:flex;gap:8px;align-items:center">
          <label class="text-xs text-muted">From</label>
          <input type="date" id="labor-start" class="input" value="${weekAgo}" style="width:auto">
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <label class="text-xs text-muted">To</label>
          <input type="date" id="labor-end" class="input" value="${today}" style="width:auto">
        </div>
        <button class="btn btn-primary btn-sm" onclick="loadLaborData()">Update</button>
        <div style="display:flex;gap:6px;margin-left:auto">
          <button class="btn btn-outline btn-sm" onclick="setLaborRange('today')">Today</button>
          <button class="btn btn-outline btn-sm" onclick="setLaborRange('week')">This Week</button>
          <button class="btn btn-outline btn-sm" onclick="setLaborRange('month')">This Month</button>
        </div>
      </div>

      <!-- Summary Cards -->
      <div id="labor-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
        ${UI.loading()}
      </div>

      <!-- By Role Breakdown -->
      <div class="card mb-3">
        <div class="card-title mb-2">Cost by Role</div>
        <div id="labor-by-role">${UI.loading()}</div>
      </div>

      <!-- By Day Breakdown -->
      <div class="card mb-3">
        <div class="card-title mb-2">Daily Breakdown</div>
        <div id="labor-by-day">${UI.loading()}</div>
      </div>

      <!-- Top Earners -->
      <div class="card mb-3">
        <div class="card-title mb-2">By Employee</div>
        <div id="labor-by-employee">${UI.loading()}</div>
      </div>
    </div>
  `);

  loadLaborData();
}

function setLaborRange(range) {
  const today = new Date();
  let start;
  if (range === 'today') {
    start = today;
  } else if (range === 'week') {
    start = new Date(today);
    start.setDate(today.getDate() - today.getDay()); // Sunday
  } else if (range === 'month') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  }
  document.getElementById('labor-start').value = start.toISOString().split('T')[0];
  document.getElementById('labor-end').value = today.toISOString().split('T')[0];
  loadLaborData();
}

async function loadLaborData() {
  const start = document.getElementById('labor-start').value;
  const end = document.getElementById('labor-end').value;

  try {
    const data = await API.getLaborCost({ start, end });
    renderLaborSummary(data);
    renderLaborByRole(data.byRole);
    renderLaborByDay(data.byDay);
    renderLaborByEmployee(data.byEmployee);
  } catch (err) {
    document.getElementById('labor-summary').innerHTML = '<div class="text-muted text-sm">No labor data for this period.</div>';
    document.getElementById('labor-by-role').innerHTML = '';
    document.getElementById('labor-by-day').innerHTML = '';
    document.getElementById('labor-by-employee').innerHTML = '';
  }
}

function renderLaborSummary(data) {
  const t = data.totals;
  const avgHourly = t.hours > 0 ? (t.laborCost / t.hours).toFixed(2) : '0.00';
  const days = data.byDay.length || 1;
  const dailyAvg = (t.laborCost / days).toFixed(2);

  document.getElementById('labor-summary').innerHTML = `
    <div class="card" style="text-align:center;border-left:3px solid var(--purple)">
      <div class="text-xs text-muted">Total Labor Cost</div>
      <div class="semi" style="font-size:22px;color:var(--purple-light)">$${t.laborCost.toLocaleString()}</div>
    </div>
    <div class="card" style="text-align:center;border-left:3px solid var(--blue,#60a5fa)">
      <div class="text-xs text-muted">Total Hours</div>
      <div class="semi" style="font-size:22px">${t.hours.toFixed(1)}</div>
    </div>
    <div class="card" style="text-align:center;border-left:3px solid var(--green)">
      <div class="text-xs text-muted">Total Tips</div>
      <div class="semi" style="font-size:22px;color:var(--green-text)">$${t.tips.toLocaleString()}</div>
    </div>
    <div class="card" style="text-align:center;border-left:3px solid var(--yellow,#fbbf24)">
      <div class="text-xs text-muted">Avg $/Hour</div>
      <div class="semi" style="font-size:22px">$${avgHourly}</div>
    </div>
    <div class="card" style="text-align:center;border-left:3px solid var(--orange,#fb923c)">
      <div class="text-xs text-muted">Daily Avg Cost</div>
      <div class="semi" style="font-size:22px">$${dailyAvg}</div>
    </div>
    <div class="card" style="text-align:center;border-left:3px solid var(--text-muted)">
      <div class="text-xs text-muted">Total Shifts</div>
      <div class="semi" style="font-size:22px">${t.entries}</div>
    </div>
  `;
}

function renderLaborByRole(roles) {
  if (!roles.length) {
    document.getElementById('labor-by-role').innerHTML = '<div class="text-muted text-sm">No data yet. Clock entries need pay roles assigned.</div>';
    return;
  }
  const totalCost = roles.reduce((s, r) => s + r.cost, 0) || 1;
  const html = `
    <table style="width:100%;font-size:13px">
      <thead><tr style="border-bottom:1px solid var(--border)">
        <th style="text-align:left;padding:6px 8px">Role</th>
        <th style="text-align:right;padding:6px 8px">Hours</th>
        <th style="text-align:right;padding:6px 8px">Cost</th>
        <th style="text-align:right;padding:6px 8px">Tips</th>
        <th style="text-align:right;padding:6px 8px">% of Labor</th>
      </tr></thead>
      <tbody>${roles.sort((a,b) => b.cost - a.cost).map(r => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:6px 8px" class="semi">${r.name}</td>
          <td style="padding:6px 8px;text-align:right">${r.hours.toFixed(1)}</td>
          <td style="padding:6px 8px;text-align:right">$${r.cost.toFixed(2)}</td>
          <td style="padding:6px 8px;text-align:right;color:var(--green-text)">$${r.tips.toFixed(2)}</td>
          <td style="padding:6px 8px;text-align:right">
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">
              <div style="width:60px;height:6px;background:var(--bg-primary);border-radius:3px;overflow:hidden">
                <div style="width:${Math.round(r.cost/totalCost*100)}%;height:100%;background:var(--purple);border-radius:3px"></div>
              </div>
              ${Math.round(r.cost/totalCost*100)}%
            </div>
          </td>
        </tr>
      `).join('')}</tbody>
    </table>
  `;
  document.getElementById('labor-by-role').innerHTML = html;
}

function renderLaborByDay(days) {
  if (!days.length) {
    document.getElementById('labor-by-day').innerHTML = '<div class="text-muted text-sm">No data for this period.</div>';
    return;
  }
  const maxCost = Math.max(...days.map(d => d.cost)) || 1;
  const html = days.map(d => {
    const dayName = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const barWidth = Math.round(d.cost / maxCost * 100);
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
        <div style="width:100px;font-size:12px" class="semi">${dayName}</div>
        <div style="flex:1;height:20px;background:var(--bg-primary);border-radius:4px;overflow:hidden;position:relative">
          <div style="width:${barWidth}%;height:100%;background:linear-gradient(90deg,var(--purple),rgba(124,58,237,.5));border-radius:4px"></div>
          <span style="position:absolute;right:6px;top:2px;font-size:11px;color:var(--text-secondary)">$${d.cost.toFixed(0)} · ${d.hours.toFixed(1)}h · ${d.entries} shifts</span>
        </div>
      </div>
    `;
  }).join('');
  document.getElementById('labor-by-day').innerHTML = html;
}

function renderLaborByEmployee(employees) {
  if (!employees.length) {
    document.getElementById('labor-by-employee').innerHTML = '<div class="text-muted text-sm">No employee data.</div>';
    return;
  }
  const html = `
    <table style="width:100%;font-size:13px">
      <thead><tr style="border-bottom:1px solid var(--border)">
        <th style="text-align:left;padding:6px 8px">Employee</th>
        <th style="text-align:right;padding:6px 8px">Shifts</th>
        <th style="text-align:right;padding:6px 8px">Hours</th>
        <th style="text-align:right;padding:6px 8px">Labor Cost</th>
        <th style="text-align:right;padding:6px 8px">Tips</th>
        <th style="text-align:right;padding:6px 8px">Total Comp</th>
      </tr></thead>
      <tbody>${employees.slice(0, 20).map(e => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:6px 8px" class="semi">${e.name}</td>
          <td style="padding:6px 8px;text-align:right">${e.shifts}</td>
          <td style="padding:6px 8px;text-align:right">${e.hours.toFixed(1)}</td>
          <td style="padding:6px 8px;text-align:right">$${e.cost.toFixed(2)}</td>
          <td style="padding:6px 8px;text-align:right;color:var(--green-text)">$${e.tips.toFixed(2)}</td>
          <td style="padding:6px 8px;text-align:right" class="semi">$${(e.cost + e.tips).toFixed(2)}</td>
        </tr>
      `).join('')}</tbody>
    </table>
  `;
  document.getElementById('labor-by-employee').innerHTML = html;
}
