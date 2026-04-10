// ═══════════════════════════════════════════════════════════════
// CrewCast — Today's Assignments Page
// Big-screen digital poster showing today's staff assignments by station
// Works as admin page (/admin/assignments) and employee view (/assignments)
// ═══════════════════════════════════════════════════════════════

// Helper: get today's date in YYYY-MM-DD format
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: format date like "Sat, Oct 17"
function formatAssignmentDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const dayNum = d.getDate();
  return `${dayName}, ${month} ${dayNum}`;
}

// Helper: format time like "9:00 AM"
function formatAssignmentTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
}

async function renderAssignmentsContent(selectedDate, isAdminView) {
  try {
    // Fetch schedules to find one covering today/selected date
    const schedules = await API.getSchedules();
    if (schedules.length === 0) {
      return `
        <div style="text-align:center;padding:40px 20px">
          ${isAdminView ? '<div style="font-size:48px;margin-bottom:12px">📋</div>' : ''}
          <div class="text-lg semi" style="margin-bottom:8px">No schedules found</div>
          <div class="text-sm text-muted">Create a schedule first to see assignments</div>
        </div>
      `;
    }

    // Find a schedule that covers the selected date
    const applicableSchedules = schedules.filter(s => {
      const startDate = s.start_date || s.date;
      const endDate = s.end_date || s.date;
      return selectedDate >= startDate && selectedDate <= endDate;
    });

    if (applicableSchedules.length === 0) {
      return `
        <div style="text-align:center;padding:40px 20px">
          ${isAdminView ? '<div style="font-size:48px;margin-bottom:12px">📋</div>' : ''}
          <div class="text-lg semi" style="margin-bottom:8px">No active schedule for ${formatAssignmentDate(selectedDate)}</div>
          <div class="text-sm text-muted">Select a different date or create a schedule</div>
        </div>
      `;
    }

    // Get shifts for the selected date from all applicable schedules
    const allShifts = [];
    for (const schedule of applicableSchedules) {
      try {
        const { shifts } = await API.getShifts(schedule.id);
        const todayShifts = shifts.filter(s => s.date === selectedDate && s.status !== 'declined');
        allShifts.push(...todayShifts);
      } catch (e) {
        console.log('Could not load shifts for schedule', schedule.id);
      }
    }

    if (allShifts.length === 0) {
      return `
        <div style="text-align:center;padding:40px 20px">
          ${isAdminView ? '<div style="font-size:48px;margin-bottom:12px">📋</div>' : ''}
          <div class="text-lg semi" style="margin-bottom:8px">No assignments for ${formatAssignmentDate(selectedDate)}</div>
          <div class="text-sm text-muted">This day has no shifts scheduled</div>
        </div>
      `;
    }

    // Get stations and employees for reference
    const [stations, employees] = await Promise.all([
      API.getStations(),
      API.getEmployees()
    ]).catch(() => [[], []]);

    const stationMap = {};
    stations.forEach(s => { stationMap[s.id] = s; stationMap[s.name] = s; });

    const employeeMap = {};
    employees.forEach(e => { employeeMap[e.id] = e; });

    // Group shifts by station
    const byStation = {};
    allShifts.forEach(shift => {
      const stationId = shift.station_id || shift.station;
      const station = stationMap[stationId] || { id: stationId, name: shift.station || 'Unassigned', icon: '📍' };
      if (!byStation[station.id]) {
        byStation[station.id] = { station, shifts: [] };
      }
      byStation[station.id].shifts.push(shift);
    });

    // Sort stations by some priority (e.g., alphabetical or by icon)
    const sortedStations = Object.values(byStation).sort((a, b) => {
      return (a.station.name || '').localeCompare(b.station.name || '');
    });

    // Build the big-screen layout
    let html = '';

    // For employee view, add centered header
    if (!isAdminView) {
      // Employee view
      html += `
        <div style="text-align:center;margin-bottom:24px">
          <div style="font-size:14px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Today's Assignments</div>
          <h2 style="margin:0;font-size:24px">${formatAssignmentDate(selectedDate)}</h2>
          <div style="color:var(--text-muted);margin-top:4px">${API.user?.businessName || 'CrewCast'}</div>
        </div>
      `;
    }

    // Big-screen station cards with employee chips
    html += '<div style="display:grid;grid-template-columns:1fr;gap:16px">';

    sortedStations.forEach(({ station, shifts }) => {
      // Get unique confirmed/pending employees for this station
      const staffSet = new Set();
      const employees = [];
      shifts.forEach(shift => {
        if (shift.employee_id && !staffSet.has(shift.employee_id)) {
          staffSet.add(shift.employee_id);
          const emp = employeeMap[shift.employee_id];
          if (emp) {
            employees.push({
              id: emp.id,
              firstName: emp.first_name || emp.firstName || 'Unknown',
              lastName: emp.last_name || emp.lastName || '',
              status: shift.status
            });
          }
        }
      });

      // Get time range for this station
      const timeRange = shifts.length > 0 ? `${formatAssignmentTime(shifts[0].start_time)} - ${formatAssignmentTime(shifts[0].end_time)}` : '';

      html += `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
          <div style="padding:16px 20px;background:linear-gradient(135deg, rgba(96,165,250,.05), rgba(56,189,248,.05));border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
              <span style="font-size:28px">${station.icon || '📍'}</span>
              <div>
                <div class="semi" style="font-size:18px;color:var(--text)">${station.name || 'Unassigned'}</div>
              </div>
            </div>
            <div style="font-size:14px;color:var(--text-muted);margin-left:38px">${timeRange}</div>
          </div>
          <div style="padding:16px 20px">
            ${employees.length > 0 ? `
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:10px">
                ${employees.map(emp => `
                  <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;padding:12px;text-align:center;${emp.status === 'pending' ? 'border-color:var(--amber);background:rgba(251,191,36,.05)' : 'background:var(--bg-primary)'}">
                    <div class="semi" style="font-size:14px;margin-bottom:4px;word-wrap:break-word">${emp.firstName}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;word-wrap:break-word">${emp.lastName}</div>
                    ${emp.status === 'pending' ? `<span style="display:inline-block;font-size:11px;background:var(--amber);color:var(--text);padding:2px 6px;border-radius:3px">⏳ Pending</span>` : `<span style="display:inline-block;font-size:11px;background:var(--green);color:white;padding:2px 6px;border-radius:3px">✓ Confirmed</span>`}
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="text-align:center;padding:20px;color:var(--text-muted)">
                <div style="font-size:18px;margin-bottom:8px">🚨</div>
                <div style="font-size:14px">No staff assigned</div>
              </div>
            `}
          </div>
        </div>
      `;
    });

    html += '</div>';

    // Add refresh note for admin view
    if (isAdminView) {
      html += `
        <div style="text-align:center;margin-top:32px;padding:12px;color:var(--text-muted);font-size:12px">
          Auto-refreshes every 60 seconds · Last updated ${new Date().toLocaleTimeString()}
        </div>
      `;
    }

    return html;
  } catch (err) {
    return `
      <div style="text-align:center;padding:40px 20px">
        <div style="font-size:18px;color:var(--red);margin-bottom:12px">Error loading assignments</div>
        <div style="color:var(--text-muted);margin-bottom:20px">${err.message}</div>
        <button class="btn btn-secondary" onclick="${isAdminView ? 'renderAssignmentsAdmin' : 'renderAssignmentsEmployee'}(document.getElementById('app'))">Retry</button>
      </div>
    `;
  }
}

// Build date dropdown options from existing schedules
function buildAssignmentDateOptions(schedules, selectedDate) {
  // Collect all unique dates covered by schedules
  const dates = new Set();
  schedules.forEach(s => {
    const start = s.start_date || s.date;
    const end = s.end_date || s.date || start;
    // Add every day in range
    let d = new Date(start + 'T00:00:00');
    const endD = new Date(end + 'T00:00:00');
    while (d <= endD) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.add(`${yyyy}-${mm}-${dd}`);
      d.setDate(d.getDate() + 1);
    }
  });

  const sorted = Array.from(dates).sort();
  const today = getTodayString();

  let opts = '';
  // "Today" option always present
  const todayInList = sorted.includes(today);
  opts += `<option value="${today}" ${selectedDate === today ? 'selected' : ''}>📅 Today — ${formatAssignmentDate(today)}</option>`;

  // Separator
  if (sorted.length > 0) opts += '<option disabled>──────────</option>';

  // All schedule dates
  sorted.forEach(dt => {
    if (dt === today) return; // already shown above
    const sel = dt === selectedDate ? 'selected' : '';
    opts += `<option value="${dt}" ${sel}>${formatAssignmentDate(dt)}</option>`;
  });

  // Custom date option
  const isCustom = selectedDate !== today && !sorted.includes(selectedDate);
  opts += '<option disabled>──────────</option>';
  opts += `<option value="__custom" ${isCustom ? 'selected' : ''}>📝 Pick a date...</option>`;
  if (isCustom) {
    opts += `<option value="${selectedDate}" selected>${formatAssignmentDate(selectedDate)}</option>`;
  }

  return opts;
}

function onAssignmentDateChange(selectEl) {
  const val = selectEl.value;
  if (val === '__custom') {
    // Show a hidden date input and trigger it
    const picker = document.getElementById('assignment-date-hidden');
    if (picker) {
      picker.showPicker ? picker.showPicker() : picker.click();
    }
    return;
  }
  window._assignmentDate = val;
  renderAssignmentsAdmin(document.getElementById('app'));
}

function onAssignmentCustomDate(input) {
  if (input.value) {
    window._assignmentDate = input.value;
    renderAssignmentsAdmin(document.getElementById('app'));
  }
}

async function renderAssignmentsAdmin(app) {
  const selectedDate = window._assignmentDate || getTodayString();

  // Fetch schedules early for the dropdown
  let schedules = [];
  try { schedules = await API.getSchedules(); } catch(e) {}

  const dropdownOptions = buildAssignmentDateOptions(schedules, selectedDate);

  app.innerHTML = UI.adminShell('assignments', `
    <div class="page">
      <div class="page-header flex justify-between items-center" style="margin-bottom:20px">
        <div>
          <h1 style="margin:0">📋 Today's Assignments</h1>
          <p class="subtitle" style="margin:4px 0 0 0">${API.user?.businessName || 'CrewCast'}</p>
        </div>
        <div class="flex gap2" style="align-items:center">
          <select onchange="onAssignmentDateChange(this)" style="padding:8px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--text);font-size:14px;cursor:pointer;min-width:200px">
            ${dropdownOptions}
          </select>
          <input type="date" id="assignment-date-hidden" value="${selectedDate}" onchange="onAssignmentCustomDate(this)" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0">
          <button class="btn btn-secondary btn-sm" onclick="window._assignmentDate='${getTodayString()}';renderAssignmentsAdmin(document.getElementById('app'))">Today</button>
        </div>
      </div>
      <div id="assignments-content">${UI.loading()}</div>
    </div>
  `);

  const content = await renderAssignmentsContent(selectedDate, true);
  document.getElementById('assignments-content').innerHTML = content;

  // Auto-refresh every 60 seconds
  if (window._assignmentRefreshTimer) clearInterval(window._assignmentRefreshTimer);
  window._assignmentRefreshTimer = setInterval(() => {
    if (document.getElementById('assignments-content')) {
      renderAssignmentsAdmin(app);
    }
  }, 60000);
}

async function renderAssignmentsEmployee(app) {
  const selectedDate = getTodayString();

  app.innerHTML = `
    <div class="page">
      <div id="assignments-content" style="padding:20px">${UI.loading()}</div>
    </div>
    ${UI.employeeNav('home')}
  `;

  const content = await renderAssignmentsContent(selectedDate, false);
  document.getElementById('assignments-content').innerHTML = content;
}
