// ═══════════════════════════════════════════════════════
// CrewCast — QR Join Page
// Employee scans a poster QR / visits join link,
// enters phone number → matched to employee record → sets PIN
// ═══════════════════════════════════════════════════════

function renderJoin(app, params) {
  const slug = params.slug || '';

  app.innerHTML = `
    <div class="login-page">
      <div class="login-logo">CrewCast</div>
      <div class="login-sub">Join your team</div>
      <div class="login-box">
        <div id="join-step-phone">
          <div class="card" style="margin-bottom:16px">
            <p class="text-sm">Enter the phone number your manager has on file for you. We'll find your account and get you set up in seconds.</p>
          </div>
          <div class="form-group">
            <label class="form-label">Your Phone Number</label>
            <input type="tel" id="join-phone" class="form-input" placeholder="(555) 123-4567" inputmode="tel"
              oninput="formatJoinPhone(this)">
          </div>
          <button id="join-find-btn" class="btn btn-primary btn-block" onclick="joinFindEmployee('${slug}')">Find My Account</button>
          <div style="text-align:center;margin-top:16px">
            <span class="text-xs text-muted">Already set up?</span>
            <a href="/login" class="text-xs" style="color:var(--purple-light);margin-left:4px" onclick="event.preventDefault();Router.navigate('/login')">Sign in</a>
          </div>
        </div>

        <div id="join-step-pin" style="display:none">
          <div class="card" style="margin-bottom:16px">
            <p class="text-sm">Welcome, <strong id="join-emp-name"></strong>! Create a PIN to secure your account.</p>
          </div>
          <div class="form-group">
            <label class="form-label">Create Your PIN (4-6 digits)</label>
            <input type="password" id="join-pin" class="form-input pin-input" placeholder="----" maxlength="6" inputmode="numeric">
          </div>
          <div class="form-group">
            <label class="form-label">Confirm PIN</label>
            <input type="password" id="join-pin-confirm" class="form-input pin-input" placeholder="----" maxlength="6" inputmode="numeric">
          </div>
          <button id="join-setup-btn" class="btn btn-primary btn-block" onclick="joinSetupPin()">Set Up My Account</button>
        </div>

        <div id="join-step-done" style="display:none">
          <div style="text-align:center;padding:20px 0">
            <div style="font-size:48px;margin-bottom:12px">🎉</div>
            <div class="semi" style="font-size:18px;margin-bottom:8px">You're all set!</div>
            <p class="text-sm text-muted mb-3">Your account is ready. You can now view your schedule, clock in, and more.</p>
            <button class="btn btn-primary btn-block" onclick="Router.navigate('/', true)">Go to My Dashboard</button>
            <div class="card" style="margin-top:16px;text-align:left">
              <div class="semi text-xs mb-1">📲 Install the App</div>
              <p class="text-xs text-muted">For the best experience, add CrewCast to your home screen. On your phone, tap the share button and choose "Add to Home Screen".</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Enter key handlers
  document.getElementById('join-phone').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinFindEmployee(slug);
  });
}

let _joinInviteToken = null;

function formatJoinPhone(input) {
  let digits = input.value.replace(/\D/g, '').slice(0, 10);
  if (digits.length >= 7) {
    input.value = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  } else if (digits.length >= 4) {
    input.value = `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  } else if (digits.length > 0) {
    input.value = `(${digits}`;
  }
}

async function joinFindEmployee(slug) {
  const phone = document.getElementById('join-phone').value.replace(/\D/g, '').slice(-10);
  const btn = document.getElementById('join-find-btn');

  if (!phone || phone.length !== 10) {
    UI.toast('Please enter a valid 10-digit phone number', 'error');
    return;
  }

  btn.textContent = 'Looking you up...';
  btn.disabled = true;

  try {
    const data = await API.post('/api/auth/join-lookup', { phone, businessSlug: slug });

    if (data.alreadySetUp) {
      UI.toast('Your account is already set up! Redirecting to login...');
      setTimeout(() => Router.navigate('/login'), 1500);
      return;
    }

    _joinInviteToken = data.inviteToken;
    document.getElementById('join-emp-name').textContent = data.firstName;
    document.getElementById('join-step-phone').style.display = 'none';
    document.getElementById('join-step-pin').style.display = 'block';

    // Focus PIN field
    setTimeout(() => document.getElementById('join-pin').focus(), 100);

    // Enter key on confirm
    document.getElementById('join-pin-confirm').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') joinSetupPin();
    });
  } catch (err) {
    UI.toast(err.message, 'error');
    btn.textContent = 'Find My Account';
    btn.disabled = false;
  }
}

async function joinSetupPin() {
  const pin = document.getElementById('join-pin').value;
  const pinConfirm = document.getElementById('join-pin-confirm').value;
  const btn = document.getElementById('join-setup-btn');

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
    const data = await API.setup(_joinInviteToken, pin);
    API.setAuth(data.token, data.user);

    document.getElementById('join-step-pin').style.display = 'none';
    document.getElementById('join-step-done').style.display = 'block';
  } catch (err) {
    UI.toast(err.message, 'error');
    btn.textContent = 'Set Up My Account';
    btn.disabled = false;
  }
}
