// ═══════════════════════════════════════════════════════
// CrewCast — Admin Schedule Management (with Calendar)
// ═══════════════════════════════════════════════════════

let _calendarMonth = null;
let _calendarYear = null;
let _selectedDates = new Set();

async function renderAdminSchedules(app) {
  app.innerHTML = UI.adminShell('schedules', `
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
  `);

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
  // Initialize calendar to current month
  const now = new Date();
  _calendarMonth = now.getMonth();
  _calendarYear = now.getFullYear();
  _selectedDates = new Set();

  UI.showModal('New Schedule', `
    <div class="form-group">
      <label class="form-label">Schedule Name</label>
      <input type="text" id="sched-name" class="form-input" placeholder="e.g. Weekend of May 3-4">
    </div>
    <div class="form-group">
      <label class="form-label">Select Dates</label>
      <p class="text-xs text-muted mb-2">Tap days on the calendar to select schedule dates</p>
      <div class="calendar">
        <div class="calendar-header">
          <button class="btn btn-ghost btn-sm" onclick="schedCalNav(-1)">${SVG.chevLeft}</button>
          <span id="sched-cal-title" class="semi"></span>
          <button class="btn btn-ghost btn-sm" onclick="schedCalNav(1)">${SVG.chevRight}</button>
        </div>
        <div class="calendar-grid">
          <div class="calendar-day-label">Sun</div>
          <div class="calendar-day-label">Mon</div>
          <div class="calendar-day-label">Tue</div>
          <div class="calendar-day-label">Wed</div>
          <div class="calendar-day-label">Thu</div>
          <div class="calendar-day-label">Fri</div>
          <div class="calendar-day-label">Sat</div>
        </div>
        <div id="sched-cal-days" class="calendar-grid"></div>
      </div>
      <div id="sched-selected-dates" class="text-xs text-muted"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes (optional)</label>
      <input type="text" id="sched-notes" class="form-input" placeholder="Any special instructions...">
    </div>
  `, `
    <button class="btn btn-primary" onclick="createSchedule()">Create</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);

  renderScheduleCalendar();
}

function schedCalNav(dir) {
  _calendarMonth += dir;
  if (_calendarMonth < 0) { _calendarMonth = 11; _calendarYear--; }
  if (_calendarMonth > 11) { _calendarMonth = 0; _calendarYear++; }
  renderScheduleCalendar();
}

function renderScheduleCalendar() {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  document.getElementById('sched-cal-title').textContent =
    `${monthNames[_calendarMonth]} ${_calendarYear}`;

  const firstDay = new Date(_calendarYear, _calendarMonth, 1).getDay();
  const daysInMonth = new Date(_calendarYear, _calendarMonth + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let html = '';

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(_calendarYear, _calendarMonth, d);
    const dateStr = `${_calendarYear}-${String(_calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();
    const isSelected = _selectedDates.has(dateStr);

    let cls = 'calendar-day';
    if (isPast) cls += ' other-month';
    if (isToday) cls += ' today';
    if (isSelected) cls += ' selected';

    html += `<div class="${cls}" onclick="${isPast ? '' : `toggleSchedDate('${dateStr}')`}" style="${isPast ? 'cursor:default' : ''}">${d}</div>`;
  }

  document.getElementById('sched-cal-days').innerHTML = html;
  updateSelectedDatesDisplay();
}

function toggleSchedDate(dateStr) {
  if (_selectedDates.has(dateStr)) {
    _selectedDates.delete(dateStr);
  } else {
    _selectedDates.add(dateStr);
  }
  renderScheduleCalendar();
}

function updateSelectedDatesDisplay() {
  const el = document.getElementById('sched-selected-dates');
  if (_selectedDates.size === 0) {
    el.textContent = 'No dates selected';
    return;
  }
  const sorted = Array.from(_selectedDates).sort();
  el.textContent = `${sorted.length} date${sorted.length > 1 ? 's' : ''} selected: ${sorted.map(d => UI.formatDate(d)).join(', ')}`;

  // Auto-fill schedule name if empty
  const nameInput = document.getElementById('sched-name');
  if (!nameInput.value && sorted.length > 0) {
    if (sorted.length === 1) {
      nameInput.value = UI.formatDate(sorted[0]);
    } else {
      nameInput.value = `${UI.formatDate(sorted[0])} - ${UI.formatDate(sorted[sorted.length - 1])}`;
    }
  }
}

async function createSchedule() {
  const name = document.getElementById('sched-name').value;
  const notes = document.getElementById('sched-notes').value;

  if (_selectedDates.size === 0) {
    UI.toast('Select at least one date', 'error');
    return;
  }

  const sorted = Array.from(_selectedDates).sort();
  const startDate = sorted[0];
  const endDate = sorted[sorted.length - 1];

  if (!name) {
    UI.toast('Name required', 'error');
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
