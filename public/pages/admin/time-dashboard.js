// ═══════════════════════════════════════════════════════
// CrewCast — Live Time Tracking Dashboard
// Who's clocked in where, late/no-show alerts
// ═══════════════════════════════════════════════════════

let timeDashboardInterval = null;

async function renderTimeDashboard(app) {
  document.body.classList.add('admin-mode');

  app.innerHTML = UI.adminShell('time-dashboard', `
    <div class="page" style="padding-bottom:80px">
    <div class="page-header" style="flex-wrap:wrap;gap:12px">
      <h1>Live Dashboard</h1>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="Router.navigate('/admin/kiosk')">Open Kiosk</button>
        <button class="btn btn-secondary btn-sm" onclick="Router.navigate('/admin/timesheet')">Timesheets</button>
      </div>
    </div>
    <div id="td-content">${UI.loading()}</div>
    </div>
  `);

  // Load immediately and refresh every 15 seconds
  loadTimeDashboard();
  if (timeDashboardInterval) clearInterval(timeDashboardInterval);
  timeDashboardInterval = setInterval(loadTimeDashboard, 15000);
}

async function loadTimeDashboard() {
  const container = document.getElementById('td-content');
  if (!container) {
    clearInterval(timeDashboardInterval);
    return;
  }

  try {
    const [dashboard, active] = await Promise.all([
      API.getTimeDashboard(),
      API.getActiveEmployees()
    ]);

    const { stations, lateCount, noShowCount, lateEmployees, totalScheduled } = dashboard;

    container.innerHTML = `
      <!-- Alert cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
        <div class="card" style="padding:16px;text-align:center">
          <div class="text-xs text-muted">Clocked In</div>
          <div class="semi" style="font-size:28px;color:var(--green, #10b981)">${active.length}</div>
        </div>
        <div class="card" style="padding:16px;text-align:center">
          <div class="text-xs text-muted">Scheduled Today</div>
          <div class="semi" style="font-size:28px">${totalScheduled}</div>
        </div>
        <div class="card" style="padding:16px;text-align:center;${lateCount > 0 ? 'border:1px solid var(--amber, #f59e0b)' : ''}">
          <div class="text-xs text-muted">Late</div>
          <div class="semi" style="font-size:28px;${lateCount > 0 ? 'color:var(--amber, #f59e0b)' : ''}">${lateCount}</div>
        </div>
        <div class="card" style="padding:16px;text-align:center;${noShowCount > 0 ? 'border:1px solid var(--red, #ef4444)' : ''}">
          <div class="text-xs text-muted">No-Show</div>
          <div class="semi" style="font-size:28px;${noShowCount > 0 ? 'color:var(--red, #ef4444)' : ''}">${noShowCount}</div>
        </div>
      </div>

      ${lateEmployees.length > 0 ? `
        <div class="card" style="padding:16px;margin-bottom:20px;border:1px solid var(--amber, #f59e0b)">
          <div class="semi" style="margin-bottom:8px;color:var(--amber, #f59e0b)">&#9888; Late Employees</div>
          ${lateEmployees.map(e => `
            <div style="display:flex;justify-content:space-between;padding:4px 0">
              <span>${e.firstName} ${e.lastName}</span>
              <span class="badge badge-amber">${e.minutesLate} min late</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Station cards -->
      <div class="semi" style="margin-bottom:12px">Stations</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
        ${stations.map(s => {
          const needed = s.staff_needed || 0;
          const count = parseInt(s.clocked_in_count) || 0;
          const pct = needed > 0 ? Math.min(100, Math.round((count / needed) * 100)) : 100;
          let statusColor = '#10b981'; // green
          let statusLabel = 'Fully Staffed';
          if (count === 0 && needed > 0) { statusColor = '#6b7280'; statusLabel = 'Empty'; }
          else if (pct < 50) { statusColor = '#ef4444'; statusLabel = 'Critical'; }
          else if (pct < 80) { statusColor = '#f59e0b'; statusLabel = 'Understaffed'; }

          // Get names of active employees at this station
          const atStation = active.filter(a => a.station_id === s.id);

          return `
            <div class="card" style="padding:16px;border-left:4px solid ${statusColor}">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div class="semi">${s.name}</div>
                <span class="text-xs" style="color:${statusColor};font-weight:600">${statusLabel}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${statusColor};border-radius:3px;transition:width 0.3s"></div>
                </div>
                <span class="text-sm semi">${count}/${needed}</span>
              </div>
              ${atStation.length > 0 ? `
                <div style="display:flex;flex-wrap:wrap;gap:4px">
                  ${atStation.map(a => `<span class="badge badge-green" style="font-size:11px">${a.first_name} ${a.last_name.charAt(0)}.</span>`).join('')}
                </div>
              ` : '<div class="text-xs text-muted">No one clocked in</div>'}
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:20px"><p class="text-muted">Error: ${err.message}</p></div>`;
  }
}
