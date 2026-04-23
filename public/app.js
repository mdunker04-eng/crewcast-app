// ═══════════════════════════════════════════════════════
// CrewCast — App Entry Point
// Routes + PWA registration
// ═══════════════════════════════════════════════════════

// ── Route definitions ──

// Auth routes
Router.add('/login', (app) => renderLogin(app));
Router.add('/signup', (app) => renderOnboard(app));
Router.add('/invite/:token', (app, params) => renderSetup(app, params));
Router.add('/join/:slug', (app, params) => renderJoin(app, params));
Router.add('/join', (app) => renderJoin(app, {}));
// Magic-link consumption (phone-only sign-in for personal devices)
Router.add('/m/:token', (app, params) => renderMagic(app, params));

// Employee routes
Router.add('/welcome', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  renderEmployeeWelcome(app);
});
Router.add('/', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (API.isAdmin()) return Router.navigate('/admin', true);
  if (shouldShowEmployeeWelcome()) return Router.navigate('/welcome', true);
  renderEmployeeHome(app);
});
Router.add('/schedule', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  renderEmployeeSchedule(app);
});
Router.add('/availability', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  renderAvailability(app);
});
Router.add('/swaps', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  const f = API.features || {};
  if (f.allowSwaps === false) return Router.navigate('/', true);
  renderEmployeeSwaps(app);
});
Router.add('/preferences', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  const f = API.features || {};
  if (f.employeeRankStations === false) return Router.navigate('/', true);
  renderPreferences(app);
});
Router.add('/assignments', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  renderAssignmentsEmployee(app);
});

// ── Time tracking v1 (employee) ──
Router.add('/timeclock', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  renderTimeClock(app);
});

// Admin routes
Router.add('/admin/welcome', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  renderAdminWelcome(app);
});
Router.add('/admin', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  renderAdminDashboard(app);
});
Router.add('/admin/schedules', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  renderAdminSchedules(app);
});
Router.add('/admin/schedule/:id', (app, params) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  renderScheduleDetail(app, params);
});
Router.add('/admin/stations', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  renderAdminStations(app);
});
Router.add('/admin/employees', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  renderAdminEmployees(app);
});
Router.add('/admin/settings', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  renderSettings(app);
});
Router.add('/admin/assignments', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  renderAssignmentsAdmin(app);
});

// ── Time tracking v1 (admin) ──
Router.add('/admin/kiosk', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  renderKiosk(app);
});
Router.add('/admin/timesheet', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  if (typeof renderTimesheet === 'function') renderTimesheet(app);
  else app.innerHTML = '<div class="page"><div class="card" style="padding:20px">Timesheet view coming soon.</div></div>';
});
Router.add('/admin/time-dashboard', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  if (typeof renderTimeDashboard === 'function') renderTimeDashboard(app);
  else app.innerHTML = '<div class="page"><div class="card" style="padding:20px">Time dashboard coming soon.</div></div>';
});
Router.add('/admin/badges', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  renderBadges(app);
});
Router.add('/admin/wiw-reconcile', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  renderWiwReconcile(app);
});
Router.add('/admin/onboarding', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  renderOnboarding(app);
});
Router.add('/admin/inbox', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (!API.isAdmin()) return Router.navigate('/', true);
  renderInbox(app);
});
// Legacy alias — old links in docs pointed at /admin/cg-onboard.
Router.add('/admin/cg-onboard', (app) => Router.navigate('/admin/onboarding', true));

// Demo feature views (all require admin)
const demoRoutes = [
  ['/admin/demo/dashboard', renderDemoDashboard],
  ['/admin/demo/crowdpulse', renderDemoCrowdPulse],
  ['/admin/demo/stations', renderDemoStationView],
  ['/admin/demo/coverage', renderDemoCoverage],
  ['/admin/demo/storm', renderDemoStorm],
  ['/admin/demo/replacement', renderDemoReplacement],
  ['/admin/demo/cascade', renderDemoCascade],
  ['/admin/demo/swaps', renderDemoSwaps],
  ['/admin/demo/sms', renderDemoSms],
  ['/admin/demo/costs', renderDemoCosts],
  ['/admin/demo/alerts', renderDemoAlerts],
  ['/admin/demo/roster', renderDemoRoster],
  ['/admin/demo/employee', renderDemoEmployee],
];
demoRoutes.forEach(([path, handler]) => {
  Router.add(path, (app) => {
    if (!API.isLoggedIn()) return Router.navigate('/login', true);
    if (!API.isAdmin()) return Router.navigate('/', true);
    handler(app);
  });
});

// ── Initialize router ──
Router.init();

// ── Load feature flags + refresh session (for returning sessions) ──
if (API.isLoggedIn()) {
  API.getFeatures().then(f => { API.features = f; }).catch(() => { API.features = {}; });
  // Roll the session expiry forward to 1 year from now on every app open.
  // Silent — ignore errors (401s will bounce the user to /login automatically).
  API.refresh().catch(() => {});
}

// ── PWA Install Prompt ──
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  // Don't show if already installed (standalone mode)
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  // Don't show if user dismissed it this session
  if (sessionStorage.getItem('cc-install-dismissed')) return;

  // Remove existing banner if any
  const existing = document.getElementById('install-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.innerHTML = `
    <div class="install-banner-content">
      <div style="display:flex;align-items:center;gap:10px;flex:1">
        <span style="font-size:24px">📲</span>
        <div>
          <div class="semi" style="font-size:13px">Install CrewCast</div>
          <div class="text-xs text-muted">Add to your home screen for quick access</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-primary btn-sm" onclick="triggerInstall()">Install</button>
        <button class="btn btn-ghost btn-sm" onclick="dismissInstallBanner()" style="padding:4px 8px;font-size:16px">&times;</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);
}

async function triggerInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const result = await deferredInstallPrompt.userChoice;
  if (result.outcome === 'accepted') {
    UI.toast('CrewCast installed!');
  }
  deferredInstallPrompt = null;
  dismissInstallBanner();
}

function dismissInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (banner) banner.remove();
  sessionStorage.setItem('cc-install-dismissed', '1');
}

// Also show iOS-specific instructions (Safari doesn't fire beforeinstallprompt)
function checkIOSInstallHint() {
  const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const dismissed = sessionStorage.getItem('cc-install-dismissed');
  if (isIOS && !isStandalone && !dismissed) {
    const existing = document.getElementById('install-banner');
    if (existing) return; // Android banner already showing
    const banner = document.createElement('div');
    banner.id = 'install-banner';
    banner.innerHTML = `
      <div class="install-banner-content">
        <div style="display:flex;align-items:center;gap:10px;flex:1">
          <span style="font-size:24px">📲</span>
          <div>
            <div class="semi" style="font-size:13px">Install CrewCast</div>
            <div class="text-xs text-muted">Tap <strong>Share</strong> ↗ then <strong>"Add to Home Screen"</strong></div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="dismissInstallBanner()" style="padding:4px 8px;font-size:16px">&times;</button>
      </div>
    `;
    document.body.appendChild(banner);
  }
}
setTimeout(checkIOSInstallHint, 2000);

// ── Register Service Worker for PWA ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    .then(reg => {
      console.log('Service Worker registered');
      // Check for push notification support
      if (API.isLoggedIn() && 'PushManager' in window) {
        subscribeToPush(reg);
      }
    })
    .catch(err => console.log('SW registration failed:', err));
}

async function subscribeToPush(reg) {
  try {
    const { key } = await API.getVapidKey();
    if (!key) return;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

    await API.subscribePush(subscription);
    console.log('Push subscription saved');
  } catch (err) {
    console.log('Push subscription failed:', err);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
