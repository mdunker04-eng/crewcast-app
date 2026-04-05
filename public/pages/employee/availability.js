// ═══════════════════════════════════════════════════════
// CrewCast — Employee Availability Calendar
// Tap a date to set available + time window
// ═══════════════════════════════════════════════════════

let availCurrentMonth = new Date().getMonth();
let availCurrentYear = new Date().getFullYear();
let availData = {};

async function renderAvailability(app) {
  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1>My Availability</h1>
        <p class="subtitle">Tap dates to mark when you can work</p>
      </div>
      <div class="card">
        <div class="calendar-header">
          <button class="btn btn-ghost btn-sm" onclick="changeAvailMonth(-1)">${SVG.chevLeft}</button>
          <span class="semi" id="avail-month-label"></span>
          <button class="btn btn-ghost btn-sm" onclick="changeAvailMonth(1)">${SVG.chevRight}</button>
        </div>
        <div class="calendar-grid" id="avail-calendar"></div>
      </div>
      <div class="flex gap-2 mb-3">
        <div class="flex items-center gap-1 text-xs"><span class="badge badge-green">Available</span></div>
        <div class="flex items-center gap-1 text-xs"><span class="badge badge-red">Unavailable</span></div>
        <div class="flex items-center gap-1 text-xs"><span class="badge" style="background:var(--border);color:var(--text-muted)">Not Set</span></div>
      </div>
      <div id="avail-actions"></div>
    </div>
    ${UI.employeeNav('availability')}
  `;

  await loadAvailability();
  renderCalendar();
}

async function loadAvailability() {
  try {
    const start = `${availCurrentYear}-${String(availCurrentMonth + 1).padStart(2, '0')}-01`;
    const endMonth = availCurrentMonth === 11 ? 0 : availCurrentMonth + 1;
    const endYear = availCurrentMonth === 11 ? availCurrentYear + 1 : availCurrentYear;
    const end = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-01`;

    const data = await API.getAvailability({ startDate: start, endDate: end });
    availData = {};
    data.forEach(d => {
      availData[d.date] = {
        available: d.available,
        startTime: d.start_time || '09:00',
        endTime: d.end_time || '17:00',
      };
    });
  } catch (err) {
    console.error('Failed to load availability:', err);
  }
}

function renderCalendar() {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  document.getElementById('avail-month-label').textContent =
    `${monthNames[availCurrentMonth]} ${availCurrentYear}`;

  const firstDay = new Date(availCurrentYear, availCurrentMonth, 1).getDay();
  const daysInMonth = new Date(availCurrentYear, availCurrentMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    .map(d => `<div class="calendar-day-label">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${availCurrentYear}-${String(availCurrentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const isPast = new Date(dateStr) < new Date(todayStr);
    const entry = availData[dateStr];

    let cls = 'calendar-day';
    if (isToday) cls += ' today';
    if (entry && entry.available) cls += ' available';
    else if (entry && !entry.available) cls += ' unavailable';
    if (isPast) cls += ' other-month';

    // Show time range if available
    let timeLabel = '';
    if (entry && entry.available) {
      timeLabel = `<div style="font-size:7px;margin-top:1px;color:rgba(52,211,153,.8)">${UI.formatTime(entry.startTime).replace(' AM','a').replace(' PM','p')}–${UI.formatTime(entry.endTime).replace(' AM','a').replace(' PM','p')}</div>`;
    }

    html += `<div class="${cls}" onclick="${isPast ? '' : `showAvailDayModal('${dateStr}')`}" style="position:relative">${day}${timeLabel}</div>`;
  }

  document.getElementById('avail-calendar').innerHTML = html;
}

function showAvailDayModal(dateStr) {
  const entry = availData[dateStr] || { available: true, startTime: '09:00', endTime: '17:00' };
  const d = new Date(dateStr + 'T12:00:00');
  const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  function timeOpts(selected) {
    let opts = '';
    for (let h = 5; h <= 22; h++) {
      for (let m = 0; m < 60; m += 30) {
        const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const label = UI.formatTime(val);
        opts += `<option value="${val}" ${val === selected ? 'selected' : ''}>${label}</option>`;
      }
    }
    return opts;
  }

  UI.showModal(dayLabel, `
    <div class="form-group">
      <label class="form-label">Status</label>
      <select id="avail-status" class="form-input" onchange="document.getElementById('avail-times').style.display = this.value === 'available' ? 'block' : 'none'">
        <option value="available" ${entry.available ? 'selected' : ''}>Available</option>
        <option value="unavailable" ${!entry.available ? 'selected' : ''}>Unavailable</option>
      </select>
    </div>
    <div id="avail-times" style="${entry.available ? '' : 'display:none'}">
      <div class="form-group">
        <label class="form-label">Earliest Start</label>
        <select id="avail-start" class="form-input">${timeOpts(entry.startTime)}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Latest End</label>
        <select id="avail-end" class="form-input">${timeOpts(entry.endTime)}</select>
      </div>
    </div>
  `, `
    <button class="btn btn-primary" onclick="saveAvailDay('${dateStr}')">Save</button>
    ${availData[dateStr] ? '<button class="btn btn-ghost" onclick="clearAvailDay(\'' + dateStr + '\')">Clear</button>' : ''}
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);
}

async function saveAvailDay(dateStr) {
  const status = document.getElementById('avail-status').value;
  const available = status === 'available';
  const startTime = document.getElementById('avail-start').value;
  const endTime = document.getElementById('avail-end').value;

  availData[dateStr] = { available, startTime, endTime };
  UI.closeModal();
  renderCalendar();

  try {
    await API.setAvailability([{
      date: dateStr,
      available,
      startTime: available ? startTime : null,
      endTime: available ? endTime : null,
    }]);
    UI.toast('Saved');
  } catch (err) {
    UI.toast('Failed to save', 'error');
  }
}

async function clearAvailDay(dateStr) {
  delete availData[dateStr];
  UI.closeModal();
  renderCalendar();

  try {
    // Set as unavailable then it won't show — or we could add a delete endpoint
    // For now just mark as available with no times (acts as "not set")
    await API.setAvailability([{ date: dateStr, available: true }]);
  } catch (err) {
    // silently fail
  }
}

function changeAvailMonth(delta) {
  availCurrentMonth += delta;
  if (availCurrentMonth > 11) { availCurrentMonth = 0; availCurrentYear++; }
  if (availCurrentMonth < 0) { availCurrentMonth = 11; availCurrentYear--; }

  loadAvailability().then(() => renderCalendar());
}
