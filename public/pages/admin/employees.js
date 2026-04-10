// ═══════════════════════════════════════════════════════
// CrewCast — Admin Employee Management
// ═══════════════════════════════════════════════════════

// Format phone number from 10 digits to (XXX) XXX-XXXX
function formatPhoneNumber(digits) {
  if (!digits) return '';
  const cleaned = digits.toString().replace(/\D/g, '').slice(-10);
  if (cleaned.length !== 10) return cleaned;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}

// Category star rating (inline, compact)
function renderCatStars(empId, catId, rating, icon, name) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    const filled = rating && i <= rating;
    stars += `<span onclick="setCatRating(${empId},${catId},${i === rating ? 0 : i})" style="font-size:12px;color:${filled ? '#FFD700' : '#475569'};cursor:pointer">${filled ? '★' : '☆'}</span>`;
  }
  return `<span id="cat-stars-${empId}-${catId}" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;padding:1px 6px;border-radius:10px;background:rgba(30,41,59,.6);border:1px solid rgba(51,65,85,.4)" title="${name}"><span style="font-size:11px">${icon}</span>${stars}</span>`;
}

function _rebuildCatStars(empId, catId, rating, icon) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    const filled = rating && i <= rating;
    stars += `<span onclick="setCatRating(${empId},${catId},${i === rating ? 0 : i})" style="font-size:12px;color:${filled ? '#FFD700' : '#475569'};cursor:pointer">${filled ? '★' : '☆'}</span>`;
  }
  return `<span style="font-size:11px">${icon}</span>${stars}`;
}

