// ═══════════════════════════════════════════════════════
// CrewCast — Kiosk Mode (QR Scanner)
// Full-screen camera scanner for employee clock in/out
// ═══════════════════════════════════════════════════════

let kioskScanner = null;
let kioskStationId = null;
let kioskId = null;
let kioskScanCooldown = false;

async function renderKiosk(app) {
  // Get station from URL params or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  kioskStationId = urlParams.get('station') || localStorage.getItem('kiosk_station') || null;
  kioskId = urlParams.get('kiosk') || localStorage.getItem('kiosk_id') || null;

  app.innerHTML = `
    <div class="kiosk-page">
      <div class="kiosk-header">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:28px">&#128247;</span>
          <div>
            <div class="semi" style="font-size:20px;color:white">CrewCAST Time Clock</div>
            <div id="kiosk-station-label" class="text-sm" style="color:rgba(255,255,255,0.7)">Loading...</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <div id="kiosk-time" style="font-size:24px;font-weight:600;color:white;font-variant-numeric:tabular-nums"></div>
          <button class="btn btn-ghost btn-sm" style="color:white" onclick="exitKiosk()">Exit</button>
        </div>
      </div>

      <div class="kiosk-body">
        <div id="kiosk-scanner-area" class="kiosk-scanner">
          <div id="kiosk-video-container"></div>
          <div class="kiosk-crosshair"></div>
          <div id="kiosk-scan-prompt" class="kiosk-prompt">
            <span style="font-size:48px">&#128179;</span>
            <div style="font-size:20px;font-weight:600;margin-top:8px">Scan Your Badge</div>
            <div style="font-size:14px;opacity:0.7;margin-top:4px">Hold your QR code in front of the camera</div>
          </div>
        </div>

        <div id="kiosk-result" class="kiosk-result" style="display:none"></div>

        <div class="kiosk-footer">
          <div id="kiosk-active-count" class="text-sm" style="color:rgba(255,255,255,0.6)"></div>
        </div>
      </div>
    </div>
  `;

  // Add kiosk-specific styles
  if (!document.getElementById('kiosk-styles')) {
    const style = document.createElement('style');
    style.id = 'kiosk-styles';
    style.textContent = `
      .kiosk-page { position:fixed;inset:0;background:#0a0a0a;display:flex;flex-direction:column;z-index:9999 }
      .kiosk-header { display:flex;justify-content:space-between;align-items:center;padding:16px 24px;background:rgba(15,23,42,0.95);border-bottom:1px solid rgba(255,255,255,0.1) }
      .kiosk-body { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px }
      .kiosk-scanner { position:relative;width:100%;max-width:500px;aspect-ratio:1;background:#111;border-radius:16px;overflow:hidden;display:flex;align-items:center;justify-content:center }
      .kiosk-scanner video { width:100%;height:100%;object-fit:cover }
      .kiosk-crosshair { position:absolute;inset:15%;border:3px solid rgba(59,130,246,0.8);border-radius:12px;pointer-events:none }
      .kiosk-prompt { position:absolute;text-align:center;color:white }
      .kiosk-result { text-align:center;padding:32px;border-radius:16px;margin-top:24px;width:100%;max-width:500px;animation:kioskFade 0.3s ease }
      .kiosk-result.success { background:rgba(16,185,129,0.15);border:2px solid #10b981 }
      .kiosk-result.clock-out { background:rgba(239,68,68,0.15);border:2px solid #ef4444 }
      .kiosk-footer { margin-top:24px;text-align:center }
      @keyframes kioskFade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    `;
    document.head.appendChild(style);
  }

  // Load station name
  if (kioskStationId) {
    try {
      const stations = await API.getStations();
      const station = stations.find(s => s.id == kioskStationId);
      document.getElementById('kiosk-station-label').textContent = station ? station.name : 'All Stations';
    } catch (e) {
      document.getElementById('kiosk-station-label').textContent = 'Station Kiosk';
    }
  } else {
    document.getElementById('kiosk-station-label').textContent = 'All Stations';
  }

  // Start clock
  updateKioskClock();
  setInterval(updateKioskClock, 1000);

  // Update active count
  updateActiveCount();
  setInterval(updateActiveCount, 30000);

  // Start camera scanner
  startKioskScanner();
}

