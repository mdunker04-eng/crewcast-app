// ═══════════════════════════════════════════════════════
// CrewCast — Invite Setup Page (legacy /invite/:token)
// Now PIN-less. Consumes the invite token directly → session.
// New primary path is /join/:slug (phone lookup), but legacy SMS
// invite links still point here.
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

    document.getElementById('setup-box').innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:48px;margin-bottom:12px">🎉</div>
        <div class="semi" style="font-size:18px;margin-bottom:8px">You're all set, ${data.user.firstName}!</div>
        <p class="text-sm text-muted mb-3">Your account is ready.</p>
        <button class="btn btn-primary btn-block"
          onclick="Router.navigate('/', true)">Go to My Dashboard</button>
        <div class="card" style="margin-top:16px;text-align:left">
          <div class="semi text-xs mb-1">📲 Install the App</div>
          <p class="text-xs text-muted">For the best experience, add CrewCast to your home screen. Tap the share button, then "Add to Home Screen".</p>
        </div>
      </div>
    `;
  } catch (err) {
    showSetupError(err.message || 'Setup failed.');
  }
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
