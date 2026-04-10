// ═══════════════════════════════════════════════════════
// CrewCast — Center Grove Orchard Onboarding
// Pre-loads CG stations + Spring 2026 schedule dates
// Uses real API to create actual stations & schedules
// ═══════════════════════════════════════════════════════

// Format report time from open time minus early minutes
function cgFmtTime(openTime, earlyMin) {
  const [h, m] = openTime.split(':').map(Number);
  const total = h * 60 + m - (earlyMin || 0);
  const rh = Math.floor(Math.max(0, total) / 60);
  const rm = Math.max(0, total) % 60;
  const ampm = rh >= 12 ? 'PM' : 'AM';
  const hr = rh === 0 ? 12 : rh > 12 ? rh - 12 : rh;
  return hr + (rm > 0 ? ':' + String(rm).padStart(2, '0') : '') + ' ' + ampm;
}

const CG_STATIONS = [
  { name: 'Apple Barn & Country Store', icon: '🍎', category: 'Retail', minStaff: 3, maxStaff: 6, openTime: '09:00', closeTime: '17:00', arriveEarlyMinutes: 30 },
  { name: 'Bakery', icon: '🧁', category: 'Food & Beverage', minStaff: 2, maxStaff: 4, openTime: '09:00', closeTime: '17:00', arriveEarlyMinutes: 30 },
  { name: 'Cider Bar', icon: '🍺', category: 'Food & Beverage', minStaff: 2, maxStaff: 4, openTime: '10:00', closeTime: '17:00', arriveEarlyMinutes: 15 },
  { name: 'Wine & Spirits Tasting', icon: '🍷', category: 'Food & Beverage', minStaff: 2, maxStaff: 3, openTime: '10:00', closeTime: '17:00', arriveEarlyMinutes: 15 },
  { name: 'Caramel Apple Kitchen', icon: '🍏', category: 'Food & Beverage', minStaff: 2, maxStaff: 4, openTime: '09:00', closeTime: '17:00', arriveEarlyMinutes: 30 },
  { name: 'Food Court', icon: '🍔', category: 'Food & Beverage', minStaff: 4, maxStaff: 8, openTime: '09:00', closeTime: '17:00', arriveEarlyMinutes: 30 },
  { name: 'Corn Maze', icon: '🌽', category: 'Attractions', minStaff: 2, maxStaff: 4, openTime: '09:00', closeTime: '17:00', arriveEarlyMinutes: 15 },
  { name: 'Petting Zoo', icon: '🐐', category: 'Attractions', minStaff: 2, maxStaff: 3, openTime: '09:00', closeTime: '17:00', arriveEarlyMinutes: 15 },
  { name: 'Cow Train', icon: '🚂', category: 'Attractions', minStaff: 1, maxStaff: 2, openTime: '10:00', closeTime: '16:00', arriveEarlyMinutes: 15 },
  { name: 'Jumping Pillow', icon: '🤸', category: 'Attractions', minStaff: 1, maxStaff: 2, openTime: '09:00', closeTime: '17:00', arriveEarlyMinutes: 15 },
  { name: 'Pedal Karts', icon: '🏎️', category: 'Attractions', minStaff: 1, maxStaff: 2, openTime: '09:00', closeTime: '17:00', arriveEarlyMinutes: 15 },
  { name: 'Barnyard Play Area', icon: '🎪', category: 'Attractions', minStaff: 1, maxStaff: 2, openTime: '09:00', closeTime: '17:00', arriveEarlyMinutes: 15 },
  { name: 'U-Pick Apples', icon: '🍎', category: 'U-Pick', minStaff: 3, maxStaff: 6, openTime: '09:00', closeTime: '17:00', arriveEarlyMinutes: 30 },
  { name: 'U-Pick Pumpkins', icon: '🎃', category: 'U-Pick', minStaff: 2, maxStaff: 5, openTime: '09:00', closeTime: '17:00', arriveEarlyMinutes: 30 },
  { name: 'Hayrides', icon: '🚜', category: 'Attractions', minStaff: 2, maxStaff: 3, openTime: '10:00', closeTime: '16:00', arriveEarlyMinutes: 15 },
  { name: 'Lemonade Stand', icon: '🍋', category: 'Food & Beverage', minStaff: 1, maxStaff: 2, openTime: '10:00', closeTime: '16:00', arriveEarlyMinutes: 15 },
  { name: 'Strawberry U-Pick', icon: '🍓', category: 'U-Pick', minStaff: 2, maxStaff: 4, openTime: '09:00', closeTime: '17:00', arriveEarlyMinutes: 30 },
  { name: 'Parking & Entrance', icon: '🅿️', category: 'Operations', minStaff: 3, maxStaff: 6, openTime: '08:00', closeTime: '18:00', arriveEarlyMinutes: 30 },
];

