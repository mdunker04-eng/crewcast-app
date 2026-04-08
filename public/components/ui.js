// ═══════════════════════════════════════════════════════
// CrewCast — UI Helpers
// ═══════════════════════════════════════════════════════

const UI = {
  // Show toast notification
  toast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  },

  // Loading spinner
  loading() {
    return '<div class="loading"><div class="spinner"></div> Loading...</div>';
  },

  // Empty state
  empty(icon, title, subtitle) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-title">${title}</div>
        <div class="text-sm text-muted">${subtitle || ''}</div>
      </div>
    `;
  },

  // Format date
  formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },

  // Format time
  formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  },

  // Status badge
  statusBadge(status) {
    const map = {
      confirmed: ['badge-green', 'Confirmed'],
      declined: ['badge-red', 'Declined'],
      pending: ['badge-amber', 'Pending'],
      published: ['badge-green', 'Published'],
      draft: ['badge-amber', 'Draft'],
      closed: ['badge-blue', 'Closed'],
      open: ['badge-amber', 'Open'],
      accepted: ['badge-green', 'Accepted'],
      cancelled: ['badge-red', 'Cancelled'],
      'swap-pending': ['badge-purple', 'Swap Pending'],
    };
    const [cls, label] = map[status] || ['badge-blue', status];
    return `<span class="badge ${cls}">${label}</span>`;
  },

  // Bottom navigation for employees
  employeeNav(active) {
    const f = API.features || {};
    const tabs = [
      { id: 'home', icon: SVG.home, label: 'Home', path: '/' },
      { id: 'schedule', icon: SVG.calendar, label: 'Schedule', path: '/schedule' },
      { id: 'timeclock', icon: SVG.clock, label: 'Clock In', path: '/timeclock' },
      { id: 'availability', icon: '📅', label: 'Availability', path: '/availability' },
      f.allowSwaps !== false ? { id: 'swaps', icon: SVG.swap, label: 'Swaps', path: '/swaps' } : null,
      f.employeeRankStations !== false ? { id: 'preferences', icon: SVG.star, label: 'Prefs', path: '/preferences' } : null,
    ].filter(Boolean);
    return `
      <nav class="bottom-nav">
        ${tabs.map(t => `
          <button class="nav-tab ${active === t.id ? 'active' : ''}" onclick="Router.navigate('${t.path}')">
            ${t.icon}
            <span>${t.label}</span>
          </button>
        `).join('')}
      </nav>
    `;
  },

  // Bottom navigation for admin (mobile fallback)
  adminNav(active) {
    const tabs = [
      { id: 'dashboard', icon: SVG.grid, label: 'Home', path: '/admin' },
      { id: 'stations', icon: SVG.station, label: 'Stations', path: '/admin/stations' },
      { id: 'schedules', icon: SVG.calendar, label: 'Schedules', path: '/admin/schedules' },
      { id: 'employees', icon: SVG.users, label: 'Team', path: '/admin/employees' },
    ];
    return `
      <nav class="bottom-nav">
        ${tabs.map(t => `
          <button class="nav-tab ${active === t.id ? 'active' : ''}" onclick="Router.navigate('${t.path}')">
            ${t.icon}
            <span>${t.label}</span>
          </button>
        `).join('')}
      </nav>
    `;
  },

  // Admin sidebar (desktop) — wraps the entire admin page
  adminSidebar(active) {
    const businessName = (API.user && API.user.businessName) || 'CrewCast';
    const items = [
      { section: 'Admin' },
      { id: 'welcome', icon: '🚀', label: 'Getting Started', path: '/admin/welcome' },
      { id: 'dashboard', icon: SVG.grid, label: 'Dashboard', path: '/admin' },
      { id: 'stations', icon: SVG.station, label: 'Stations', path: '/admin/stations' },
      { id: 'schedules', icon: SVG.calendar, label: 'Schedules', path: '/admin/schedules' },
      { id: 'employees', icon: SVG.users, label: 'Employees', path: '/admin/employees' },
      { id: 'settings', icon: '⚙️', label: 'Settings', path: '/admin/settings' },
      { section: 'Schedule' },
      { id: 'assignments', icon: '📋', label: 'Assignments', path: '/admin/assignments' },
      { id: 'demo-dashboard', icon: '📊', label: 'Dashboard', path: '/admin/demo/dashboard' },
      { id: 'demo-crowdpulse', icon: '🎯', label: 'CrowdPulse', path: '/admin/demo/crowdpulse' },
      { id: 'demo-stations', icon: '🏗️', label: 'Station View', path: '/admin/demo/stations' },
      { id: 'demo-coverage', icon: '📈', label: 'Coverage Grid', path: '/admin/demo/coverage' },
      { section: 'Actions' },
      { id: 'demo-storm', icon: '🌧️', label: 'Storm Mode', path: '/admin/demo/storm', style: 'color:#F87171' },
      { id: 'demo-replacement', icon: '⚡', label: 'Auto-Replace', path: '/admin/demo/replacement', badge: '3' },
      { id: 'demo-cascade', icon: '🎬', label: 'Live Demo', path: '/admin/demo/cascade' },
      { id: 'demo-swaps', icon: '🔄', label: 'Shift Swaps', path: '/admin/demo/swaps' },
      { id: 'demo-sms', icon: '📱', label: 'SMS Center', path: '/admin/demo/sms' },
      { section: 'Time Clock' },
      { id: 'time-dashboard', icon: '📊', label: 'Live Dashboard', path: '/admin/time-dashboard' },
      { id: 'timesheet', icon: '📋', label: 'Timesheets', path: '/admin/timesheet' },
      { id: 'kiosk', icon: '📷', label: 'Kiosk Mode', path: '/admin/kiosk' },
      { section: 'Restaurant' },
      { id: 'pay-roles', icon: '💰', label: 'Pay Roles', path: '/admin/pay-roles' },
      { id: 'compliance', icon: '🛡️', label: 'Compliance', path: '/admin/compliance' },
      { section: 'Insights' },
      { id: 'demo-costs', icon: '💰', label: 'Cost of Gaps', path: '/admin/demo/costs' },
      { id: 'demo-alerts', icon: '🚨', label: 'Alerts', path: '/admin/demo/alerts', badge: '5' },
      { section: 'Team' },
      { id: 'demo-roster', icon: '👥', label: 'Roster (60)', path: '/admin/demo/roster' },
      { id: 'demo-employee', icon: '👤', label: 'Employee View', path: '/admin/demo/employee' },
    ];

    return `
      <div class="admin-sidebar">
        <div class="sidebar-logo">
          <h2>🌾 CrewCast</h2>
          <div class="sub">${businessName}</div>
        </div>
        ${items.map(item => {
          if (item.section) return `<div class="nav-section">${item.section}</div>`;
          if (item.divider) return `<div class="sidebar-divider"></div>`;
          const cls = active === item.id ? 'sidebar-item active' : 'sidebar-item';
          const style = item.style ? ` style="${item.style}"` : '';
          const badge = item.badge ? `<span class="nav-badge">${item.badge}</span>` : '';
          if (item.external) {
            return `<a class="${cls}"${style} href="${item.path}" target="_blank">${item.icon} ${item.label}${badge}</a>`;
          }
          return `<div class="${cls}"${style} onclick="Router.navigate('${item.path}')">${item.icon} ${item.label}${badge}</div>`;
        }).join('')}
      </div>
    `;
  },

  // Wrap an admin page with sidebar + bottom nav
  adminShell(active, pageContent) {
    document.body.classList.add('admin-mode');
    return `
      ${this.adminSidebar(active)}
      <div class="admin-main">
        ${pageContent}
        ${this.adminNav(active)}
      </div>
    `;
  },

  // Show modal
  showModal(title, content, actions = '') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-title">${title}</div>
        ${content}
        ${actions ? `<div class="btn-group mt-3">${actions}</div>` : ''}
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  },

  closeModal() {
    const m = document.querySelector('.modal-overlay');
    if (m) m.remove();
  },
};

// ── Continue Setup Banner (shown after completing a step) ──
// Figures out the next incomplete setup step and navigates directly there
async function showContinueSetup() {
  // Remove any existing banner
  const existing = document.getElementById('continue-setup-banner');
  if (existing) existing.remove();

  // Determine the next incomplete step
  let nextPath = '/admin/welcome'; // fallback
  let nextLabel = 'Continue Setup';
  try {
    const [stations, employees, settings] = await Promise.all([
      API.getStations(),
      API.getEmployees(),
      API.getSettings().catch(() => ({})),
    ]);
    let hasSchedules = false;
    try { const s = await API.getSchedules(); hasSchedules = s && s.length > 0; } catch(e) {}

    const activeStations = stations.filter(s => s.active);
    const activeEmployees = employees.filter(e => e.active && e.role !== 'admin' && e.role !== 'owner');

    const steps = [
      { done: !!(settings.businessName && settings.defaultOpenTime), path: '/admin/settings', label: 'Set up Settings' },
      { done: activeStations.length >= 2, path: '/admin/stations', label: 'Set up Stations' },
      { done: activeEmployees.length >= 1, path: '/admin/employees', label: 'Add Employees' },
      { done: hasSchedules, path: '/admin/schedules', label: 'Create Schedule' },
    ];
    const next = steps.find(s => !s.done);
    if (next) { nextPath = next.path; nextLabel = next.label; }
    else { nextPath = '/admin'; nextLabel = 'Go to Dashboard'; }
  } catch(e) {}

  const banner = document.createElement('div');
  banner.id = 'continue-setup-banner';
  banner.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:150;animation:slideUp .3s ease;max-width:calc(100% - 32px)';
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid var(--green);border-radius:12px;padding:12px 16px;box-shadow:0 4px 20px rgba(0,0,0,.4)">
      <span style="color:var(--green-text);font-size:14px;font-weight:600">✅ Done!</span>
      <button class="btn btn-primary btn-sm" onclick="Router.navigate('${nextPath}');document.getElementById('continue-setup-banner')?.remove()">${nextLabel} →</button>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('continue-setup-banner')?.remove()" style="padding:4px 8px;font-size:16px">&times;</button>
    </div>
  `;
  document.body.appendChild(banner);
}

// ── SVG Icons ──
const SVG = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17,1 21,5 17,9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7,23 3,19 7,15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  chevLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,18 9,12 15,6"/></svg>',
  chevRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>',
  station: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M9 17h1"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>',
  demo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
};
