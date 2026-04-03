// ═══════════════════════════════════════════════════════
// CrewCast — Admin Employee Management
// ═══════════════════════════════════════════════════════

async function renderAdminEmployees(app) {
  app.innerHTML = `
    <div class="page">
      <div class="page-header flex justify-between items-center">
        <div>
          <h1>Employees</h1>
          <p class="subtitle">Manage your workforce</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="showAddEmployeeModal()">${SVG.plus} Add</button>
      </div>
      <div id="employees-content">${UI.loading()}</div>
    </div>
    ${UI.adminNav('employees')}
  `;

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

      <div class="card">
        ${active.map(e => `
          <div class="list-item">
            <div>
              <div class="semi">${e.firstName} ${e.lastName}</div>
              <div class="text-xs text-muted">${e.phone}</div>
            </div>
            <div class="flex items-center gap-2">
              ${e.hasPin ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-amber">Invited</span>'}
              <button class="btn btn-ghost btn-sm" onclick="showEmployeeOptions(${e.id}, '${e.firstName}', '${e.lastName}', '${e.inviteToken}', ${e.hasPin})">...</button>
            </div>
          </div>
        `).join('')}
      </div>

      ${inactive.length > 0 ? `
        <div class="card">
          <div class="card-title mb-2 text-muted">Inactive (${inactive.length})</div>
          ${inactive.map(e => `
            <div class="list-item" style="opacity:.5">
              <div>
                <div class="semi">${e.firstName} ${e.lastName}</div>
                <div class="text-xs text-muted">${e.phone}</div>
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
      <button class="btn btn-primary" onclick="copyInviteLink(document.querySelector('.modal .form-input'));UI.closeModal();renderAdminEmployees(document.getElementById('app'))">Done</button>
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
