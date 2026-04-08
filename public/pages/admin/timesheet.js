// ═══════════════════════════════════════════════════════
// CrewCast — Admin Timesheet Page
// View hours, edit entries, export CSV
// ═══════════════════════════════════════════════════════

async function renderAdminTimesheet(app) {
  document.body.classList.add('admin-mode');
  const today = new Date().toISOString().split('T')[0];

  app.innerHTML = UI.adminShell('timesheet', `
    <div class="page" style="padding-bottom:80px">
    <div class="page-header" style="flex-wrap:wrap;gap:12px">
      <h1>Timesheet</h1>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input type="date" id="ts-start" class="input" value="${today}" style="width:auto">
        <span class="text-muted">to</span>
        <input type="date" id="ts-end" class="input" value="${today}" style="width:auto">
        <button class="btn btn-primary btn-sm" onclick="loadTimesheet()">Load</button>
        <button class="btn btn-secondary btn-sm" onclick="exportTimesheet()">Export CSV</button>
      </div>
    </div>

    <div id="ts-summary" class="card" style="padding:16px;margin-bottom:16px;display:flex;gap:24px;flex-wrap:wrap">
    </div>

    <div id="ts-entries">${UI.loading()}</div>
    </div>
  `);

  loadTimesheet();
}

async function loadTimesheet() {
  const startDate = document.getElementById('ts-start')?.value;
  const endDate = document.getElementById('ts-end')?.value;
  const container = document.getElementById('ts-entries');
  const summary = document.getElementById('ts-summary');
  if (!container) return;

  container.innerHTML = UI.loading();

  try {
    const entries = await API.getTimeEntries({ startDate, endDate });

    // Calculate summary
    let totalHours = 0;
    let openEntries = 0;
    let totalTips = 0;
    const uniqueEmployees = new Set();

    entries.forEach(e => {
      uniqueEmployees.add(e.employee_id);
      if (e.clock_out) {
        totalHours += (new Date(e.clock_out) - new Date(e.clock_in)) / 3600000;
      } else {
        openEntries++;
      }
      totalTips += (parseFloat(e.tip_cash) || 0) + (parseFloat(e.tip_card) || 0);
    });

    if (summary) {
      summary.innerHTML = `
        <div><div class="text-xs text-muted">Entries</div><div class="semi" style="font-size:20px">${entries.length}</div></div>
        <div><div class="text-xs text-muted">Employees</div><div class="semi" style="font-size:20px">${uniqueEmployees.size}</div></div>
        <div><div class="text-xs text-muted">Total Hours</div><div class="semi" style="font-size:20px">${totalHours.toFixed(1)}h</div></div>
        <div><div class="text-xs text-muted">Tips</div><div class="semi" style="font-size:20px;color:var(--green,#10b981)">$${totalTips.toFixed(2)}</div></div>
        <div><div class="text-xs text-muted">Still Clocked In</div><div class="semi" style="font-size:20px;${openEntries > 0 ? 'color:var(--amber, #f59e0b)' : ''}">${openEntries}</div></div>
      `;
    }

    if (entries.length === 0) {
      container.innerHTML = UI.empty('&#128338;', 'No time entries', 'No clock-in records for this date range');
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Station</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Hours</th>
              <th>Tips</th>
              <th>Method</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(e => {
              const clockIn = new Date(e.clock_in);
              const clockOut = e.clock_out ? new Date(e.clock_out) : null;
              const hours = clockOut ? ((clockOut - clockIn) / 3600000).toFixed(2) : '---';
              const tips = (parseFloat(e.tip_cash) || 0) + (parseFloat(e.tip_card) || 0);
              const methodIcon = e.clock_in_method === 'qr_kiosk' ? '&#128247;' : e.clock_in_method === 'qr_mobile' ? '&#128241;' : '&#9997;';
              const isOpen = !clockOut;

              return `
                <tr style="${isOpen ? 'background:rgba(245,158,11,0.08)' : ''}">
                  <td class="semi">${e.first_name} ${e.last_name}</td>
                  <td>${e.station_name || '<span class="text-muted">---</span>'}</td>
                  <td>${clockIn.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</td>
                  <td>${clockOut ? clockOut.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '<span class="badge badge-amber">Active</span>'}</td>
                  <td class="semi">${hours}${!isOpen ? 'h' : ''}</td>
                  <td>${tips > 0 ? '<span style="color:var(--green,#10b981)">$' + tips.toFixed(2) + '</span>' : '<span class="text-muted">—</span>'}</td>
                  <td style="font-size:16px" title="${e.clock_in_method}">${methodIcon}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" onclick="editTimeEntry(${e.id}, '${e.clock_in}', '${e.clock_out || ''}', '${(e.notes || '').replace(/'/g, "\\'")}')">Edit</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card" style="padding:20px"><p class="text-muted">Error: ${err.message}</p></div>`;
  }
}

function editTimeEntry(id, clockIn, clockOut, notes) {
  const clockInLocal = new Date(clockIn).toISOString().slice(0, 16);
  const clockOutLocal = clockOut ? new Date(clockOut).toISOString().slice(0, 16) : '';

  UI.showModal('Edit Time Entry', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <label class="text-sm semi">Clock In</label>
      <input type="datetime-local" id="edit-clockin" class="input" value="${clockInLocal}">
      <label class="text-sm semi">Clock Out</label>
      <input type="datetime-local" id="edit-clockout" class="input" value="${clockOutLocal}">
      <label class="text-sm semi">Notes</label>
      <textarea id="edit-notes" class="input" rows="2">${notes}</textarea>
    </div>
  `, `
    <button class="btn btn-primary" onclick="saveTimeEntry(${id})">Save</button>
    <button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
  `);
}

async function saveTimeEntry(id) {
  try {
    const data = {
      clockIn: document.getElementById('edit-clockin').value ? new Date(document.getElementById('edit-clockin').value).toISOString() : undefined,
      clockOut: document.getElementById('edit-clockout').value ? new Date(document.getElementById('edit-clockout').value).toISOString() : undefined,
      notes: document.getElementById('edit-notes').value
    };
    await API.editTimeEntry(id, data);
    UI.closeModal();
    UI.toast('Entry updated');
    loadTimesheet();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

function exportTimesheet() {
  const startDate = document.getElementById('ts-start')?.value;
  const endDate = document.getElementById('ts-end')?.value;
  if (!startDate || !endDate) {
    UI.toast('Select a date range first', 'error');
    return;
  }
  const url = `/api/time/export?startDate=${startDate}&endDate=${endDate}`;
  fetch(url, { headers: { 'Authorization': `Bearer ${API.token}` } })
    .then(r => {
      if (!r.ok) throw new Error('Export failed');
      return r.blob();
    })
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `timesheet_${startDate}_${endDate}.csv`;
      link.click();
      URL.revokeObjectURL(blobUrl);
      UI.toast('CSV exported');
    })
    .catch(err => UI.toast(err.message, 'error'));
}
