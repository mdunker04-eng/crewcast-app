// ═══════════════════════════════════════════════════════
// CrewCast — Admin Schedule Management
// ═══════════════════════════════════════════════════════

async function renderAdminSchedules(app) {
  app.innerHTML = `
    <div class="page">
      <div class="page-header flex justify-between items-center">
        <div>
          <h1>Schedules</h1>
          <p class="subtitle">Create and manage schedules</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="showCreateScheduleModal()">${SVG.plus} New</button>
      </div>
      <div id="schedules-content">${UI.loading()}</div>
    </div>
    ${UI.adminNav('schedules')}
  `;

  try {
    const schedules = await API.getSchedules();

    if (schedules.length === 0) {
      document.getElementById('schedules-content').innerHTML = `
        ${UI.empty('📅', 'No schedules yet', 'Create your first schedule to start assigning shifts')}
        <button class="btn btn-primary btn-block mt-3" onclick="showCreateScheduleModal()">Create Schedule</button>
      `;
      return;
    }

    document.getElementById('schedules-content').innerHTML = schedules.map(s => `
      <div class="card" onclick="Router.navigate('/admin/schedule/${s.id}')" style="cursor:pointer">
        <div class="flex justify-between items-center mb-2">
          <div class="semi">${s.name}</div>
          ${UI.statusBadge(s.status)}
        </div>
        <div class="text-xs text-muted mb-3">${UI.formatDate(s.start_date)} - ${UI.formatDate(s.end_date)}</div>
        <div class="stat-grid stat-grid-3">
          <div class="stat-card">
            <div class="stat-label">Total</div>
            <div class="stat-value" style="font-size:18px">${s.total_shifts}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Confirmed</div>
            <div class="stat-value text-green" style="font-size:18px">${s.confirmed}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Pending</div>
            <div class="stat-value text-amber" style="font-size:18px">${s.pending}</div>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('schedules-content').innerHTML = `
      <div class="card text-center"><p class="text-red">${err.message}</p></div>
    `;
  }
}

function showCreateScheduleModal() {
  const today = new Date();
  const nextSat = new Date(today);
  nextSat.setDate(today.getDate() + (6 - today.getDay() + 7) % 7);
  const nextSun = new Date(nextSat);
  nextSun.setDate(nextSat.getDate() + 1);

  const satStr = nextSat.toISOString().split('T')[0];
  const sunStr = nextSun.toISOString().split('T')[0];

  UI.showModal('New Schedule', `
    <div class="form-group">
      <label class="form-label">Schedule Name</label>
      <input type="text" id="sched-name" class="form-input" placeholder="Weekend of May 3-4" value="Weekend of ${nextSat.toLocaleDateString('en-US', {month:'short', day:'numeric'})}">
    </div>
    <div class="form-group">
      <label class="form-label">Start Date</label>
      <input type="date" id="sched-start" class="form-input" value="${satStr}">
    </div>
    <div class="form-group">
      <label class="form-label">End Date</label>
      <input type="date" id="sched-end" class="form-input" value="${sunStr}">
    </div>
    <div class="form-group">
      <label class="form-label">Notes (optional)</label>
      <input type="text" id="sched-notes" class="form-input" placeholder="Any special instructions...">
    </div>
  `, `
    <button class="btn btn-primary" onclick="createSchedule()">Create</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);
}

async function createSchedule() {
  const name = document.getElementById('sched-name').value;
  const startDate = document.getElementById('sched-start').value;
  const endDate = document.getElementById('sched-end').value;
  const notes = document.getElementById('sched-notes').value;

  if (!name || !startDate || !endDate) {
    UI.toast('Name and dates required', 'error');
    return;
  }

  try {
    const result = await API.createSchedule({ name, startDate, endDate, notes });
    UI.closeModal();
    UI.toast('Schedule created!');
    Router.navigate(`/admin/schedule/${result.id}`);
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}
