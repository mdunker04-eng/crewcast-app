// ═══════════════════════════════════════════════════════
// CrewCast — Employee Schedule View
// ═══════════════════════════════════════════════════════

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

  try {
    const shifts = await API.getMyShifts();

    // Load station data for arrive-early display
    try {
      const stations = await API.getStations();
      window._stationMap = {};
      stations.forEach(s => { window._stationMap[s.name] = s; });
    } catch (e) { window._stationMap = {}; }

    if (shifts.length === 0) {
      document.getElementById('schedule-content').innerHTML = UI.empty(
        '📅', 'No upcoming shifts', 'You\'ll see your shifts here when a schedule is published'
      );
      return;
    }

    // Group by date
    const byDate = {};
    shifts.forEach(s => {
      if (!byDate[s.date]) byDate[s.date] = [];
      byDate[s.date].push(s);
    });

    document.getElementById('schedule-content').innerHTML = Object.entries(byDate).map(([date, dayShifts]) => `
      <div class="mb-4">
        <h3 class="text-purple mb-2">${UI.formatDate(date)}</h3>
        ${dayShifts.map(s => `
          <div class="shift-card ${s.status}">
            <div class="flex justify-between items-center">
              <div>
                <div class="shift-time semi">${UI.formatTime(s.start_time)} - ${UI.formatTime(s.end_time)}</div>
                ${s.station ? `<div class="shift-station">${SVG.station} ${s.station}</div>` : ''}
                ${(() => {
                  if (s.station && window._stationMap && window._stationMap[s.station]) {
                    const early = window._stationMap[s.station].arrive_early_minutes;
                    if (early > 0) {
                      const [h, m] = s.start_time.split(':').map(Number);
                      const totalMin = h * 60 + m - early;
                      const arrH = Math.floor(totalMin / 60);
                      const arrM = totalMin % 60;
                      const arrTime = UI.formatTime(String(arrH).padStart(2, '0') + ':' + String(arrM).padStart(2, '0'));
                      return '<div class="text-xs text-amber mt-1">⏰ Arrive by ' + arrTime + ' (' + early + ' min early)</div>';
                    }
                  }
                  return '';
                })()}
                ${s.notes ? `<div class="text-xs text-muted mt-2">${s.notes}</div>` : ''}
              </div>
              ${UI.statusBadge(s.status)}
            </div>
            ${s.status === 'pending' ? `
              <div class="shift-actions">
                <button class="btn btn-success btn-sm" onclick="respondToShift(${s.schedule_id}, ${s.id}, 'confirmed')">Confirm</button>
                <button class="btn btn-danger btn-sm" onclick="respondToShift(${s.schedule_id}, ${s.id}, 'declined')">Can't Make It</button>
              </div>
            ` : ''}
            ${s.status === 'confirmed' ? `
              <div class="mt-2">
                <button class="btn btn-ghost btn-sm text-xs" onclick="showSwapModal(${s.schedule_id}, ${s.id})">Request Swap</button>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('schedule-content').innerHTML = `
      <div class="card text-center"><p class="text-red">${err.message}</p></div>
    `;
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
