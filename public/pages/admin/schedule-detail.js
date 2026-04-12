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

  app.innerHTML = UI.adminShell('schedules', `
    <div class="page">
      <div class="page-header flex justify-between items-center">
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('/admin/schedules')">${SVG.chevLeft} Back</button>
        <div id="sched-actions"></div>
      </div>
      <div id="schedule-detail">${UI.loading()}</div>
    </div>
  `);

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
        <div class="card mb-4 ring-row" style="display:flex;justify-content:space-around;align-items:center;padding:20px 12px;flex-wrap:wrap;gap:12px">
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
  // Exclude admins/leads from auto-fill
  const emps = (window._scheduleEmployees || []).filter(e => e.role !== 'admin' && e.role !== 'lead');

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

  // Load preference setting
  let usePreferences = true;
  let prefsFeatureEnabled = true;
  try {
    const settings = await API.getSettings();
    if (settings.usePreferences === false) usePreferences = false;
    if (settings.employeeRankStations === false) { prefsFeatureEnabled = false; usePreferences = false; }
  } catch (e) {}

  const defaultTotal = stations.reduce((sum, s) => sum + (s.staff_needed || 0), 0);
  const minTotal = stations.reduce((sum, s) => sum + (s.min_staff || 1), 0);
  const maxTotal = stations.reduce((sum, s) => sum + (s.max_staff || s.staff_needed || 0), 0);

  // Build list of all dates in the schedule range
  const scheduleDates = [];
  const startD = new Date(schedule.start_date + 'T12:00:00');
  const endD = new Date(schedule.end_date + 'T12:00:00');
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    scheduleDates.push(d.toISOString().split('T')[0]);
  }

  UI.showModal('Auto-Fill Shifts', `
    <p class="text-sm text-muted mb-3">Set your total crew size and stations will scale automatically.</p>

    <div class="form-group">
      <label class="form-label">Total Staff for This Day</label>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <input type="range" id="af-total-slider" min="${minTotal}" max="${Math.max(maxTotal, emps.length)}" value="${defaultTotal}"
          oninput="onTotalStaffChange(this.value)" style="flex:1;accent-color:var(--purple)">
        <input type="number" id="af-total-input" min="${minTotal}" max="${Math.max(maxTotal, emps.length)}" value="${defaultTotal}"
          oninput="onTotalStaffChange(this.value)" style="width:60px;text-align:center;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:6px;font-size:16px;font-weight:600">
      </div>
      <div class="flex justify-between text-xs text-muted">
        <span>Min: ${minTotal}</span>
        <span>Default: ${defaultTotal}</span>
        <span>Max: ${maxTotal}</span>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Dates to Fill</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px">
        ${scheduleDates.map(dt => `
          <label style="display:flex;align-items:center;gap:4px;padding:4px 10px;background:rgba(30,41,59,.5);border-radius:6px;border:1px solid var(--border);cursor:pointer">
            <input type="checkbox" class="af-date-cb" value="${dt}" checked style="width:14px;height:14px;accent-color:var(--purple)">
            <span class="text-sm">${new Date(dt + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </label>
        `).join('')}
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Station Breakdown <span class="text-xs text-muted">(toggle stations on/off · auto-scaled)</span></label>
      <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px" id="af-station-list">
        ${stations.map(s => `
          <div class="flex items-center" style="padding:6px 0;border-bottom:1px solid rgba(51,65,85,.2);gap:10px" data-station="${s.name}" data-enabled="1" data-min="${s.min_staff || 1}" data-default="${s.staff_needed || 0}" data-max="${s.max_staff || 0}" data-open="${s.open_time}" data-close="${s.close_time}">
            <label style="display:flex;align-items:center;cursor:pointer;gap:6px;flex:1">
              <input type="checkbox" class="af-station-toggle" checked
                onchange="onStationToggle(this)"
                style="width:16px;height:16px;accent-color:var(--purple);cursor:pointer">
              <span class="text-sm semi af-station-label">${s.name}</span>
            </label>
            <span class="text-xs af-station-scaled" style="color:var(--purple-light);font-weight:600;min-width:40px;text-align:right">${s.staff_needed || 0}</span>
          </div>
        `).join('')}
      </div>
      <div class="text-xs text-muted mt-1">Uncheck a station to exclude it from this auto-fill run.</div>
    </div>

    <div id="autofill-summary" class="card" style="background:var(--bg-primary);padding:12px;margin-bottom:8px">
      <div class="flex justify-between text-sm">
        <span>Stations:</span>
        <span class="semi" id="af-station-count">${stations.length}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span>Total staff:</span>
        <span class="semi text-purple" id="af-staff-count">${defaultTotal}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span>Available employees:</span>
        <span class="semi ${emps.length < defaultTotal ? 'text-amber' : 'text-green'}" id="af-avail-count">${emps.length}</span>
      </div>
    </div>

    ${prefsFeatureEnabled ? `<div class="card mb-3" style="background:var(--bg-primary);padding:12px">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
        <input type="checkbox" id="af-use-prefs" ${usePreferences ? 'checked' : ''}
          onchange="togglePreferenceMatching(this.checked)"
          style="width:18px;height:18px;accent-color:var(--purple)">
        <div>
          <div class="text-sm semi">Use Employee Preferences</div>
          <div class="text-xs text-muted">Prioritize stations employees ranked higher when assigning</div>
        </div>
      </label>
    </div>` : ''}

    <p class="text-xs text-muted">Employees are scored by training + preference rank. You can adjust assignments after generating.</p>
  `, `
    <button class="btn btn-primary" onclick="executeAutoFill(${scheduleId})">Generate Shifts</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);

  // Store for use in execute
  window._autoFillStations = stations;

  // Initialize scaled values
  onTotalStaffChange(defaultTotal);
}

function onStationToggle(cb) {
  const row = cb.closest('[data-station]');
  if (!row) return;
  row.dataset.enabled = cb.checked ? '1' : '0';
  // Dim disabled rows so the state is obvious
  row.style.opacity = cb.checked ? '1' : '0.45';
  const label = row.querySelector('.af-station-scaled');
  if (label && !cb.checked) label.textContent = '—';
  // Re-scale staff across remaining stations
  const input = document.getElementById('af-total-input');
  onTotalStaffChange(input ? input.value : 0);
}

function onTotalStaffChange(val) {
  const total = parseInt(val) || 0;
  // Sync slider and input
  const slider = document.getElementById('af-total-slider');
  const input = document.getElementById('af-total-input');
  if (slider && slider.value != total) slider.value = total;
  if (input && input.value != total) input.value = total;

  // Proportionally scale stations (only enabled ones)
  const rows = document.querySelectorAll('#af-station-list [data-station]');
  const defaults = [];
  let defaultSum = 0;
  rows.forEach(row => {
    const enabled = row.dataset.enabled !== '0';
    if (!enabled) return;
    const def = parseInt(row.dataset.default) || 1;
    const min = parseInt(row.dataset.min) || 1;
    const max = parseInt(row.dataset.max) || def;
    defaults.push({ row, def, min, max });
    defaultSum += def;
  });

  // Scale each enabled station proportionally, clamped to min/max
  const scaled = defaults.map(d => {
    let n = Math.round((d.def / (defaultSum || 1)) * total);
    n = Math.max(d.min, Math.min(d.max, n));
    return n;
  });
  // Adjust rounding to hit exact total
  let diff = total - scaled.reduce((s, n) => s + n, 0);
  for (let i = 0; diff !== 0 && i < scaled.length; i++) {
    if (diff > 0 && scaled[i] < defaults[i].max) { scaled[i]++; diff--; }
    else if (diff < 0 && scaled[i] > defaults[i].min) { scaled[i]--; diff++; }
  }

  // Apply scaled values to enabled rows; disabled rows stay at 0
  defaults.forEach((d, i) => {
    const label = d.row.querySelector('.af-station-scaled');
    if (label) label.textContent = scaled[i];
    d.row.dataset.scaled = scaled[i];
  });
  rows.forEach(row => {
    if (row.dataset.enabled === '0') row.dataset.scaled = '0';
  });

  // Update summary
  document.getElementById('af-staff-count').textContent = total;
  const empCount = (window._scheduleEmployees || []).filter(e => e.role !== 'admin' && e.role !== 'lead').length;
  const availEl = document.getElementById('af-avail-count');
  if (availEl) {
    availEl.textContent = empCount;
    availEl.className = `semi ${empCount < total ? 'text-amber' : 'text-green'}`;
  }
}

// Keep backward compat — old code might call this
function updateAutoFillSummary() { onTotalStaffChange(document.getElementById('af-total-input')?.value || 0); }

async function executeAutoFill(scheduleId) {
  const dateCbs = document.querySelectorAll('.af-date-cb:checked');
  const dates = Array.from(dateCbs).map(cb => cb.value);
  if (dates.length === 0) { UI.toast('Select at least one date', 'error'); return; }

  // Exclude admins/leads
  const emps = (window._scheduleEmployees || []).filter(e => e.role !== 'admin' && e.role !== 'lead');
  if (emps.length === 0) { UI.toast('No employees available', 'error'); return; }

  const stationRows = document.querySelectorAll('#af-station-list [data-station]');
  if (stationRows.length === 0) { UI.toast('No stations found', 'error'); return; }

  // Load business settings to check if preference matching is enabled
  let usePreferences = true; // default ON
  try {
    const settings = await API.getSettings();
    if (settings.usePreferences === false) usePreferences = false;
  } catch (e) { /* settings not set yet, default to true */ }

  // Load station skill + preference data for each station
  // stationSkillMap: stationName -> [{ id, rank, preferred }]
  let stationSkillMap = {};
  const allStations = window._autoFillStations || [];
  try {
    for (const s of allStations) {
      const trained = await API.getEmployeesByStation(s.id);
      if (trained.length > 0) {
        stationSkillMap[s.name] = trained.map(t => ({
          id: t.id,
          rank: t.rank || 0,
          preferred: t.preferred || false,
        }));
      }
    }
  } catch (e) { /* skills not set up yet, fall back to round-robin */ }

  // Score an employee for a station (higher = better fit)
  function scoreEmployee(emp, stationName) {
    const trained = stationSkillMap[stationName] || [];
    const match = trained.find(t => t.id === emp.id);
    if (!match) return 0; // not trained for this station

    let score = 10; // base score for being trained
    if (usePreferences && match.rank > 0) {
      // rank 1 = +100, rank 2 = +75, rank 3 = +50, rank 4+ = +25
      if (match.rank === 1) score += 100;
      else if (match.rank === 2) score += 75;
      else if (match.rank === 3) score += 50;
      else score += 25;
    }
    if (match.preferred) score += 15;
    return score;
  }

  // Collect station requests with scaled staff counts (skip disabled stations)
  const stationRequests = [];
  stationRows.forEach(row => {
    if (row.dataset.enabled === '0') return;
    const scaled = parseInt(row.dataset.scaled) || parseInt(row.dataset.default) || 1;
    if (scaled > 0) {
      stationRequests.push({
        name: row.dataset.station,
        needed: scaled,
        openTime: row.dataset.open || '09:00',
        closeTime: row.dataset.close || '17:00',
      });
    }
  });
  if (stationRequests.length === 0) {
    UI.toast('Enable at least one station', 'error');
    return;
  }

  // Build shifts for EACH selected date
  const shifts = [];
  for (const date of dates) {
    const usedEmployees = new Set();
    let empIndex = 0;

    stationRequests.forEach(station => {
      let assigned = 0;

      const scored = emps
        .filter(e => !usedEmployees.has(e.id))
        .map(e => ({ emp: e, score: scoreEmployee(e, station.name) }))
        .sort((a, b) => b.score - a.score);

      for (const { emp, score } of scored) {
        if (assigned >= station.needed) break;
        if (score > 0 && !usedEmployees.has(emp.id)) {
          shifts.push({ employeeId: emp.id, date, startTime: station.openTime, endTime: station.closeTime, station: station.name });
          usedEmployees.add(emp.id);
          assigned++;
        }
      }

      while (assigned < station.needed && emps.length > 0) {
        const emp = emps[empIndex % emps.length];
        empIndex++;
        if (empIndex > emps.length * 2) break;
        if (!usedEmployees.has(emp.id)) {
          shifts.push({ employeeId: emp.id, date, startTime: station.openTime, endTime: station.closeTime, station: station.name });
          usedEmployees.add(emp.id);
          assigned++;
        }
      }
    });
  }

  try {
    await API.addShifts(scheduleId, shifts);
    UI.closeModal();
    const prefCount = usePreferences ? Object.values(stationSkillMap).reduce((sum, arr) => sum + arr.filter(t => t.rank > 0).length, 0) : 0;
    let msg = `Generated ${shifts.length} shifts across ${stationRequests.length} stations, ${dates.length} day${dates.length > 1 ? 's' : ''}!`;
    if (prefCount > 0) msg = `Generated ${shifts.length} shifts across ${dates.length} day${dates.length > 1 ? 's' : ''} (preference-matched)!`;
    else if (Object.keys(stationSkillMap).length > 0) msg = `Generated ${shifts.length} shifts across ${dates.length} day${dates.length > 1 ? 's' : ''} (skill-matched)!`;
    UI.toast(msg);
    renderScheduleDetail(document.getElementById('app'), { id: scheduleId });
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function togglePreferenceMatching(enabled) {
  try {
    await API.updateSettings({ usePreferences: enabled });
    UI.toast(enabled ? 'Preference matching ON' : 'Preference matching OFF');
  } catch (err) {
    UI.toast('Failed to save setting', 'error');
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
