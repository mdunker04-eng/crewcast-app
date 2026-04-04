// ═══════════════════════════════════════════════════════
// CrewCast — App Entry Point
// Routes + PWA registration
// ═══════════════════════════════════════════════════════

// ── Route definitions ──

// Auth routes
Router.add('/login', (app) => renderLogin(app));
Router.add('/invite/:token', (app, params) => renderSetup(app, params));

// Employee routes
Router.add('/', (app) => {
  if (!API.isLoggedIn()) return Router.navigate('/login', true);
  if (API.isAdmin()) return Router.navigate('/admin', true);
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
  renderEmployeeSwaps(app);
});

// Admin routes
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

// ── Initialize router ──
Router.init();

// ── Register Service Worker for PWA ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
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