async function setCatRating(empId, catId, rating) {
  try {
    await API.setCategoryRating(empId, catId, rating || null);
    // Update just the stars inline — no page reload
    const container = document.getElementById(`cat-stars-${empId}-${catId}`);
    if (container) {
      const icon = container.querySelector('span')?.textContent || '📋';
      container.innerHTML = _rebuildCatStars(empId, catId, rating, icon);
    }
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

// Cached categories for the session
let _cachedCategories = null;

async function renderAdminEmployees(app) {
  app.innerHTML = UI.adminShell('employees', `
    <div class="page">
      <div class="page-header flex justify-between items-center">
        <div>
          <h1>Employees</h1>
          <p class="subtitle">Manage your workforce</p>
        </div>
        <div style="position:relative;display:inline-block">
          <button class="btn btn-primary btn-sm" onclick="this.nextElementSibling.classList.toggle('show')">${SVG.plus} Add ▾</button>
          <div class="add-emp-dropdown" style="display:none;position:absolute;right:0;top:110%;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;overflow:hidden;z-index:50;min-width:160px;box-shadow:0 8px 24px rgba(0,0,0,.4)">
            <div style="padding:10px 14px;cursor:pointer;font-size:14px;white-space:nowrap" onclick="this.parentElement.classList.remove('show');showAddEmployeeModal()" onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='transparent'">👤 Add One</div>
            <div style="padding:10px 14px;cursor:pointer;font-size:14px;white-space:nowrap;border-top:1px solid var(--border)" onclick="this.parentElement.classList.remove('show');showBulkImportModal()" onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='transparent'">📋 Bulk Import</div>
          </div>
        </div>
      </div>
      <div id="employees-content">${UI.loading()}</div>
    </div>
  `);

  try {
    const employees = await API.getEmployees();

    if (employees.length === 0) {
      document.getElementById('employees-content').innerHTML = `
        ${UI.empty('👥', 'No employees yet', 'Add your first employee to get started')}
        <button class="btn btn-primary btn-block mt-3" onclick="showAddEmployeeModal()">Add Employee</button>
      `;
      return;
    }

    const active = employees.filter(e => e.active);
    const inactive = employees.filter(e => !e.active);

    // Fetch station assignments, categories, and ratings in parallel
    const stationData = {};
    const [categories, allRatings] = await Promise.all([
      API.getCategories().catch(() => []),
      API.getAllCategoryRatings().catch(() => ({})),
      ...active.map(async (e) => {
        try { stationData[e.id] = await API.getEmployeeStations(e.id); }
        catch (_) { stationData[e.id] = []; }
      })
    ]);
    _cachedCategories = categories;

    document.getElementById('employees-content').innerHTML = `
      <div class="stat-grid mb-4">
        <div class="stat-card">
          <div class="stat-label">Active</div>
          <div class="stat-value text-green">${active.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Registered</div>
          <div class="stat-value text-purple">${employees.filter(e => e.hasPin).length}</div>
        </div>
      </div>

      ${categories.length > 0 ? `
      <div style="display:flex;flex-wrap:wrap;gap:8px 16px;padding:8px 12px;margin-bottom:8px;font-size:11px;color:var(--text-muted);background:rgba(30,41,59,.4);border-radius:8px;border:1px solid rgba(51,65,85,.3)">
        <span style="font-weight:600;color:var(--text-secondary)">Rating Key:</span>
        ${categories.map(cat => `<span>${cat.icon} ${cat.name}</span>`).join('')}
      </div>` : ''}

      <div class="card">
        ${active.map(e => {
          const empStations = stationData[e.id] || [];
          const empRatings = allRatings[e.id] || [];
          const ratingMap = {};
          empRatings.forEach(r => { ratingMap[r.category_id] = r.rating; });

          return `
          <div class="list-item" style="flex-direction:column;align-items:stretch;gap:6px;padding:12px 16px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div class="flex items-center gap-2">
                  <div class="semi">${e.firstName} ${e.lastName}</div>
                  ${e.role === 'admin' || e.role === 'lead' ? `<span class="badge" style="font-size:10px;padding:2px 6px;background:var(--purple);color:white">${e.role.charAt(0).toUpperCase() + e.role.slice(1)}</span>` : ''}
                </div>
                <div class="text-xs text-muted" style="margin-top:1px">${formatPhoneNumber(e.phone)}${empStations.length > 0 ? ` · ${empStations.length} station${empStations.length !== 1 ? 's' : ''}` : ''}</div>
              </div>
              <div class="flex items-center gap-2">
                ${e.hasPin ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-amber">Invited</span>'}
                <button class="btn btn-ghost btn-sm" onclick="showEmployeeOptions(${e.id}, '${e.firstName}', '${e.lastName}', '${e.inviteToken}', ${e.hasPin})">...</button>
              </div>
            </div>
            ${categories.length > 0 ? `
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px">
              ${categories.map(cat => renderCatStars(e.id, cat.id, ratingMap[cat.id] || 0, cat.icon, cat.name)).join('')}
            </div>` : ''}
          </div>
        `;}).join('')}
      </div>

      ${inactive.length > 0 ? `
        <div class="card">
          <div class="card-title mb-2 text-muted">Inactive (${inactive.length})</div>
          ${inactive.map(e => `
            <div class="list-item" style="opacity:.5">
              <div>
                <div class="semi">${e.firstName} ${e.lastName}</div>
                <div class="text-xs text-muted">${formatPhoneNumber(e.phone)}</div>
              </div>
              <span class="badge badge-red">Inactive</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  } catch (err) {
    document.getElementById('employees-content').innerHTML = `
      <div class="card text-center"><p class="text-red">${err.message}</p></div>
    `;
  }
}

function showAddEmployeeModal() {
  UI.showModal('Add Employee', `
    <div class="form-group">
      <label class="form-label">First Name</label>
      <input type="text" id="emp-first" class="form-input" placeholder="First name">
    </div>
    <div class="form-group">
      <label class="form-label">Last Name</label>
      <input type="text" id="emp-last" class="form-input" placeholder="Last name">
    </div>
    <div class="form-group">
      <label class="form-label">Phone Number</label>
      <input type="tel" id="emp-phone" class="form-input" placeholder="(555) 123-4567">
    </div>
  `, `
    <button class="btn btn-primary" onclick="addEmployee()">Add Employee</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);
}

async function addEmployee() {
  const firstName = document.getElementById('emp-first').value;
  const lastName = document.getElementById('emp-last').value;
  const phone = document.getElementById('emp-phone').value;

  if (!firstName || !lastName || !phone) {
    UI.toast('All fields required', 'error');
    return;
  }

  try {
    const result = await API.addEmployee({ firstName, lastName, phone });
    UI.closeModal();
    UI.toast(`${firstName} added! Share their invite link.`);

    // Show invite link
    UI.showModal('Invite Link', `
      <p class="text-sm mb-3">Share this link with ${firstName} so they can set up their account:</p>
      <div class="form-input text-xs" style="word-break:break-all;cursor:pointer" onclick="copyInviteLink(this)">${result.inviteUrl}</div>
      <p class="text-xs text-muted mt-2">Tap to copy</p>
    `, `
      <button class="btn btn-primary" onclick="copyInviteLink(document.querySelector('.modal .form-input'));UI.closeModal();renderAdminEmployees(document.getElementById('app'));showContinueSetup()">Done</button>
    `);
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

function copyInviteLink(el) {
  navigator.clipboard.writeText(el.textContent).then(() => {
    UI.toast('Link copied!');
  }).catch(() => {
    // Fallback: select text
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    UI.toast('Select and copy the link');
  });
}

function showEmployeeOptions(id, firstName, lastName, inviteToken, hasPin) {
  const inviteUrl = `${location.origin}/invite/${inviteToken}`;
  UI.showModal(`${firstName} ${lastName}`, `
    <div class="flex flex-col gap-2">
      <button class="btn btn-primary btn-block" onclick="UI.closeModal();showStationSkillsModal(${id}, '${firstName} ${lastName}')">
        ${SVG.station} Station Skills
      </button>
      <button class="btn btn-secondary btn-block" onclick="UI.closeModal();showEmpPreferencesModal(${id}, '${firstName} ${lastName}')">
        ⭐ Preferences &amp; Rankings
      </button>
      <button class="btn btn-secondary btn-block" onclick="UI.closeModal();showStationRatingsModal(${id}, '${firstName} ${lastName}')">
        🎯 Rate by Station
      </button>
      ${!hasPin ? `
        <button class="btn btn-secondary btn-block" onclick="copyInviteLink(this)" data-link="${inviteUrl}">
          Copy Invite Link
        </button>
      ` : ''}
      <button class="btn btn-danger btn-block" onclick="deactivateEmployee(${id}, '${firstName}')">
        Deactivate Employee
      </button>
      <button class="btn btn-ghost btn-block" onclick="UI.closeModal()">Cancel</button>
    </div>
  `);
}

async function showStationSkillsModal(empId, empName) {
  let stations = [];
  let empStations = [];
  try {
    [stations, empStations] = await Promise.all([
      API.getStations(),
      API.getEmployeeStations(empId),
    ]);
  } catch (e) {
    UI.toast('Could not load stations', 'error');
    return;
  }

  const activeStations = stations.filter(s => s.active);
  const assignedIds = new Set(empStations.map(es => es.station_id));

  UI.showModal(`Stations — ${empName}`, `
    <p class="text-sm text-muted mb-3">Check the stations this employee is trained to work at:</p>
    <div class="flex gap-2 mb-2">
      <button class="btn btn-ghost btn-sm" onclick="document.querySelectorAll('.emp-station-cb').forEach(c=>c.checked=true)">All</button>
      <button class="btn btn-ghost btn-sm" onclick="document.querySelectorAll('.emp-station-cb').forEach(c=>c.checked=false)">None</button>
    </div>
    <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px">
      ${activeStations.map(s => `
        <label style="display:flex;align-items:center;gap:8px;padding:8px 0;cursor:pointer;border-bottom:1px solid rgba(51,65,85,.2)">
          <input type="checkbox" class="emp-station-cb" value="${s.id}"
            ${assignedIds.has(s.id) ? 'checked' : ''}
            style="width:16px;height:16px;accent-color:var(--purple)">
          <span class="text-sm">${s.name}</span>
        </label>
      `).join('')}
    </div>
  `, `
    <button class="btn btn-primary" onclick="saveStationSkills(${empId})">Save</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);
}

async function saveStationSkills(empId) {
  const checked = document.querySelectorAll('.emp-station-cb:checked');
  const stationIds = Array.from(checked).map(cb => parseInt(cb.value));

  try {
    await API.updateEmployeeStations(empId, stationIds);
    UI.closeModal();
    UI.toast('Station skills updated!');
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function deactivateEmployee(id, name) {
  if (!confirm(`Deactivate ${name}? They won't be able to log in.`)) return;
  try {
    await API.deleteEmployee(id);
    UI.closeModal();
    UI.toast(`${name} deactivated`);
    renderAdminEmployees(document.getElementById('app'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════
// Admin: Employee Preferences & Rankings
// ═══════════════════════════════════════════════════════

let _empPrefData = { empId: null, empName: '', stations: [], allStations: [], ranked: [] };

async function showEmpPreferencesModal(empId, empName) {
  _empPrefData = { empId, empName, stations: [], allStations: [], ranked: [] };

  UI.showModal(`⭐ ${empName} — Preferences`, `<div id="emp-pref-content">${UI.loading()}</div>`, '');

  try {
    const [empStations, allStations] = await Promise.all([
      API.getEmployeeStations(empId),
      API.getStations(),
    ]);

    _empPrefData.allStations = allStations.filter(s => s.active);
    _empPrefData.stations = empStations;

    // Build ranked list (stations with a rank, in order)
    const ranked = empStations.filter(es => es.rank != null).sort((a, b) => a.rank - b.rank);
    // Stations they're trained on but haven't ranked
    const unranked = empStations.filter(es => es.rank == null);

    _empPrefData.ranked = ranked.map(r => r.station_id);
    _empPrefData.unrankedSkills = unranked.map(r => r.station_id);

    renderEmpPrefUI();
  } catch (err) {
    document.getElementById('emp-pref-content').innerHTML = `
      <div class="text-red text-sm">${err.message}</div>
    `;
  }
}

function renderEmpPrefUI() {
  const { ranked, unrankedSkills, allStations, stations, empName } = _empPrefData;
  const stationMap = {};
  allStations.forEach(s => { stationMap[s.id] = s; });

  // Stations not assigned at all
  const assignedIds = new Set([...ranked, ...unrankedSkills]);
  const notAssigned = allStations.filter(s => !assignedIds.has(s.id));

  let html = '';

  // Ranked preferences section
  if (ranked.length > 0) {
    html += `<div style="margin-bottom:16px">
      <div class="semi text-sm" style="margin-bottom:8px">Ranked Preferences</div>
      <div style="display:grid;gap:6px">`;
    ranked.forEach((stId, idx) => {
      const st = stationMap[stId];
      if (!st) return;
      const rankColor = idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : 'var(--text-muted)';
      html += `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:${idx < 3 ? 'rgba(167,139,250,.08)' : 'rgba(30,41,59,.5)'};border:1px solid ${idx < 3 ? 'rgba(167,139,250,.2)' : '#334155'};border-radius:8px">
        <span class="semi" style="color:${rankColor};font-size:15px;width:28px;text-align:center">#${idx + 1}</span>
        <div style="flex:1">
          <div class="semi text-sm">${st.name}</div>
        </div>
        <div class="flex gap-1">
          ${idx > 0 ? `<button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px" onclick="empPrefMove(${idx},-1)">▲</button>` : '<span style="width:28px"></span>'}
          ${idx < ranked.length - 1 ? `<button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px" onclick="empPrefMove(${idx},1)">▼</button>` : '<span style="width:28px"></span>'}
          <button class="btn btn-ghost btn-sm" style="padding:2px 6px;color:var(--red);font-size:11px" onclick="empPrefRemove(${idx})">✕</button>
        </div>
      </div>`;
    });
    html += `</div></div>`;
  } else {
    html += `<div style="background:rgba(251,191,36,.05);border:1px solid rgba(251,191,36,.2);border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:var(--text-muted)">
      No ranked preferences set. ${empName.split(' ')[0]} hasn't ranked their preferred stations yet, or you can set them below.
    </div>`;
  }

  // Trained stations (unranked)
  if (unrankedSkills.length > 0) {
    html += `<div style="margin-bottom:16px">
      <div class="semi text-sm" style="margin-bottom:8px">Trained (not ranked)</div>
      <div style="display:grid;gap:4px">`;
    unrankedSkills.forEach(stId => {
      const st = stationMap[stId];
      if (!st) return;
      html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(30,41,59,.5);border:1px solid #334155;border-radius:8px">
        <div style="flex:1"><span class="text-sm">${st.name}</span></div>
        <button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:11px" onclick="empPrefAddRank(${stId})">+ Rank</button>
      </div>`;
    });
    html += `</div></div>`;
  }

  // Available stations (not assigned)
  if (notAssigned.length > 0) {
    html += `<div style="margin-bottom:12px">
      <div class="semi text-sm" style="margin-bottom:8px;color:var(--text-muted)">Not assigned</div>
      <div style="display:grid;gap:4px">`;
    notAssigned.forEach(st => {
      html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(30,41,59,.3);border:1px solid rgba(51,65,85,.4);border-radius:8px;opacity:.6">
        <div style="flex:1"><span class="text-sm">${st.name}</span></div>
        <button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:11px" onclick="empPrefAddNew(${st.id})">+ Add & Rank</button>
      </div>`;
    });
    html += `</div></div>`;
  }

  html += `<div class="flex gap-2 mt-3">
    <button class="btn btn-primary" style="flex:1" onclick="saveEmpPrefs()">Save</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  </div>`;

  document.getElementById('emp-pref-content').innerHTML = html;
}

function empPrefMove(idx, direction) {
  const r = _empPrefData.ranked;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= r.length) return;
  [r[idx], r[newIdx]] = [r[newIdx], r[idx]];
  renderEmpPrefUI();
}

function empPrefRemove(idx) {
  const stId = _empPrefData.ranked.splice(idx, 1)[0];
  // Move back to unranked skills
  _empPrefData.unrankedSkills.push(stId);
  renderEmpPrefUI();
}

function empPrefAddRank(stationId) {
  _empPrefData.unrankedSkills = _empPrefData.unrankedSkills.filter(id => id !== stationId);
  _empPrefData.ranked.push(stationId);
  renderEmpPrefUI();
}

function empPrefAddNew(stationId) {
  _empPrefData.ranked.push(stationId);
  renderEmpPrefUI();
}

async function saveEmpPrefs() {
  const { empId, ranked, unrankedSkills } = _empPrefData;
  // Build the full station list: ranked ones with rank, unranked ones without
  const stationIds = [];
  ranked.forEach((stId, idx) => {
    stationIds.push({ stationId: stId, preferred: idx < 3, rank: idx + 1 });
  });
  unrankedSkills.forEach(stId => {
    stationIds.push({ stationId: stId, preferred: false, rank: null });
  });

  try {
    await API.updateEmployeeStations(empId, stationIds);
    UI.closeModal();
    UI.toast('Preferences updated!');
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

// Close add-employee dropdown when clicking elsewhere
document.addEventListener('click', (e) => {
  if (!e.target.closest('.add-emp-dropdown') && !e.target.closest('.btn-primary')) {
    document.querySelectorAll('.add-emp-dropdown.show').forEach(d => d.classList.remove('show'));
  }
});

// ═══════════════════════════════════════════════════════
// Bulk Employee Import
// ═══════════════════════════════════════════════════════

let _bulkImportData = { rows: [], mapping: {}, step: 'upload' };

// Fuzzy column matching keywords
const COLUMN_PATTERNS = {
  firstName: ['first', 'fname', 'given', 'first name', 'firstname', 'first_name'],
  lastName:  ['last', 'lname', 'surname', 'family', 'last name', 'lastname', 'last_name'],
  phone:     ['phone', 'mobile', 'cell', 'tel', 'number', 'phone number', 'phone_number', 'phonenumber'],
  email:     ['email', 'e-mail', 'mail', 'email address', 'email_address'],
  role:      ['role', 'position', 'title', 'job', 'type'],
};

// Detect column type from header text
function detectColumnType(header) {
  const h = header.toString().toLowerCase().trim();
  for (const [field, keywords] of Object.entries(COLUMN_PATTERNS)) {
    for (const kw of keywords) {
      if (h === kw || h.includes(kw)) return field;
    }
  }
  // Check if it's a "name" column (could be full name)
  if (h === 'name' || h === 'employee' || h === 'employee name' || h === 'full name' || h === 'fullname') return 'fullName';
  return 'skip';
}

// Detect data type from cell values (for headerless data)
function detectDataType(values) {
  const samples = values.filter(v => v && v.toString().trim()).slice(0, 10);
  if (samples.length === 0) return 'skip';

  const phonePattern = /^[\d\s\-\(\)\+\.]{7,}$/;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneCount = samples.filter(v => phonePattern.test(v.toString().trim())).length;
  const emailCount = samples.filter(v => emailPattern.test(v.toString().trim())).length;

  if (phoneCount > samples.length * 0.5) return 'phone';
  if (emailCount > samples.length * 0.5) return 'email';

  // Check if values look like "First Last" names
  const nameCount = samples.filter(v => {
    const parts = v.toString().trim().split(/\s+/);
    return parts.length >= 2 && parts.every(p => /^[a-zA-Z\-']+$/.test(p));
  }).length;
  if (nameCount > samples.length * 0.5) return 'fullName';

  // Check if single word (could be first or last name)
  const singleWord = samples.filter(v => /^[a-zA-Z\-']+$/.test(v.toString().trim())).length;
  if (singleWord > samples.length * 0.5) return 'firstName'; // default to first name

  return 'skip';
}

// Parse uploaded file (Excel or CSV)
function parseBulkFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (typeof XLSX === 'undefined') {
          reject(new Error('Excel library not loaded. Please refresh and try again.'));
          return;
        }
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        resolve(json.filter(row => row.some(cell => cell !== '')));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// Parse pasted text (tab or comma separated)
function parseBulkPaste(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  // Detect delimiter: tab, comma, or pipe
  const firstLine = lines[0];
  let delimiter = '\t';
  if (!firstLine.includes('\t')) {
    delimiter = firstLine.includes(',') ? ',' : firstLine.includes('|') ? '|' : /\s{2,}/.test(firstLine) ? /\s{2,}/ : ',';
  }

  return lines.map(line => {
    if (delimiter instanceof RegExp) return line.split(delimiter).map(c => c.trim());
    return line.split(delimiter).map(c => c.trim());
  }).filter(row => row.some(cell => cell !== ''));
}

// Detect if first row is headers
function hasHeaders(rows) {
  if (rows.length < 2) return false;
  const firstRow = rows[0];
  // If any cell in first row matches a known header keyword, treat as headers
  return firstRow.some(cell => {
    const c = cell.toString().toLowerCase().trim();
    return detectColumnType(c) !== 'skip' || c === 'name' || c === 'employee';
  });
}

// Auto-detect column mapping
function autoDetectMapping(rows) {
  const mapping = {};
  const isHeader = hasHeaders(rows);

  if (isHeader) {
    rows[0].forEach((header, i) => {
      mapping[i] = detectColumnType(header);
    });
  } else {
    // Use data pattern recognition
    const colCount = Math.max(...rows.map(r => r.length));
    for (let i = 0; i < colCount; i++) {
      const colValues = rows.map(r => r[i] || '');
      mapping[i] = detectDataType(colValues);
    }
  }
  return { mapping, hasHeader: isHeader };
}

// Show bulk import modal
function showBulkImportModal() {
  _bulkImportData = { rows: [], mapping: {}, step: 'upload' };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'bulk-import-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:600px;width:95%;max-height:90vh;overflow-y:auto">
      <div class="modal-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>📋 Bulk Import Employees</span>
        <button class="btn btn-ghost btn-sm" onclick="closeBulkImport()" style="font-size:18px">&times;</button>
      </div>
      <div id="bulk-import-content">
        ${renderBulkUploadStep()}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function closeBulkImport() {
  const el = document.getElementById('bulk-import-overlay');
  if (el) el.remove();
}

// Step 1: Upload / Paste
function renderBulkUploadStep() {
  return `
    <p class="text-sm text-muted mb-3">Upload a spreadsheet or paste employee data. We'll auto-detect the columns.</p>

    <div id="bulk-drop-zone" style="border:2px dashed var(--border);border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:16px"
      onclick="document.getElementById('bulk-file-input').click()"
      ondragover="event.preventDefault();this.style.borderColor='var(--green)';this.style.background='rgba(34,197,94,.05)'"
      ondragleave="this.style.borderColor='var(--border)';this.style.background='transparent'"
      ondrop="event.preventDefault();this.style.borderColor='var(--border)';this.style.background='transparent';handleBulkFileDrop(event)">
      <div style="font-size:32px;margin-bottom:8px">📁</div>
      <div class="semi" style="margin-bottom:4px">Drop Excel or CSV file here</div>
      <div class="text-xs text-muted">or click to browse</div>
      <input type="file" id="bulk-file-input" accept=".xlsx,.xls,.csv,.tsv,.txt" style="display:none" onchange="handleBulkFileSelect(event)">
    </div>

    <div style="text-align:center;color:var(--text-muted);font-size:12px;margin:12px 0">— or paste data below —</div>

    <textarea id="bulk-paste-area" placeholder="Paste from Excel, Google Sheets, or type:&#10;John Smith  (555) 123-4567&#10;Jane Doe    (555) 987-6543"
      style="width:100%;min-height:120px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:12px;font-family:monospace;font-size:13px;resize:vertical"></textarea>

    <button class="btn btn-primary btn-block mt-3" onclick="processBulkPaste()">Process Pasted Data</button>
  `;
}

// Handle file upload
async function handleBulkFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  await processBulkFile(file);
}

async function handleBulkFileDrop(event) {
  const file = event.dataTransfer.files[0];
  if (!file) return;
  await processBulkFile(file);
}

async function processBulkFile(file) {
  const content = document.getElementById('bulk-import-content');
  content.innerHTML = `<div class="loading"><div class="spinner"></div> Parsing ${file.name}...</div>`;

  try {
    const rows = await parseBulkFile(file);
    if (rows.length === 0) {
      UI.toast('File appears to be empty', 'error');
      content.innerHTML = renderBulkUploadStep();
      return;
    }
    processBulkRows(rows);
  } catch (err) {
    UI.toast('Error reading file: ' + err.message, 'error');
    content.innerHTML = renderBulkUploadStep();
  }
}

function processBulkPaste() {
  const text = document.getElementById('bulk-paste-area').value;
  if (!text.trim()) {
    UI.toast('Paste some data first', 'error');
    return;
  }
  const rows = parseBulkPaste(text);
  if (rows.length === 0) {
    UI.toast('Could not parse any data', 'error');
    return;
  }
  processBulkRows(rows);
}

// Step 2: Column mapping + preview
function processBulkRows(rows) {
  const { mapping, hasHeader } = autoDetectMapping(rows);
  _bulkImportData.rows = rows;
  _bulkImportData.mapping = mapping;
  _bulkImportData.hasHeader = hasHeader;
  _bulkImportData.step = 'mapping';

  renderBulkMappingStep();
}

function renderBulkMappingStep() {
  const { rows, mapping, hasHeader } = _bulkImportData;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const colCount = Math.max(...rows.map(r => r.length));
  const previewRows = dataRows.slice(0, 5);

  const fieldOptions = [
    { value: 'skip', label: '— Skip —' },
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'fullName', label: 'Full Name' },
    { value: 'phone', label: 'Phone' },
    { value: 'email', label: 'Email' },
    { value: 'role', label: 'Role' },
  ];

  const content = document.getElementById('bulk-import-content');
  content.innerHTML = `
    <p class="text-sm text-muted mb-3">
      Found <strong>${dataRows.length}</strong> rows. ${hasHeader ? 'Headers detected.' : 'No headers detected — mapped by data patterns.'}
      Adjust column mapping if needed:
    </p>

    <div style="overflow-x:auto;margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr>
            ${Array.from({length: colCount}, (_, i) => `
              <th style="padding:6px 8px;border-bottom:2px solid var(--border);text-align:left;min-width:120px">
                ${hasHeader ? `<div class="text-xs text-muted mb-1">${rows[0][i] || `Col ${i+1}`}</div>` : ''}
                <select class="form-input" style="font-size:12px;padding:4px 6px" data-col="${i}" onchange="updateBulkMapping(${i}, this.value)">
                  ${fieldOptions.map(f => `<option value="${f.value}" ${mapping[i] === f.value ? 'selected' : ''}>${f.label}</option>`).join('')}
                </select>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${previewRows.map(row => `
            <tr>
              ${Array.from({length: colCount}, (_, i) => `
                <td style="padding:6px 8px;border-bottom:1px solid rgba(51,65,85,.2);font-size:12px;color:var(--text-muted)">${row[i] || ''}</td>
              `).join('')}
            </tr>
          `).join('')}
          ${dataRows.length > 5 ? `
            <tr><td colspan="${colCount}" style="padding:6px 8px;text-align:center;font-size:11px;color:var(--text-muted)">... and ${dataRows.length - 5} more rows</td></tr>
          ` : ''}
        </tbody>
      </table>
    </div>

    <div id="bulk-mapping-warning" style="display:none;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);border-radius:8px;padding:10px;margin-bottom:12px;font-size:13px;color:#FBBF24"></div>

    <div class="btn-group">
      <button class="btn btn-secondary" onclick="document.getElementById('bulk-import-content').innerHTML=renderBulkUploadStep()">← Back</button>
      <button class="btn btn-primary" onclick="previewBulkImport()">Preview Import →</button>
    </div>
  `;

  validateBulkMapping();
}

function updateBulkMapping(colIndex, value) {
  _bulkImportData.mapping[colIndex] = value;
  validateBulkMapping();
}

function validateBulkMapping() {
  const m = _bulkImportData.mapping;
  const values = Object.values(m);
  const warnings = [];

  const hasFirst = values.includes('firstName');
  const hasLast = values.includes('lastName');
  const hasFull = values.includes('fullName');
  const hasPhone = values.includes('phone');

  if (!hasFirst && !hasFull) warnings.push('No first name or full name column mapped');
  if (!hasLast && !hasFull) warnings.push('No last name or full name column mapped');
  if (!hasPhone) warnings.push('No phone column mapped — employees need a phone number to log in');

  const el = document.getElementById('bulk-mapping-warning');
  if (el) {
    if (warnings.length > 0) {
      el.style.display = 'block';
      el.innerHTML = '⚠️ ' + warnings.join('<br>⚠️ ');
    } else {
      el.style.display = 'none';
    }
  }
}

// Step 3: Preview parsed employees
function previewBulkImport() {
  const { rows, mapping, hasHeader } = _bulkImportData;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  // Build employee objects from mapping
  const employees = [];
  for (const row of dataRows) {
    const emp = { firstName: '', lastName: '', phone: '', email: '', role: 'employee' };

    for (const [colStr, field] of Object.entries(mapping)) {
      const col = parseInt(colStr);
      const val = (row[col] || '').toString().trim();
      if (!val) continue;

      if (field === 'fullName') {
        const parts = val.split(/\s+/);
        emp.firstName = parts[0] || '';
        emp.lastName = parts.slice(1).join(' ') || '';
      } else if (field === 'firstName') {
        emp.firstName = val;
      } else if (field === 'lastName') {
        emp.lastName = val;
      } else if (field === 'phone') {
        emp.phone = val.replace(/\D/g, '').slice(-10);
      } else if (field === 'email') {
        emp.email = val;
      } else if (field === 'role') {
        emp.role = val.toLowerCase();
      }
    }

    // Skip empty rows
    if (emp.firstName || emp.lastName) {
      employees.push(emp);
    }
  }

  if (employees.length === 0) {
    UI.toast('No valid employees found. Check column mapping.', 'error');
    return;
  }

  _bulkImportData.employees = employees;
  _bulkImportData.step = 'preview';

  const content = document.getElementById('bulk-import-content');
  content.innerHTML = `
    <p class="text-sm text-muted mb-3">
      Ready to import <strong>${employees.length}</strong> employee${employees.length !== 1 ? 's' : ''}.
      Duplicates (by phone) will be skipped automatically.
    </p>

    <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="position:sticky;top:0;background:var(--bg-card);z-index:1">
            <th style="padding:8px;text-align:left;border-bottom:2px solid var(--border)">First</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid var(--border)">Last</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid var(--border)">Phone</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid var(--border)">Status</th>
          </tr>
        </thead>
        <tbody>
          ${employees.map((emp, i) => {
            const hasIssue = !emp.firstName || !emp.lastName;
            const noPhone = !emp.phone || emp.phone.length !== 10;
            return `
              <tr style="${hasIssue || noPhone ? 'background:rgba(251,191,36,.05)' : ''}">
                <td style="padding:6px 8px;border-bottom:1px solid rgba(51,65,85,.2)">${emp.firstName || '<span style="color:#F87171">Missing</span>'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(51,65,85,.2)">${emp.lastName || '<span style="color:#F87171">Missing</span>'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(51,65,85,.2)">${emp.phone ? formatPhoneNumber(emp.phone) : '<span style="color:#FBBF24">No phone</span>'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(51,65,85,.2)">${
                  hasIssue ? '<span style="color:#FBBF24;font-size:11px">⚠️ Name incomplete</span>' :
                  noPhone ? '<span style="color:#FBBF24;font-size:11px">⚠️ No phone</span>' :
                  '<span style="color:#22C55E;font-size:11px">✓ Ready</span>'
                }</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    ${employees.some(e => !e.phone || e.phone.length !== 10) ? `
      <div style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);border-radius:8px;padding:10px;margin-top:12px;font-size:12px;color:#FBBF24">
        ⚠️ Employees without valid phone numbers will be imported but won't be able to log in until a phone is added.
      </div>
    ` : ''}

    <div class="btn-group mt-3">
      <button class="btn btn-secondary" onclick="renderBulkMappingStep()">← Back</button>
      <button class="btn btn-primary" id="bulk-import-btn" onclick="executeBulkImport()">Import ${employees.length} Employee${employees.length !== 1 ? 's' : ''}</button>
    </div>
  `;
}

// Step 4: Execute import
async function executeBulkImport() {
  const btn = document.getElementById('bulk-import-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Importing...'; }

  const employees = _bulkImportData.employees;

  try {
    const result = await API.bulkImport(employees);
    closeBulkImport();
    UI.toast(`Imported ${result.added} employee${result.added !== 1 ? 's' : ''}${result.skipped ? ` (${result.skipped} skipped)` : ''}!`);
    renderAdminEmployees(document.getElementById('app'));
    showContinueSetup();
  } catch (err) {
    UI.toast('Import failed: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = `Import ${employees.length} Employees`; }
  }
}

// ── Per-Station Ratings Modal ──
async function showStationRatingsModal(empId, empName) {
  let empStations = [];
  let stationRatings = [];
  try {
    [empStations, stationRatings] = await Promise.all([
      API.getEmployeeStations(empId),
      API.getStationRatings(empId),
    ]);
  } catch (e) {}

  if (empStations.length === 0) {
    UI.showModal(`${empName} — Station Ratings`, `
      <p class="text-sm text-muted">No stations assigned yet. Assign stations first via "Station Skills".</p>
    `, `<button class="btn btn-secondary" onclick="UI.closeModal()">Close</button>`);
    return;
  }

  const ratingMap = {};
  stationRatings.forEach(r => { ratingMap[r.station_id] = r.rating; });

  function starsHtml(stationId, current) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const filled = current && i <= current;
      html += `<span onclick="setStationRatingInline(${empId},${stationId},${i === current ? 0 : i})" style="font-size:20px;color:${filled ? '#FFD700' : '#475569'};cursor:pointer;padding:0 1px">${filled ? '★' : '☆'}</span>`;
    }
    return html;
  }

  UI.showModal(`${empName} — Station Ratings`, `
    <p class="text-sm text-muted mb-3">Rate this employee on each assigned station. These override the category ratings for scheduling.</p>
    <div id="station-ratings-list">
      ${empStations.map(s => `
        <div class="flex justify-between items-center" style="padding:10px 0;border-bottom:1px solid rgba(51,65,85,.3)" id="sr-row-${s.station_id}">
          <div>
            <div class="semi text-sm">${s.station_name || s.name}</div>
            <div class="text-xs text-muted">${s.station_description || ''}</div>
          </div>
          <div id="sr-stars-${s.station_id}">${starsHtml(s.station_id, ratingMap[s.station_id] || 0)}</div>
        </div>
      `).join('')}
    </div>
  `, `<button class="btn btn-secondary" onclick="UI.closeModal()">Done</button>`);

  // Store for inline updates
  window._srEmpId = empId;
  window._srRatingMap = ratingMap;
  window._srEmpStations = empStations;
}

async function setStationRatingInline(empId, stationId, rating) {
  try {
    await API.setStationRating(empId, stationId, rating || null);
    // Update the stars inline
    window._srRatingMap[stationId] = rating;
    const container = document.getElementById(`sr-stars-${stationId}`);
    if (container) {
      let html = '';
      for (let i = 1; i <= 5; i++) {
        const filled = rating && i <= rating;
        html += `<span onclick="setStationRatingInline(${empId},${stationId},${i === rating ? 0 : i})" style="font-size:20px;color:${filled ? '#FFD700' : '#475569'};cursor:pointer;padding:0 1px">${filled ? '★' : '☆'}</span>`;
      }
      container.innerHTML = html;
    }
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}
