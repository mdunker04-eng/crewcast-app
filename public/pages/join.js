// ═══════════════════════════════════════════════════════
// CrewCast — QR / Invite Join Page
// Employee scans a poster QR or taps an SMS invite link.
// Phone in → session out. No PIN required.
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
            <p class="text-sm">Enter the phone number your manager has on file for you. We'll get you signed in instantly.</p>
          </div>
          <div class="form-group">
            <label class="form-label">Your Phone Number</label>
            <input type="tel" id="join-phone" class="form-input"
              placeholder="(555) 123-4567" inputmode="tel"
              oninput="formatJoinPhone(this)">
          </div>
          <button id="join-find-btn" class="btn btn-primary btn-block"
            onclick="joinFindAndSetup('${slug}')">Get Started</button>
          <p class="text-center text-muted text-xs mt-3" style="line-height:1.4">
            By tapping <strong>Get Started</strong> you agree to receive
            shift-related text messages from CrewCast (schedules, reminders,
            swap requests) at the phone number above. Msg &amp; data rates may
            apply. Reply <strong>STOP</strong> to unsubscribe,
            <strong>HELP</strong> for help. See our
            <a href="/sms-program" style="color:var(--purple-light)">SMS Program</a>,
            <a href="/privacy" style="color:var(--purple-light)">Privacy Policy</a>,
            and <a href="/terms" style="color:var(--purple-light)">Terms</a>.
          </p>
          <div style="text-align:center;margin-top:16px">
            <span class="text-xs text-muted">Returning user?</span>
            <a href="/login" class="text-xs"
              style="color:var(--purple-light);margin-left:4px"
              onclick="event.preventDefault();Router.navigate('/login')">Sign in</a>
          </div>
        </div>

        <div id="join-step-done" style="display:none">
          <div style="text-align:center;padding:20px 0">
            <div style="font-size:48px;margin-bottom:12px">🎉</div>
            <div class="semi" style="font-size:18px;margin-bottom:8px">You're all set, <span id="join-welcome-name"></span>!</div>
            <p class="text-sm text-muted mb-3">Your account is ready. You can now view your schedule, clock in, and more.</p>
            <button class="btn btn-primary btn-block" onclick="Router.navigate('/', true)">Go to My Dashboard</button>
            <div class="card" style="margin-top:16px;text-align:left">
              <div class="semi text-xs mb-1">📲 Install the App</div>
              <p class="text-xs text-muted">For the best experience, add CrewCast to your home screen. Tap the share button, then "Add to Home Screen".</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  document.getElementById('join-phone').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinFindAndSetup(slug);
  });
}

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

async function joinFindAndSetup(slug) {
  const phone = document.getElementById('join-phone').value.replace(/\D/g, '').slice(-10);
  const btn = document.getElementById('join-find-btn');

  if (!phone || phone.length !== 10) {
    UI.toast('Please enter a valid 10-digit phone number', 'error');
    return;
  }

  btn.textContent = 'Signing you in...';
  btn.disabled = true;

  try {
    // Look up employee
    const lookup = await API.post('/api/auth/join-lookup', { phone, businessSlug: slug });

    // Complete setup (no PIN needed) → get session
    const data = await API.setup(lookup.inviteToken);
    API.setAuth(data.token, data.user);

    // Load feature flags
    try { API.features = await API.getFeatures(); } catch (e) { API.features = {}; }

    document.getElementById('join-step-phone').style.display = 'none';

    // Reuse the same install-prominent landing as the /invite/<token> path.
    // setup.js exposes renderSetupSuccess(user) globally; we just need a
    // container with id="setup-box" for it to render into.
    const done = document.getElementById('join-step-done');
    done.style.display = 'block';
    done.innerHTML = '<div id="setup-box"></div>';
    if (typeof renderSetupSuccess === 'function') {
      renderSetupSuccess(data.user);
    } else {
      document.getElementById('setup-box').innerHTML = `
        <div style="text-align:center;padding:20px 0">
          <div style="font-size:48px;margin-bottom:12px">🎉</div>
          <div class="semi" style="font-size:18px;margin-bottom:8px">You're all set, ${data.user.firstName}!</div>
          <button class="btn btn-primary btn-block" onclick="Router.navigate('/', true)">Go to My Dashboard</button>
        </div>
      `;
    }
  } catch (err) {
    UI.toast(err.message, 'error');
    btn.textContent = 'Get Started';
    btn.disabled = false;
  }
}
