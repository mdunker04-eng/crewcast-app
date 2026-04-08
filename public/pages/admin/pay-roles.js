// ═══════════════════════════════════════════════════════
// CrewCast — Admin Pay Roles Page
// Manage tipped/non-tipped roles with base rates
// ═══════════════════════════════════════════════════════

async function renderPayRoles(app) {
  document.body.classList.add('admin-mode');
  app.innerHTML = UI.adminShell('pay-roles', `
    <div class="page" style="padding-bottom:80px">
      <div class="page-header">
        <h1>Pay Roles</h1>
        <button class="btn btn-primary btn-sm" onclick="showAddPayRole()">+ Add Role</button>
      </div>
      <p class="text-sm text-muted" style="margin-bottom:16px">Define roles with base rates and tip eligibility. Employees select their role when clocking in.</p>
      <div id="pay-roles-list">${UI.loading()}</div>
    </div>
  `);
  loadPayRoles();
}

async function loadPayRoles() {
  const container = document.getElementById('pay-roles-list');
  if (!container) return;
  try {
    const roles = await API.getPayRoles();
    if (roles.length === 0) {
      container.innerHTML = UI.empty('💰', 'No pay roles yet', 'Add roles like Server, Bartender, Host, Cook to track different pay rates') +
        `<div style="text-align:center;margin-top:16px">
          <button class="btn btn-secondary" onclick="seedDefaultRoles()">Add Restaurant Defaults</button>
        </div>`;
      return;
    }
    container.innerHTML = roles.map(r => `
      <div class="card" style="padding:16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <div class="semi">${r.name}</div>
          <div class="text-sm text-muted">
            $${parseFloat(r.base_rate).toFixed(2)}/hr
            ${r.is_tipped ? ' <span style="background:var(--green-bg,#d1fae5);color:var(--green,#10b981);padding:2px 8px;border-radius:4px;font-size:11px">+ Tips</span>' : ''}
            ${r.overtime_eligible ? '' : ' <span style="background:var(--amber-bg,#fef3c7);color:var(--amber,#f59e0b);padding:2px 8px;border-radius:4px;font-size:11px">OT Exempt</span>'}
            ${!r.active ? ' <span style="opacity:0.5">(inactive)</span>' : ''}
          </div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick='editPayRole(${JSON.stringify(r)})'>Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red,#ef4444)" onclick="deletePayRole(${r.id})">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:20px"><p class="text-muted">Error: ${err.message}</p></div>`;
  }
}

function showAddPayRole() {
  UI.showModal('Add Pay Role', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <label class="text-sm semi">Role Name</label>
      <input type="text" id="pr-name" class="input" placeholder="e.g. Server, Bartender, Host">
      <label class="text-sm semi">Base Rate ($/hr)</label>
      <input type="number" id="pr-rate" class="input" placeholder="2.13" step="0.01" min="0">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="pr-tipped" checked> Receives tips
      </label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="pr-ot" checked> Overtime eligible
      </label>
    </div>
  `, `
    <button class="btn btn-primary" onclick="saveNewPayRole()">Save</button>
    <button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
  `);
}

async function saveNewPayRole() {
  try {
    const name = document.getElementById('pr-name').value.trim();
    const baseRate = document.getElementById('pr-rate').value;
    const isTipped = document.getElementById('pr-tipped').checked;
    const overtimeEligible = document.getElementById('pr-ot').checked;
    if (!name || !baseRate) return UI.toast('Name and rate required', 'error');
    await API.createPayRole({ name, baseRate, isTipped, overtimeEligible });
    UI.closeModal();
    UI.toast('Role created');
    loadPayRoles();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

function editPayRole(role) {
  UI.showModal('Edit Pay Role', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <label class="text-sm semi">Role Name</label>
      <input type="text" id="pr-name" class="input" value="${role.name}">
      <label class="text-sm semi">Base Rate ($/hr)</label>
      <input type="number" id="pr-rate" class="input" value="${parseFloat(role.base_rate).toFixed(2)}" step="0.01" min="0">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="pr-tipped" ${role.is_tipped ? 'checked' : ''}> Receives tips
      </label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="pr-ot" ${role.overtime_eligible ? 'checked' : ''}> Overtime eligible
      </label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="pr-active" ${role.active ? 'checked' : ''}> Active
      </label>
    </div>
  `, `
    <button class="btn btn-primary" onclick="saveEditPayRole(${role.id})">Save</button>
    <button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
  `);
}

async function saveEditPayRole(id) {
  try {
    await API.updatePayRole(id, {
      name: document.getElementById('pr-name').value.trim(),
      baseRate: document.getElementById('pr-rate').value,
      isTipped: document.getElementById('pr-tipped').checked,
      overtimeEligible: document.getElementById('pr-ot').checked,
      active: document.getElementById('pr-active').checked
    });
    UI.closeModal();
    UI.toast('Role updated');
    loadPayRoles();
  } catch (err) { UI.toast(err.message, 'error'); }
}

async function deletePayRole(id) {
  if (!confirm('Delete this pay role?')) return;
  try {
    await API.deletePayRole(id);
    UI.toast('Role deleted');
    loadPayRoles();
  } catch (err) { UI.toast(err.message, 'error'); }
}

async function seedDefaultRoles() {
  try {
    const defaults = [
      { name: 'Server', baseRate: 2.13, isTipped: true, overtimeEligible: true },
      { name: 'Bartender', baseRate: 2.13, isTipped: true, overtimeEligible: true },
      { name: 'Host', baseRate: 12.00, isTipped: false, overtimeEligible: true },
      { name: 'Line Cook', baseRate: 16.00, isTipped: false, overtimeEligible: true },
      { name: 'Prep Cook', baseRate: 14.00, isTipped: false, overtimeEligible: true },
      { name: 'Dishwasher', baseRate: 12.00, isTipped: false, overtimeEligible: true },
      { name: 'Manager', baseRate: 22.00, isTipped: false, overtimeEligible: false },
      { name: 'Busser', baseRate: 10.00, isTipped: true, overtimeEligible: true },
      { name: 'Food Runner', baseRate: 10.00, isTipped: true, overtimeEligible: true },
    ];
    for (const role of defaults) {
      try { await API.createPayRole(role); } catch (e) { /* skip duplicates */ }
    }
    UI.toast('Default roles added');
    loadPayRoles();
  } catch (err) { UI.toast(err.message, 'error'); }
}
