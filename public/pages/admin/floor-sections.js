// ═══════════════════════════════════════════════════════
// CrewCast — Floor Sections / Server Assignments
// Assign servers to sections with cover counts
// ═══════════════════════════════════════════════════════

let _floorDate = new Date().toISOString().split('T')[0];
let _floorSections = [];

async function renderFloorSections(app) {
  document.body.classList.add('admin-mode');
  const today = new Date().toISOString().split('T')[0];

  app.innerHTML = UI.adminShell('floor-sections', `
    <div class="page" style="padding-bottom:80px">
      <div class="page-header">
        <h1>Floor Sections</h1>
        <button class="btn btn-primary btn-sm" onclick="showAddSection()">+ Add Section</button>
      </div>
      <p class="text-sm text-muted" style="margin-bottom:16px">
        Assign servers to dining sections. Track covers and balance the floor.
      </p>

      <!-- Date Selector -->
      <div class="card mb-3" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div style="display:flex;gap:8px;align-items:center">
          <label class="text-xs text-muted">Date</label>
          <input type="date" id="floor-date" class="input" value="${today}" onchange="_floorDate=this.value;loadFloorSections()" style="width:auto">
        </div>
        <div style="display:flex;gap:6px;margin-left:auto">
          <button class="btn btn-outline btn-sm" onclick="setFloorShift('lunch')">Lunch</button>
          <button class="btn btn-outline btn-sm" onclick="setFloorShift('dinner')">Dinner</button>
        </div>
      </div>

      <!-- Summary -->
      <div id="floor-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;margin-bottom:16px"></div>

      <!-- Sections Grid -->
      <div id="floor-sections-grid">${UI.loading()}</div>

      <!-- Quick Setup -->
      <div id="floor-quick-setup" style="display:none">
        <div class="card" style="text-align:center;padding:24px">
          <div style="font-size:36px;margin-bottom:8px">🍽️</div>
          <div class="semi mb-2">No sections set up yet</div>
          <p class="text-sm text-muted mb-3">Add dining sections to assign servers and track covers.</p>
          <button class="btn btn-secondary" onclick="seedDefaultSections()">Add Default Sections</button>
        </div>
      </div>
    </div>
  `);

  loadFloorSections();
}

function setFloorShift(meal) {
  // Just a visual label for now — could be used to filter
  document.querySelectorAll('.floor-meal-btn').forEach(b => b.classList.remove('active'));
  UI.toast(`Showing ${meal} sections`);
}

async function loadFloorSections() {
  const grid = document.getElementById('floor-sections-grid');
  const summary = document.getElementById('floor-summary');
  const quickSetup = document.getElementById('floor-quick-setup');
  if (!grid) return;

  // Load sections from localStorage (lightweight — no backend needed for MVP)
  const stored = localStorage.getItem('cc-floor-sections-' + API.user.businessId);
  _floorSections = stored ? JSON.parse(stored) : [];

  if (_floorSections.length === 0) {
    grid.style.display = 'none';
    quickSetup.style.display = 'block';
    summary.innerHTML = '';
    return;
  }

  grid.style.display = '';
  quickSetup.style.display = 'none';

  const totalCovers = _floorSections.reduce((s, sec) => s + (sec.covers || 0), 0);
  const totalTables = _floorSections.reduce((s, sec) => s + (sec.tables || 0), 0);
  const assignedServers = _floorSections.filter(s => s.server).length;

  summary.innerHTML = `
    <div class="card" style="text-align:center;border-left:3px solid var(--purple)">
      <div class="text-xs text-muted">Sections</div>
      <div class="semi" style="font-size:20px">${_floorSections.length}</div>
    </div>
    <div class="card" style="text-align:center;border-left:3px solid var(--green)">
      <div class="text-xs text-muted">Servers Assigned</div>
      <div class="semi" style="font-size:20px">${assignedServers}</div>
    </div>
    <div class="card" style="text-align:center;border-left:3px solid var(--blue,#60a5fa)">
      <div class="text-xs text-muted">Total Tables</div>
      <div class="semi" style="font-size:20px">${totalTables}</div>
    </div>
    <div class="card" style="text-align:center;border-left:3px solid var(--yellow,#fbbf24)">
      <div class="text-xs text-muted">Est. Covers</div>
      <div class="semi" style="font-size:20px">${totalCovers}</div>
    </div>
  `;

  const maxCovers = Math.max(..._floorSections.map(s => s.covers || 0), 1);
  grid.innerHTML = _floorSections.map((sec, idx) => `
    <div class="card" style="padding:16px;margin-bottom:10px;border-left:3px solid ${sec.server ? 'var(--green)' : 'var(--border)'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div class="semi">${sec.name}</div>
          <div class="text-xs text-muted">${sec.tables || 0} tables · ${sec.covers || 0} covers</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="editFloorSection(${idx})">Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red,#ef4444)" onclick="deleteFloorSection(${idx})">×</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:60px;font-size:11px;color:var(--text-muted)">Server:</div>
        <input type="text" class="input" value="${sec.server || ''}" placeholder="Assign server..."
          style="flex:1;font-size:12px;padding:4px 8px"
          onchange="updateFloorServer(${idx}, this.value)">
      </div>
      <div style="margin-top:6px;height:6px;background:var(--bg-primary);border-radius:3px;overflow:hidden">
        <div style="width:${Math.round((sec.covers || 0) / maxCovers * 100)}%;height:100%;background:var(--purple);border-radius:3px"></div>
      </div>
    </div>
  `).join('');
}

