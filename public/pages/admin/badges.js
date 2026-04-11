// ═══════════════════════════════════════════════════════
// CrewCast — Badge Printing (admin)
// Generates a printable PDF of QR badges for all employees.
// 4 per letter page. Steve prints, cuts, hands them out.
// ═══════════════════════════════════════════════════════

async function renderBadges(app) {
  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <a href="/admin" class="btn btn-ghost btn-sm">&larr; Admin</a>
        <h1>Employee Badges</h1>
      </div>

      <div class="card" style="padding:20px;margin-bottom:20px">
        <div class="semi" style="margin-bottom:8px">Print QR Clock-In Badges</div>
        <div class="text-sm text-muted" style="margin-bottom:16px">
          Generates a PDF with one QR badge per active employee. Each badge is scanned at a station kiosk to clock in or out.
          Print on card stock, cut, and laminate or clip on.
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-primary" onclick="downloadBadgesPDF()">Download Badges PDF</button>
          <label class="text-sm" style="display:flex;align-items:center;gap:6px">
            <input type="checkbox" id="badges-active-only" checked />
            Active employees only
          </label>
        </div>

        <div id="badges-status" class="text-sm text-muted" style="margin-top:12px"></div>
      </div>

      <div class="card" style="padding:20px">
        <div class="semi" style="margin-bottom:8px">How badges work</div>
        <ol class="text-sm" style="padding-left:20px;line-height:1.6;color:var(--text-muted,#94a3b8)">
          <li>Each QR code contains a signed employee id (HMAC-SHA256). Nobody else can fake it.</li>
          <li>A station kiosk scans the badge; CrewCAST verifies the signature and logs the punch.</li>
          <li>If the same employee scans again in the same day, it clocks them out.</li>
          <li>If the kiosk is offline, the punch queues locally and replays when the network is back.</li>
          <li>All punches are reconciled nightly against When I Work (Tools → WIW Reconciliation).</li>
        </ol>
      </div>
    </div>
  `;
}

async function downloadBadgesPDF() {
  const statusEl = document.getElementById('badges-status');
  const activeOnly = document.getElementById('badges-active-only')?.checked ? 1 : 0;
  statusEl.textContent = 'Generating PDF…';
  try {
    const url = `/api/time/badges-pdf?activeOnly=${activeOnly}`;
    const res = await fetch(url, {
      headers: API.token ? { 'Authorization': 'Bearer ' + API.token } : {}
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate PDF (HTTP ' + res.status + ')');
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `crewcast-badges-${new Date().toISOString().slice(0,10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    statusEl.textContent = 'Downloaded.';
    UI.toast('Badges PDF ready');
  } catch (err) {
    statusEl.textContent = '';
    UI.toast(err.message, 'error');
  }
}
