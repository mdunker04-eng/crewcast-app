// ═══════════════════════════════════════════════════════
// CrewCast — Login Page
// Phone-first for employees (magic SMS link).
// Admin / owner accounts still use PIN (higher-privilege path).
// ═══════════════════════════════════════════════════════

function renderLogin(app) {
  app.innerHTML = `
    <div class="login-page">
      <div class="login-brand">
        <div class="login-logo">CrewCast</div>
        <div class="login-sub">Smart Workforce Scheduling</div>
      </div>

      <div class="login-box">

        <!-- Employee flow (default) -->
        <div id="login-employee">
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="tel" id="login-phone" class="form-input"
              placeholder="(555) 123-4567" autocomplete="tel" inputmode="tel">
          </div>
          <button id="login-link-btn" class="btn btn-primary btn-block"
            onclick="handleMagicLink()">Text me a sign-in link</button>
          <p class="text-center text-muted text-xs mt-3">
            We'll send you a link — no password needed.
          </p>

          <div id="login-link-sent" class="card"
            style="display:none;margin-top:16px;padding:14px;text-align:center">
            <div style="font-size:32px;margin-bottom:8px">📱</div>
            <div class="semi" style="font-size:15px;margin-bottom:4px">Check your texts</div>
            <p class="text-xs text-muted">
              Tap the link we just sent. It expires in 15 minutes.
            </p>
          </div>

          <div style="text-align:center;margin-top:20px">
            <a href="#" onclick="showInviteLinkBox();return false"
              class="text-xs" style="color:var(--purple-light)">
              Have an invite link? Tap to paste →
            </a>
          </div>

          <!-- Invite link paste box (hidden by default) -->
          <div id="login-invite-box" class="card" style="display:none;margin-top:14px;padding:12px">
            <label class="form-label text-xs">Paste your invite link</label>
            <input type="url" id="login-invite-input" class="form-input"
              placeholder="https://crewcast-app-production.up.railway.app/invite/..."
              autocomplete="off" autocapitalize="off" spellcheck="false">
            <button class="btn btn-primary btn-block mt-2" onclick="handleInviteLinkPaste()">Sign In with Invite</button>
            <p class="text-xs text-muted mt-2">
              Use this if SMS isn't working or you got the link from your manager. Pasting any
              <code>/invite/...</code> URL will sign you in.
            </p>
          </div>

          <div style="text-align:center;margin-top:14px">
            <a href="#" onclick="showAdminLogin();return false"
              class="text-xs" style="color:var(--purple-light)">
              Admin? Sign in with PIN →
            </a>
          </div>
        </div>

        <!-- Admin flow (hidden by default) -->
        <div id="login-admin" style="display:none">
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="tel" id="login-admin-phone" class="form-input"
              placeholder="(555) 123-4567" autocomplete="tel" inputmode="tel">
          </div>
          <div class="form-group">
            <label class="form-label">PIN</label>
            <input type="password" id="login-admin-pin" class="form-input pin-input"
              placeholder="----" maxlength="6" inputmode="numeric"
              autocomplete="current-password">
          </div>
          <button id="login-admin-btn" class="btn btn-primary btn-block"
            onclick="handleAdminLogin()">Sign In</button>
          <div style="text-align:center;margin-top:20px">
            <a href="#" onclick="showEmployeeLogin();return false"
              class="text-xs" style="color:var(--purple-light)">
              ← Back to employee sign in
            </a>
          </div>
        </div>

        <p class="text-center text-xs mt-3">
          <a href="#" onclick="Router.navigate('/signup');return false"
            style="color:var(--purple-light);text-decoration:none">
            New business? Sign up here →
          </a>
        </p>
      </div>
    </div>
  `;

  // Auto-format phone numbers
  const fmtPhone = (input) => {
    let v = input.value.replace(/\D/g, '').slice(0, 10);
    if (v.length >= 7) input.value = `(${v.slice(0,3)}) ${v.slice(3,6)}-${v.slice(6)}`;
    else if (v.length >= 4) input.value = `(${v.slice(0,3)}) ${v.slice(3)}`;
    else if (v.length > 0) input.value = `(${v}`;
    else input.value = '';
  };
  const phoneEl = document.getElementById('login-phone');
  phoneEl.addEventListener('input', () => fmtPhone(phoneEl));
  phoneEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleMagicLink(); });

  const adminPhoneEl = document.getElementById('login-admin-phone');
  adminPhoneEl.addEventListener('input', () => fmtPhone(adminPhoneEl));
  document.getElementById('login-admin-pin').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAdminLogin();
  });
}

function showAdminLogin() {
  document.getElementById('login-employee').style.display = 'none';
  document.getElementById('login-admin').style.display = 'block';
  setTimeout(() => document.getElementById('login-admin-phone').focus(), 50);
}

function showEmployeeLogin() {
  document.getElementById('login-admin').style.display = 'none';
  document.getElementById('login-employee').style.display = 'block';
  setTimeout(() => document.getElementById('login-phone').focus(), 50);
}

function showInviteLinkBox() {
  const box = document.getElementById('login-invite-box');
  if (!box) return;
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
  if (box.style.display === 'block') {
    setTimeout(() => document.getElementById('login-invite-input').focus(), 50);
  }
}

function handleInviteLinkPaste() {
  const raw = (document.getElementById('login-invite-input').value || '').trim();
  if (!raw) {
    UI.toast('Paste your invite link first', 'error');
    return;
  }
  // Accept either a full URL (https://...../invite/<token>) or just the token.
  const m = raw.match(/\/invite\/([A-Za-z0-9_-]+)/);
  const token = m ? m[1] : raw;
  if (!/^[A-Za-z0-9_-]{8,}$/.test(token)) {
    UI.toast("That doesn't look like a valid invite link", 'error');
    return;
  }
  // Navigate within the SPA so we stay in PWA scope (iOS keeps storage isolated).
  Router.navigate('/invite/' + token);
}

async function handleMagicLink() {
  const phone = document.getElementById('login-phone').value.replace(/\D/g, '').slice(-10);
  const btn = document.getElementById('login-link-btn');

  if (!phone || phone.length !== 10) {
    UI.toast('Enter a valid 10-digit phone number', 'error');
    return;
  }

  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    await API.magicLink(phone);
    document.getElementById('login-link-sent').style.display = 'block';
    btn.textContent = 'Link sent ✓';
  } catch (err) {
    UI.toast(err.message, 'error');
    btn.textContent = 'Text me a sign-in link';
    btn.disabled = false;
  }
}

async function handleAdminLogin() {
  const phone = document.getElementById('login-admin-phone').value;
  const pin = document.getElementById('login-admin-pin').value;
  const btn = document.getElementById('login-admin-btn');

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

    try { API.features = await API.getFeatures(); } catch (e) { API.features = {}; }

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
