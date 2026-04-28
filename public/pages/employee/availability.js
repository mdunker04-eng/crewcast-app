// ═══════════════════════════════════════════════════════
// CrewCast — Employee Availability Calendar
// Tap a date to set available + time window
// Supports split time blocks when org setting enabled
// ═══════════════════════════════════════════════════════

let availCurrentMonth = new Date().getMonth();
let availCurrentYear = new Date().getFullYear();
let availData = {};
let availClipboard = null; // { available, startTime, endTime, timeBlocks }

async function renderAvailability(app) {
  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1>My Availability</h1>
        <p class="subtitle">Tap dates to mark when you can work</p>
      </div>
      <div class="card">
        <div class="calendar-header">
          <button class="btn btn-ghost btn-sm" onclick="changeAvailMonth(-1)">${SVG.chevLeft}</button>
          <span class="semi" id="avail-month-label"></span>
          <button class="btn btn-ghost btn-sm" onclick="changeAvailMonth(1)">${SVG.chevRight}</button>
        </div>
        <div class="calendar-grid" id="avail-calendar"></div>
      </div>
      <div class="flex gap-2 mb-3">
        <div class="flex items-center gap-1 text-xs"><span class="badge badge-green">Available</span></div>
        <div class="flex items-center gap-1 text-xs"><span class="badge badge-red">Unavailable</span></div>
        <div class="flex items-center gap-1 text-xs"><span class="badge" style="background:var(--border);color:var(--text-muted)">Not Set</span></div>
      </div>
      <div id="avail-actions"></div>
    </div>
    ${UI.employeeNav('availability')}
  `;

  await loadAvailability();
  renderCalendar();
}

async function loadAvailability() {
  try {
    const start = `${availCurrentYear}-${String(availCurrentMonth + 1).padStart(2, '0')}-01`;
    const endMonth = availCurrentMonth === 11 ? 0 : availCurrentMonth + 1;
    const endYear = availCurrentMonth === 11 ? availCurrentYear + 1 : availCurrentYear;
    const end = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-01`;

    const data = await API.getAvailability({ startDate: start, endDate: end });
    availData = {};
    data.forEach(d => {
      let timeBlocks = null;
      if (d.time_blocks) {
        try { timeBlocks = JSON.parse(d.time_blocks); } catch (e) {}
      }
      availData[d.date] = {
        available: d.available,
        startTime: d.start_time || '09:00',
        endTime: d.end_time || '17:00',
        timeBlocks: timeBlocks,
      };
    });
  } catch (err) {
    console.error('Failed to load availability:', err);
  }
}

