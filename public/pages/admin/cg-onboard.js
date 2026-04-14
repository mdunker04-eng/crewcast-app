// ═══════════════════════════════════════════════════════
// CrewCast — Season Manager
// Multi-season support: define seasons with date ranges,
// active stations, and staff profiles.
// Uses real API + localStorage for season config.
// ═══════════════════════════════════════════════════════

// ── Persisted seasons (localStorage) ──
function getSeasons() {
  try { return JSON.parse(localStorage.getItem('cc_seasons') || '[]'); } catch { return []; }
}
function saveSeasons(seasons) {
  localStorage.setItem('cc_seasons', JSON.stringify(seasons));
}

// ── Default CG Spring 2026 seed (auto-created on first visit) ──
function seedDefaultSeason() {
  const seasons = getSeasons();
  if (seasons.length > 0) return; // already seeded
  seasons.push({
    id: 'spring-2026',
    name: 'Spring on the Farm 2026',
    icon: '🌷',
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    status: 'active',
    notes: 'Tulips, baby animals, strawberry U-pick. May 2026 season.',
    stationOverrides: {},  // station_id → { active: bool, staffMult: number }
    createdAt: new Date().toISOString(),
  });
  saveSeasons(seasons);
}

// ── Render ──
async function renderCGOnboard(app) {
  seedDefaultSeason();
  const seasons = getSeasons();

  let existingStations = [], existingSchedules = [];
  try {
    [existingStations, existingSchedules] = await Promise.all([
      API.getStations(),
      API.getSchedules(),
    ]);
  } catch (e) { /* offline or no auth */ }

  const activeSeason = seasons.find(s => s.status === 'active');

  app.innerHTML = UI.adminShell('cg-onboard', `
    <div class="page">
      <div class="flex justify-between items-center" style="margin-bottom:20px">
        <div>
          <h1>📅 Season Manager</h1>
          <p class="subtitle">Define seasons with different dates, stations, and staffing levels</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="seasonShowCreate()">+ New Season</button>
      </div>

      ${seasons.length === 0 ? `
        <div class="card" style="text-align:center;padding:40px">
          <div style="font-size:48px;margin-bottom:12px">📅</div>
          <div class="semi" style="font-size:16px;margin-bottom:6px">No seasons defined yet</div>
          <div class="text-xs text-muted mb-3">Create your first season to start planning schedules.</div>
          <button class="btn btn-primary" onclick="seasonShowCreate()">+ Create Season</button>
        </div>
      ` : `
        <div style="display:grid;gap:12px">
          ${seasons.map((s, idx) => {
            const isActive = s.status === 'active';
            const schedCount = existingSchedules.filter(sc => {
              // Match schedules whose dates fall within this season
              return sc.start_date >= s.startDate && sc.start_date <= s.endDate;
            }).length;
            const borderColor = isActive ? 'rgba(52,211,153,.3)' : 'rgba(71,85,105,.3)';
            const bgGrad = isActive ? 'linear-gradient(135deg,rgba(52,211,153,.06),rgba(52,211,153,.01))' : 'none';
            return `
              <div class="card" style="border-color:${borderColor};background:${bgGrad}">
                <div class="flex justify-between items-center mb-2">
                  <div class="flex items-center gap-2">
                    <span style="font-size:28px">${s.icon || '📅'}</span>
                    <div>
                      <div class="semi" style="font-size:16px">${s.name}</div>
                      <div class="text-xs text-muted">${UI.formatDate(s.startDate)} — ${UI.formatDate(s.endDate)}</div>
                    </div>
                  </div>
                  <div class="flex gap-1 items-center">
                    <span class="badge ${isActive ? 'badge-green' : 'badge-amber'}">${isActive ? 'Active' : s.status}</span>
                  </div>
                </div>
                ${s.notes ? `<div class="text-xs text-muted mb-2">${s.notes}</div>` : ''}
                <div class="flex gap-2 flex-wrap" style="margin-top:8px">
                  <div class="stat-card" style="flex:1;min-width:80px"><div class="stat-label">Stations</div><div class="stat-value" style="font-size:16px">${existingStations.length}</div></div>
                  <div class="stat-card" style="flex:1;min-width:80px"><div class="stat-label">Schedules</div><div class="stat-value" style="font-size:16px">${schedCount}</div></div>
                  <div class="stat-card" style="flex:1;min-width:80px"><div class="stat-label">Duration</div><div class="stat-value" style="font-size:16px">${seasonDuration(s)} days</div></div>
                </div>
                <div class="flex gap-1 mt-2" style="margin-top:10px;flex-wrap:wrap">
                  <button class="btn btn-secondary btn-sm" onclick="seasonEdit(${idx})">✏️ Edit</button>
                  ${!isActive ? `<button class="btn btn-sm" style="background:rgba(52,211,153,.1);color:#34D399;border:1px solid rgba(52,211,153,.3)" onclick="seasonSetActive(${idx})">Set Active</button>` : ''}
                  <button class="btn btn-sm" onclick="seasonDuplicate(${idx})" style="background:rgba(167,139,250,.1);color:#A78BFA;border:1px solid rgba(167,139,250,.3)">📋 Duplicate</button>
                  <button class="btn btn-ghost btn-sm" style="color:#F87171" onclick="seasonDelete(${idx})">🗑️</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}

      ${existingStations.length > 0 ? `
        <div class="card" style="margin-top:16px;border-left:3px solid var(--purple-light)">
          <div class="semi" style="font-size:14px;margin-bottom:4px">💡 Multi-Season Tip</div>
          <div class="text-xs text-muted">Many venues have different seasons with different stations and staff needs. For example, an orchard might run Spring (tulips + baby animals), Summer (strawberry + blueberry picking), and Fall (apples + corn maze + pumpkin patch) — each with different opening hours, station counts, and crew sizes. Create a season for each, then build schedules within it.</div>
        </div>
      ` : ''}

      <div class="flex gap-2 justify-center" style="flex-wrap:wrap;margin:20px 0">
        <button class="btn btn-secondary" onclick="Router.navigate('/admin/schedules')">📅 Season Calendar</button>
        <button class="btn btn-secondary" onclick="Router.navigate('/admin/stations')">📍 Stations</button>
        <button class="btn btn-secondary" onclick="Router.navigate('/admin/employees')">👥 Employees</button>
      </div>
    </div>
  `);
}

function seasonDuration(s) {
  const start = new Date(s.startDate);
  const end = new Date(s.endDate);
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

// ── Create / Edit modal ──
function seasonShowCreate(editIdx) {
  const isEdit = editIdx !== undefined;
  const seasons = getSeasons();
  const s = isEdit ? seasons[editIdx] : {};

  UI.showModal(isEdit ? 'Edit Season' : 'New Season', `
    <div class="form-group">
      <label class="form-label">Season Name</label>
      <input type="text" id="season-name" class="form-input" value="${s.name || ''}" placeholder="e.g. Fall Festival 2026">
    </div>
    <div class="form-group">
      <label class="form-label">Icon (emoji)</label>
      <input type="text" id="season-icon" class="form-input" value="${s.icon || ''}" placeholder="🎃" maxlength="2" style="width:60px">
    </div>
    <div class="grid2">
      <div class="form-group">
        <label class="form-label">Start Date</label>
        <input type="date" id="season-start" class="form-input" value="${s.startDate || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">End Date</label>
        <input type="date" id="season-end" class="form-input" value="${s.endDate || ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Status</label>
      <select id="season-status" class="form-input">
        <option value="planning" ${s.status === 'planning' ? 'selected' : ''}>Planning</option>
        <option value="active" ${s.status === 'active' ? 'selected' : ''}>Active</option>
        <option value="completed" ${s.status === 'completed' ? 'selected' : ''}>Completed</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <input type="text" id="season-notes" class="form-input" value="${(s.notes || '').replace(/"/g, '&quot;')}" placeholder="What's unique about this season?">
    </div>
  `, `
    <button class="btn btn-primary" onclick="seasonSave(${isEdit ? editIdx : -1})">${isEdit ? 'Save' : 'Create'}</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);
}

function seasonSave(editIdx) {
  const name = document.getElementById('season-name').value.trim();
  const icon = document.getElementById('season-icon').value.trim() || '📅';
  const startDate = document.getElementById('season-start').value;
  const endDate = document.getElementById('season-end').value;
  const status = document.getElementById('season-status').value;
  const notes = document.getElementById('season-notes').value.trim();

  if (!name) { UI.toast('Season name required', 'error'); return; }
  if (!startDate || !endDate) { UI.toast('Start and end dates required', 'error'); return; }
  if (endDate < startDate) { UI.toast('End date must be after start date', 'error'); return; }

  const seasons = getSeasons();
  const obj = {
    id: editIdx >= 0 ? seasons[editIdx].id : name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
    name, icon, startDate, endDate, status, notes,
    stationOverrides: editIdx >= 0 ? (seasons[editIdx].stationOverrides || {}) : {},
    createdAt: editIdx >= 0 ? seasons[editIdx].createdAt : new Date().toISOString(),
  };

  // If setting to active, deactivate others
  if (status === 'active') {
    seasons.forEach(s => { if (s.status === 'active') s.status = 'planning'; });
  }

  if (editIdx >= 0) {
    seasons[editIdx] = obj;
  } else {
    seasons.push(obj);
  }
  saveSeasons(seasons);
  UI.closeModal();
  UI.toast(editIdx >= 0 ? 'Season updated' : 'Season created!');
  renderCGOnboard(document.getElementById('app'));
}

function seasonEdit(idx) { seasonShowCreate(idx); }

function seasonSetActive(idx) {
  const seasons = getSeasons();
  seasons.forEach(s => { if (s.status === 'active') s.status = 'planning'; });
  seasons[idx].status = 'active';
  saveSeasons(seasons);
  UI.toast(seasons[idx].name + ' is now the active season');
  renderCGOnboard(document.getElementById('app'));
}

function seasonDuplicate(idx) {
  const seasons = getSeasons();
  const orig = seasons[idx];
  const copy = JSON.parse(JSON.stringify(orig));
  copy.id = orig.id + '-copy-' + Date.now();
  copy.name = orig.name + ' (Copy)';
  copy.status = 'planning';
  copy.createdAt = new Date().toISOString();
  seasons.push(copy);
  saveSeasons(seasons);
  UI.toast('Season duplicated — edit the copy to adjust dates and settings');
  renderCGOnboard(document.getElementById('app'));
}

function seasonDelete(idx) {
  const seasons = getSeasons();
  if (!confirm('Delete season "' + seasons[idx].name + '"? This only removes the season definition — existing schedules and stations are not affected.')) return;
  seasons.splice(idx, 1);
  saveSeasons(seasons);
  UI.toast('Season removed');
  renderCGOnboard(document.getElementById('app'));
}
