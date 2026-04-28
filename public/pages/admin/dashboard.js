// ═══════════════════════════════════════════════════════
// CrewCast — Admin Dashboard
// ═══════════════════════════════════════════════════════

async function renderAdminDashboard(app) {
  app.innerHTML = UI.adminShell('dashboard', `
    <div class="page">
      <div class="page-header flex justify-between items-center">
        <div>
          <h1>${API.user.businessName}</h1>
          <p class="subtitle">Admin Dashboard</p>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="handleLogout()">${SVG.logout}</button>
      </div>
      <div id="admin-content">${UI.loading()}</div>
    </div>
  `);

  try {
    const [schedules, employees, swaps] = await Promise.all([
      API.getSchedules(),
      API.getEmployees(),
      API.getSwaps(),
    ]);

    const activeSchedules = schedules.filter(s => s.status === 'published');
    const openSwaps = swaps.filter(s => s.status === 'open');
    const activeEmps = employees.filter(e => e.active);

    // Find the most recent published schedule for stats
    const currentSchedule = activeSchedules[0];

    document.getElementById('admin-content').innerHTML = `
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Employees</div>
          <div class="stat-value">${activeEmps.length}</div>
          <div class="stat-sub">${employees.filter(e => e.hasPin).length} registered</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Open Swaps</div>
          <div class="stat-value ${openSwaps.length > 0 ? 'text-amber' : ''}">${openSwaps.length}</div>
          <div class="stat-sub">requests</div>
        </div>
      </div>

      ${currentSchedule ? `
        <div class="card">
          <div class="card-header">
            <div class="card-title">${currentSchedule.name}</div>
            ${UI.statusBadge(currentSchedule.status)}
          </div>
          <div class="stat-grid stat-grid-3">
            <div class="stat-card">
              <div class="stat-label">Confirmed</div>
              <div class="stat-value text-green">${currentSchedule.confirmed || 0}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Pending</div>
              <div class="stat-value text-amber">${currentSchedule.pending || 0}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Declined</div>
              <div class="stat-value text-red">${currentSchedule.declined || 0}</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm btn-block" onclick="Router.navigate('/admin/schedule/${currentSchedule.id}')">View Details</button>
        </div>
      ` : ''}

      <div class="card">
        <div class="card-title mb-3">Quick Actions</div>
        <div class="flex flex-col gap-2">
          <button class="btn btn-primary btn-block" onclick="Router.navigate('/admin/stations')">
            ${SVG.station} Set Up Stations
          </button>
          <button class="btn btn-secondary btn-block" onclick="Router.navigate('/admin/schedules')">
            ${SVG.calendar} Create Schedule
          </button>
          <button class="btn btn-secondary btn-block" onclick="Router.navigate('/admin/employees')">
            ${SVG.users} Manage Employees
          </button>
          <button class="btn btn-secondary btn-block" onclick="Router.navigate('/admin/onboarding')">
            📲 Employee Onboarding
          </button>
          <button class="btn btn-secondary btn-block" onclick="showNotifyModal()">
            ${SVG.send} Send Notification
          </button>
        </div>
      </div>

      ${schedules.length > 0 ? `
        <div class="card">
          <div class="card-title mb-3">Recent Schedules</div>
          ${schedules.slice(0, 5).map(s => `
            <div class="list-item" onclick="Router.navigate('/admin/schedule/${s.id}')" style="cursor:pointer">
              <div>
                <div class="semi">${s.name}</div>
                <div class="text-xs text-muted">${UI.formatDate(s.start_date)} - ${UI.formatDate(s.end_date)}</div>
              </div>
              <div class="flex items-center gap-2">
                ${UI.statusBadge(s.status)}
                <span class="text-xs text-muted">${s.total_shifts} shifts</span>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  } catch (err) {
    document.getElementById('admin-content').innerHTML = `
      <div class="card text-center"><p class="text-red">${err.message}</p></div>
    `;
  }
}

async function showNotifyModal() {
  // Show modal first with loading reach count, then fill in.
  UI.showModal('Send Push Notification', `
    <div class="form-group">
      <label class="form-label">Title</label>
      <input type="text" id="notify-title" class="form-input" placeholder="Schedule Update">
    </div>
    <div class="form-group">
      <label class="form-label">Message</label>
      <input type="text" id="notify-body" class="form-input" placeholder="Your schedule for this weekend is ready!">
    </div>
    <div id="notify-reach" class="text-xs text-muted" style="margin-top:-6px;margin-bottom:8px">Counting how many employees can receive push…</div>
  `, `
    <button class="btn btn-primary" onclick="sendNotification()">Send to All</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);

  // Compute reach: active employees with a push subscription.
  try {
    const employees = await API.getEmployees();
    const active = employees.filter(e => e.active);
    const reachable = active.filter(e => e.hasPush);
    const reachEl = document.getElementById('notify-reach');
    if (!reachEl) return;
    if (reachable.length === active.length) {
      reachEl.innerHTML = `🔔 <strong>${reachable.length} of ${active.length}</strong> active employees will receive this push.`;
      reachEl.style.color = 'var(--green-text)';
    } else {
      reachEl.innerHTML = `🔔 <strong>${reachable.length} of ${active.length}</strong> active employees will receive this push. The other ${active.length - reachable.length} haven't enabled notifications yet.`;
      reachEl.style.color = 'var(--amber, #F59E0B)';
    }
  } catch (e) { /* leave the loading text */ }
}

async function sendNotification() {
  const title = document.getElementById('notify-title').value;
  const body = document.getElementById('notify-body').value;
  if (!title || !body) { UI.toast('Title and message required', 'error'); return; }

  try {
    const result = await API.sendPush({ title, body });
    UI.closeModal();
    UI.toast(`Notification sent to ${result.sent} employees`);
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}
