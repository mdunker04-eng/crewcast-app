// ═══════════════════════════════════════════════════════
// CrewCast — Admin Schedule Detail
// View shifts, add employees, publish — with coverage dashboard
// ═══════════════════════════════════════════════════════

function progressRing(pct, color, label, count) {
  const c = color === 'green' ? '#34D399' : color === 'amber' ? '#FBBF24' : '#F87171';
  const bg = 'rgba(51,65,85,.4)';
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="position:relative;width:64px;height:64px">
        <div style="width:64px;height:64px;border-radius:50%;background:conic-gradient(${c} ${pct * 3.6}deg, ${bg} 0deg)"></div>
        <div style="position:absolute;inset:8px;border-radius:50%;background:var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:${c}">${count}</div>
      </div>
      <span style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">${label}</span>
    </div>
  `;
}

function buildStationCoverage(shifts) {
  const byStation = {};
  shifts.forEach(s => {
    const st = s.station || 'Unassigned';
    if (!byStation[st]) byStation[st] = { confirmed: 0, pending: 0, declined: 0, total: 0 };
    byStation[st][s.status]++;
    byStation[st].total++;
  });
  if (Object.keys(byStation).length === 0) return '';

  return `
    <div class="card mb-4">
      <div class="card-title mb-3">Station Coverage</div>
      ${Object.entries(byStation).map(([name, c]) => {
        const pct = c.total > 0 ? Math.round((c.confirmed / c.total) * 100) : 0;
        const barGreen = c.total > 0 ? (c.confirmed / c.total * 100) : 0;
        const barAmber = c.total > 0 ? (c.pending / c.total * 100) : 0;
        const barRed = c.total > 0 ? (c.declined / c.total * 100) : 0;
        return `
          <div style="margin-bottom:12px">
            <div class="flex justify-between items-center mb-1">
              <span class="text-sm semi">${name}</span>
              <span class="text-xs text-muted">${c.confirmed}/${c.total} confirmed</span>
            </div>
            <div style="height:8px;border-radius:4px;background:var(--bg-primary);overflow:hidden;display:flex">
              <div style="width:${barGreen}%;background:var(--green);transition:width .3s"></div>
              <div style="width:${barAmber}%;background:var(--amber);transition:width .3s"></div>
              <div style="width:${barRed}%;background:var(--red);transition:width .3s"></div>
            </div>
            <div class="flex gap-2 mt-1">
              ${c.confirmed ? `<span class="text-xs text-green">✓ ${c.confirmed}</span>` : ''}
              ${c.pending ? `<span class="text-xs text-amber">⏳ ${c.pending}</span>` : ''}
              ${c.declined ? `<span class="text-xs text-red">✗ ${c.declined}</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

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

    const total = shifts.length;
    const confirmed = shifts.filter(s => s.status === 'confirmed').length;
    const pending = shifts.filter(s => s.status === 'pending').length;
    const declined = shifts.filter(s => s.status === 'declined').length;
    const confirmedPct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
    const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;
    const declinedPct = total > 0 ? Math.round((declined / total) * 100) : 0;

    document.getElementById('sched-actions').innerHTML = `
      ${schedule.status === 'draft' ? `
        <button class="btn btn-success btn-sm" onclick="publishSchedule(${scheduleId})">Publish</button>
      ` : ''}
    `;

    // View toggle state
    const viewMode = window._schedDetailView || 'overview';

    document.getElementById('schedule-detail').innerHTML = `
      <h2>${schedule.name}</h2>
      <p class="subtitle">${UI.formatDate(schedule.start_date)} - ${UI.formatDate(schedule.end_date)} ${UI.statusBadge(schedule.status)}</p>

      ${total > 0 ? `
        <!-- Progress Rings -->
        <div class="card mb-4" style="display:flex;justify-content:space-around;align-items:center;padding:20px 12px">
          ${progressRing(confirmedPct, 'green', 'Confirmed', confirmed)}
          ${progressRing(pendingPct, 'amber', 'Pending', pending)}
          ${progressRing(declinedPct, 'red', 'Declined', declined)}
        </div>

        ${declined > 0 ? `
          <div class="card mb-4" style="background:var(--red-bg);border-color:rgba(239,68,68,.25)">
            <div class="flex items-center gap-2">
              <span style="font-size:18px">⚠️</span>
              <div>
                <div class="text-sm semi" style="color:var(--red-text)">${declined} shift${declined > 1 ? 's' : ''} declined</div>
                <div class="text-xs text-muted">Use Auto-Fill to find replacements or manually reassign.</div>
              </div>
            </div>
          </div>
        ` : ''}
      ` : ''}

      <div class="flex gap-2 mb-4">
        <button class="btn btn-primary" style="flex:1" onclick="showAutoFillModal(${scheduleId})">
          ${SVG.station} Auto-Fill Shifts
        </button>
        <button class="btn btn-secondary" style="flex:1" onclick="showAddShiftsModal(${scheduleId})">
          ${SVG.plus} Manual Add
        </button>
      </div>

      ${total > 0 ? `
        <!-- View Toggle -->
        <div class="flex gap-2 mb-3">
          <button class="btn btn-sm ${viewMode === 'overview' ? 'btn-primary' : 'btn-secondary'}" onclick="window._schedDetailView='overview';renderScheduleDetail(document.getElementById('app'),{id:${scheduleId}})">By Date</button>
          <button class="btn btn-sm ${viewMode === 'stations' ? 'btn-primary' : 'btn-secondary'}" onclick="window._schedDetailView='stations';renderScheduleDetail(document.getElementById('app'),{id:${scheduleId}})">By Station</button>
        </div>
      ` : ''}

      ${Object.keys(byDate).length === 0 ? UI.empty('📋', 'No shifts yet', 'Add employees to this schedule') : ''}

      ${viewMode === 'stations' && total > 0 ? buildStationCoverage(shifts) : ''}

      ${viewMode === 'overview' ? Object.entries(byDate).map(([date, dayShifts]) => `
        <div class="mb-4">
          <h3 class="text-purple mb-2">${UI.formatDate(date)} (${dayShifts.length} staff)</h3>
          ${dayShifts.map(s => `
            <div class="shift-card ${s.status}">
              <div class="flex justify-between items-center">
                <div>
                  <div class="semi">${s.first_name} ${s.last_name}</div>
                  <div class="shift-time">${UI.formatTime(s.start_time)} - ${UI.formatTime(s.end_time)}</div>
                  ${s.station ? `<div class="shift-station">Station: ${s.station}</div>` : ''}
                  ${s.status === 'declined' && s.decline_reason ? `<div class="text-xs text-red mt-1">Reason: ${s.decline_reason}</div>` : ''}
                </div>
                ${UI.statusBadge(s.status)}
              </div>
            </div>
          `).join('')}
        </div>
      `).join('') : ''}

      ${viewMode === 'stations' && total > 0 ? `
        <!-- Individual shift cards grouped by station -->
        ${(() => {
          const byStation = {};
          shifts.forEach(s => {
            const st = s.station || 'Unassigned';
            if (!byStation[st]) byStation[st] = [];
            byStation[st].push(s);
          });
          return Object.entries(byStation).map(([station, stShifts]) => `
            <div class="mb-4">
              <h3 class="text-purple mb-2">${station} (${stShifts.length} staff)</h3>
              ${stShifts.map(s => `
                <div class="shift-card ${s.status}">
                  <div class="flex justify-between items-center">
                    <div>
                      <div class="semi">${s.first_name} ${s.last_name}</div>
                      <div class="shift-time">${UI.formatTime(s.start_time)} - ${UI.formatTime(s.end_time)} · ${UI.formatDate(s.date)}</div>
                      ${s.status === 'declined' && s.decline_reason ? `<div class="text-xs text-red mt-1">Reason: ${s.decline_reason}</div>` : ''}
                    </div>
                    ${UI.statusBadge(s.status)}
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('');
        })()}
      ` : ''}

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

async function showAddShiftsModal(scheduleId) {
  const emps = window._scheduleEmployees || [];
  const schedule = window._scheduleData;

  // Load stations for dropdown
  let stationOptions = '<option value="">— No station —</option>';
  try {
    const stations = await API.getStations();
    stationOptions += stations.filter(s => s.active).map(s =>
      `<option value="${s.name}" data-open="${s.open_time}" data-close="${s.close_time}">${s.name}</option>`
    ).join('');
  } catch (e) { /* stations not set up yet, that's fine */ }

  UI.showModal('Add Shifts', `
    <div class="form-group">
      <label class="form-label">Station</label>
      <select id="shift-station" class="form-input" onchange="onStationSelect()">
        ${stationOptions}
      </select>
    </div>
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

// When a station is selected, auto-fill open/close times
function onStationSelect() {
  const sel = document.getElementById('shift-station');
  const opt = sel.options[sel.selectedIndex];
  const open = opt.dataset.open;
  const close = opt.dataset.close;
  if (open) document.getElementById('shift-start').value = open;
  if (close) document.getElementById('shift-end').value = close;
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

// ═══════════════════════════════════════════════════════
// Auto-Fill Shifts — generate shifts from stations
// ═══════════════════════════════════════════════════════

async function showAutoFillModal(scheduleId) {
  const schedule = window._scheduleData;
  const emps = window._scheduleEmployees || [];

  let stations = [];
  try {
    stations = (await API.getStations()).filter(s => s.active);
  } catch (e) {
    UI.toast('Set up stations first', 'error');
    return;
  }

  if (stations.length === 0) {
    UI.toast('No stations set up yet. Go to Stations first.', 'error');
    return;
  }

  const totalNeeded = stations.reduce((sum, s) => sum + (s.staff_needed || 0), 0);

  UI.showModal('Auto-Fill Shifts', `
    <p class="text-sm text-muted mb-3">Select a date and which stations to staff. Employees will be auto-assigned based on staff needed per station.</p>

    <div class="form-group">
      <label class="form-label">Date</label>
      <input type="date" id="autofill-date" class="form-input" value="${schedule.start_date}">
    </div>

    <div class="form-group">
      <label class="form-label">Stations to Staff</label>
      <div class="flex gap-2 mb-2">
        <button class="btn btn-ghost btn-sm" onclick="document.querySelectorAll('.af-station-cb').forEach(c=>c.checked=true);updateAutoFillSummary()">All</button>
        <button class="btn btn-ghost btn-sm" onclick="document.querySelectorAll('.af-station-cb').forEach(c=>c.checked=false);updateAutoFillSummary()">None</button>
      </div>
      <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px">
        ${stations.map(s => `
          <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;border-bottom:1px solid rgba(51,65,85,.2)">
            <input type="checkbox" class="af-station-cb" data-station="${s.name}" data-needed="${s.staff_needed || 0}"
              data-open="${s.open_time}" data-close="${s.close_time}" checked
              onchange="updateAutoFillSummary()"
              style="width:16px;height:16px;accent-color:var(--purple)">
            <div style="flex:1">
              <span class="text-sm semi">${s.name}</span>
            </div>
            <span class="text-xs text-muted">${s.staff_needed || 0} staff</span>
          </label>
        `).join('')}
      </div>
    </div>

    <div id="autofill-summary" class="card" style="background:var(--bg-primary);padding:12px;margin-bottom:8px">
      <div class="flex justify-between text-sm">
        <span>Stations selected:</span>
        <span class="semi" id="af-station-count">${stations.length}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span>Total staff needed:</span>
        <span class="semi" id="af-staff-count">${totalNeeded}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span>Available employees:</span>
        <span class="semi ${emps.length < totalNeeded ? 'text-amber' : 'text-green'}">${emps.length}</span>
      </div>
    </div>

    <p class="text-xs text-muted">Employees are assigned round-robin across stations. You can adjust assignments after generating.</p>
  `, `
    <button class="btn btn-primary" onclick="executeAutoFill(${scheduleId})">Generate Shifts</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);

  // Store for use in execute
  window._autoFillStations = stations;
}

function updateAutoFillSummary() {
  const checked = document.querySelectorAll('.af-station-cb:checked');
  let totalNeeded = 0;
  checked.forEach(cb => { totalNeeded += parseInt(cb.dataset.needed) || 0; });
  document.getElementById('af-station-count').textContent = checked.length;
  document.getElementById('af-staff-count').textContent = totalNeeded;

  const empCount = (window._scheduleEmployees || []).length;
  const empEl = document.getElementById('af-staff-count').parentElement.nextElementSibling.querySelector('.semi');
  if (empEl) {
    empEl.className = `semi ${empCount < totalNeeded ? 'text-amber' : 'text-green'}`;
  }
}

async function executeAutoFill(scheduleId) {
  const date = document.getElementById('autofill-date').value;
  if (!date) { UI.toast('Select a date', 'error'); return; }

  const emps = window._scheduleEmployees || [];
  if (emps.length === 0) { UI.toast('No employees available', 'error'); return; }

  const checked = document.querySelectorAll('.af-station-cb:checked');
  if (checked.length === 0) { UI.toast('Select at least one station', 'error'); return; }

  // Try to load station skill data for smarter assignment
  let stationSkillMap = {}; // stationId -> [empId, empId, ...]
  const allStations = window._autoFillStations || [];
  try {
    for (const s of allStations) {
      const trained = await API.getEmployeesByStation(s.id);
      if (trained.length > 0) {
        stationSkillMap[s.name] = trained.map(t => t.id);
      }
    }
  } catch (e) { /* skills not set up yet, fall back to round-robin */ }

  // Build shifts: prefer trained employees, then fill with round-robin
  const shifts = [];
  const usedEmployees = new Set(); // track who's already assigned
  let empIndex = 0;

  checked.forEach(cb => {
    const stationName = cb.dataset.station;
    const needed = parseInt(cb.dataset.needed) || 1;
    const openTime = cb.dataset.open || '09:00';
    const closeTime = cb.dataset.close || '17:00';

    // Get trained employees for this station
    const trainedIds = stationSkillMap[stationName] || [];
    let assigned = 0;

    // First: assign trained employees who aren't used yet
    for (const trainedId of trainedIds) {
      if (assigned >= needed) break;
      if (!usedEmployees.has(trainedId)) {
        shifts.push({ employeeId: trainedId, date, startTime: openTime, endTime: closeTime, station: stationName });
        usedEmployees.add(trainedId);
        assigned++;
      }
    }

    // Then: fill remaining with round-robin from all employees
    while (assigned < needed && emps.length > 0) {
      const emp = emps[empIndex % emps.length];
      empIndex++;
      // Allow double-assigning if we've gone through everyone
      if (empIndex > emps.length * 2) break;
      if (!usedEmployees.has(emp.id)) {
        shifts.push({ employeeId: emp.id, date, startTime: openTime, endTime: closeTime, station: stationName });
        usedEmployees.add(emp.id);
        assigned++;
      }
    }
  });

  try {
    await API.addShifts(scheduleId, shifts);
    UI.closeModal();
    const trainedCount = Object.keys(stationSkillMap).length;
    const msg = trainedCount > 0
      ? `Generated ${shifts.length} shifts (skill-matched where possible)!`
      : `Generated ${shifts.length} shifts across ${checked.length} stations!`;
    UI.toast(msg);
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
