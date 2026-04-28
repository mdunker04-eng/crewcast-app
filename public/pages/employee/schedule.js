// ═══════════════════════════════════════════════════════
// CrewCast — Employee Schedule View
// Shows next shift highlight + date picker + full list
// ═══════════════════════════════════════════════════════

let _scheduleShifts = [];
let _scheduleSelectedDate = null;

async function renderEmployeeSchedule(app) {
  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1>My Schedule</h1>
        <p class="subtitle">Your upcoming shifts</p>
      </div>
      <div id="schedule-content">${UI.loading()}</div>
    </div>
    ${UI.employeeNav('schedule')}
  `;

  // Show notification prompt if not yet enabled
  if ('PushManager' in window && Notification.permission === 'default') {
    const banner = document.createElement('div');
    banner.className = 'card';
    banner.style.cssText = 'margin-bottom:12px;background:rgba(124,58,237,.1);border:1px solid rgba(167,139,250,.25)';
    banner.innerHTML = `
      <div class="flex items-center gap-3">
        <span style="font-size:22px">🔔</span>
        <div style="flex:1">
          <div class="semi text-sm">Enable notifications?</div>
          <div class="text-xs text-muted">Get alerted when schedules post or shifts change</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="enablePushFromBanner(this)">Enable</button>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('.card').remove()" style="padding:4px">${SVG.x}</button>
      </div>
    `;
    document.getElementById('schedule-content').before(banner);
  }

  try {
    _scheduleShifts = await API.getMyShifts();

    // Load station data for arrive-early display
    try {
      const stations = await API.getStations();
      window._stationMap = {};
      stations.forEach(s => { window._stationMap[s.name] = s; });
    } catch (e) { window._stationMap = {}; }

    renderScheduleContent();
  } catch (err) {
    document.getElementById('schedule-content').innerHTML = `
      <div class="card text-center"><p class="text-red">${err.message}</p></div>
    `;
  }
}

function renderScheduleContent() {
  const shifts = _scheduleShifts;
  const container = document.getElementById('schedule-content');

  if (shifts.length === 0) {
    container.innerHTML = UI.empty(
      '📅', 'No upcoming shifts', 'You\'ll see your shifts here when a schedule is published'
    );
    return;
  }

  // Find next shift (first upcoming)
  const todayStr = new Date().toISOString().split('T')[0];
  const nextShift = shifts.find(s => s.date >= todayStr && s.status !== 'declined');

  // Collect unique dates for the date picker
  const uniqueDates = [...new Set(shifts.map(s => s.date))].sort();

  // Group by date
  const byDate = {};
  shifts.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  // If a date is selected, filter; otherwise show all
  const datesToShow = _scheduleSelectedDate
    ? { [_scheduleSelectedDate]: byDate[_scheduleSelectedDate] || [] }
    : byDate;

  container.innerHTML = `
    ${nextShift ? renderNextUpCard(nextShift) : ''}

    <!-- Date picker strip -->
    <div class="card" style="padding:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span class="text-xs semi text-muted" style="text-transform:uppercase;letter-spacing:.5px">Jump to date</span>
        ${_scheduleSelectedDate ? `<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 8px" onclick="_scheduleSelectedDate=null;renderScheduleContent()">Show All</button>` : ''}
      </div>
      <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch">
        ${uniqueDates.map(date => {
          const d = new Date(date + 'T12:00:00');
          const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
          const dayNum = d.getDate();
          const monthName = d.toLocaleDateString('en-US', { month: 'short' });
          const isSelected = _scheduleSelectedDate === date;
          const isNext = nextShift && nextShift.date === date && !_scheduleSelectedDate;
          const dayShifts = byDate[date] || [];
          const hasPending = dayShifts.some(s => s.status === 'pending');
          return `
            <button onclick="_scheduleSelectedDate='${date}';renderScheduleContent()"
              style="
                flex-shrink:0;
                min-width:56px;
                padding:8px 6px;
                border-radius:12px;
                border:1px solid ${isSelected ? 'var(--purple)' : isNext ? 'rgba(124,58,237,.4)' : 'var(--border)'};
                background:${isSelected ? 'var(--purple-bg)' : isNext ? 'rgba(124,58,237,.06)' : 'var(--bg-primary)'};
                cursor:pointer;
                text-align:center;
                transition:all .15s;
                position:relative;
              " class="btn">
              <div style="font-size:9px;color:var(--text-muted);font-weight:600;text-transform:uppercase">${dayName}</div>
              <div style="font-size:18px;font-weight:700;color:${isSelected ? 'var(--purple-light)' : 'var(--text-primary)'};margin:2px 0">${dayNum}</div>
              <div style="font-size:9px;color:var(--text-muted)">${monthName}</div>
              ${hasPending ? '<div style="position:absolute;top:4px;right:4px;width:6px;height:6px;background:var(--amber);border-radius:50%"></div>' : ''}
            </button>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Shifts list -->
    ${Object.entries(datesToShow).map(([date, dayShifts]) => {
      if (!dayShifts || dayShifts.length === 0) {
        return `<div class="card text-center"><p class="text-muted text-sm">No shifts on this date</p></div>`;
      }
      return `
        <div class="mb-4">
          <h3 class="text-purple mb-2">${UI.formatDate(date)}</h3>
          ${dayShifts.map(s => renderScheduleShiftCard(s)).join('')}
        </div>
      `;
    }).join('')}
  `;
}

function renderNextUpCard(shift) {
  const d = new Date(shift.date + 'T12:00:00');
  const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Calculate time until shift
  const now = new Date();
  const shiftStart = new Date(shift.date + 'T' + shift.start_time);
  const diffMs = shiftStart - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  let countdownText = '';
  if (diffDays > 0) countdownText = `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  else if (diffHours > 0) countdownText = `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  else if (diffMs > 0) countdownText = 'starting soon';
  else countdownText = 'now';

  // Station icon + arrive early
  const stData = (shift.station && window._stationMap) ? window._stationMap[shift.station] : null;
  const stIcon = (stData && stData.icon) ? stData.icon : '📋';

  let arriveNote = '';
  if (stData && stData.arrive_early_minutes > 0) {
    const [h, m] = shift.start_time.split(':').map(Number);
    const totalMin = h * 60 + m - stData.arrive_early_minutes;
    const arrH = Math.floor(totalMin / 60);
    const arrM = totalMin % 60;
    const arrTime = UI.formatTime(`${String(arrH).padStart(2, '0')}:${String(arrM).padStart(2, '0')}`);
    arriveNote = `<div class="shift-arrive" style="margin-top:6px">⏰ Arrive by ${arrTime} (${stData.arrive_early_minutes} min early)</div>`;
  }

  return `
    <div class="card" style="background:linear-gradient(135deg, rgba(124,58,237,.12) 0%, rgba(45,212,191,.06) 100%);border-color:rgba(124,58,237,.3);margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;background:var(--gradient-brand);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Next Up</span>
        <span class="badge badge-purple" style="font-size:9px">${countdownText}</span>
      </div>
      <div class="shift-card-body">
        ${shift.station ? `<div class="shift-card-icon" style="font-size:36px;width:52px;height:52px;background:rgba(124,58,237,.12);border-radius:14px">${stIcon}</div>` : ''}
        <div class="shift-card-details">
          <div class="shift-station-name" style="font-size:16px;margin-top:0;margin-bottom:2px">${shift.station || 'Shift'}</div>
          <div class="semi" style="font-size:14px;color:var(--text-primary);margin-bottom:1px">${dayLabel}</div>
          <div style="font-size:13px;color:var(--text-secondary)">${UI.formatTime(shift.start_time)} – ${UI.formatTime(shift.end_time)}</div>
          ${arriveNote}
        </div>
      </div>
      ${shift.notes ? `<div class="text-xs text-muted mt-2">${shift.notes}</div>` : ''}
      <div style="margin-top:8px">${UI.statusBadge(shift.status)}</div>
      ${shift.status === 'pending' ? `
        <div class="shift-actions" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">
          <button class="btn btn-success btn-sm" onclick="respondToShift(${shift.schedule_id}, ${shift.id}, 'confirmed')">Confirm</button>
          <button class="btn btn-secondary btn-sm" onclick="showCounterOfferModal(${shift.schedule_id}, ${shift.id}, '${shift.start_time}', '${shift.end_time}')" style="background:rgba(96,165,250,.12);border-color:rgba(96,165,250,.4);color:#60A5FA">💬 Offer Alt Hours</button>
          <button class="btn btn-danger btn-sm" onclick="showDeclineModal(${shift.schedule_id}, ${shift.id}, '${shift.start_time}', '${shift.end_time}')">Can't Make It</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderScheduleShiftCard(s) {
  const stData = (s.station && window._stationMap) ? window._stationMap[s.station] : null;
  const stIcon = (stData && stData.icon) ? stData.icon : '📋';

  let arriveNote = '';
  if (stData && stData.arrive_early_minutes > 0) {
    const [h, m] = s.start_time.split(':').map(Number);
    const totalMin = h * 60 + m - stData.arrive_early_minutes;
    const arrH = Math.floor(totalMin / 60);
    const arrM = totalMin % 60;
    const arrTime = UI.formatTime(String(arrH).padStart(2, '0') + ':' + String(arrM).padStart(2, '0'));
    arriveNote = '<div class="shift-arrive">⏰ Arrive by ' + arrTime + ' (' + stData.arrive_early_minutes + ' min early)</div>';
  }

  return `
    <div class="shift-card ${s.status}">
      <div class="shift-card-body">
        ${s.station ? `<div class="shift-card-icon">${stIcon}</div>` : ''}
        <div class="shift-card-details" style="flex:1">
          <div class="shift-station-name">${s.station || ''}</div>
          <div class="shift-time">${UI.formatTime(s.start_time)} - ${UI.formatTime(s.end_time)}</div>
          ${arriveNote}
          ${s.notes ? `<div class="text-xs text-muted mt-2">${s.notes}</div>` : ''}
        </div>
        ${UI.statusBadge(s.status)}
      </div>
      ${s.status === 'pending' ? `
        <div class="shift-actions" style="display:flex;flex-wrap:wrap;gap:6px">
          <button class="btn btn-success btn-sm" onclick="respondToShift(${s.schedule_id}, ${s.id}, 'confirmed')">Confirm</button>
          <button class="btn btn-secondary btn-sm" onclick="showCounterOfferModal(${s.schedule_id}, ${s.id}, '${s.start_time}', '${s.end_time}')" style="background:rgba(96,165,250,.12);border-color:rgba(96,165,250,.4);color:#60A5FA">💬 Offer Alt Hours</button>
          <button class="btn btn-danger btn-sm" onclick="showDeclineModal(${s.schedule_id}, ${s.id}, '${s.start_time}', '${s.end_time}')">Can't Make It</button>
        </div>
      ` : ''}
      ${s.status === 'declined' && s.decline_reason ? `
        <div class="text-xs text-muted mt-2">Reason: ${s.decline_reason}</div>
      ` : ''}
      ${s.status === 'confirmed' ? `
        <div class="mt-2">
          <button class="btn btn-ghost btn-sm text-xs" onclick="showSwapModal(${s.schedule_id}, ${s.id})">Request Swap</button>
        </div>
      ` : ''}
    </div>
  `;
}

// Standalone "Offer Alternate Hours" modal — used by the third action button
// on a pending shift. No decline reason; just propose a window the employee
// CAN work, optional note, send.
function showCounterOfferModal(scheduleId, shiftId, shiftStart, shiftEnd) {
  const startGuess = (shiftStart && shiftEnd)
    ? midpointTime(shiftStart, shiftEnd)
    : (shiftStart || '10:00');
  const endGuess = shiftEnd || '17:00';

  UI.showModal('Offer Alternate Hours', `
    <p class="text-sm text-muted mb-3">
      Tell your manager what you <strong>can</strong> work. They'll see your offer
      and either accept or pass.
    </p>
    <div class="card" style="padding:12px;background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.25)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label class="form-label text-xs">I can start at</label>
          <input type="time" id="alt-start" class="form-input" step="900" value="${startGuess}">
        </div>
        <div>
          <label class="form-label text-xs">And work until</label>
          <input type="time" id="alt-end" class="form-input" step="900" value="${endGuess}">
        </div>
      </div>
      <input type="text" id="alt-note" class="form-input mt-2" placeholder="Optional note for your manager (e.g., 'class until 9:45')">
    </div>
    <p class="text-xs text-muted mt-2">Time picker steps in 15-minute increments.</p>
  `, `
    <button class="btn btn-primary" onclick="submitCounterOffer(${scheduleId}, ${shiftId})">Send Offer</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);
}

async function submitCounterOffer(scheduleId, shiftId) {
  const startTime = document.getElementById('alt-start').value;
  const endTime = document.getElementById('alt-end').value;
  const note = document.getElementById('alt-note').value;
  if (!startTime || !endTime) { UI.toast('Pick a start and end time', 'error'); return; }
  if (endTime <= startTime) { UI.toast('End must be after start', 'error'); return; }
  try {
    await API.respondShift(scheduleId, shiftId, 'counter', null, null, {
      startTime, endTime, note: note || null,
    });
    UI.closeModal();
    UI.toast('Offer sent — your manager will reply');
    // Re-render whichever page we're on.
    if (typeof renderEmployeeSchedule === 'function' && location.hash !== '#/') {
      renderEmployeeSchedule(document.getElementById('app'));
    } else if (typeof renderEmployeeHome === 'function') {
      renderEmployeeHome(document.getElementById('app'));
    }
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

function showDeclineModal(scheduleId, shiftId, shiftStart, shiftEnd) {
  const reasons = [
    'Family commitment',
    'Already scheduled at other job',
    'Feeling sick',
    'Car trouble',
    'Out of town',
    'School / class conflict',
    'Other'
  ];
  // Default counter window: pick the back half of the shift (a reasonable
  // "I can come in part-way" guess). Falls back to shift bounds if missing.
  const startGuess = (shiftStart && shiftEnd)
    ? midpointTime(shiftStart, shiftEnd)
    : (shiftStart || '10:00');
  const endGuess = shiftEnd || '17:00';

  UI.showModal("Can't Make It", `
    <p class="text-sm text-muted mb-3">Let your manager know why so they can plan ahead.</p>
    <div class="form-group">
      <label class="form-label">Reason</label>
      <div id="decline-reasons" style="display:flex;flex-direction:column;gap:6px">
        ${reasons.map((r, i) => `
          <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;border:1px solid var(--border);border-radius:8px;transition:border-color .15s" onclick="this.querySelector('input').checked=true;document.querySelectorAll('#decline-reasons label').forEach(l=>l.style.borderColor='var(--border)');this.style.borderColor='var(--purple)'">
            <input type="radio" name="decline-reason" value="${r}" style="accent-color:var(--purple)" ${i === 0 ? 'checked' : ''}>
            <span class="text-sm">${r}</span>
          </label>
        `).join('')}
      </div>
    </div>
    <div id="decline-other-wrap" class="form-group hidden">
      <label class="form-label">Please specify</label>
      <input type="text" id="decline-other" class="form-input" placeholder="What's going on?">
    </div>
    <p class="text-xs text-muted" style="margin-top:6px">
      Want to offer to work <strong>part</strong> of this shift instead?
      Cancel and tap the blue <strong>💬 Offer Alt Hours</strong> button.
    </p>
  `, `
    <button class="btn btn-danger" id="decline-submit-btn" onclick="submitDecline(${scheduleId}, ${shiftId})">Decline Shift</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);

  setTimeout(() => {
    document.querySelectorAll('input[name="decline-reason"]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('decline-other-wrap').classList.toggle('hidden', r.value !== 'Other');
      });
    });
  }, 50);
}

