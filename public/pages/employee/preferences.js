// ═══════════════════════════════════════════════════════
// CrewCast — Employee Station Preferences
// Rank preferred work stations via drag-like interface
// ═══════════════════════════════════════════════════════

let prefStations = [];    // all available stations
let prefRanked = [];      // employee's ranked picks (station IDs in order)

async function renderPreferences(app) {
  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1>My Preferences</h1>
        <p class="subtitle">Rank your preferred stations — we'll try to match you</p>
      </div>

      <!-- Notification Settings -->
      <div class="card" id="notif-settings" style="margin-bottom:16px">
        <div class="flex items-center gap-2 mb-2">
          <span style="font-size:18px">🔔</span>
          <div class="semi text-sm">Push Notifications</div>
        </div>
        <div id="notif-status">${UI.loading()}</div>
      </div>

      <div id="pref-content">${UI.loading()}</div>
    </div>
    ${UI.employeeNav('preferences')}
  `;
  renderNotifStatus();

  try {
    const [stations, myPrefs] = await Promise.all([
      API.getStations(),
      API.getMyStationPrefs(),
    ]);

    prefStations = stations.filter(s => s.active);

    // Build ranked list from saved prefs
    prefRanked = [];
    myPrefs.sort((a, b) => a.rank - b.rank).forEach(p => {
      if (prefStations.find(s => s.id === p.station_id)) {
        prefRanked.push(p.station_id);
      }
    });

    renderPrefUI();
  } catch (err) {
    document.getElementById('pref-content').innerHTML = `
      <div class="card text-center"><p class="text-red">${err.message}</p></div>
    `;
  }
}

function renderPrefUI() {
  const unranked = prefStations.filter(s => !prefRanked.includes(s.id));

  let html = '';

  if (prefRanked.length > 0) {
    html += '<div class="card"><div class="card-title mb-2">Your Ranked Stations</div>';
    html += '<div class="text-xs text-muted mb-3">#1 is your top choice. Tap arrows to reorder, or X to remove.</div>';
    html += '<div style="display:grid;gap:6px">';
    prefRanked.forEach((stId, idx) => {
      const st = prefStations.find(s => s.id === stId);
      if (!st) return;
      const isTop3 = idx < 3;
      const rankColor = idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : 'var(--text-muted)';
      html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${isTop3 ? 'rgba(167,139,250,.08)' : 'rgba(30,41,59,.5)'};border:1px solid ${isTop3 ? 'rgba(167,139,250,.2)' : '#334155'};border-radius:8px">
        <span class="semi" style="color:${rankColor};font-size:16px;width:24px;text-align:center">#${idx + 1}</span>
        <div style="flex:1">
          <div class="semi text-sm">${st.name}</div>
          ${st.description ? `<div class="text-xs text-muted">${st.description}</div>` : ''}
        </div>
        <div class="flex gap-1 pref-actions">
          ${idx > 0 ? `<button class="btn btn-ghost btn-sm" style="padding:4px 6px" onclick="prefMove(${idx},-1)">${SVG.chevLeft.replace('15,18 9,12 15,6', '12,6 12,18').replace('polyline', 'polyline').replace('15,18 9,12 15,6', '6,15 12,9 18,15')}<span style="font-size:10px">Up</span></button>` : '<span style="width:40px"></span>'}
          ${idx < prefRanked.length - 1 ? `<button class="btn btn-ghost btn-sm" style="padding:4px 6px" onclick="prefMove(${idx},1)"><span style="font-size:10px">Down</span></button>` : '<span style="width:50px"></span>'}
          <button class="btn btn-ghost btn-sm" style="padding:4px 6px;color:var(--red)" onclick="prefRemove(${idx})">${SVG.x}</button>
        </div>
      </div>`;
    });
    html += '</div></div>';
  }

  if (unranked.length > 0) {
    html += '<div class="card"><div class="card-title mb-2">Available Stations</div>';
    html += '<div class="text-xs text-muted mb-3">Tap + to add a station to your ranked list.</div>';
    html += '<div style="display:grid;gap:6px">';
    unranked.forEach(st => {
      html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,41,59,.5);border:1px solid #334155;border-radius:8px">
        <div style="flex:1">
          <div class="semi text-sm">${st.name}</div>
          ${st.description ? `<div class="text-xs text-muted">${st.description}</div>` : ''}
        </div>
        <button class="btn btn-primary btn-sm" style="padding:4px 10px" onclick="prefAdd(${st.id})">${SVG.plus} Add</button>
      </div>`;
    });
    html += '</div></div>';
  }

  if (prefRanked.length > 0) {
    html += `<button class="btn btn-primary btn-block mt-2" onclick="savePrefRanks()">Save Preferences</button>`;
  }

  if (prefStations.length === 0) {
    html += '<div class="card text-center"><p class="text-muted">No stations set up yet. Check back later.</p></div>';
  }

  document.getElementById('pref-content').innerHTML = html;
}

function prefAdd(stationId) {
  if (!prefRanked.includes(stationId)) {
    prefRanked.push(stationId);
    renderPrefUI();
  }
}

function prefRemove(idx) {
  prefRanked.splice(idx, 1);
  renderPrefUI();
}

function prefMove(idx, direction) {
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= prefRanked.length) return;
  const temp = prefRanked[idx];
  prefRanked[idx] = prefRanked[newIdx];
  prefRanked[newIdx] = temp;
  renderPrefUI();
}

async function savePrefRanks() {
  try {
    const stations = prefRanked.map((stId, i) => ({ stationId: stId, rank: i + 1 }));
    await API.setMyStationPrefs(stations);
    UI.toast('Preferences saved!');
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

// ── Notification Settings ──
async function renderNotifStatus() {
  const el = document.getElementById('notif-status');
  if (!el) return;

  if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
    el.innerHTML = '<p class="text-xs text-muted">Push notifications are not supported on this browser/device. Try adding the app to your home screen first.</p>';
    return;
  }

  const perm = Notification.permission;
  if (perm === 'granted') {
    // Check if actually subscribed
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        el.innerHTML = `
          <div class="flex items-center gap-2">
            <span style="color:var(--green-text)">✅</span>
            <span class="text-sm">Notifications are <strong>enabled</strong></span>
          </div>
          <p class="text-xs text-muted mt-1">You'll get notified when schedules are posted, shifts change, or swap requests come in.</p>
          <button class="btn btn-ghost btn-sm mt-2" onclick="disablePushNotifs()">Disable Notifications</button>
        `;
      } else {
        el.innerHTML = `
          <p class="text-sm text-muted">Notifications were allowed but not active.</p>
          <button class="btn btn-primary btn-sm mt-2" onclick="enablePushNotifs()">🔔 Enable Notifications</button>
        `;
      }
    } catch (e) {
      el.innerHTML = '<p class="text-xs text-muted">Could not check notification status.</p>';
    }
  } else if (perm === 'denied') {
    el.innerHTML = `
      <div class="flex items-center gap-2">
        <span style="color:var(--red)">🔕</span>
        <span class="text-sm">Notifications are <strong>blocked</strong></span>
      </div>
      <p class="text-xs text-muted mt-1">To re-enable, open your browser settings and allow notifications for this site.</p>
    `;
  } else {
    el.innerHTML = `
      <p class="text-sm">Get notified when new schedules are posted, shifts change, or swap requests come in.</p>
      <button class="btn btn-primary btn-sm mt-2" onclick="enablePushNotifs()">🔔 Enable Notifications</button>
    `;
  }
}

async function enablePushNotifs() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      UI.toast('Notification permission denied', 'error');
      renderNotifStatus();
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const { key } = await API.getVapidKey();
    if (!key) { UI.toast('Push not configured', 'error'); return; }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    await API.subscribePush(subscription);
    UI.toast('Notifications enabled!');
    renderNotifStatus();
  } catch (err) {
    UI.toast('Failed to enable: ' + err.message, 'error');
  }
}

async function disablePushNotifs() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    UI.toast('Notifications disabled');
    renderNotifStatus();
  } catch (err) {
    UI.toast('Failed: ' + err.message, 'error');
  }
}
