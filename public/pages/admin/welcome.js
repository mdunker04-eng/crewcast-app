// ═══════════════════════════════════════════════════════
// CrewCast — Admin Welcome / Getting Started Page
// Shows on first login or when setup steps incomplete
// Auto-advances to next incomplete step
// ═══════════════════════════════════════════════════════

let welcomeSteps = [];
let _templates = [];

async function renderAdminWelcome(app) {
  app.innerHTML = UI.adminShell('welcome', `
    <div class="page">
      <div id="admin-welcome">${UI.loading()}</div>
    </div>
  `);
  const main = document.getElementById('admin-welcome');

  try {
    const [stations, employees, settings, templates] = await Promise.all([
      API.getStations(),
      API.getEmployees(),
      API.getSettings().catch(() => ({})),
      API.getTemplates().catch(() => []),
    ]);
    _templates = templates;

    let hasSchedules = false;
    try {
      const s = await API.getSchedules();
      hasSchedules = s && s.length > 0;
    } catch (e) {}

    const activeStations = stations.filter(s => s.active);
    const activeEmployees = employees.filter(e => e.active && e.role !== 'admin' && e.role !== 'owner');

    welcomeSteps = [
      {
        id: 'settings',
        title: 'Complete your Settings',
        desc: 'Fill in business name, operating hours, and scheduling rules.',
        done: !!(settings.businessName && settings.defaultOpenTime),
        action: '/admin/settings',
        icon: '⚙️',
        doneDetail: settings.businessName ? `Business: ${settings.businessName}` : '',
      },
      {
        id: 'stations',
        title: 'Set up stations',
        desc: 'Add the stations where staff get assigned (e.g., Host Stand, Server Section, Grill).',
        done: activeStations.length >= 2,
        action: '/admin/stations',
        icon: '📍',
        doneDetail: activeStations.length > 0 ? `${activeStations.length} station${activeStations.length > 1 ? 's' : ''} active` : '',
      },
      {
        id: 'employees',
        title: 'Add your team',
        desc: 'Add employees and assign them to stations they\'re trained on. Each gets an invite link.',
        done: activeEmployees.length >= 1,
        action: '/admin/employees',
        icon: '👥',
        doneDetail: activeEmployees.length > 0 ? `${activeEmployees.length} team member${activeEmployees.length > 1 ? 's' : ''} added` : '',
      },
      {
        id: 'schedule',
        title: 'Create your first schedule',
        desc: 'Pick dates and use Auto-Fill to assign employees based on availability and preferences.',
        done: hasSchedules,
        action: '/admin/schedules',
        icon: '📅',
        doneDetail: hasSchedules ? 'First schedule created' : '',
      },
      {
        id: 'share',
        title: 'Share with your team',
        desc: 'Send employees the app link so they can view schedules, set availability, and swap shifts.',
        done: false,
        action: null,
        icon: '📲',
        doneDetail: '',
      },
    ];

    const completedCount = welcomeSteps.filter(s => s.done).length;
    const totalSteps = welcomeSteps.length;
    const progressPct = Math.round((completedCount / totalSteps) * 100);
    const userName = API.user ? API.user.firstName : 'there';
    const nextStepIdx = welcomeSteps.findIndex(s => !s.done);

    // Show Quick Start only if no stations set up yet
    const showQuickStart = activeStations.length === 0 && _templates.length > 0;

    main.innerHTML = `
        <!-- Welcome Header -->
        <div style="text-align:center;padding:8px 0 24px">
          <h1 style="font-size:24px;margin-bottom:6px">Welcome to CrewCast, ${userName}! 👋</h1>
          <p class="text-muted" style="font-size:14px">Let's get your workforce scheduling up and running.</p>
        </div>

        ${showQuickStart ? `
        <!-- Quick Start: Choose Business Type -->
        <div class="card" style="margin-bottom:20px;border:2px solid rgba(124,58,237,.3);background:var(--purple-bg)">
          <div class="flex items-center gap-2 mb-2">
            <span style="font-size:18px">⚡</span>
            <div class="semi text-sm" style="color:var(--purple-light)">Quick Start — Choose Your Industry</div>
          </div>
          <p class="text-xs text-muted mb-3">Select your business type to auto-load stations, categories, and staff targets. You can customize everything after.</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px" id="template-grid">
            ${_templates.map(t => `
              <button class="card" onclick="applyTemplate('${t.id}')" style="padding:12px;text-align:center;cursor:pointer;border:1px solid var(--border);background:var(--bg-card);transition:all .15s" onmouseenter="this.style.borderColor='var(--purple)'" onmouseleave="this.style.borderColor='var(--border)'">
                <div style="font-size:28px;margin-bottom:4px">${t.icon}</div>
                <div class="semi text-xs">${t.label}</div>
                <div class="text-xs text-muted">${t.stationCount} stations</div>
              </button>
            `).join('')}
            <button class="card" onclick="Router.navigate('/admin/stations')" style="padding:12px;text-align:center;cursor:pointer;border:1px dashed var(--border);background:var(--bg-card)">
              <div style="font-size:28px;margin-bottom:4px">✏️</div>
              <div class="semi text-xs">Start Blank</div>
              <div class="text-xs text-muted">Add your own</div>
            </button>
          </div>
        </div>
        ` : ''}

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
          ${welcomeSteps.map((step, idx) => {
            const isNext = idx === nextStepIdx;
            const isFuture = !step.done && !isNext;
            return `
            <div class="card" id="welcome-step-${idx}" style="padding:14px 16px;border-left:3px solid ${step.done ? 'var(--green)' : isNext ? 'var(--purple)' : 'var(--border)'}${isNext ? ';box-shadow:0 0 0 1px rgba(124,58,237,.3)' : ''}">
              <div class="flex items-center gap-3">
                <div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;background:${step.done ? 'var(--green-bg)' : isNext ? 'var(--purple-bg)' : 'var(--bg-primary)'}">${step.done ? '✅' : step.icon}</div>
                <div style="flex:1;min-width:0">
                  <div class="semi text-sm" style="color:${step.done ? 'var(--green-text)' : isFuture ? 'var(--text-muted)' : 'var(--text-primary)'}">
                    ${step.title}
                  </div>
                  <div class="text-xs text-muted" style="margin-top:2px">${step.done && step.doneDetail ? step.doneDetail : step.desc}</div>
                </div>
                ${step.action && isNext ? `<button class="btn btn-primary btn-sm" onclick="Router.navigate('${step.action}')" style="flex-shrink:0">Continue →</button>` : ''}
                ${step.action && step.done ? `<button class="btn btn-ghost btn-sm" onclick="Router.navigate('${step.action}')" style="flex-shrink:0">Edit</button>` : ''}
              </div>
            </div>
          `;}).join('')}
        </div>

        <!-- Share Section (always visible) -->
        <div class="card" style="background:var(--purple-bg);border-color:rgba(167,139,250,.25)">
          <div class="flex items-center gap-2 mb-2">
            <span style="font-size:18px">📲</span>
            <div class="semi text-sm" style="color:var(--purple-light)">Share with Your Team</div>
          </div>
          <p class="text-xs text-muted mb-3">Send this link to employees. They can install it on their phones as an app.</p>
          <div class="flex gap-2" style="flex-wrap:wrap">
            <input type="text" class="form-input text-xs" value="https://mindful-strength-production-071e.up.railway.app" readonly onclick="this.select()" style="flex:1;min-width:200px">
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

    // Auto-scroll to the next incomplete step
    if (nextStepIdx > 0) {
      setTimeout(() => {
        const el = document.getElementById('welcome-step-' + nextStepIdx);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }

  } catch (err) {
    main.innerHTML = `<div class="page"><div class="card"><p class="text-red">${err.message}</p></div></div>`;
  }
}

async function applyTemplate(templateId) {
  const btn = event.target.closest('button');
  const grid = document.getElementById('template-grid');
  if (grid) grid.querySelectorAll('button').forEach(b => b.disabled = true);
  if (btn) btn.innerHTML = '<div class="semi text-xs">Loading...</div>';

  try {
    // Fetch template stations from server
    const stations = await API.getDefaultStations(templateId);
    if (!stations || stations.length === 0) {
      UI.toast('No stations in template', 'error');
      return;
    }
    // Bulk import them
    const result = await API.bulkAddStations(stations);
    UI.toast(`Added ${result.added} stations! ${result.skipped ? `(${result.skipped} already existed)` : ''}`);
    // Save the business type in settings
    const tpl = _templates.find(t => t.id === templateId);
    if (tpl) {
      await API.updateSettings({ industryType: templateId, industryLabel: tpl.label }).catch(() => {});
    }
    // Re-render the page to update progress
    renderAdminWelcome(document.getElementById('app'));
  } catch (err) {
    UI.toast(err.message, 'error');
    if (grid) grid.querySelectorAll('button').forEach(b => b.disabled = false);
  }
}

function copyAppLink() {
  navigator.clipboard.writeText('https://mindful-strength-production-071e.up.railway.app')
    .then(() => UI.toast('Link copied!'))
    .catch(() => UI.toast('Couldn\'t copy — select and copy manually', 'error'));
}
