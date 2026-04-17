// ═══════════════════════════════════════════════════════
// CrewCast — Admin Onboarding Hub
// QR poster, bulk SMS invites, CSV export, progress tracker
// ═══════════════════════════════════════════════════════

async function renderOnboarding(app) {
  app.innerHTML = UI.adminShell('onboarding', `
    <div class="page">
      <h1>📲 Employee Onboarding</h1>
      <p class="subtitle">Get your team set up on CrewCast</p>
      <div id="onboard-content"><div class="card" style="padding:30px;text-align:center"><div class="spinner"></div></div></div>
    </div>
  `);

  try {
    const [stats, smsStatus, employees] = await Promise.all([
      API.getOnboardStats(),
      API.getSmsStatus().catch(() => ({ configured: false })),
      API.getEmployees(),
    ]);

    const total = parseInt(stats.total) || 0;
    const done = parseInt(stats.setup_complete) || 0;
    const pending = parseInt(stats.pending) || 0;
    const noPhone = parseInt(stats.no_phone) || 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const slug = API.user?.businessSlug || '';
    const joinUrl = `${location.origin}/join/${slug}`;

    const pendingEmps = employees.filter(e => !e.hasPin && e.role !== 'admin');

    document.getElementById('onboard-content').innerHTML = `
      <!-- Progress Bar -->
      <div class="card" style="margin-bottom:16px">
        <div class="flex justify-between items-center mb-2">
          <div class="semi">Onboarding Progress</div>
          <div class="semi" style="color:var(--purple-light)">${pct}%</div>
        </div>
        <div style="background:rgba(51,65,85,.3);border-radius:8px;height:12px;overflow:hidden;margin-bottom:12px">
          <div style="background:linear-gradient(90deg,var(--purple-light),#A78BFA);height:100%;width:${pct}%;border-radius:8px;transition:width .5s"></div>
        </div>
        <div class="flex gap-3 flex-wrap">
          <div class="stat-card" style="flex:1;min-width:80px"><div class="stat-value" style="color:#22C55E">${done}</div><div class="stat-label">Set Up</div></div>
          <div class="stat-card" style="flex:1;min-width:80px"><div class="stat-value" style="color:#FBBF24">${pending}</div><div class="stat-label">Pending</div></div>
          <div class="stat-card" style="flex:1;min-width:80px"><div class="stat-value">${total}</div><div class="stat-label">Total</div></div>
          ${noPhone > 0 ? `<div class="stat-card" style="flex:1;min-width:80px"><div class="stat-value" style="color:#F87171">${noPhone}</div><div class="stat-label">No Phone</div></div>` : ''}
        </div>
      </div>

      <!-- QR Join Poster -->
      <div class="card" style="margin-bottom:16px">
        <div class="flex items-center gap-2 mb-2">
          <span style="font-size:24px">📋</span>
          <div>
            <div class="semi">QR Join Link</div>
            <div class="text-xs text-muted">Print this as a poster or share the link. Employees scan it, enter their phone, and set up their account.</div>
          </div>
        </div>
        <div class="form-input text-sm" style="word-break:break-all;cursor:pointer;margin:12px 0" onclick="onboardCopyLink(this)">${joinUrl}</div>
        <div class="flex gap-2 flex-wrap">
          <button class="btn btn-primary btn-sm" onclick="onboardCopyLink(document.querySelector('#onboard-content .form-input'))">📋 Copy Link</button>
          <button class="btn btn-secondary btn-sm" onclick="onboardShowQR()">📱 Show QR Code</button>
          <button class="btn btn-secondary btn-sm" onclick="onboardPrintPoster()">🖨️ Print Poster</button>
        </div>
      </div>

      <!-- SMS Invites -->
      <div class="card" style="margin-bottom:16px">
        <div class="flex items-center gap-2 mb-2">
          <span style="font-size:24px">💬</span>
          <div>
            <div class="semi">SMS Invites</div>
            <div class="text-xs text-muted">${smsStatus.configured
              ? `Twilio connected — send text invites to employees who haven't set up yet`
              : `Not configured yet. Add Twilio credentials in Settings to enable SMS invites.`
            }</div>
          </div>
        </div>
        ${smsStatus.configured ? `
          <div class="flex gap-2 flex-wrap">
            <button class="btn btn-primary btn-sm" onclick="onboardBulkSms()" ${pending === 0 ? 'disabled' : ''}>
              📤 Text All Pending (${pending})
            </button>
          </div>
          <div id="sms-result" style="margin-top:8px"></div>
        ` : `
          <button class="btn btn-secondary btn-sm" onclick="Router.navigate('/admin/settings')">⚙️ Configure SMS</button>
        `}
      </div>

      <!-- CSV Export -->
      <div class="card" style="margin-bottom:16px">
        <div class="flex items-center gap-2 mb-2">
          <span style="font-size:24px">📥</span>
          <div>
            <div class="semi">Export Invite List</div>
            <div class="text-xs text-muted">Download a CSV with names, phones, status, and individual invite links. Use for mail merge or manual texting.</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="onboardDownloadCsv()">📥 Download CSV</button>
      </div>

      <!-- Pending Employees List -->
      ${pendingEmps.length > 0 ? `
        <div class="card">
          <div class="semi mb-2">Pending Setup (${pendingEmps.length})</div>
          <div style="max-height:300px;overflow-y:auto">
            ${pendingEmps.map(emp => `
              <div class="flex justify-between items-center" style="padding:8px 0;border-bottom:1px solid rgba(51,65,85,.2)">
                <div>
                  <div class="text-sm semi">${emp.firstName} ${emp.lastName}</div>
                  <div class="text-xs text-muted">${emp.phone || 'No phone'}</div>
                </div>
                <div class="flex gap-1">
                  ${smsStatus.configured && emp.phone ? `
                    <button class="btn btn-ghost btn-sm" onclick="onboardSendOne(${emp.id}, '${emp.firstName}')" title="Send invite text">💬</button>
                  ` : ''}
                  <button class="btn btn-ghost btn-sm" onclick="onboardCopyInviteLink(${emp.id}, '${emp.inviteToken}')" title="Copy invite link">📋</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="card" style="text-align:center;padding:30px">
          <div style="font-size:48px;margin-bottom:8px">🎉</div>
          <div class="semi">All employees are set up!</div>
          <p class="text-xs text-muted mt-1">Everyone has created their PIN and can access CrewCast.</p>
        </div>
      `}

      <div class="flex gap-2 justify-center mt-3">
        <button class="btn btn-secondary" onclick="Router.navigate('/admin/employees')">👥 Manage Employees</button>
        <button class="btn btn-secondary" onclick="Router.navigate('/admin')">🏠 Dashboard</button>
      </div>
    `;
  } catch (err) {
    document.getElementById('onboard-content').innerHTML = `
      <div class="card" style="color:#F87171;padding:20px">Failed to load onboarding data: ${err.message}</div>
    `;
  }
}

