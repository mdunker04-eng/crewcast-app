// ═══════════════════════════════════════════════════════
// CrewCast — Employee Availability Calendar
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
      availData[d.date] = d.available === 1;
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

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${availCurrentYear}-${String(availCurrentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const isPast = new Date(dateStr) < new Date(todayStr);

    let cls = 'calendar-day';
    if (isToday) cls += ' today';
    if (availData[dateStr] === true) cls += ' available';
    else if (availData[dateStr] === false) cls += ' unavailable';
    if (isPast) cls += ' other-month';

    html += `<div class="${cls}" onclick="${isPast ? '' : `toggleAvailDay('${dateStr}')`}">${day}</div>`;
  }

  document.getElementById('avail-calendar').innerHTML = html;
}

async function toggleAvailDay(dateStr) {
  const current = availData[dateStr];
  let newState;

  if (current === undefined) newState = true;       // not set → available
  else if (current === true) newState = false;       // available → unavailable
  else newState = undefined;                          // unavailable → not set

  if (newState === undefined) {
    delete availData[dateStr];
    // Set to available=true then we'll handle removal differently
    // For simplicity, toggle between available and unavailable
    newState = true;
    availData[dateStr] = true;
  } else {
    availData[dateStr] = newState;
  }

  renderCalendar();

  try {
    await API.setAvailability([{ date: dateStr, available: newState }]);
  } catch (err) {
    UI.toast('Failed to save', 'error');
  }
}

function changeAvailMonth(delta) {
  availCurrentMonth += delta;
  if (availCurrentMonth > 11) { availCurrentMonth = 0; availCurrentYear++; }
  if (availCurrentMonth < 0) { availCurrentMonth = 11; availCurrentYear--; }

  loadAvailability().then(() => renderCalendar());
}