const CG_SPRING_2026 = [
  { label: 'Opening Weekend — May 2–3', start: '2026-05-02', end: '2026-05-03' },
  { label: "Mother's Day Weekend — May 9–10", start: '2026-05-09', end: '2026-05-10' },
  { label: 'Mid-May Weekend — May 16–17', start: '2026-05-16', end: '2026-05-17' },
  { label: 'Strawberry + Memorial Day — May 23–25', start: '2026-05-23', end: '2026-05-25' },
  { label: 'Season Finale — May 30–31', start: '2026-05-30', end: '2026-05-31' },
];

async function renderCGOnboard(app) {
  app.innerHTML = UI.adminShell('cg-onboard', `
    <div class="page">
      <div id="cg-onboard-content">${UI.loading()}</div>
    </div>
  `);
  const main = document.getElementById('cg-onboard-content');

  try {
    // Check what already exists
    const [existingStations, existingSchedules, settings] = await Promise.all([
      API.getStations(),
      API.getSchedules(),
      API.getSettings().catch(() => ({})),
    ]);

    const existingNames = new Set(existingStations.map(s => s.name.toLowerCase()));
    const existingScheduleLabels = new Set(existingSchedules.map(s => (s.title || '').toLowerCase()));

    // Build station checklist — pre-check stations not yet created
    const stationChecks = CG_STATIONS.map(s => ({
      ...s,
      exists: existingNames.has(s.name.toLowerCase()),
      checked: !existingNames.has(s.name.toLowerCase()),
    }));

    // Build schedule checklist — pre-check weekends not yet created
    const schedChecks = CG_SPRING_2026.map(w => ({
      ...w,
      exists: existingScheduleLabels.has(w.label.toLowerCase()),
      checked: !existingScheduleLabels.has(w.label.toLowerCase()),
    }));

    const allStationsExist = stationChecks.every(s => s.exists);
    const allSchedulesExist = schedChecks.every(s => s.exists);

    main.innerHTML = `
      <!-- Header -->
      <div style="text-align:center;padding:8px 0 24px">
        <h1 style="font-size:24px;margin-bottom:6px">🌾 Center Grove Orchard — Spring 2026</h1>
        <p class="text-muted" style="font-size:14px">Set up stations and schedules for this spring's season.</p>
      </div>

      <!-- Settings Reminder -->
      ${!settings.businessName ? `
      <div class="card" style="margin-bottom:16px;border-left:3px solid var(--amber)">
        <div class="flex items-center gap-2">
          <span>⚙️</span>
          <div style="flex:1">
            <div class="semi text-sm">Complete Settings First</div>
            <div class="text-xs text-muted">Set your business name, hours, and scheduling rules.</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="Router.navigate('/admin/settings')">Go to Settings →</button>
        </div>
      </div>
      ` : ''}

      <!-- Step 1: Stations -->
      <div class="card" style="margin-bottom:16px">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="semi" style="font-size:16px">📍 Step 1 — Stations</div>
            <div class="text-xs text-muted mt-1">Select the areas you'll staff this spring. Uncheck any you don't need.</div>
          </div>
          ${allStationsExist ? '<span class="badge badge-green">All Created</span>' : `
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" onclick="cgToggleAll('station', true)">All</button>
            <button class="btn btn-ghost btn-sm" onclick="cgToggleAll('station', false)">None</button>
          </div>`}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px" id="cg-station-grid">
          ${stationChecks.map((s, i) => `
            <label class="card" style="padding:10px 12px;cursor:${s.exists ? 'default' : 'pointer'};display:flex;align-items:center;gap:10px;border:1px solid var(--border);opacity:${s.exists ? '.6' : '1'}">
              <input type="checkbox" class="cg-station-check" data-idx="${i}" ${s.checked ? 'checked' : ''} ${s.exists ? 'disabled' : ''}>
              <span style="font-size:22px">${s.icon}</span>
              <div style="flex:1;min-width:0">
                <div class="semi text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</div>
                <div class="text-xs text-muted">${s.category} · ${s.minStaff}–${s.maxStaff} staff${s.openTime ? ` · Report ${cgFmtTime(s.openTime, s.arriveEarlyMinutes)}` : ''}</div>
              </div>
              ${s.exists ? '<span class="badge badge-green" style="font-size:10px">Exists</span>' : ''}
            </label>
          `).join('')}
        </div>
        ${!allStationsExist ? `
        <div style="margin-top:12px;text-align:right">
          <button class="btn btn-primary" id="cg-create-stations-btn" onclick="cgCreateStations()">Create Selected Stations</button>
        </div>` : ''}
      </div>

      <!-- Step 2: Schedules -->
      <div class="card" style="margin-bottom:16px">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="semi" style="font-size:16px">📅 Step 2 — Spring Schedules</div>
            <div class="text-xs text-muted mt-1">Each weekend becomes a schedule. You'll assign staff after creating them.</div>
          </div>
          ${allSchedulesExist ? '<span class="badge badge-green">All Created</span>' : `
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" onclick="cgToggleAll('sched', true)">All</button>
            <button class="btn btn-ghost btn-sm" onclick="cgToggleAll('sched', false)">None</button>
          </div>`}
        </div>
        <div style="display:grid;gap:8px" id="cg-sched-grid">
          ${schedChecks.map((w, i) => `
            <label class="card" style="padding:12px 14px;cursor:${w.exists ? 'default' : 'pointer'};display:flex;align-items:center;gap:12px;border:1px solid var(--border);opacity:${w.exists ? '.6' : '1'}">
              <input type="checkbox" class="cg-sched-check" data-idx="${i}" ${w.checked ? 'checked' : ''} ${w.exists ? 'disabled' : ''}>
              <div style="flex:1">
                <div class="semi text-sm">${w.label}</div>
                <div class="text-xs text-muted">${w.start} → ${w.end}</div>
              </div>
              ${w.exists ? '<span class="badge badge-green" style="font-size:10px">Exists</span>' : ''}
            </label>
          `).join('')}
        </div>
        ${!allSchedulesExist ? `
        <div style="margin-top:12px;text-align:right">
          <button class="btn btn-primary" id="cg-create-scheds-btn" onclick="cgCreateSchedules()">Create Selected Schedules</button>
        </div>` : ''}
      </div>

      <!-- Step 3: Next Steps -->
      <div class="card" style="background:var(--purple-bg);border-color:rgba(167,139,250,.25);margin-bottom:16px">
        <div class="semi" style="font-size:16px;margin-bottom:8px;color:var(--purple-light)">🚀 Next Steps</div>
        <div style="display:grid;gap:6px;font-size:13px;color:var(--text-muted)">
          <div>1. <strong>Add employees</strong> on the <a href="#" onclick="Router.navigate('/admin/employees');return false" style="color:var(--purple-light)">Employees page</a></div>
          <div>2. <strong>Assign staff to stations</strong> — set which areas each person can work</div>
          <div>3. <strong>Open a schedule</strong> and use <strong>Auto-Fill</strong> to assign shifts</div>
          <div>4. <strong>Publish</strong> and share the app link with your team</div>
        </div>
      </div>

      <!-- Quick Links -->
      <div class="flex gap-2 justify-center" style="flex-wrap:wrap;margin-bottom:20px">
        <button class="btn btn-secondary" onclick="Router.navigate('/admin/employees')">👥 Add Employees</button>
        <button class="btn btn-secondary" onclick="Router.navigate('/admin/schedules')">📅 View Schedules</button>
        <button class="btn btn-secondary" onclick="Router.navigate('/admin')">📊 Dashboard</button>
      </div>
    `;
  } catch (err) {
    main.innerHTML = `<div class="card"><p class="text-red">Error: ${err.message}</p></div>`;
  }
}

