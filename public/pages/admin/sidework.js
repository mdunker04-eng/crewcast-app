// ═══════════════════════════════════════════════════════
// CrewCast — Admin Side Work / Closing Duties
// Manage daily checklists for opening, closing, side work
// ═══════════════════════════════════════════════════════

async function renderSidework(app) {
  document.body.classList.add('admin-mode');
  app.innerHTML = UI.adminShell('sidework', `
    <div class="page" style="padding-bottom:80px">
      <div class="page-header">
        <h1>Side Work & Duties</h1>
        <button class="btn btn-primary btn-sm" onclick="showAddSidework()">+ Add Task</button>
      </div>
      <p class="text-sm text-muted" style="margin-bottom:16px">
        Define opening, closing, and side work tasks. Staff can check them off during their shifts.
      </p>

      <!-- Category Filter -->
      <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary sw-cat-btn active" data-cat="all" onclick="filterSideworkCat('all')">All</button>
        <button class="btn btn-sm btn-secondary sw-cat-btn" data-cat="opening" onclick="filterSideworkCat('opening')">Opening</button>
        <button class="btn btn-sm btn-secondary sw-cat-btn" data-cat="closing" onclick="filterSideworkCat('closing')">Closing</button>
        <button class="btn btn-sm btn-secondary sw-cat-btn" data-cat="sidework" onclick="filterSideworkCat('sidework')">Side Work</button>
        <button class="btn btn-sm btn-secondary sw-cat-btn" data-cat="prep" onclick="filterSideworkCat('prep')">Prep</button>
      </div>

      <div id="sidework-list">${UI.loading()}</div>

      <!-- Today's Completions -->
      <div class="card mt-4">
        <div class="card-title mb-2">Today's Completions</div>
        <div id="sidework-completions">${UI.loading()}</div>
      </div>
    </div>
  `);
  loadSidework();
}

let _swFilterCat = 'all';

function filterSideworkCat(cat) {
  _swFilterCat = cat;
  document.querySelectorAll('.sw-cat-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === cat);
    b.style.background = b.dataset.cat === cat ? 'var(--purple)' : '';
    b.style.color = b.dataset.cat === cat ? '#fff' : '';
  });
  loadSidework();
}

async function loadSidework() {
  const container = document.getElementById('sidework-list');
  if (!container) return;
  try {
    const tasks = await API.getSidework();
    const filtered = _swFilterCat === 'all' ? tasks : tasks.filter(t => t.category === _swFilterCat);

    if (filtered.length === 0 && tasks.length === 0) {
      container.innerHTML = UI.empty('📋', 'No tasks yet', 'Add opening, closing, or side work tasks for your team.') +
        `<div style="text-align:center;margin-top:16px">
          <button class="btn btn-secondary" onclick="seedDefaultSidework()">Add Restaurant Defaults</button>
        </div>`;
    } else if (filtered.length === 0) {
      container.innerHTML = `<div class="text-muted text-sm">No tasks in this category.</div>`;
    } else {
      const catIcons = { opening: '🌅', closing: '🌙', sidework: '🧹', prep: '🔪' };
      container.innerHTML = filtered.map(t => `
        <div class="card" style="padding:12px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px${!t.active ? ';opacity:0.5' : ''}">
          <div>
            <div class="semi text-sm">${catIcons[t.category] || '📋'} ${t.name}</div>
            <div class="text-xs text-muted">
              ${t.category}${t.station_name ? ' · ' + t.station_name : ''}${t.role_name ? ' · ' + t.role_name : ''}
            </div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm" onclick='editSidework(${JSON.stringify(t).replace(/'/g, "\\'")})'>Edit</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red,#ef4444)" onclick="deleteSidework(${t.id})">Delete</button>
          </div>
        </div>
      `).join('');
    }

    // Load completions
    loadSideworkCompletions();
  } catch (err) {
    container.innerHTML = `<div class="card"><p class="text-muted">Error: ${err.message}</p></div>`;
  }
}

