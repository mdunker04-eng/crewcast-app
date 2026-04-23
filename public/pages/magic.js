// ═══════════════════════════════════════════════════════
// CrewCast — Magic Link Landing Page
// Consumes /m/:token → creates session → redirects
// ═══════════════════════════════════════════════════════

async function renderMagic(app, params) {
  const token = params.token;

  app.innerHTML = `
    <div class="login-page">
      <div class="login-brand">
        <div class="login-logo">CrewCast</div>
        <div class="login-sub">Signing you in…</div>
      </div>
      <div class="login-box" id="magic-box">
        <div class="card" style="text-align:center;padding:20px">
          <div style="font-size:36px;margin-bottom:10px">🔐</div>
          <div class="semi" style="font-size:15px;margin-bottom:4px">One moment…</div>
          <p class="text-xs text-muted">Verifying your sign-in link.</p>
        </div>
      </div>
    </div>
  `;

  if (!token) {
    showMagicError('That link looks invalid. Go back and request a new one.');
    return;
  }

  try {
    const data = await API.magicConsume(token);
    API.setAuth(data.token, data.user);

    // Load feature flags
    try { API.features = await API.getFeatures(); } catch (e) { API.features = {}; }

    UI.toast(`Welcome, ${data.user.firstName}!`);

    // Route based on role
    if (data.user.role === 'admin' || data.user.role === 'owner') {
      Router.navigate('/admin', true);
    } else {
      Router.navigate('/', true);
    }
  } catch (err) {
    showMagicError(err.message || 'Sign-in failed.');
  }
}

function showMagicError(message) {
  document.getElementById('magic-box').innerHTML = `
    <div class="card" style="text-align:center;padding:20px">
      <div style="font-size:36px;margin-bottom:10px">⚠️</div>
      <div class="semi" style="font-size:15px;margin-bottom:8px">Link expired or invalid</div>
      <p class="text-sm text-muted mb-3">${message}</p>
      <button class="btn btn-primary btn-block"
        onclick="Router.navigate('/login')">Request a new link</button>
    </div>
  `;
}