function cgToggleAll(type, checked) {
  const cls = type === 'station' ? '.cg-station-check' : '.cg-sched-check';
  document.querySelectorAll(cls).forEach(cb => {
    if (!cb.disabled) cb.checked = checked;
  });
}

async function cgCreateStations() {
  const btn = document.getElementById('cg-create-stations-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }

  const checked = document.querySelectorAll('.cg-station-check:checked:not(:disabled)');
  const stations = [];
  checked.forEach(cb => {
    const s = CG_STATIONS[parseInt(cb.dataset.idx)];
    stations.push({
      name: s.name,
      icon: s.icon,
      category: s.category,
      minStaff: s.minStaff,
      maxStaff: s.maxStaff,
      openTime: s.openTime || '09:00',
      closeTime: s.closeTime || '17:00',
      arriveEarlyMinutes: s.arriveEarlyMinutes || 15,
      active: true,
    });
  });

  if (stations.length === 0) {
    UI.toast('No stations selected', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Create Selected Stations'; }
    return;
  }

  try {
    const result = await API.bulkAddStations(stations);
    UI.toast(`Created ${result.added} station${result.added !== 1 ? 's' : ''}!${result.skipped ? ` (${result.skipped} already existed)` : ''}`);
    // Re-render to update state
    renderCGOnboard(document.getElementById('app'));
  } catch (err) {
    UI.toast('Error creating stations: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Create Selected Stations'; }
  }
}

async function cgCreateSchedules() {
  const btn = document.getElementById('cg-create-scheds-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }

  const checked = document.querySelectorAll('.cg-sched-check:checked:not(:disabled)');
  const weekends = [];
  checked.forEach(cb => {
    weekends.push(CG_SPRING_2026[parseInt(cb.dataset.idx)]);
  });

  if (weekends.length === 0) {
    UI.toast('No schedules selected', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Create Selected Schedules'; }
    return;
  }

  let created = 0;
  try {
    for (const w of weekends) {
      await API.createSchedule({
        title: w.label,
        start_date: w.start,
        end_date: w.end,
        status: 'draft',
      });
      created++;
    }
    UI.toast(`Created ${created} schedule${created !== 1 ? 's' : ''}!`);
    renderCGOnboard(document.getElementById('app'));
  } catch (err) {
    UI.toast(`Created ${created}, then error: ${err.message}`, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Create Selected Schedules'; }
  }
}