function showAddSection() {
  UI.showModal('Add Section', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label class="text-sm semi">Section Name</label>
        <input type="text" id="fs-name" class="input" placeholder="e.g. Section A, Patio, Bar Top">
      </div>
      <div>
        <label class="text-sm semi">Number of Tables</label>
        <input type="number" id="fs-tables" class="input" value="4" min="1" max="50">
      </div>
      <div>
        <label class="text-sm semi">Estimated Covers</label>
        <input type="number" id="fs-covers" class="input" value="16" min="0" max="200">
      </div>
    </div>
  `, `
    <button class="btn btn-primary" onclick="saveNewSection()">Add</button>
    <button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
  `);
}

function saveNewSection() {
  const name = document.getElementById('fs-name').value.trim();
  const tables = parseInt(document.getElementById('fs-tables').value) || 4;
  const covers = parseInt(document.getElementById('fs-covers').value) || 16;
  if (!name) return UI.toast('Section name required', 'error');
  _floorSections.push({ name, tables, covers, server: '' });
  saveFloorSections();
  UI.closeModal();
  UI.toast('Section added');
  loadFloorSections();
}

function editFloorSection(idx) {
  const sec = _floorSections[idx];
  UI.showModal('Edit Section', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label class="text-sm semi">Section Name</label>
        <input type="text" id="fs-name" class="input" value="${sec.name}">
      </div>
      <div>
        <label class="text-sm semi">Number of Tables</label>
        <input type="number" id="fs-tables" class="input" value="${sec.tables || 4}" min="1" max="50">
      </div>
      <div>
        <label class="text-sm semi">Estimated Covers</label>
        <input type="number" id="fs-covers" class="input" value="${sec.covers || 16}" min="0" max="200">
      </div>
    </div>
  `, `
    <button class="btn btn-primary" onclick="saveEditSection(${idx})">Save</button>
    <button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
  `);
}

function saveEditSection(idx) {
  _floorSections[idx].name = document.getElementById('fs-name').value.trim();
  _floorSections[idx].tables = parseInt(document.getElementById('fs-tables').value) || 4;
  _floorSections[idx].covers = parseInt(document.getElementById('fs-covers').value) || 16;
  saveFloorSections();
  UI.closeModal();
  UI.toast('Section updated');
  loadFloorSections();
}

function deleteFloorSection(idx) {
  if (!confirm('Remove this section?')) return;
  _floorSections.splice(idx, 1);
  saveFloorSections();
  loadFloorSections();
}

function updateFloorServer(idx, name) {
  _floorSections[idx].server = name;
  saveFloorSections();
}

function saveFloorSections() {
  localStorage.setItem('cc-floor-sections-' + API.user.businessId, JSON.stringify(_floorSections));
}

function seedDefaultSections() {
  _floorSections = [
    { name: 'Section A (Front)', tables: 5, covers: 20, server: '' },
    { name: 'Section B (Middle)', tables: 5, covers: 20, server: '' },
    { name: 'Section C (Back)', tables: 4, covers: 16, server: '' },
    { name: 'Patio', tables: 6, covers: 24, server: '' },
    { name: 'Bar Top', tables: 0, covers: 12, server: '' },
    { name: 'Private Dining', tables: 2, covers: 16, server: '' },
  ];
  saveFloorSections();
  loadFloorSections();
  UI.toast('Default sections added');
}
