// ═══════════════════════════════════════════════════════
// CrewCast — Employee Swap Requests
// ═══════════════════════════════════════════════════════

async function renderEmployeeSwaps(app) {
  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1>Shift Swaps</h1>
        <p class="subtitle">Your swap requests</p>
      </div>
      <div id="swaps-content">${UI.loading()}</div>
    </div>
    ${UI.employeeNav('swaps')}
  `;

  try {
    const swaps = await API.getSwaps();

    if (swaps.length === 0) {
      document.getElementById('swaps-content').innerHTML = UI.empty(
        '🔄', 'No swap requests', 'Request a swap from your schedule page'
      );
      return;
    }

    const incoming = swaps.filter(s => s.target_id === API.user.id && s.status === 'open');
    const myRequests = swaps.filter(s => s.requester_id === API.user.id);
    const resolved = swaps.filter(s => s.status !== 'open' && s.requester_id !== API.user.id);

    let html = '';

    if (incoming.length > 0) {
      html += `<div class="card">
        <div class="card-title mb-3">Incoming Requests</div>
        ${incoming.map(s => `
          <div class="shift-card pending">
            <div class="shift-date">${s.requester_first} ${s.requester_last} wants to swap</div>
            <div class="shift-time">${UI.formatDate(s.date)} ${UI.formatTime(s.start_time)} - ${UI.formatTime(s.end_time)}</div>
            ${s.station ? `<div class="shift-station">Station: ${s.station}</div>` : ''}
            ${s.reason ? `<div class="text-xs text-muted mt-2">"${s.reason}"</div>` : ''}
            <div class="shift-actions">
              <button class="btn btn-success btn-sm" onclick="respondToSwap(${s.id}, 'accepted')">Accept</button>
              <button class="btn btn-danger btn-sm" onclick="respondToSwap(${s.id}, 'declined')">Decline</button>
            </div>
          </div>
        `).join('')}
      </div>`;
    }

    if (myRequests.length > 0) {
      html += `<div class="card">
        <div class="card-title mb-3">My Requests</div>
        ${myRequests.map(s => `
          <div class="shift-card ${s.status === 'open' ? 'pending' : s.status === 'accepted' ? 'confirmed' : 'declined'}">
            <div class="flex justify-between items-center">
              <div>
                <div class="shift-date">${UI.formatDate(s.date)}</div>
                <div class="shift-time">${UI.formatTime(s.start_time)} - ${UI.formatTime(s.end_time)}</div>
              </div>
              ${UI.statusBadge(s.status)}
            </div>
            ${s.reason ? `<div class="text-xs text-muted mt-2">"${s.reason}"</div>` : ''}
            ${s.status === 'open' ? `
              <div class="mt-2">
                <button class="btn btn-ghost btn-sm text-xs text-red" onclick="cancelSwapRequest(${s.id})">Cancel Request</button>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>`;
    }

    document.getElementById('swaps-content').innerHTML = html || UI.empty('🔄', 'No swap activity');
  } catch (err) {
    document.getElementById('swaps-content').innerHTML = `
      <div class="card text-center"><p class="text-red">${err.message}</p></div>
    `;
  }
}

async function cancelSwapRequest(swapId) {
  try {
    await API.respondSwap(swapId, 'cancelled');
    UI.toast('Swap request cancelled');
    renderEmployeeSwaps(document.getElementById('app'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}