// Halfway point between two HH:MM times. Used to seed the counter-offer
// time picker with something sensible.
function midpointTime(a, b) {
  const toM = t => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
  const fromM = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const am = toM(a), bm = toM(b);
  return fromM(Math.round((am + bm) / 2));
}

async function submitDecline(scheduleId, shiftId) {
  const selected = document.querySelector('input[name="decline-reason"]:checked');
  let reason = selected ? selected.value : '';
  if (reason === 'Other') {
    reason = document.getElementById('decline-other')?.value || 'Other';
  }
  try {
    await API.respondShift(scheduleId, shiftId, 'declined', null, reason);
    UI.closeModal();
    UI.toast('Shift declined');
    renderEmployeeSchedule(document.getElementById('app'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

function showSwapModal(scheduleId, shiftId) {
  UI.showModal('Request Shift Swap', `
    <div class="form-group">
      <label class="form-label">Reason (optional)</label>
      <input type="text" id="swap-reason" class="form-input" placeholder="Why do you need to swap?">
    </div>
  `, `
    <button class="btn btn-primary" onclick="submitSwap(${shiftId})">Submit Request</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);
}

async function submitSwap(shiftId) {
  const reason = document.getElementById('swap-reason')?.value;
  try {
    await API.requestSwap(shiftId, null, reason);
    UI.closeModal();
    UI.toast('Swap request submitted!');
    renderEmployeeSchedule(document.getElementById('app'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

// Quick push enable from banner
async function enablePushFromBanner(btn) {
  try {
    btn.textContent = '...';
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      btn.closest('.card').remove();
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const { key } = await API.getVapidKey();
    if (!key) { btn.closest('.card').remove(); return; }
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    await API.subscribePush(subscription);
    btn.closest('.card').innerHTML = '<div class="flex items-center gap-2"><span>✅</span><span class="text-sm semi" style="color:var(--green-text)">Notifications enabled!</span></div>';
    setTimeout(() => btn.closest('.card')?.remove(), 2000);
  } catch (e) {
    btn.closest('.card').remove();
  }
}
