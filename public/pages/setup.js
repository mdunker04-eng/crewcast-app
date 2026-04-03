// ═══════════════════════════════════════════════════════
// CrewCast — Invite Setup Page
// First-time PIN setup for new employees
// ═══════════════════════════════════════════════════════

function renderSetup(app, params) {
  const token = params.token;

  app.innerHTML = `
    <div class="login-page">
      <div class="login-logo">CrewCast</div>
      <div class="login-sub">Set up your account</div>
      <div class="login-box">
        <div class="card">
          <p class="text-sm mb-3">Welcome! Create a 4-6 digit PIN to access your schedule. You'll use your phone number and this PIN to sign in.</p>
        </div>
        <div class="form-group">
          <label class="form-label">Create Your PIN (4-6 digits)</label>
          <input type="password" id="setup-pin" class="form-input pin-input" placeholder="----" maxlength="6" inputmode="numeric">
        </div>
        <div class="form-group">
          <label class="form-label">Confirm PIN</label>
          <input type="password" id="setup-pin-confirm" class="form-input pin-input" placeholder="----" maxlength="6" inputmode="numeric">
        </div>
        <button id="setup-btn" class="btn btn-primary btn-block" onclick="handleSetup('${token}')">Set Up My Account</button>
      </div>
    </div>
  `;

  document.getElementById('setup-pin-confirm').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSetup(token);
  });
}

async function handleSetup(inviteToken) {
  const pin = document.getElementById('setup-pin').value;
  const pinConfirm = document.getElementById('setup-pin-confirm').value;
  const btn = document.getElementById('setup-btn');

  if (!pin || pin.length < 4) {
    UI.toast('PIN must be at least 4 digits', 'error');
    return;
  }
  if (pin !== pinConfirm) {
    UI.toast('PINs don\'t match', 'error');
    return;
  }

  btn.textContent = 'Setting up...';
  btn.disabled = true;

  try {
    const data = await API.setup(inviteToken, pin);
    API.setAuth(data.token, data.user);
    UI.toast(`Welcome, ${data.user.firstName}! You're all set.`);
    Router.navigate('/', true);
  } catch (err) {
    UI.toast(err.message, 'error');
    btn.textContent = 'Set Up My Account';
    btn.disabled = false;
  }
}