function renderCalendar() {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  document.getElementById('avail-month-label').textContent =
    `${monthNames[availCurrentMonth]} ${availCurrentYear}`;

  const firstDay = new Date(availCurrentYear, availCurrentMonth, 1).getDay();
  const daysInMonth = new Date(availCurrentYear, availCurrentMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    .map(d => `<div class="calendar-day-label">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${availCurrentYear}-${String(availCurrentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const isPast = new Date(dateStr) < new Date(todayStr);
    const entry = availData[dateStr];

    let cls = 'calendar-day';
    if (isToday) cls += ' today';
    if (entry && entry.available) cls += ' available';
    else if (entry && !entry.available) cls += ' unavailable';
    if (isPast) cls += ' other-month';

    // Show time range if available
    let timeLabel = '';
    if (entry && entry.available) {
      if (entry.timeBlocks && entry.timeBlocks.length > 1) {
        // Split shift — show block count
        timeLabel = `<div style="font-size:7px;margin-top:1px;color:rgba(52,211,153,.8)">${entry.timeBlocks.length} blocks</div>`;
      } else {
        timeLabel = `<div style="font-size:7px;margin-top:1px;color:rgba(52,211,153,.8)">${UI.formatTime(entry.startTime).replace(' AM','a').replace(' PM','p')}–${UI.formatTime(entry.endTime).replace(' AM','a').replace(' PM','p')}</div>`;
      }
    }

    html += `<div class="${cls}" onclick="${isPast ? '' : `showAvailDayModal('${dateStr}')`}" style="position:relative">${day}${timeLabel}</div>`;
  }

  document.getElementById('avail-calendar').innerHTML = html;
}

function showAvailDayModal(dateStr) {
  const entry = availData[dateStr] || { available: true, startTime: '09:00', endTime: '17:00', timeBlocks: null };
  const d = new Date(dateStr + 'T12:00:00');
  const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const splitEnabled = (API.features || {}).allowSplitShifts;

  function timeOpts(selected) {
    let opts = '';
    for (let h = 5; h <= 22; h++) {
      for (let m = 0; m < 60; m += 15) {
        const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const label = UI.formatTime(val);
        opts += `<option value="${val}" ${val === selected ? 'selected' : ''}>${label}</option>`;
      }
    }
    return opts;
  }

  // Build time blocks HTML if split is enabled and we have blocks
  const hasBlocks = entry.timeBlocks && entry.timeBlocks.length > 1;
  const blocks = hasBlocks ? entry.timeBlocks : [{ start: entry.startTime, end: entry.endTime }];

  let blocksHtml = '';
  if (splitEnabled) {
    blocksHtml = `
      <div id="avail-blocks-container">
        ${blocks.map((b, i) => `
          <div class="avail-block" data-idx="${i}" style="background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;position:relative">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span class="text-xs semi" style="color:var(--purple-light)">Block ${i + 1}</span>
              ${i > 0 ? `<button type="button" class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:10px;color:var(--red-text)" onclick="removeAvailBlock(${i})">Remove</button>` : ''}
            </div>
            <div style="display:flex;gap:8px">
              <div style="flex:1">
                <label class="form-label">Start</label>
                <select class="form-input avail-block-start" style="font-size:12px;padding:6px 8px">${timeOpts(b.start)}</select>
              </div>
              <div style="flex:1">
                <label class="form-label">End</label>
                <select class="form-input avail-block-end" style="font-size:12px;padding:6px 8px">${timeOpts(b.end)}</select>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <button type="button" class="btn btn-ghost btn-sm" style="width:100%;border:1px dashed var(--border);margin-bottom:8px" onclick="addAvailBlock()">
        + Add another time block
      </button>
      <p class="text-xs text-muted" style="margin-bottom:4px">Split availability lets you work morning + afternoon separately.</p>
    `;
  }

  UI.showModal(dayLabel, `
    <div class="form-group">
      <label class="form-label">Status</label>
      <select id="avail-status" class="form-input" onchange="toggleAvailTimes()">
        <option value="available" ${entry.available ? 'selected' : ''}>Available</option>
        <option value="unavailable" ${!entry.available ? 'selected' : ''}>Unavailable</option>
      </select>
    </div>
    <div id="avail-times" style="${entry.available ? '' : 'display:none'}">
      ${splitEnabled ? blocksHtml : `
        <div class="form-group">
          <label class="form-label">Earliest Start</label>
          <select id="avail-start" class="form-input">${timeOpts(entry.startTime)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Latest End</label>
          <select id="avail-end" class="form-input">${timeOpts(entry.endTime)}</select>
        </div>
      `}
    </div>
  `, `
    <button class="btn btn-primary" onclick="saveAvailDay('${dateStr}')">Save</button>
    <button class="btn btn-ghost" onclick="copyAvailDay('${dateStr}')" title="Copy this day's settings">📋 Copy</button>
    ${availClipboard ? '<button class="btn btn-ghost" onclick="pasteAvailDay(\'' + dateStr + '\')" title="Paste copied settings">📌 Paste</button>' : ''}
    ${availData[dateStr] ? '<button class="btn btn-ghost" onclick="clearAvailDay(\'' + dateStr + '\')">Clear</button>' : ''}
    <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
  `);
}

function toggleAvailTimes() {
  const el = document.getElementById('avail-times');
  if (el) el.style.display = document.getElementById('avail-status').value === 'available' ? 'block' : 'none';
}

function addAvailBlock() {
  const container = document.getElementById('avail-blocks-container');
  if (!container) return;
  const idx = container.querySelectorAll('.avail-block').length;
  if (idx >= 4) { UI.toast('Maximum 4 blocks per day', 'error'); return; }

  function timeOpts(selected) {
    let opts = '';
    for (let h = 5; h <= 22; h++) {
      for (let m = 0; m < 60; m += 15) {
        const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const label = UI.formatTime(val);
        opts += `<option value="${val}" ${val === selected ? 'selected' : ''}>${label}</option>`;
      }
    }
    return opts;
  }

  const block = document.createElement('div');
  block.className = 'avail-block';
  block.dataset.idx = idx;
  block.style.cssText = 'background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;position:relative';
  block.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span class="text-xs semi" style="color:var(--purple-light)">Block ${idx + 1}</span>
      <button type="button" class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:10px;color:var(--red-text)" onclick="removeAvailBlock(${idx})">Remove</button>
    </div>
    <div style="display:flex;gap:8px">
      <div style="flex:1">
        <label class="form-label">Start</label>
        <select class="form-input avail-block-start" style="font-size:12px;padding:6px 8px">${timeOpts('12:00')}</select>
      </div>
      <div style="flex:1">
        <label class="form-label">End</label>
        <select class="form-input avail-block-end" style="font-size:12px;padding:6px 8px">${timeOpts('17:00')}</select>
      </div>
    </div>
  `;
  container.appendChild(block);
}

function removeAvailBlock(idx) {
  const container = document.getElementById('avail-blocks-container');
  if (!container) return;
  const blocks = container.querySelectorAll('.avail-block');
  if (blocks.length <= 1) return; // Can't remove last block
  blocks[idx]?.remove();
  // Re-number remaining blocks
  container.querySelectorAll('.avail-block').forEach((el, i) => {
    el.dataset.idx = i;
    const label = el.querySelector('.text-xs.semi');
    if (label) label.textContent = `Block ${i + 1}`;
  });
}

function copyAvailDay(dateStr) {
  const splitEnabled = (API.features || {}).allowSplitShifts;
  if (splitEnabled) {
    const blocks = getAvailBlocks();
    availClipboard = {
      available: document.getElementById('avail-status').value === 'available',
      startTime: blocks[0]?.start || '09:00',
      endTime: blocks[blocks.length - 1]?.end || '17:00',
      timeBlocks: blocks.length > 1 ? blocks : null,
    };
  } else {
    availClipboard = {
      available: document.getElementById('avail-status').value === 'available',
      startTime: document.getElementById('avail-start').value,
      endTime: document.getElementById('avail-end').value,
      timeBlocks: null,
    };
  }
  UI.closeModal();
  UI.toast('Copied — tap another date and hit Paste');
}

function pasteAvailDay(dateStr) {
  if (!availClipboard) return;
  document.getElementById('avail-status').value = availClipboard.available ? 'available' : 'unavailable';
  toggleAvailTimes();

  const splitEnabled = (API.features || {}).allowSplitShifts;
  if (!splitEnabled) {
    document.getElementById('avail-start').value = availClipboard.startTime;
    document.getElementById('avail-end').value = availClipboard.endTime;
  }
  UI.toast('Pasted — hit Save to confirm');
}

function getAvailBlocks() {
  const container = document.getElementById('avail-blocks-container');
  if (!container) return [];
  const blocks = [];
  container.querySelectorAll('.avail-block').forEach(el => {
    const start = el.querySelector('.avail-block-start')?.value;
    const end = el.querySelector('.avail-block-end')?.value;
    if (start && end) blocks.push({ start, end });
  });
  return blocks;
}

async function saveAvailDay(dateStr) {
  const status = document.getElementById('avail-status').value;
  const available = status === 'available';
  const splitEnabled = (API.features || {}).allowSplitShifts;

  let startTime, endTime, timeBlocks = null;

  if (splitEnabled && available) {
    const blocks = getAvailBlocks();
    // Validate blocks
    for (const b of blocks) {
      if (b.start >= b.end) {
        UI.toast('Each block\'s start must be before its end', 'error');
        return;
      }
    }
    // Sort by start time
    blocks.sort((a, b) => a.start.localeCompare(b.start));
    // Check for overlaps
    for (let i = 1; i < blocks.length; i++) {
      if (blocks[i].start < blocks[i - 1].end) {
        UI.toast('Time blocks cannot overlap', 'error');
        return;
      }
    }
    startTime = blocks[0].start;
    endTime = blocks[blocks.length - 1].end;
    timeBlocks = blocks.length > 1 ? blocks : null;
  } else {
    startTime = document.getElementById('avail-start')?.value || '09:00';
    endTime = document.getElementById('avail-end')?.value || '17:00';
  }

  availData[dateStr] = { available, startTime, endTime, timeBlocks };
  availClipboard = { available, startTime, endTime, timeBlocks }; // auto-copy last saved
  UI.closeModal();
  renderCalendar();

  try {
    await API.setAvailability([{
      date: dateStr,
      available,
      startTime: available ? startTime : null,
      endTime: available ? endTime : null,
      timeBlocks: available ? timeBlocks : null,
    }]);
    UI.toast('Saved');
  } catch (err) {
    UI.toast('Failed to save', 'error');
  }
}

async function clearAvailDay(dateStr) {
  delete availData[dateStr];
  UI.closeModal();
  renderCalendar();

  try {
    await API.setAvailability([{ date: dateStr, available: true }]);
  } catch (err) {
    // silently fail
  }
}

function changeAvailMonth(delta) {
  availCurrentMonth += delta;
  if (availCurrentMonth > 11) { availCurrentMonth = 0; availCurrentYear++; }
  if (availCurrentMonth < 0) { availCurrentMonth = 11; availCurrentYear--; }

  loadAvailability().then(() => renderCalendar());
}