function updateKioskClock() {
  const el = document.getElementById('kiosk-time');
  if (el) {
    el.textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }
}

async function updateActiveCount() {
  try {
    const active = await API.getActiveEmployees();
    const el = document.getElementById('kiosk-active-count');
    if (el) {
      el.textContent = `${active.length} employee${active.length !== 1 ? 's' : ''} currently clocked in`;
    }
  } catch (e) { /* ignore */ }
}

async function startKioskScanner() {
  const container = document.getElementById('kiosk-video-container');
  if (!container) return;

  try {
    // Use html5-qrcode library for reliable scanning
    if (!window.Html5Qrcode) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js');
    }

    kioskScanner = new Html5Qrcode('kiosk-video-container');
    await kioskScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      onKioskScanSuccess,
      () => {} // ignore failures (no QR in frame)
    );

    // Hide the prompt once camera is active
    const prompt = document.getElementById('kiosk-scan-prompt');
    if (prompt) prompt.style.opacity = '0.5';
  } catch (err) {
    console.error('Camera error:', err);
    const prompt = document.getElementById('kiosk-scan-prompt');
    if (prompt) {
      prompt.innerHTML = `
        <span style="font-size:48px">&#128247;</span>
        <div style="font-size:18px;font-weight:600;margin-top:8px">Camera Not Available</div>
        <div style="font-size:14px;opacity:0.7;margin-top:4px">${err.message || 'Please allow camera access and reload'}</div>
      `;
    }
  }
}

async function onKioskScanSuccess(decodedText) {
  if (kioskScanCooldown) return;
  kioskScanCooldown = true;

  const resultEl = document.getElementById('kiosk-result');
  if (!resultEl) return;

  try {
    // Try parsing as CrewCAST QR payload
    const parsed = JSON.parse(decodedText);
    if (!parsed.eid || !parsed.bid || !parsed.h) {
      throw new Error('Not a CrewCAST badge');
    }

    // Process the scan
    const result = await API.scanQR(decodedText, kioskStationId ? parseInt(kioskStationId) : undefined, kioskId ? parseInt(kioskId) : undefined);

    const isClockIn = result.action === 'clock_in';
    const emp = result.employee;

    resultEl.style.display = 'block';
    resultEl.className = `kiosk-result ${isClockIn ? 'success' : 'clock-out'}`;
    resultEl.innerHTML = `
      <div style="font-size:48px;margin-bottom:8px">${isClockIn ? '&#9989;' : '&#128075;'}</div>
      <div style="font-size:24px;font-weight:700;color:white">${emp.firstName} ${emp.lastName}</div>
      <div style="font-size:18px;color:${isClockIn ? '#10b981' : '#ef4444'};margin-top:8px">${isClockIn ? 'Clocked In' : 'Clocked Out'}</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.6);margin-top:4px">${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
    `;

    // Play a beep sound
    playBeep(isClockIn ? 800 : 400);

    // Hide result after 3 seconds
    setTimeout(() => {
      if (resultEl) {
        resultEl.style.display = 'none';
      }
      kioskScanCooldown = false;
    }, 3000);

    // Update active count
    updateActiveCount();
  } catch (err) {
    resultEl.style.display = 'block';
    resultEl.className = 'kiosk-result';
    resultEl.style.background = 'rgba(239,68,68,0.15)';
    resultEl.style.border = '2px solid #ef4444';
    resultEl.innerHTML = `
      <div style="font-size:48px;margin-bottom:8px">&#10060;</div>
      <div style="font-size:18px;color:#ef4444">${err.message || 'Invalid badge'}</div>
    `;
    playBeep(200);
    setTimeout(() => {
      if (resultEl) resultEl.style.display = 'none';
      kioskScanCooldown = false;
    }, 2000);
  }
}

function playBeep(freq) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { /* audio not supported */ }
}

function exitKiosk() {
  if (kioskScanner) {
    kioskScanner.stop().catch(() => {});
    kioskScanner = null;
  }
  Router.navigate('/admin');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
