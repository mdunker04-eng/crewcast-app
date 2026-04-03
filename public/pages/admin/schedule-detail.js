// ═══════════════════════════════════════════════════════
// CrewCast — Admin Schedule Detail
// View shifts, add employees, publish
// ═══════════════════════════════════════════════════════

async function renderScheduleDetail(app, params) {
  const scheduleId = params.id;

  app.innerHTML = `
    <div class="page">
      <div class="page-header flex justify-between items-center">
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/admin/schedules')">${SVG.chevLeft} Back</button>
        <div id="sched-actions"></div>
      </div>
      <div id="schedule-detail">${UI.loading()}</div>
    </div>
    ${UI.adminNav('schedules')}
  `;

  try {
    const { schedule, shifts } = await API.getShifts(scheduleId);
    const employees = await API.getEmployees();
    const activeEmps = employees.filter(e => e.active);

    // Group shifts by date
    const byDate = {};
    shifts.forEach(s => {
      if (!byDate[s.date]) byDate[s.date] = [];
      byDate[s.date].push(s);
    });

    const confirmed = shifts.filter(s => s.status === 'confirmed').length;
    const pending = shifts.filter(s => s.status === 'pending').length;
    const declined = shifts.filter(s => s.status === 'declined').length;

    document.getElementById('sched-actions').innerHTML = `
      ${schedule.status === 'draft' ? `
        <button class="btn btn-success btn-sm" onclick="publishSchedule(${scheduleId})">Publish</button>
      ` : ''}
    `;

    document.getElementById('schedule-detail').innerHTML = `
      <h2>${schedule.name}</h2>
      <p class="subtitle">${UI.formatDate(schedule.start_date)} - ${UI.formatDate(schedule.end_date)} ${UI.statusBadge(schedule.status)}</p>

      <div class="stat-grid stat-grid-3 mb-4">
        <div class="stat-card">
          <div class="stat-label">Confirmed</div>
          <div class="stat-value text-green">${confirmed}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pending</div>
          <div class="stat-value text-amber">${pending}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Declined</div>
          <div class="stat-value text-red">${declined}</div>
        </div>
      </div>

      <button class="btn btn-primary btn-block mb-4" onclick="showAddShiftsModal(${scheduleId})">
        ${SVG.plus} Add Shifts
      </button>

      ${Object.keys(byDate).length === 0 ? UI.empty('📋', 'No shifts yet', 'Add employees to this schedule') : ''}

      ${Object.entries(byDate).map(([date, dayShifts]) => `
        <div class="mb-4">
          <h3 class="text-purple mb-2">${UI.formatDate(date)} (${dayShifts.length} staff)</h3>
          ${dayShifts.map(s => `
            <div class="shift-card ${s.status}">
              <div class="flex justify-between items-center">
                <div>
                  <div class="semi">${s.first_name} ${s.last_name}</div>
                  <div class="shift-time">${UI.formatTime(s.start_time)} - ${UI.formatTime(s.end_time)}</div>
                  ${s.station ? `<div class="shift-station">Station: ${s.station}</div>` : ''}
                </div>
                ${UI.statusBadge(s.status)}
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')}

      ${schedule.status === 'published' ? `
        <button class="btn btn-secondary btn-block mt-3" onclick="sendScheduleNotification(${scheduleId})">
          ${SVG.send} Notify Pending Employees
        </button>
      ` : ''}
    `;

    // Store employees for the add shifts modal
    window._scheduleEmployees = activeEmps;
    window._scheduleId = scheduleId;
    window._scheduleData = schedule;
  } catch (err) {
    document.getElementById('schedule-detail').innerHTML = `
      <div class="card text-center"><p class="text-red">${err.message}</p></div>
    `;
  }
}

function showAddShiftsModal(scheduleId) {
  const emps = window._scheduleEmployees || [];
  const schedule = window._scheduleData;

  UI.showModal('Add Shifts', `
    <div class="form-group">
      <label class="form-label">Date</label>
      <input type="date" id="shift-date" class="form-input" value="${schedule.start_date}">
    </div>
    <div class="form-group">
      <label class="form-label">Start Time</label>
      <input type="time" id="shift-start" class="form-input" value="09:00">
    </div>
    <div class="form-group">
      <label class="form-label">End Time</label>
      <input type="time" id="shift-end" class="form-input" value="17:00">
    </div>
    <div class="form-group">
      <label class="form-label">Station (optional)</label>
      <input type="text" id="shift-station" class="form-input" placeholder="e.g. Train, Bake Shop">
    </div>
    <div class="form-group">
      <label class="form-label">Select Employees</label>
      <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px">
        ${emps.map(e => `
          <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer">
            <input type="checkbox" value="${e.id}" class="shift-emp-check">
            <span class="text-sm">${e.firstName} ${e.lastName}</span>
          </label>
        `).join('')}
      </div>
      <button class="btn btn-ghost btn-sm mt-2" onclick="document.querySelectorAll('.shift-emp-check').forEach(c=>c.checked=true)">Select All</button>
    </div>
  `, `
    <button class="btn btn-primary" onclick="addShiftsToSchedule(${scheduleId})">Add Shifts</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);
}

async function addShiftsToSchedule(scheduleId) {
  const date = document.getElementById('shift-date').value;
  const startTime = document.getElementById('shift-start').value;
  const endTime = document.getElementById('shift-end').value;
  const station = document.getElementById('shift-station').value;

  const checked = document.querySelectorAll('.shift-emp-check:checked');
  const employeeIds = Array.from(checked).map(c => parseInt(c.value));

  if (!date || employeeIds.length === 0) {
    UI.toast('Select a date and at least one employee', 'error');
    return;
  }

  const shifts = employeeIds.map(empId => ({
    employeeId: empId,
    date,
    startTime,
    endTime,
    station: station || null,
  }));

  try {
    await API.addShifts(scheduleId, shifts);
    UI.closeModal();
    UI.toast(`${shifts.length} shifts added!`);
    renderScheduleDetail(document.getElementById('app'), { id: scheduleId });
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function publishSchedule(scheduleId) {
  try {
    await API.updateSchedule(scheduleId, { status: 'published' });
    UI.toast('Schedule published! Employees can now see their shifts.');
    renderScheduleDetail(document.getElementById('app'), { id: scheduleId });
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function sendScheduleNotification(scheduleId) {
  try {
    const { shifts } = await API.getShifts(scheduleId);
    const pendingEmpIds = [...new Set(shifts.filter(s => s.status === 'pending').map(s => s.employee_id))];

    if (pendingEmpIds.length === 0) {
      UI.toast('No pending shifts to notify about');
      return;
    }

    await API.sendPush({
      employeeIds: pendingEmpIds,
      title: 'Schedule Update',
      body: 'You have a shift waiting for your confirmation. Open CrewCast to respond!',
      url: '/schedule',
    });

    UI.toast(`Notified ${pendingEmpIds.length} employees`);
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}
