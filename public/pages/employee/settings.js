// ═══════════════════════════════════════════════════════
// CrewCast — Employee App Settings
// Notifications, install help, account / sign-out.
// (Station preferences live on /preferences in their own tab.)
// ═══════════════════════════════════════════════════════

async function renderEmployeeSettings(app) {
  const u = API.user || {};
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  app.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1>Settings</h1>
        <p class="subtitle">Notifications, app install, and account</p>
      </div>

      <!-- Notifications -->
      <div class="card mb-3" id="notif-settings">
        <div class="flex items-center gap-2 mb-2">
          <span style="font-size:18px">🔔</span>
          <div class="semi text-sm">Push Notifications</div>
        </div>
        <div id="notif-status">${UI.loading()}</div>
      </div>

      <!-- Install -->
      ${!isStandalone ? `
        <div class="card mb-3" style="background:var(--purple-bg);border-color:rgba(167,139,250,.25)">
          <div class="flex items-center gap-2 mb-2">
            <span style="font-size:18px">📲</span>
            <div class="semi text-sm" style="color:var(--purple-light)">Install on your phone</div>
          </div>
          <p class="text-xs text-muted">
            <strong>iPhone:</strong> Tap the Share button → "Add to Home Screen"<br>
            <strong>Android:</strong> Tap the install banner, or menu → "Install app"
          </p>
        </div>
      ` : `
        <div class="card mb-3">
          <div class="flex items-center gap-2">
            <span style="font-size:18px">✅</span>
            <div class="semi text-sm">App is installed</div>
          </div>
        </div>
      `}

      <!-- Account -->
      <div class="card mb-3">
        <div class="card-title mb-2">Account</div>
        <div class="text-sm" style="margin-bottom:4px">${u.firstName || ''} ${u.lastName || ''}</div>
        ${u.phone ? `<div class="text-xs text-muted" style="margin-bottom:8px">${u.phone}</div>` : ''}
        ${u.businessName ? `<div class="text-xs text-muted" style="margin-bottom:12px">${u.businessName}</div>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="handleLogout()">Sign Out</button>
      </div>
    </div>
    ${UI.employeeNav('settings')}
  `;

  if (typeof renderNotifStatus === 'function') renderNotifStatus();
}
