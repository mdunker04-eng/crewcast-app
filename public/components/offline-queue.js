// ═══════════════════════════════════════════════════════
// CrewCast — Offline Queue for Clock Punches
// Uses IndexedDB to durably store punches that fail to reach the server.
// On reconnect (or next user action), replays them with dedupe tokens.
//
// This is the single most important reliability feature for Steve's
// flaky orchard workforce — lost punches destroy trust.
// ═══════════════════════════════════════════════════════

const OfflineQueue = (() => {
  const DB_NAME = 'crewcast-offline';
  const DB_VERSION = 1;
  const STORE = 'pending_punches';
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  // Generate a stable client punch id — UUIDv4-ish, used as dedupe key server-side
  function newPunchId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
  }

  async function enqueue(punch) {
    const db = await openDB();
    const record = {
      id: punch.id || newPunchId(),
      kind: punch.kind, // 'clock_in' | 'clock_out' | 'scan' | 'kiosk_scan'
      url: punch.url,   // API path to replay to
      body: punch.body, // request body (will include clientPunchId + punchTime)
      createdAt: Date.now(),
      attempts: 0,
      lastError: null
    };
    // Ensure the body carries the dedupe id + original punch time
    if (!record.body.clientPunchId) record.body.clientPunchId = record.id;
    if (!record.body.punchTime) record.body.punchTime = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function list() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function count() {
    const items = await list();
    return items.length;
  }

  async function remove(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function updateRecord(rec) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Wrap a fetch. On network failure, enqueue. On success, return server response.
  // On server error that we should retry (5xx, network-level), enqueue.
  // On client error (4xx), do NOT enqueue — return error to caller.
  async function sendOrQueue({ url, body, kind }) {
    const clientPunchId = newPunchId();
    const punchTime = new Date().toISOString();
    const fullBody = { ...body, clientPunchId, punchTime };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API.token ? { 'Authorization': 'Bearer ' + API.token } : {})
        },
        body: JSON.stringify(fullBody)
      });
      if (res.ok) {
        return { queued: false, response: await res.json() };
      }
      if (res.status >= 500) {
        // Server error — queue for retry
        await enqueue({ id: clientPunchId, kind, url, body: fullBody });
        return { queued: true, reason: 'server_error_' + res.status };
      }
      // 4xx — client error, don't queue (would just fail forever)
      const errBody = await res.json().catch(() => ({}));
      return { queued: false, error: errBody.error || ('HTTP ' + res.status) };
    } catch (netErr) {
      // Network failure / offline — queue
      await enqueue({ id: clientPunchId, kind, url, body: fullBody });
      return { queued: true, reason: 'network_error' };
    }
  }

  // Replay all queued punches. Returns { sent, failed, remaining }.
  async function flush() {
    const items = await list();
    items.sort((a, b) => a.createdAt - b.createdAt);
    let sent = 0, failed = 0;

    for (const rec of items) {
      try {
        const res = await fetch(rec.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(API.token ? { 'Authorization': 'Bearer ' + API.token } : {})
          },
          body: JSON.stringify(rec.body)
        });
        if (res.ok) {
          await remove(rec.id);
          sent++;
        } else if (res.status >= 400 && res.status < 500) {
          // Permanent failure — log and drop so we don't retry forever
          console.warn('Dropping permanently-failed punch:', rec, res.status);
          rec.attempts += 1;
          rec.lastError = `HTTP ${res.status}`;
          // Drop after 3 attempts on 4xx
          if (rec.attempts >= 3) await remove(rec.id);
          else await updateRecord(rec);
          failed++;
        } else {
          rec.attempts += 1;
          rec.lastError = `HTTP ${res.status}`;
          await updateRecord(rec);
          failed++;
        }
      } catch (err) {
        rec.attempts += 1;
        rec.lastError = err.message;
        await updateRecord(rec);
        failed++;
        // Stop on network error — no point retrying the rest
        break;
      }
    }

    const remaining = (await list()).length;
    return { sent, failed, remaining };
  }

  // Auto-flush when we come back online
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      console.log('[OfflineQueue] Back online — flushing queue');
      flush().then(r => {
        if (r.sent > 0) {
          console.log(`[OfflineQueue] Replayed ${r.sent} punches, ${r.remaining} remaining`);
          if (window.UI && UI.toast) UI.toast(`Synced ${r.sent} offline punch${r.sent > 1 ? 'es' : ''}`, 'success');
        }
      });
    });
  }

  return { enqueue, list, count, remove, flush, sendOrQueue, newPunchId };
})();

// Expose globally so pages can use it
if (typeof window !== 'undefined') window.OfflineQueue = OfflineQueue;
