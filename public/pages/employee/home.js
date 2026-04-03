// ═══════════════════════════════════════════════════════
// CrewCast — Employee Home Page
// Overview of upcoming shifts + quick actions
// ═══════════════════════════════════════════════════════

async function renderEmployeeHome(app) {
  app.innerHTML = `
    <div class="page">
      <div class="page-header flex justify-between items-center">
        <div>
          <h1>Hey, ${API.user.firstName}!</h1>
          <p class="subtitle">${API.user.businessName}</p>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="handleLogout()">${SVG.logout}</button>
      </div>
      <div id="home-content">${UI.loading()}</div>
    </div>
    ${UI.employeeNav('home')}
  `;

  try {
    const shifts = await API.getMyShifts();
    const swaps = await API.getSwaps();
    const openSwaps = swaps.filter(s => s.status === 'open' && s.target_id === API.user.id);

    const pending = shifts.filter(s => s.status === 'pending');
    const confirmed = shifts.filter(s => s.status === 'confirmed');
    const upcoming = shifts.filter(s => s.status === 'confirmed').slice(0, 3);

    document.getElementById('home-content').innerHTML = `
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Upcoming</div>
          <div class="stat-value text-purple">${shifts.length}</div>
          <div class="stat-sub">shifts</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Need Response</div>
          <div class="stat-value ${pending.length > 0 ? 'text-amber' : 'text-green'}">${pending.length}</div>
          <div class="stat-sub">pending</div>
        </div>
      </div>

      ${pending.length > 0 ? `
        <div class="card">
          <div class="card-title mb-3">Action Needed</div>
          ${pending.map(s => renderShiftCard(s, true)).join('')}
        </div>
      ` : ''}

      ${openSwaps.length > 0 ? `
        <div class="card">
          <div class="card-title mb-3">Swap Requests For You</div>
          ${openSwaps.map(s => `
            <div class="shift-card">
              <div class="shift-date">${s.requester_first} ${s.requester_last} wants to swap</div>
              <div class="shift-time">${UI.formatDate(s.date)} ${UI.formatTime(s.start_time)} - ${UI.formatTime(s.end_time)}</div>
              ${s.reason ? `<div class="text-xs text-muted mt-2">"${s.reason}"</div>` : ''}
              <div class="shift-actions">
                <button class="btn btn-success btn-sm" onclick="respondToSwap(${s.id}, 'accepted')">Accept</button>
                <button class="btn btn-danger btn-sm" onclick="respondToSwap(${s.id}, 'declined')">Decline</button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${upcoming.length > 0 ? `
        <div class="card">
          <div class="card-header">
            <div class="card-title">Next Up</div>
            <a href="/schedule" class="text-xs text-purple">View All</a>
          </div>
          ${upcoming.map(s => renderShiftCard(s, false)).join('')}
        </div>
      ` : ''}

      ${shifts.length === 0 ? UI.empty('📋', 'No upcoming shifts', 'Check back later or update your availability') : ''}
    `;
  } catch (err) {
    document.getElementById('home-content').innerHTML = `
      <div class="card text-center">
        <p class="text-red">${err.message}</p>
        <button class="btn btn-secondary btn-sm mt-3" onclick="renderEmployeeHome(document.getElementById('app'))">Retry</button>
      </div>
    `;
  }
}

function renderShiftCard(shift, showActions) {
  return `
    <div class="shift-card ${shift.status}">
      <div class="shift-date">${UI.formatDate(shift.date)}</div>
      <div class="shift-time">${UI.formatTime(shift.start_time)} - ${UI.formatTime(shift.end_time)}</div>
      ${shift.station ? `<div class="shift-station">Station: ${shift.station}</div>` : ''}
      <div class="flex justify-between items-center mt-2">
        ${UI.statusBadge(shift.status)}
        ${shift.schedule_name ? `<span class="text-xs text-muted">${shift.schedule_name}</span>` : ''}
      </div>
      ${showActions && shift.status === 'pending' ? `
        <div class="shift-actions">
          <button class="btn btn-success btn-sm" onclick="respondToShift(${shift.schedule_id}, ${shift.id}, 'confirmed')">Confirm</button>
          <button class="btn btn-danger btn-sm" onclick="respondToShift(${shift.schedule_id}, ${shift.id}, 'declined')">Can't Make It</button>
        </div>
      ` : ''}
    </div>
  `;
}

async function respondToShift(scheduleId, shiftId, status) {
  try {
    await API.respondShift(scheduleId, shiftId, status);
    UI.toast(status === 'confirmed' ? 'Shift confirmed!' : 'Shift declined');
    renderEmployeeHome(document.getElementById('app'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function respondToSwap(swapId, status) {
  try {
    await API.respondSwap(swapId, status);
    UI.toast(status === 'accepted' ? 'Swap accepted!' : 'Swap declined');
    renderEmployeeHome(document.getElementById('app'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function handleLogout() {
  try { await API.logout(); } catch (e) {}
  API.clearAuth();
  Router.navigate('/login', true);
}
