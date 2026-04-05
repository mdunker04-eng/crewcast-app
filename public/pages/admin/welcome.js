// ═══════════════════════════════════════════════════════
// CrewCast — Admin Welcome / Getting Started Page
// Shows on first login or when setup steps incomplete
// ═══════════════════════════════════════════════════════

async function renderAdminWelcome(app) {
  app.innerHTML = UI.adminShell('welcome', `
    <div class="page">
      <div id="admin-welcome">${UI.loading()}</div>
    </div>
  `);
  const main = document.getElementById('admin-welcome');

  try {
    // Load current state to determine checklist progress
    const [stations, employees, settings] = await Promise.all([
      API.getStations(),
      API.getEmployees(),
      API.getSettings().catch(() => ({})),
    ]);

    const schedules = []; // We'll check if any schedules exist
    let hasSchedules = false;
    try {
      const s = await API.getSchedules();
      hasSchedules = s && s.length > 0;
    } catch (e) { /* no schedules yet */ }

    const steps = [
      {
        id: 'settings',
        title: 'Complete your Settings',
        desc: 'Fill in business name, operating hours, and scheduling rules.',
        done: !!(settings.businessName && settings.operatingHoursOpen),
        action: '/admin/settings',
        actionLabel: 'Open Settings',
        icon: '⚙️',
      },
      {
        id: 'stations',
        title: 'Set up stations',
        desc: 'Add the work areas where employees get assigned (e.g., Register, Kitchen, Floor).',
        done: stations.filter(s => s.active).length >= 2,
        action: '/admin/stations',
        actionLabel: 'Manage Stations',
        icon: '📍',
      },
      {
        id: 'employees',
        title: 'Add your team',
        desc: 'Add employees and assign them to stations they\'re trained on. Each gets an invite link.',
        done: employees.filter(e => e.active && e.role !== 'admin' && e.role !== 'owner').length >= 1,
        action: '/admin/employees',
        actionLabel: 'Manage Team',
        icon: '👥',
      },
      {
        id: 'schedule',
        title: 'Create your first schedule',
        desc: 'Pick dates and use Auto-Fill to assign employees based on availability and preferences.',
        done: hasSchedules,
        action: '/admin/schedules',
        actionLabel: 'Create Schedule',
        icon: '📅',
      },
      {
        id: 'share',
        title: 'Share with your team',
        desc: 'Send employees the app link so they can view schedules, set availability, and swap shifts.',
        done: false, // Manual step, never auto-completes
        action: null,
        actionLabel: null,
        icon: '📲',
      },
    ];

    const completedCount = steps.filter(s => s.done).length;
    const totalSteps = steps.length;
    const progressPct = Math.round((completedCount / totalSteps) * 100);
    const userName = API.user ? API.user.firstName : 'there';

    main.innerHTML = `
        <!-- Welcome Header -->
        <div style="text-align:center;padding:8px 0 24px">
          <h1 style="font-size:24px;margin-bottom:6px">Welcome to CrewCast, ${userName}! 👋</h1>
          <p class="text-muted" style="font-size:14px">Let's get your workforce scheduling up and running.</p>
        </div>

        <!-- Progress Bar -->
        <div class="card" style="margin-bottom:20px">
          <div class="flex items-center justify-between mb-2">
            <span class="semi text-sm">Setup Progress</span>
            <span class="text-sm" style="color:${progressPct === 100 ? 'var(--green-text)' : 'var(--purple-light)'}">${completedCount}/${totalSteps} complete</span>
          </div>
          <div style="background:var(--bg-primary);border-radius:6px;height:8px;overflow:hidden">
            <div style="background:${progressPct === 100 ? 'var(--green)' : 'var(--purple)'};height:100%;width:${progressPct}%;border-radius:6px;transition:width .5s ease"></div>
          </div>
          ${progressPct === 100 ? '<p class="text-xs text-center mt-2" style="color:var(--green-text)">All set! You\'re ready to start scheduling.</p>' : ''}
        </div>

        <!-- Checklist Steps -->
        <div style="display:grid;gap:10px;margin-bottom:20px">
          ${steps.map((step, idx) => `
            <div class="card" style="padding:14px 16px;border-left:3px solid ${step.done ? 'var(--green)' : idx === completedCount ? 'var(--purple)' : 'var(--border)'}">
              <div class="flex items-center gap-3">
                <div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;background:${step.done ? 'var(--green-bg)' : idx === completedCount ? 'var(--purple-bg)' : 'var(--bg-primary)'}">${step.done ? '✅' : step.icon}</div>
                <div style="flex:1;min-width:0">
                  <div class="semi text-sm" style="color:${step.done ? 'var(--green-text)' : 'var(--text-primary)'}">
                    ${step.done ? '<s>' : ''}${step.title}${step.done ? '</s>' : ''}
                  </div>
                  <div class="text-xs text-muted" style="margin-top:2px">${step.desc}</div>
                </div>
                ${step.action && !step.done ? `<button class="btn btn-sm ${idx === completedCount ? 'btn-primary' : 'btn-secondary'}" onclick="Router.navigate('${step.action}')" style="flex-shrink:0">${step.actionLabel}</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Share Section (always visible) -->
        <div class="card" style="background:var(--purple-bg);border-color:rgba(167,139,250,.25)">
          <div class="flex items-center gap-2 mb-2">
            <span style="font-size:18px">📲</span>
            <div class="semi text-sm" style="color:var(--purple-light)">Share with Your Team</div>
          </div>
          <p class="text-xs text-muted mb-3">Send this link to employees. They can install it on their phones as an app.</p>
          <div class="flex gap-2" style="flex-wrap:wrap">
            <input type="text" class="form-input text-xs" value="https://crewcast-app-production.up.railway.app" readonly onclick="this.select()" style="flex:1;min-width:200px">
            <button class="btn btn-primary btn-sm" onclick="copyAppLink()">Copy Link</button>
          </div>
          <div class="text-xs text-muted mt-2">
            <strong>iPhone:</strong> Share → "Add to Home Screen" &nbsp;|&nbsp; <strong>Android:</strong> Tap install banner or menu → "Install app"
          </div>
        </div>

        <!-- Skip to Dashboard -->
        <div style="text-align:center;margin-top:20px">
          <button class="btn btn-ghost" onclick="Router.navigate('/admin')">Skip to Dashboard →</button>
        </div>
    `;
  } catch (err) {
    main.innerHTML = `<div class="page"><div class="card"><p class="text-red">${err.message}</p></div></div>`;
  }
}

function copyAppLink() {
  navigator.clipboard.writeText('https://crewcast-app-production.up.railway.app')
    .then(() => UI.toast('Link copied!'))
    .catch(() => UI.toast('Couldn\'t copy — select and copy manually', 'error'));
}
