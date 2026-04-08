// ═══════════════════════════════════════════════════════
// CrewCast — Admin Tip Pool Configuration
// Define how tips are distributed across roles
// ═══════════════════════════════════════════════════════

let _payRolesCache = [];

async function renderTipPools(app) {
  document.body.classList.add('admin-mode');
  app.innerHTML = UI.adminShell('tip-pools', `
    <div class="page" style="padding-bottom:80px">
      <div class="page-header">
        <h1>Tip Pools</h1>
        <button class="btn btn-primary btn-sm" onclick="showAddTipPool()">+ New Pool</button>
      </div>
      <p class="text-sm text-muted" style="margin-bottom:16px">
        Set up tip pooling rules to automatically distribute tips among roles. Each pool defines what percentage of tips goes in and how shares are split.
      </p>
      <div id="tip-pools-list">${UI.loading()}</div>
    </div>
  `);
  loadTipPools();
}

async function loadTipPools() {
  const container = document.getElementById('tip-pools-list');
  if (!container) return;
  try {
    const [pools, roles] = await Promise.all([
      API.getTipPools(),
      API.getPayRoles()
    ]);
    _payRolesCache = roles.filter(r => r.active);

    if (pools.length === 0) {
      container.innerHTML = UI.empty('💰', 'No tip pools configured', 'Create a pool to define how tips get split between front-of-house and support staff.') +
        `<div style="text-align:center;margin-top:16px">
          <button class="btn btn-secondary" onclick="seedDefaultTipPool()">Add Default Pool</button>
        </div>`;
      return;
    }

    container.innerHTML = pools.map(pool => {
      const totalShares = pool.shares.reduce((s, sh) => s + parseFloat(sh.share_percentage), 0);
      return `
        <div class="card" style="padding:16px;margin-bottom:12px;border-left:3px solid ${pool.active ? 'var(--green)' : 'var(--border)'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div>
              <div class="semi">${pool.name}</div>
              <div class="text-xs text-muted">${pool.pool_percentage}% of tips pooled${!pool.active ? ' · <span style="color:var(--red)">Inactive</span>' : ''}</div>
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm" onclick="editTipPool(${pool.id})">Edit</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--red,#ef4444)" onclick="deleteTipPool(${pool.id})">Delete</button>
            </div>
          </div>
          ${pool.shares.length > 0 ? `
            <div style="margin-top:8px">
              ${pool.shares.map(sh => {
                const pct = parseFloat(sh.share_percentage);
                return `
                  <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
                    <div style="width:120px;font-size:12px" class="semi">${sh.role_name}</div>
                    <div style="flex:1;height:16px;background:var(--bg-primary);border-radius:4px;overflow:hidden">
                      <div style="width:${Math.min(pct, 100)}%;height:100%;background:var(--green);border-radius:4px"></div>
                    </div>
                    <div style="width:45px;text-align:right;font-size:12px">${pct}%</div>
                  </div>
                `;
              }).join('')}
              ${Math.abs(totalShares - 100) > 0.1 ? `<div class="text-xs" style="color:var(--yellow,#fbbf24);margin-top:6px">⚠️ Shares total ${totalShares.toFixed(1)}% (should be 100%)</div>` : ''}
            </div>
          ` : '<div class="text-xs text-muted" style="margin-top:6px">No role shares defined yet — edit to add.</div>'}
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="card"><p class="text-muted">Error: ${err.message}</p></div>`;
  }
}

function showAddTipPool() {
  showTipPoolModal('Add Tip Pool', { name: '', pool_percentage: 100, shares: [] }, async (data) => {
    await API.createTipPool(data);
    UI.closeModal();
    UI.toast('Tip pool created');
    loadTipPools();
  });
}

async function editTipPool(poolId) {
  try {
    const pools = await API.getTipPools();
    const pool = pools.find(p => p.id === poolId);
    if (!pool) return UI.toast('Pool not found', 'error');
    showTipPoolModal('Edit Tip Pool', pool, async (data) => {
      await API.updateTipPool(poolId, data);
      UI.closeModal();
      UI.toast('Tip pool updated');
      loadTipPools();
    });
  } catch (err) { UI.toast(err.message, 'error'); }
}

function showTipPoolModal(title, pool, onSave) {
  const tippedRoles = _payRolesCache.filter(r => r.is_tipped);
  const allRoles = _payRolesCache;

  UI.showModal(title, `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label class="text-sm semi">Pool Name</label>
        <input type="text" id="tp-name" class="input" value="${pool.name}" placeholder="e.g. FOH Tip Pool">
      </div>
      <div>
        <label class="text-sm semi">% of Tips Pooled</label>
        <input type="number" id="tp-pct" class="input" value="${pool.pool_percentage}" min="1" max="100" step="1">
        <div class="text-xs text-muted mt-1">What percentage of each tipped employee's tips goes into this pool</div>
      </div>
      <div>
        <label class="text-sm semi mb-1" style="display:block">Share Distribution by Role</label>
        <div class="text-xs text-muted mb-2">How the pool is split. Percentages should total 100%.</div>
        <div id="tp-shares" style="display:flex;flex-direction:column;gap:6px">
          ${allRoles.map(r => {
            const existing = pool.shares.find(s => s.pay_role_id === r.id);
            return `
              <div style="display:flex;align-items:center;gap:8px">
                <label style="width:120px;font-size:12px" class="semi">${r.name}</label>
                <input type="number" class="input tp-share-input" data-role-id="${r.id}"
                  value="${existing ? parseFloat(existing.share_percentage) : ''}"
                  placeholder="0" min="0" max="100" step="0.5"
                  style="width:80px" oninput="updateShareTotal()">
                <span class="text-xs text-muted">%</span>
              </div>
            `;
          }).join('')}
        </div>
        <div id="tp-share-total" class="text-xs mt-2" style="color:var(--text-muted)"></div>
      </div>
    </div>
  `, `
    <button class="btn btn-primary" id="tp-save-btn">Save</button>
    <button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
  `);

  updateShareTotal();

  document.getElementById('tp-save-btn').onclick = async () => {
    const name = document.getElementById('tp-name').value.trim();
    const poolPercentage = parseFloat(document.getElementById('tp-pct').value);
    if (!name) return UI.toast('Name is required', 'error');

    const shares = [];
    document.querySelectorAll('.tp-share-input').forEach(input => {
      const val = parseFloat(input.value);
      if (val > 0) {
        shares.push({ payRoleId: parseInt(input.dataset.roleId), sharePercentage: val });
      }
    });

    try {
      await onSave({ name, poolPercentage, shares });
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  };
}

function updateShareTotal() {
  let total = 0;
  document.querySelectorAll('.tp-share-input').forEach(input => {
    total += parseFloat(input.value) || 0;
  });
  const el = document.getElementById('tp-share-total');
  if (el) {
    const color = Math.abs(total - 100) < 0.1 ? 'var(--green-text)' : total > 100 ? 'var(--red,#ef4444)' : 'var(--yellow,#fbbf24)';
    el.innerHTML = `Total: <span style="color:${color};font-weight:600">${total.toFixed(1)}%</span>${Math.abs(total - 100) < 0.1 ? ' ✓' : ''}`;
  }
}

async function deleteTipPool(id) {
  if (!confirm('Delete this tip pool rule?')) return;
  try {
    await API.deleteTipPool(id);
    UI.toast('Tip pool deleted');
    loadTipPools();
  } catch (err) { UI.toast(err.message, 'error'); }
}

async function seedDefaultTipPool() {
  try {
    const roles = _payRolesCache;
    const server = roles.find(r => r.name === 'Server');
    const bartender = roles.find(r => r.name === 'Bartender');
    const busser = roles.find(r => r.name === 'Busser');
    const runner = roles.find(r => r.name === 'Food Runner');
    const host = roles.find(r => r.name === 'Host');

    const shares = [];
    if (server) shares.push({ payRoleId: server.id, sharePercentage: 50 });
    if (bartender) shares.push({ payRoleId: bartender.id, sharePercentage: 20 });
    if (busser) shares.push({ payRoleId: busser.id, sharePercentage: 15 });
    if (runner) shares.push({ payRoleId: runner.id, sharePercentage: 10 });
    if (host) shares.push({ payRoleId: host.id, sharePercentage: 5 });

    if (shares.length === 0) {
      UI.toast('Add pay roles first (Pay Roles page)', 'error');
      return;
    }

    // Normalize to 100% if roles are missing
    const total = shares.reduce((s, sh) => s + sh.sharePercentage, 0);
    if (total !== 100) {
      shares.forEach(sh => sh.sharePercentage = Math.round(sh.sharePercentage / total * 100 * 10) / 10);
    }

    await API.createTipPool({ name: 'FOH Tip Pool', poolPercentage: 100, shares });
    UI.toast('Default tip pool created');
    loadTipPools();
  } catch (err) { UI.toast(err.message, 'error'); }
}
