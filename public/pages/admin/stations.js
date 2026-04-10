// ═══════════════════════════════════════════════════════
// CrewCast — Admin Station Setup
// ═══════════════════════════════════════════════════════

let _stationDefaults = { openTime: '09:00', closeTime: '17:00', arriveEarly: 15 };

async function loadStationDefaults() {
  try {
    const settings = await API.getSettings();
    if (settings.defaultOpenTime) _stationDefaults.openTime = settings.defaultOpenTime;
    if (settings.defaultCloseTime) _stationDefaults.closeTime = settings.defaultCloseTime;
    if (settings.arriveEarlyMinutes != null) _stationDefaults.arriveEarly = settings.arriveEarlyMinutes;
  } catch(e) {}
}

async function renderAdminStations(app) {
  app.innerHTML = UI.adminShell('stations', `
    <div class="page">
      <div class="page-header flex justify-between items-center">
        <div>
          <h1>Stations</h1>
          <p class="subtitle">Set up your staffed areas and activities</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="showAddStationModal()">${SVG.plus} Add</button>
      </div>
      <div id="stations-content">${UI.loading()}</div>
    </div>
  `);

  await loadStationDefaults();
  await loadStations();
}

async function loadStations() {
  try {
    const stations = await API.getStations();

    if (stations.length === 0) {
      // Check if we have pre-populated defaults for this business
      let defaults = [];
      try { defaults = await API.getDefaultStations(); } catch (e) {}

      if (defaults.length > 0) {
        // Pre-populated setup (e.g. Center Grove)
        document.getElementById('stations-content').innerHTML = `
          <div class="card">
            <div class="card-title mb-2">Quick Setup</div>
            <p class="text-sm text-muted mb-3">We found these stations for your business. Select the ones you use, then customize times and arrival settings.</p>
            <div id="default-stations-list">${UI.loading()}</div>
            <div class="btn-group mt-3">
              <button class="btn btn-primary btn-block" onclick="importSelectedStations()">Add Selected Stations</button>
            </div>
            <div class="text-center mt-3">
              <button class="btn btn-ghost btn-sm" onclick="showAddStationModal()">Or add a custom station</button>
            </div>
          </div>
        `;
        loadDefaultStations();
      } else {
        // Blank setup for new clients
        document.getElementById('stations-content').innerHTML = `
          <div class="card">
            <div class="card-title mb-2">Set Up Your Stations</div>
            <p class="text-sm text-muted mb-3">Enter the areas or activities your staff work at. You can add them one at a time or paste a list.</p>

            <div class="form-group">
              <label class="form-label">Quick Add — Paste a List</label>
              <textarea id="bulk-station-text" class="form-input" rows="6" placeholder="Enter one station per line, e.g.:&#10;Front Gate&#10;Food Court&#10;Gift Shop&#10;Parking&#10;Main Stage"></textarea>
            </div>
            <button class="btn btn-primary btn-block mb-3" onclick="bulkAddFromText()">Add All Stations</button>

            <div class="text-center">
              <span class="text-xs text-muted">— or —</span>
            </div>
            <button class="btn btn-secondary btn-block mt-3" onclick="showAddStationModal()">Add One Station</button>
          </div>
        `;
      }
      return;
    }

    // Summary stats
    const activeStations = stations.filter(s => s.active);
    const totalMin = activeStations.reduce((sum, s) => sum + (s.min_staff || 1), 0);
    const totalMax = activeStations.reduce((sum, s) => sum + (s.max_staff || s.staff_needed || 0), 0);

    // Show existing stations with edit capability
    document.getElementById('stations-content').innerHTML = `
      <div class="stat-grid mb-3">
        <div class="stat-card">
          <div class="stat-label">Active Stations</div>
          <div class="stat-value">${activeStations.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Staff Range</div>
          <div class="stat-value">${totalMin}–${totalMax}</div>
        </div>
      </div>
      ${stations.map(s => `
        <div class="card station-card" data-id="${s.id}">
          <div class="flex justify-between items-center mb-2">
            <div>
              <div class="semi">${s.name}</div>
              <div class="text-xs text-muted">${s.description || ''}</div>
            </div>
            <div class="flex gap-1">
              ${s.active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>'}
            </div>
          </div>
          <div class="stat-grid stat-grid-4" style="margin-bottom:8px">
            <div class="stat-card">
              <div class="stat-label">Opens</div>
              <div style="font-size:14px;font-weight:600">${UI.formatTime(s.open_time)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Staff Report Time</div>
              <div style="font-size:14px;font-weight:600;color:var(--amber)">${UI.formatTime(computeReportTime(s.open_time, s.arrive_early_minutes))}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Closes</div>
              <div style="font-size:14px;font-weight:600">${UI.formatTime(s.close_time)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Staff Target</div>
              <div style="font-size:14px;font-weight:600">${s.min_staff || 1}–${s.max_staff || s.staff_needed}</div>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" style="flex:1" onclick="showEditStationModal(${s.id})">Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteStation(${s.id}, '${s.name.replace(/'/g, "\\'")}')">
              ${SVG.x}
            </button>
          </div>
        </div>
      `).join('')}
      <button class="btn btn-secondary btn-block mt-2" onclick="showAddStationModal()">${SVG.plus} Add Custom Station</button>
    `;

    // Store stations globally for other pages to use
    window._stations = stations;
  } catch (err) {
    document.getElementById('stations-content').innerHTML = `
      <div class="card text-center"><p class="text-red">${err.message}</p></div>
    `;
  }
}

async function loadDefaultStations() {
  try {
    const defaults = await API.getDefaultStations();
    const container = document.getElementById('default-stations-list');

    container.innerHTML = defaults.map((s, i) => `
      <label class="flex items-center gap-2" style="padding:10px 0;border-bottom:1px solid rgba(51,65,85,.3);cursor:pointer">
        <input type="checkbox" class="default-station-cb" data-index="${i}" checked
          style="width:18px;height:18px;accent-color:var(--purple)">
        <div style="flex:1">
          <div class="semi text-sm">${s.name}</div>
          <div class="text-xs text-muted">${s.description}</div>
        </div>
        <div style="text-align:right;min-width:50px">
          <div class="text-xs text-muted">Staff</div>
          <div class="semi text-sm">${s.staffNeeded}</div>
        </div>
      </label>
    `).join('');

    // Store defaults for import
    window._defaultStations = defaults;

    // Add select all / none controls
    container.insertAdjacentHTML('beforebegin', `
      <div class="flex gap-2 mb-2">
        <button class="btn btn-ghost btn-sm" onclick="toggleAllDefaults(true)">Select All</button>
        <button class="btn btn-ghost btn-sm" onclick="toggleAllDefaults(false)">Select None</button>
      </div>
    `);
  } catch (err) {
    document.getElementById('default-stations-list').innerHTML = `<p class="text-red text-sm">${err.message}</p>`;
  }
}

function toggleAllDefaults(checked) {
  document.querySelectorAll('.default-station-cb').forEach(cb => cb.checked = checked);
}

async function importSelectedStations() {
  const checkboxes = document.querySelectorAll('.default-station-cb:checked');
  const selected = Array.from(checkboxes).map(cb => {
    const idx = parseInt(cb.dataset.index);
    return window._defaultStations[idx];
  });

  if (selected.length === 0) {
    UI.toast('Select at least one station', 'error');
    return;
  }

  try {
    const result = await API.bulkAddStations(selected);
    UI.toast(`Added ${result.added} stations!`);
    await loadStations(); // Reload to show the edit view
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

function showAddStationModal() {
  UI.showModal('Add Station', `
    <div class="form-group">
      <label class="form-label">Station Name</label>
      <input type="text" id="station-name" class="form-input" placeholder="e.g. Apple Picking">
    </div>
    <div class="form-group">
      <label class="form-label">Description (optional)</label>
      <input type="text" id="station-desc" class="form-input" placeholder="Brief description">
    </div>
    <div class="form-group">
      <label class="form-label">Opens At</label>
      <select id="station-open" class="form-input">
        ${generateTimeOptions(_stationDefaults.openTime)}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Closes At</label>
      <select id="station-close" class="form-input">
        ${generateTimeOptions(_stationDefaults.closeTime)}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Staff Report Time</label>
      <select id="station-report" class="form-input">
        ${generateTimeOptions(computeReportTime(_stationDefaults.openTime, _stationDefaults.arriveEarly))}
      </select>
      <p class="text-xs text-muted" style="margin-top:4px">When staff should arrive (before opening)</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label class="form-label">Min Staff</label>
        <input type="number" id="station-min-staff" class="form-input" min="0" value="2" placeholder="0">
      </div>
      <div class="form-group">
        <label class="form-label">Max Staff</label>
        <input type="number" id="station-max-staff" class="form-input" min="0" value="5" placeholder="5">
      </div>
    </div>
    <p class="text-xs text-muted" style="margin-top:-8px">Set 0 for no minimum — adjust per client needs</p>
  `, `
    <button class="btn btn-primary" onclick="saveNewStation()">Add Station</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);
}

async function showEditStationModal(stationId) {
  try {
    const stations = await API.getStations();
    const s = stations.find(st => st.id === stationId);
    if (!s) return UI.toast('Station not found', 'error');

    UI.showModal('Edit Station', `
      <div class="form-group">
        <label class="form-label">Station Name</label>
        <input type="text" id="edit-station-name" class="form-input" value="${s.name}">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input type="text" id="edit-station-desc" class="form-input" value="${s.description || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Opens At</label>
        <select id="edit-station-open" class="form-input">
          ${generateTimeOptions(s.open_time)}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Closes At</label>
        <select id="edit-station-close" class="form-input">
          ${generateTimeOptions(s.close_time)}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Staff Report Time</label>
        <select id="edit-station-report" class="form-input">
          ${generateTimeOptions(computeReportTime(s.open_time, s.arrive_early_minutes))}
        </select>
        <p class="text-xs text-muted" style="margin-top:4px">When staff should arrive (before opening)</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Min Staff</label>
          <input type="number" id="edit-station-min-staff" class="form-input" min="0" value="${s.min_staff || 0}" placeholder="0">
        </div>
        <div class="form-group">
          <label class="form-label">Max Staff</label>
          <input type="number" id="edit-station-max-staff" class="form-input" min="0" value="${s.max_staff || s.staff_needed || 5}" placeholder="5">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="edit-station-active" class="form-input">
          <option value="true" ${s.active ? 'selected' : ''}>Active</option>
          <option value="false" ${!s.active ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
    `, `
      <button class="btn btn-primary" onclick="saveEditStation(${stationId})">Save</button>
      <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
    `);
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function saveNewStation() {
  const name = document.getElementById('station-name').value;
  if (!name) { UI.toast('Name required', 'error'); return; }

  try {
    const openTime = document.getElementById('station-open').value;
    const reportTime = document.getElementById('station-report').value;
    await API.addStation({
      name,
      description: document.getElementById('station-desc').value,
      openTime,
      closeTime: document.getElementById('station-close').value,
      arriveEarlyMinutes: computeEarlyMinutes(openTime, reportTime),
      minStaff: parseInt(document.getElementById('station-min-staff').value),
      maxStaff: parseInt(document.getElementById('station-max-staff').value),
    });
    UI.closeModal();
    UI.toast('Station added!');
    await loadStations();
    showContinueSetup();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function saveEditStation(id) {
  try {
    const editOpenTime = document.getElementById('edit-station-open').value;
    const editReportTime = document.getElementById('edit-station-report').value;
    await API.updateStation(id, {
      name: document.getElementById('edit-station-name').value,
      description: document.getElementById('edit-station-desc').value,
      openTime: editOpenTime,
      closeTime: document.getElementById('edit-station-close').value,
      arriveEarlyMinutes: computeEarlyMinutes(editOpenTime, editReportTime),
      minStaff: parseInt(document.getElementById('edit-station-min-staff').value),
      maxStaff: parseInt(document.getElementById('edit-station-max-staff').value),
      active: document.getElementById('edit-station-active').value === 'true',
    });
    UI.closeModal();
    UI.toast('Station updated!');
    await loadStations();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function deleteStation(id, name) {
  if (!confirm(`Remove "${name}" station?`)) return;
  try {
    await API.deleteStation(id);
    UI.toast('Station removed');
    await loadStations();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

// Bulk add stations from a text list (one per line)
async function bulkAddFromText() {
  const text = document.getElementById('bulk-station-text').value.trim();
  if (!text) { UI.toast('Enter at least one station name', 'error'); return; }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) { UI.toast('Enter at least one station name', 'error'); return; }

  const stations = lines.map(name => ({
    name,
    description: '',
    openTime: _stationDefaults.openTime,
    closeTime: _stationDefaults.closeTime,
    arriveEarlyMinutes: _stationDefaults.arriveEarly,
    staffNeeded: 5,
  }));

  try {
    const result = await API.bulkAddStations(stations);
    UI.toast(`Added ${result.added} stations!${result.skipped ? ` (${result.skipped} duplicates skipped)` : ''}`);
    await loadStations();
    showContinueSetup();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

// Helper: generate staff-needed dropdown options
function generateStaffOptions(selected) {
  let opts = '';
  for (let n = 1; n <= 50; n++) {
    opts += `<option value="${n}" ${n === selected ? 'selected' : ''}>${n} ${n === 1 ? 'person' : 'people'}</option>`;
  }
  return opts;
}

// Helper: generate time dropdown options in 15-min increments
function generateTimeOptions(selected) {
  let options = '';
  for (let h = 5; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const label = UI.formatTime(val);
      options += `<option value="${val}" ${val === selected ? 'selected' : ''}>${label}</option>`;
    }
  }
  return options;
}

// Compute staff report time from open time and arrive_early_minutes
function computeReportTime(openTime, earlyMin) {
  if (!openTime || earlyMin == null) return openTime || '09:00';
  const [h, m] = openTime.split(':').map(Number);
  const totalMin = h * 60 + m - (earlyMin || 0);
  const rh = Math.floor(Math.max(0, totalMin) / 60);
  const rm = Math.max(0, totalMin) % 60;
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
}

// Compute arrive_early_minutes from open time and report time
function computeEarlyMinutes(openTime, reportTime) {
  if (!openTime || !reportTime) return 15;
  const [oh, om] = openTime.split(':').map(Number);
  const [rh, rm] = reportTime.split(':').map(Number);
  return Math.max(0, (oh * 60 + om) - (rh * 60 + rm));
}

// Sync report time dropdown when open time changes (in add/edit modals)
function syncReportTime(prefix) {
  const openEl = document.getElementById(prefix + '-open');
  const reportEl = document.getElementById(prefix + '-report');
  if (!openEl || !reportEl) return;
  const earlyMin = computeEarlyMinutes(openEl.value, reportEl.value);
  // Keep same gap, update report time
  reportEl.value = computeReportTime(openEl.value, earlyMin);
}
