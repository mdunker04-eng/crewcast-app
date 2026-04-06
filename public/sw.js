// ═══════════════════════════════════════════════════════
// CrewCast — Service Worker
// Caching + Push Notifications
// ═══════════════════════════════════════════════════════

const CACHE_NAME = 'crewcast-v15';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/components/api.js',
  '/components/router.js',
  '/components/ui.js',
  '/pages/login.js',
  '/pages/onboard.js',
  '/pages/setup.js',
  '/pages/employee/home.js',
  '/pages/employee/schedule.js',
  '/pages/employee/availability.js',
  '/pages/employee/swaps.js',
  '/pages/employee/preferences.js',
  '/pages/employee/welcome.js',
  '/pages/admin/dashboard.js',
  '/pages/admin/employees.js',
  '/pages/admin/create-schedule.js',
  '/pages/admin/schedule-detail.js',
  '/pages/admin/stations.js',
  '/pages/admin/settings.js',
  '/pages/admin/welcome.js',
  '/pages/admin/demo-views.js',
  '/manifest.json',
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip API requests (always go to network)
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'CrewCast', body: 'You have an update!' };

  try {
    data = event.data.json();
  } catch (e) {
    data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-72.png',
      data: { url: data.url || '/' },
      vibrate: [100, 50, 100],
      requireInteraction: true,
    })
  );
});

// Notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});