function onboardCopyLink(el) {
  const text = el.textContent || el.innerText;
  navigator.clipboard.writeText(text).then(() => UI.toast('Link copied!')).catch(() => {
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    UI.toast('Select and copy the link');
  });
}

function onboardCopyInviteLink(empId, inviteToken) {
  const url = `${location.origin}/invite/${inviteToken}`;
  navigator.clipboard.writeText(url).then(() => UI.toast('Invite link copied!')).catch(() => UI.toast('Copy failed', 'error'));
}

function onboardShowQR() {
  const slug = API.user?.businessSlug || '';
  const joinUrl = `${location.origin}/join/${slug}`;
  // Use a QR code API (no library needed)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}&bgcolor=0C1222&color=A78BFA`;

  UI.showModal('Scan to Join', `
    <div style="text-align:center">
      <img src="${qrUrl}" alt="QR Code" style="width:250px;height:250px;border-radius:12px;margin:12px auto;display:block;background:#fff;padding:12px">
      <div class="text-sm text-muted mt-2" style="word-break:break-all">${joinUrl}</div>
      <p class="text-xs text-muted mt-2">Employees scan this code with their phone camera to set up their CrewCast account.</p>
    </div>
  `, `
    <button class="btn btn-primary" onclick="onboardCopyLink(document.querySelector('.modal .text-sm'))">Copy Link</button>
    <button class="btn btn-secondary" onclick="UI.closeModal()">Close</button>
  `);
}

