// ═══════════════════════════════════════════════════════
// CrewCast — Employee Welcome / Getting Started Page
// Shows on first login to guide new employees
// ═══════════════════════════════════════════════════════

async function renderEmployeeWelcome(app) {
  const userName = API.user ? API.user.firstName : 'there';

  let hasAvailability = false;
  let hasPreferences = false;
  try {
    const prefs = await API.getMyStationPrefs();
    hasPreferences = prefs && prefs.length > 0;
  } catch (e) { /* not set yet */ }

  const steps = [
    {
      title: 'View your schedule',
      desc: 'Check what shifts you\'ve been assigned and confirm or decline them.',
      done: false,
      action: '/schedule',
      actionLabel: 'My Schedule',
      icon: '📅',
    },
    {
      title: 'Set your availability',
      desc: 'Let your manager know which days and times you can work.',
      done: false,
      action: '/availability',
      actionLabel: 'Set Availability',
      icon: '🕐',
    },
    {
      title: 'Rank your station preferences',
      desc: 'Tell us where you\'d prefer to work — we\'ll try to match you.',
      done: hasPreferences,
      action: '/preferences',
      actionLabel: 'Set Preferences',
      icon: '⭐',
    },
    {
      title: 'Install on your phone',
      desc: 'Add CrewCast to your home screen so it works like a regular app.',
      done: window.matchMedia('(display-mode: standalone)').matches,
      action: null,
      actionLabel: null,
      icon: '📲',
    },
  ];

  const completedCount = steps.filter(s => s.done).length;

  app.innerHTML = `
    <div class="page">
      <!-- Welcome Header -->
      <div style="text-align:center;padding:8px 0 24px">
        <div style="font-size:40px;margin-bottom:8px">👋</div>
        <h1 style="font-size:22px;margin-bottom:6px">Welcome, ${userName}!</h1>
        <p class="text-muted" style="font-size:14px">Here's how to get the most out of CrewCast.</p>
      </div>

      <!-- Featured: Turn on Notifications -->
      ${UI.notifPromptCard ? UI.notifPromptCard() : ''}

      <!-- Checklist Steps -->
      <div style="display:grid;gap:10px;margin-bottom:20px">
        ${steps.map((step, idx) => `
          <div class="card" style="padding:14px 16px;border-left:3px solid ${step.done ? 'var(--green)' : idx === 0 ? 'var(--purple)' : 'var(--border)'}">
            <div class="flex items-center gap-3">
              <div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;background:${step.done ? 'var(--green-bg)' : 'var(--bg-primary)'}">${step.done ? '✅' : step.icon}</div>
              <div style="flex:1;min-width:0">
                <div class="semi text-sm">${step.title}</div>
                <div class="text-xs text-muted" style="margin-top:2px">${step.desc}</div>
              </div>
              ${step.action && !step.done ? `<button class="btn btn-sm ${idx === 0 ? 'btn-primary' : 'btn-secondary'}" onclick="Router.navigate('${step.action}')" style="flex-shrink:0">${step.actionLabel}</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Install Instructions -->
      <div class="card" style="background:var(--purple-bg);border-color:rgba(167,139,250,.25)">
        <div class="flex items-center gap-2 mb-2">
          <span style="font-size:18px">📲</span>
          <div class="semi text-sm" style="color:var(--purple-light)">Install CrewCast</div>
        </div>
        <p class="text-xs text-muted">
          <strong>iPhone:</strong> Tap the Share button → "Add to Home Screen"<br>
          <strong>Android:</strong> Tap the install banner at the bottom, or menu → "Install app"
        </p>
      </div>

      <!-- Go to Home -->
      <div style="text-align:center;margin-top:20px">
        <button class="btn btn-primary btn-block" onclick="markEmployeeWelcomeSeen(); Router.navigate('/')">Got it — let's go! →</button>
      </div>
    </div>
    ${UI.employeeNav('welcome')}
  `;
}

function markEmployeeWelcomeSeen() {
  localStorage.setItem('crewcast_welcome_seen', '1');
}

function shouldShowEmployeeWelcome() {
  return !localStorage.getItem('crewcast_welcome_seen');
}
