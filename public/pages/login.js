// ═══════════════════════════════════════════════════════
// CrewCast — Login Page
// ═══════════════════════════════════════════════════════

function renderLogin(app) {
  app.innerHTML = `
    <div class="login-page">
      <div class="login-brand">
        <div class="login-icon">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M16 4C9.4 4 4 9.4 4 16s5.4 12 12 12 12-5.4 12-12S22.6 4 16 4z" fill="none"/>
            <path d="M10 15.5L14 20L22 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="16" cy="16" r="10" stroke="white" stroke-width="1.5" opacity=".4"/>
            <path d="M16 6v2M16 24v2M6 16h2M24 16h2" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity=".3"/>
          </svg>
        </div>
        <div class="login-logo">CrewCast</div>
        <div class="login-sub">Smart Workforce Scheduling</div>
      </div>
      <div class="login-box">
        <div class="form-group">
          <label class="form-label">Phone Number</label>
          <input type="tel" id="login-phone" class="form-input" placeholder="(555) 123-4567" autocomplete="tel">
        </div>
        <div class="form-group">
          <label class="form-label">PIN</label>
          <input type="password" id="login-pin" class="form-input pin-input" placeholder="----" maxlength="6" inputmode="numeric" autocomplete="current-password">
        </div>
        <button id="login-btn" class="btn btn-primary btn-block" onclick="handleLogin()">Sign In</button>
        <p class="text-center text-muted text-xs mt-3">
          Got an invite link? Open it to set up your account.
        </p>
        <p class="text-center text-xs mt-2">
          <a href="#" onclick="Router.navigate('/signup');return false" style="color:var(--purple-light);text-decoration:none">New business? Sign up here →</a>
        </p>
      </div>
    </div>
  `;

  // Auto-format phone number
  document.getElementById('login-phone').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 10) v = v.slice(0, 10);
    if (v.length >= 6) v = `(${v.slice(0,3)}) ${v.slice(3,6)}-${v.slice(6)}`;
    else if (v.length >= 3) v = `(${v.slice(0,3)}) ${v.slice(3)}`;
    e.target.value = v;
  });

  // Enter key submits
  document.getElementById('login-pin').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
}

async function handleLogin() {
  const phone = document.getElementById('login-phone').value;
  const pin = document.getElementById('login-pin').value;
  const btn = document.getElementById('login-btn');

  if (!phone || !pin) {
    UI.toast('Enter your phone number and PIN', 'error');
    return;
  }

  btn.textContent = 'Signing in...';
  btn.disabled = true;

  try {
    const data = await API.login(phone, pin);
    API.setAuth(data.token, data.user);
    UI.toast(`Welcome, ${data.user.firstName}!`);

    // Load feature flags for nav visibility
    try { API.features = await API.getFeatures(); } catch (e) { API.features = {}; }

    // Route to correct page based on role
    if (data.user.role === 'admin' || data.user.role === 'owner') {
      Router.navigate('/admin', true);
    } else {
      Router.navigate('/', true);
    }
  } catch (err) {
    UI.toast(err.message, 'error');
    btn.textContent = 'Sign In';
    btn.disabled = false;
  }
}