function onboardPrintPoster() {
  const slug = API.user?.businessSlug || '';
  const joinUrl = `${location.origin}/join/${slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(joinUrl)}`;
  const bizName = API.user?.businessName || 'Our Team';

  const posterHtml = `<!DOCTYPE html>
<html><head><title>CrewCast - Join Poster</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; background:#fff; color:#1a1a2e;
         display:flex; justify-content:center; align-items:center; min-height:100vh; padding:40px; }
  .poster { text-align:center; max-width:600px; }
  .title { font-size:48px; font-weight:800; margin-bottom:8px; color:#7C3AED; }
  .subtitle { font-size:22px; font-weight:600; margin-bottom:32px; color:#334155; }
  .qr { margin:24px auto; }
  .qr img { width:300px; height:300px; border:4px solid #7C3AED; border-radius:16px; padding:12px; background:#fff; }
  .instructions { font-size:18px; margin-top:24px; color:#475569; line-height:1.6; }
  .step { display:flex; align-items:center; gap:12px; justify-content:center; margin:8px 0; }
  .step-num { background:#7C3AED; color:#fff; width:32px; height:32px; border-radius:50%; display:flex;
              align-items:center; justify-content:center; font-weight:700; font-size:16px; flex-shrink:0; }
  .url { font-size:14px; color:#7C3AED; margin-top:20px; word-break:break-all; }
  .footer { font-size:12px; color:#94A3B8; margin-top:32px; }
  @media print { body { padding:20px; } }
</style></head>
<body>
<div class="poster">
  <div class="title">📲 Join CrewCast</div>
  <div class="subtitle">${bizName} Scheduling</div>
  <div class="qr"><img src="${qrUrl}" alt="QR Code"></div>
  <div class="instructions">
    <div class="step"><div class="step-num">1</div> Scan the QR code with your phone camera</div>
    <div class="step"><div class="step-num">2</div> Enter your phone number</div>
    <div class="step"><div class="step-num">3</div> Create a 4-digit PIN</div>
    <div class="step"><div class="step-num">4</div> Add CrewCast to your home screen</div>
  </div>
  <div class="url">Or visit: ${joinUrl}</div>
  <div class="footer">View your schedule, clock in/out, swap shifts, and more — all from your phone.</div>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(posterHtml);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

async function onboardBulkSms() {
  if (!confirm('Send invite texts to all pending employees?')) return;

  const resultEl = document.getElementById('sms-result');
  resultEl.innerHTML = '<div class="text-sm" style="color:var(--purple-light)">Sending invites...</div>';

  try {
    const result = await API.sendBulkInvites();
    resultEl.innerHTML = `
      <div class="text-sm" style="color:#22C55E">
        ✅ Sent ${result.sent} invite${result.sent !== 1 ? 's' : ''}
        ${result.failed ? ` · ${result.failed} failed` : ''}
        ${result.skipped ? ` · ${result.skipped} skipped (invalid phone)` : ''}
      </div>
      ${result.errors?.length ? `<div class="text-xs text-muted mt-1">${result.errors.join('<br>')}</div>` : ''}
    `;
  } catch (err) {
    resultEl.innerHTML = `<div class="text-sm" style="color:#F87171">❌ ${err.message}</div>`;
  }
}

async function onboardSendOne(empId, firstName) {
  try {
    const result = await API.sendInviteSms(empId);
    if (result.skipped) {
      UI.toast(`${firstName}: ${result.reason}`, 'error');
    } else {
      UI.toast(`Invite sent to ${firstName}!`);
    }
  } catch (err) {
    UI.toast('Failed: ' + err.message, 'error');
  }
}

async function onboardDownloadCsv() {
  try {
    const blob = await API.downloadInviteCsv();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crewcast-invites.csv';
    a.click();
    URL.revokeObjectURL(url);
    UI.toast('CSV downloaded!');
  } catch (err) {
    UI.toast('Download failed: ' + err.message, 'error');
  }
}
