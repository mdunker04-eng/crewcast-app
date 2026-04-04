// ═══════════════════════════════════════════════════════
// CrewCast — Admin Station Setup
// ═══════════════════════════════════════════════════════

async function renderAdminStations(app) {
  app.innerHTML = `
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
    ${UI.adminNav('stations')}
  `;

  await loadStations();
}

async function loadStations() {
  try {
    const stations = await API.getStations();

    if (stations.length === 0) {
      // Show the setup wizard — pre-populated defaults
      document.getElementById('stations-content').innerHTML = `
        <div class="card">
          <div class="card-title mb-2">Quick Setup</div>
          <p class="text-sm text-muted mb-3">We found these stations from Center Grove Orchard. Select the ones you use, then customize times and arrival settings.</p>
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
      return;
    }

    // Summary stats
    const activeStations = stations.filter(s => s.active);
    const totalStaff = activeStations.reduce((sum, s) => sum + (s.staff_needed || 0), 0);

    // Show existing stations with edit capability
    document.getElementById('stations-content').innerHTML = `
      <div class="stat-grid mb-3">
        <div class="stat-card">
          <div class="stat-label">Active Stations</div>
          <div class="stat-value">${activeStations.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Staff Needed</div>
          <div class="stat-value">${totalStaff}</div>
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
              <div class="stat-label">Closes</div>
              <div style="font-size:14px;font-weight:600">${UI.formatTime(s.close_time)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Arrive Early</div>
              <div style="font-size:14px;font-weight:600">${s.arrive_early_minutes} min</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Staff Needed</div>
              <div style="font-size:14px;font-weight:600">${s.staff_needed}</div>
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
        ${generateTimeOptions('09:00')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Closes At</label>
      <select id="station-close" class="form-input">
        ${generateTimeOptions('17:00')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Staff Arrive Early</label>
      <select id="station-early" class="form-input">
        <option value="0">No early arrival</option>
        <option value="10">10 minutes before</option>
        <option value="15" selected>15 minutes before</option>
        <option value="20">20 minutes before</option>
        <option value="30">30 minutes before</option>
        <option value="45">45 minutes before</option>
        <option value="60">1 hour before</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Staff Needed</label>
      <select id="station-staff" class="form-input">
        ${generateStaffOptions(5)}
      </select>
    </div>
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
        <label class="form-label">Staff Arrive Early</label>
        <select id="edit-station-early" class="form-input">
          <option value="0" ${s.arrive_early_minutes === 0 ? 'selected' : ''}>No early arrival</option>
          <option value="10" ${s.arrive_early_minutes === 10 ? 'selected' : ''}>10 minutes before</option>
          <option value="15" ${s.arrive_early_minutes === 15 ? 'selected' : ''}>15 minutes before</option>
          <option value="20" ${s.arrive_early_minutes === 20 ? 'selected' : ''}>20 minutes before</option>
          <option value="30" ${s.arrive_early_minutes === 30 ? 'selected' : ''}>30 minutes before</option>
          <option value="45" ${s.arrive_early_minutes === 45 ? 'selected' : ''}>45 minutes before</option>
          <option value="60" ${s.arrive_early_minutes === 60 ? 'selected' : ''}>1 hour before</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Staff Needed</label>
        <select id="edit-station-staff" class="form-input">
          ${generateStaffOptions(s.staff_needed)}
        </select>
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
    await API.addStation({
      name,
      description: document.getElementById('station-desc').value,
      openTime: document.getElementById('station-open').value,
      closeTime: document.getElementById('station-close').value,
      arriveEarlyMinutes: parseInt(document.getElementById('station-early').value),
      staffNeeded: parseInt(document.getElementById('station-staff').value),
    });
    UI.closeModal();
    UI.toast('Station added!');
    await loadStations();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function saveEditStation(id) {
  try {
    await API.updateStation(id, {
      name: document.getElementById('edit-station-name').value,
      description: document.getElementById('edit-station-desc').value,
      openTime: document.getElementById('edit-station-open').value,
      closeTime: document.getElementById('edit-station-close').value,
      arriveEarlyMinutes: parseInt(document.getElementById('edit-station-early').value),
      staffNeeded: parseInt(document.getElementById('edit-station-staff').value),
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

// Helper: generate staff-needed dropdown options
function generateStaffOptions(selected) {
  const counts = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 25, 30, 35, 40, 50];
  return counts.map(n =>
    `<option value="${n}" ${n === selected ? 'selected' : ''}>${n} people</option>`
  ).join('');
}

// Helper: generate time dropdown options in 30-min increments
function generateTimeOptions(selected) {
  let options = '';
  for (let h = 5; h <= 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const label = UI.formatTime(val);
      options += `<option value="${val}" ${val === selected ? 'selected' : ''}>${label}</option>`;
    }
  }
  return options;
}
