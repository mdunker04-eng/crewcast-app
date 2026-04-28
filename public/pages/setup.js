// ═══════════════════════════════════════════════════════
// CrewCast — Invite Setup Page (legacy /invite/:token)
// Now PIN-less. Consumes the invite token directly → session.
// New primary path is /join/:slug (phone lookup), but legacy SMS
// invite links still point here.
//
// Adoption strategy: when a new employee taps an invite link, this
// is the single highest-engagement moment. Use it. Don't just say
// "you're set" and bounce them to the dashboard — actively walk
// them through installing the PWA + turning on notifications,
// because those are the things that make the app actually useful.
// ═══════════════════════════════════════════════════════

async function renderSetup(app, params) {
  const token = params.token;

  app.innerHTML = `
    <div class="login-page">
      <div class="login-logo">CrewCast</div>
      <div class="login-sub">Setting up your account…</div>
      <div class="login-box" id="setup-box">
        <div class="card" style="text-align:center;padding:20px">
          <div style="font-size:36px;margin-bottom:10px">👋</div>
          <div class="semi" style="font-size:15px;margin-bottom:4px">One moment…</div>
          <p class="text-xs text-muted">Getting your account ready.</p>
        </div>
      </div>
    </div>
  `;

  if (!token) {
    showSetupError('That link looks invalid. Ask your manager to resend.');
    return;
  }

  try {
    const data = await API.setup(token); // no PIN
    API.setAuth(data.token, data.user);

    try { API.features = await API.getFeatures(); } catch (e) { API.features = {}; }

    renderSetupSuccess(data.user);
  } catch (err) {
    showSetupError(err.message || 'Setup failed.');
  }
}

function renderSetupSuccess(user) {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  // Already installed → quick win, send them to the dashboard.
  if (isStandalone) {
    document.getElementById('setup-box').innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:48px;margin-bottom:12px">🎉</div>
        <div class="semi" style="font-size:18px;margin-bottom:8px">You're all set, ${escapeHtml(user.firstName)}!</div>
        <p class="text-sm text-muted mb-3">${escapeHtml(user.businessName || 'CrewCast')}</p>
        <button class="btn btn-primary btn-block"
          onclick="Router.navigate('/', true)">Go to My Dashboard</button>
      </div>
    `;
    return;
  }

  // In a regular browser — push the install hard.
  let stepsHtml = '';
  if (isIOS) {
    stepsHtml = `
      <ol style="margin:0;padding-left:22px;line-height:1.7">
        <li>Tap the <strong>Share button</strong> at the bottom of Safari (the square with an up-arrow).</li>
        <li>Scroll down and tap <strong>"Add to Home Screen."</strong></li>
        <li>Tap <strong>Add</strong> in the top-right corner.</li>
        <li>Close Safari and tap the new <strong>CrewCast</strong> icon on your home screen.</li>
      </ol>
      <p class="text-xs text-muted mt-3" style="text-align:center">
        Make sure you're in <strong>Safari</strong> — Chrome on iPhone can't install the app.
      </p>
    `;
  } else if (isAndroid) {
    stepsHtml = `
      <ol style="margin:0;padding-left:22px;line-height:1.7">
        <li>Tap the <strong>install banner</strong> at the bottom of Chrome.</li>
        <li>If you don't see it, tap the <strong>three-dot menu</strong> (top right) → <strong>"Install app."</strong></li>
        <li>Tap <strong>Install</strong> to confirm.</li>
        <li>Tap the new <strong>CrewCast</strong> icon on your home screen.</li>
      </ol>
    `;
  } else {
    stepsHtml = `
      <p class="text-sm text-muted">For the best experience, install CrewCast on your phone:</p>
      <ul style="margin:8px 0 0;padding-left:22px;line-height:1.6">
        <li><strong>iPhone:</strong> open this link in Safari → Share → Add to Home Screen</li>
        <li><strong>Android:</strong> open this link in Chrome → menu → Install app</li>
      </ul>
    `;
  }

  document.getElementById('setup-box').innerHTML = `
    <div style="text-align:center;padding:8px 0 16px">
      <div style="font-size:48px;margin-bottom:8px">🎉</div>
      <div class="semi" style="font-size:18px;margin-bottom:4px">Welcome, ${escapeHtml(user.firstName)}!</div>
      <p class="text-sm text-muted">${escapeHtml(user.businessName || 'CrewCast')}</p>
    </div>

    <!-- Featured: install -->
    <div class="card" style="margin-bottom:14px;padding:16px;background:var(--purple-bg);border:2px solid rgba(167,139,250,.45)">
      <div style="text-align:center;margin-bottom:10px">
        <div style="font-size:32px">📲</div>
        <div class="semi" style="font-size:16px;color:var(--purple-light);margin-top:4px">Install CrewCast — 30 seconds</div>
        <p class="text-xs text-muted" style="margin-top:4px">Get it on your home screen so it works like a real app — and so you actually get notified when shifts post or change.</p>
      </div>
      <div class="text-sm">${stepsHtml}</div>
    </div>

    <!-- Why install? -->
    <div class="card" style="margin-bottom:14px;padding:12px;background:rgba(30,41,59,.4)">
      <div class="semi text-xs mb-1">Why install?</div>
      <ul style="margin:4px 0 0;padding-left:20px;line-height:1.5;font-size:13px;color:var(--text-secondary)">
        <li>Get a notification the second a schedule is published or changed</li>
        <li>Tap once to confirm or decline shifts</li>
        <li>Request swaps right from your phone</li>
      </ul>
    </div>

    <!-- Skip-for-now (de-emphasized) -->
    <div style="text-align:center;margin-top:8px">
      <a href="#" onclick="Router.navigate('/', true);return false"
        class="text-xs" style="color:var(--text-muted);text-decoration:underline">
        Skip for now — open in browser
      </a>
    </div>
  `;
}

function showSetupError(message) {
  document.getElementById('setup-box').innerHTML = `
    <div class="card" style="text-align:center;padding:20px">
      <div style="font-size:36px;margin-bottom:10px">⚠️</div>
      <div class="semi" style="font-size:15px;margin-bottom:8px">Invite link issue</div>
      <p class="text-sm text-muted mb-3">${message}</p>
      <button class="btn btn-primary btn-block"
        onclick="Router.navigate('/login')">Go to Sign In</button>
    </div>
  `;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