async function loadSideworkCompletions() {
  const container = document.getElementById('sidework-completions');
  if (!container) return;
  try {
    const completions = await API.getSideworkCompletions();
    if (completions.length === 0) {
      container.innerHTML = '<div class="text-muted text-xs">No completions logged today.</div>';
    } else {
      container.innerHTML = completions.map(c => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
          <span style="color:var(--green-text)">✓</span>
          <span class="text-sm semi">${c.task_name}</span>
          <span class="text-xs text-muted">by ${c.first_name} ${c.last_name}</span>
          <span class="text-xs text-muted" style="margin-left:auto">${new Date(c.completed_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
        </div>
      `).join('');
    }
  } catch (err) {
    container.innerHTML = '<div class="text-muted text-xs">Could not load completions.</div>';
  }
}

function showAddSidework() {
  UI.showModal('Add Task', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label class="text-sm semi">Task Name</label>
        <input type="text" id="sw-name" class="input" placeholder="e.g. Restock napkins, Sweep patio">
      </div>
      <div>
        <label class="text-sm semi">Category</label>
        <select id="sw-cat" class="input">
          <option value="closing">Closing</option>
          <option value="opening">Opening</option>
          <option value="sidework">Side Work</option>
          <option value="prep">Prep</option>
        </select>
      </div>
    </div>
  `, `
    <button class="btn btn-primary" onclick="saveNewSidework()">Save</button>
    <button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
  `);
}

async function saveNewSidework() {
  const name = document.getElementById('sw-name').value.trim();
  const category = document.getElementById('sw-cat').value;
  if (!name) return UI.toast('Task name required', 'error');
  try {
    await API.createSidework({ name, category });
    UI.closeModal();
    UI.toast('Task added');
    loadSidework();
  } catch (err) { UI.toast(err.message, 'error'); }
}

function editSidework(task) {
  UI.showModal('Edit Task', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label class="text-sm semi">Task Name</label>
        <input type="text" id="sw-name" class="input" value="${task.name}">
      </div>
      <div>
        <label class="text-sm semi">Category</label>
        <select id="sw-cat" class="input">
          ${['closing','opening','sidework','prep'].map(c => `<option value="${c}" ${task.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="sw-active" ${task.active ? 'checked' : ''}> Active
      </label>
    </div>
  `, `
    <button class="btn btn-primary" onclick="saveEditSidework(${task.id})">Save</button>
    <button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
  `);
}

async function saveEditSidework(id) {
  try {
    await API.updateSidework(id, {
      name: document.getElementById('sw-name').value.trim(),
      category: document.getElementById('sw-cat').value,
      active: document.getElementById('sw-active').checked
    });
    UI.closeModal();
    UI.toast('Task updated');
    loadSidework();
  } catch (err) { UI.toast(err.message, 'error'); }
}

async function deleteSidework(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await API.deleteSidework(id);
    UI.toast('Task deleted');
    loadSidework();
  } catch (err) { UI.toast(err.message, 'error'); }
}

async function seedDefaultSidework() {
  try {
    const defaults = [
      { name: 'Unlock doors, turn on lights', category: 'opening' },
      { name: 'Set thermostats', category: 'opening' },
      { name: 'Check reservations list', category: 'opening' },
      { name: 'Stock server stations (napkins, silverware, condiments)', category: 'opening' },
      { name: 'Brew coffee / prep tea station', category: 'opening' },
      { name: 'Set up host stand & menus', category: 'opening' },
      { name: 'Cut fruit & garnishes for bar', category: 'prep' },
      { name: 'Prep salad station', category: 'prep' },
      { name: 'Portion desserts', category: 'prep' },
      { name: 'Check 86 board and specials', category: 'prep' },
      { name: 'Restock condiments & napkins', category: 'sidework' },
      { name: 'Roll silverware', category: 'sidework' },
      { name: 'Wipe down menus', category: 'sidework' },
      { name: 'Clean & restock restrooms', category: 'sidework' },
      { name: 'Bus & reset tables', category: 'sidework' },
      { name: 'Sweep & mop dining area', category: 'closing' },
      { name: 'Close out POS / run end-of-day', category: 'closing' },
      { name: 'Wipe down all surfaces & booths', category: 'closing' },
      { name: 'Break down bar (drain wells, cover bottles)', category: 'closing' },
      { name: 'Empty trash & recycling', category: 'closing' },
      { name: 'Check walk-in temps & date labels', category: 'closing' },
      { name: 'Set alarm & lock doors', category: 'closing' },
    ];
    await API.bulkCreateSidework(defaults);
    UI.toast('Default tasks added');
    loadSidework();
  } catch (err) { UI.toast(err.message, 'error'); }
}
