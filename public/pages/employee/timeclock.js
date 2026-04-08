// ═══════════════════════════════════════════════════════
// CrewCast — Employee Time Clock Page
// QR badge, clock in/out with role selection, tip entry, breaks
// ═══════════════════════════════════════════════════════

async function renderTimeClock(app) {
  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <a href="/" class="btn btn-ghost btn-sm">&larr; Home</a>
        <h1>Time Clock</h1>
      </div>
      <div id="timeclock-content">${UI.loading()}</div>
    </div>
  `;

  try {
    const [statusData, qrData] = await Promise.all([
      API.getClockStatus(),
      API.getQRCode(API.user.id)
    ]);

    // Try to load pay roles (may not be configured yet)
    let payRoles = [];
    try { payRoles = await API.getPayRoles(); } catch (e) { /* no roles configured */ }

    const container = document.getElementById('timeclock-content');
    const clockedIn = statusData.clockedIn;
    const entry = statusData.entry;

    let clockedInTime = '';
    let stationName = '';
    let onBreak = false;
    if (clockedIn && entry) {
      clockedInTime = new Date(entry.clock_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      stationName = entry.station_name || 'No station';
      onBreak = entry.break_start && !entry.break_end;
    }

    container.innerHTML = `
      <div style="text-align:center;padding:20px 0">
        ${clockedIn ? `
          <div class="card" style="background:var(--green-bg, #d1fae5);border:2px solid var(--green, #10b981);margin-bottom:20px;padding:20px">
            <div style="font-size:40px;margin-bottom:8px">&#9989;</div>
            <div class="semi" style="font-size:18px;color:var(--green, #10b981)">${onBreak ? 'On Break' : 'Clocked In'}</div>
            <div class="text-sm text-muted" style="margin-top:4px">Since ${clockedInTime} at ${stationName}</div>

            ${onBreak ? `
              <button class="btn btn-primary" style="margin-top:16px" onclick="doEndBreak()">End Break</button>
            ` : `
              <button class="btn btn-secondary btn-sm" style="margin-top:16px" onclick="doStartBreak()">Start Break</button>
            `}

            <div style="margin-top:16px;border-top:1px solid rgba(0,0,0,0.1);padding-top:16px">
              <div class="semi" style="margin-bottom:8px">Clock Out</div>
              <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:12px">
                <div style="text-align:left">
                  <label class="text-xs text-muted">Cash Tips</label>
                  <input type="number" id="tip-cash" class="input" placeholder="$0.00" step="0.01" min="0" style="width:120px">
                </div>
                <div style="text-align:left">
                  <label class="text-xs text-muted">Card Tips</label>
                  <input type="number" id="tip-card" class="input" placeholder="$0.00" step="0.01" min="0" style="width:120px">
                </div>
              </div>
              <button class="btn btn-danger" onclick="doClockOut()">Clock Out</button>
            </div>
          </div>
        ` : `
          <div class="card" style="background:var(--bg-secondary, #1e293b);margin-bottom:20px;padding:20px">
            <div style="font-size:40px;margin-bottom:8px">&#9203;</div>
            <div class="semi" style="font-size:18px">Not Clocked In</div>
            <div class="text-sm text-muted" style="margin-top:4px">Show your QR badge to the kiosk scanner, or clock in manually below</div>
          </div>
        `}

        <div class="card" style="padding:24px;margin-bottom:20px">
          <div class="semi" style="margin-bottom:12px">Your QR Badge</div>
          <div id="qr-badge" style="display:inline-block;background:white;padding:16px;border-radius:12px">
            <canvas id="qr-canvas" width="200" height="200"></canvas>
          </div>
          <div style="margin-top:8px">
            <div class="semi">${API.user.firstName} ${API.user.lastName}</div>
            <div class="text-xs text-muted">Show this to the scanner to clock in/out</div>
          </div>
        </div>

        ${!clockedIn ? `
          <div class="card" style="padding:20px">
            <div class="semi" style="margin-bottom:12px">Manual Clock In</div>
            ${payRoles.length > 0 ? `
              <select id="manual-role" class="input" style="margin-bottom:8px">
                <option value="">Select role</option>
                ${payRoles.filter(r => r.active).map(r =>
                  `<option value="${r.id}">${r.name} — $${parseFloat(r.base_rate).toFixed(2)}/hr${r.is_tipped ? ' + tips' : ''}</option>`
                ).join('')}
              </select>
            ` : ''}
            <select id="manual-station" class="input" style="margin-bottom:12px">
              <option value="">Select station (optional)</option>
            </select>
            <button class="btn btn-primary" style="width:100%" onclick="doManualClockIn()">Clock In Now</button>
          </div>
        ` : ''}
      </div>
    `;

    // Generate QR code on canvas
    generateQROnCanvas('qr-canvas', qrData.payload);

    // Load stations for manual clock-in dropdown
    if (!clockedIn) {
      try {
        const stations = await API.getStations();
        const sel = document.getElementById('manual-station');
        if (sel) {
          stations.filter(s => s.active).forEach(s => {
            sel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
          });
        }
      } catch (e) { /* stations optional */ }
    }
  } catch (err) {
    document.getElementById('timeclock-content').innerHTML =
      `<div class="card" style="padding:20px;text-align:center"><p class="text-muted">Failed to load time clock: ${err.message}</p></div>`;
  }
}

async function doManualClockIn() {
  try {
    const stationId = document.getElementById('manual-station')?.value || null;
    const roleId = document.getElementById('manual-role')?.value || null;
    await API.clockIn(stationId || undefined, roleId || undefined);
    UI.toast('Clocked in!');
    renderTimeClock(document.getElementById('app'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function doClockOut() {
  try {
    const tipCash = document.getElementById('tip-cash')?.value || 0;
    const tipCard = document.getElementById('tip-card')?.value || 0;
    await API.clockOut(tipCash, tipCard);
    UI.toast('Clocked out!');
    renderTimeClock(document.getElementById('app'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function doStartBreak() {
  try {
    await API.post('/api/time/start-break', {});
    UI.toast('Break started');
    renderTimeClock(document.getElementById('app'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function doEndBreak() {
  try {
    const result = await API.post('/api/time/end-break', {});
    UI.toast(`Break ended (${result.breakMinutes} min)`);
    renderTimeClock(document.getElementById('app'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

// ── QR Code Generator ──
function generateQROnCanvas(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (window.QRCode) {
    QRCode.toCanvas(canvas, data, { width: 200, margin: 2, color: { dark: '#000', light: '#fff' } });
  } else {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = '#000';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('QR Code', 100, 90);
    ctx.fillText('Loading...', 100, 110);

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    script.onload = () => {
      const qr = qrcode(0, 'M');
      qr.addData(data);
      qr.make();
      const moduleCount = qr.getModuleCount();
      const cellSize = Math.floor(190 / moduleCount);
      const offset = Math.floor((200 - moduleCount * cellSize) / 2);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 200, 200);
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          ctx.fillStyle = qr.isDark(row, col) ? '#000' : '#fff';
          ctx.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize);
        }
      }
    };
    document.head.appendChild(script);
  }
}
