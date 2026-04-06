// ═══════════════════════════════════════════════════════
// CrewCast — Customer Onboarding / Business Registration
// Public signup page for new businesses
// ═══════════════════════════════════════════════════════

function renderOnboard(app) {
  document.body.classList.remove('admin-mode');
  app.innerHTML = `
    <div class="login-page" style="justify-content:flex-start;padding-top:40px">
      <div class="login-logo">CrewCast</div>
      <div class="login-sub" style="margin-bottom:12px">Smart Workforce Scheduling</div>

      <div style="max-width:400px;width:100%">
        <!-- Steps indicator -->
        <div id="onboard-steps" class="flex justify-between mb-4" style="padding:0 20px">
          <div class="onboard-step active" id="step-ind-1"><span>1</span> Business</div>
          <div class="onboard-step" id="step-ind-2"><span>2</span> Your Info</div>
          <div class="onboard-step" id="step-ind-3"><span>3</span> PIN</div>
        </div>

        <!-- Step 1: Business Info -->
        <div id="onboard-step-1" class="card">
          <h2 style="margin-bottom:4px">Tell us about your business</h2>
          <p class="text-xs text-muted mb-4">We'll customize CrewCast for your team.</p>

          <div class="form-group">
            <label class="form-label">Business Name *</label>
            <input type="text" id="ob-biz-name" class="form-input" placeholder="e.g., Sunny Acres Farm" autofocus>
          </div>
          <div class="form-group">
            <label class="form-label">Business Email</label>
            <input type="email" id="ob-biz-email" class="form-input" placeholder="admin@yourbusiness.com">
          </div>

          <button class="btn btn-primary btn-block" onclick="onboardNext(1)">Next →</button>
        </div>

        <!-- Step 2: Admin Info -->
        <div id="onboard-step-2" class="card" style="display:none">
          <h2 style="margin-bottom:4px">Your details</h2>
          <p class="text-xs text-muted mb-4">You'll be the admin for this account.</p>

          <div class="flex gap-2">
            <div class="form-group" style="flex:1">
              <label class="form-label">First Name *</label>
              <input type="text" id="ob-first" class="form-input" placeholder="First">
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Last Name *</label>
              <input type="text" id="ob-last" class="form-input" placeholder="Last">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number *</label>
            <input type="tel" id="ob-phone" class="form-input" placeholder="(555) 123-4567" autocomplete="tel">
          </div>

          <div class="flex gap-2">
            <button class="btn btn-secondary" style="flex:1" onclick="onboardBack(2)">← Back</button>
            <button class="btn btn-primary" style="flex:2" onclick="onboardNext(2)">Next →</button>
          </div>
        </div>

        <!-- Step 3: Create PIN -->
        <div id="onboard-step-3" class="card" style="display:none">
          <h2 style="margin-bottom:4px">Create your PIN</h2>
          <p class="text-xs text-muted mb-4">You'll use this to log in. Keep it simple — 4 to 6 digits.</p>

          <div class="form-group">
            <label class="form-label">PIN *</label>
            <input type="password" id="ob-pin" class="form-input pin-input" placeholder="----" maxlength="6" inputmode="numeric">
          </div>
          <div class="form-group">
            <label class="form-label">Confirm PIN *</label>
            <input type="password" id="ob-pin2" class="form-input pin-input" placeholder="----" maxlength="6" inputmode="numeric">
          </div>

          <div class="flex gap-2">
            <button class="btn btn-secondary" style="flex:1" onclick="onboardBack(3)">← Back</button>
            <button class="btn btn-primary" style="flex:2" id="ob-submit" onclick="submitOnboard()">Create My Account</button>
          </div>
        </div>

        <p class="text-center text-muted text-xs mt-3">
          Already have an account? <a href="#" onclick="Router.navigate('/login');return false" style="color:var(--purple-light);text-decoration:none">Sign in</a>
        </p>
      </div>
    </div>
  `;

  // Auto-format phone number
  document.getElementById('ob-phone').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 10) v = v.slice(0, 10);
    if (v.length >= 6) v = `(${v.slice(0,3)}) ${v.slice(3,6)}-${v.slice(6)}`;
    else if (v.length >= 3) v = `(${v.slice(0,3)}) ${v.slice(3)}`;
    e.target.value = v;
  });

  // Enter key advances steps
  document.getElementById('ob-biz-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') onboardNext(1); });
  document.getElementById('ob-phone').addEventListener('keydown', (e) => { if (e.key === 'Enter') onboardNext(2); });
  document.getElementById('ob-pin2').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitOnboard(); });
}

function onboardNext(step) {
  if (step === 1) {
    const name = document.getElementById('ob-biz-name').value.trim();
    if (!name) { UI.toast('Enter your business name', 'error'); return; }
  }
  if (step === 2) {
    const first = document.getElementById('ob-first').value.trim();
    const last = document.getElementById('ob-last').value.trim();
    const phone = document.getElementById('ob-phone').value.replace(/\D/g, '');
    if (!first || !last) { UI.toast('Enter your first and last name', 'error'); return; }
    if (phone.length !== 10) { UI.toast('Enter a valid 10-digit phone number', 'error'); return; }
  }

  document.getElementById(`onboard-step-${step}`).style.display = 'none';
  document.getElementById(`onboard-step-${step + 1}`).style.display = 'block';
  document.getElementById(`step-ind-${step + 1}`).classList.add('active');

  // Focus first input of next step
  const nextInputs = document.getElementById(`onboard-step-${step + 1}`).querySelectorAll('input');
  if (nextInputs.length) nextInputs[0].focus();
}

function onboardBack(step) {
  document.getElementById(`onboard-step-${step}`).style.display = 'none';
  document.getElementById(`onboard-step-${step - 1}`).style.display = 'block';
  document.getElementById(`step-ind-${step}`).classList.remove('active');
}

async function submitOnboard() {
  const pin = document.getElementById('ob-pin').value;
  const pin2 = document.getElementById('ob-pin2').value;

  if (!pin || pin.length < 4) { UI.toast('PIN must be at least 4 digits', 'error'); return; }
  if (pin !== pin2) { UI.toast('PINs don\'t match', 'error'); return; }

  const btn = document.getElementById('ob-submit');
  btn.textContent = 'Creating account...';
  btn.disabled = true;

  try {
    const data = await API.post('/api/auth/register', {
      businessName: document.getElementById('ob-biz-name').value.trim(),
      email: document.getElementById('ob-biz-email').value.trim(),
      firstName: document.getElementById('ob-first').value.trim(),
      lastName: document.getElementById('ob-last').value.trim(),
      phone: document.getElementById('ob-phone').value,
      pin,
    });

    API.setAuth(data.token, data.user);
    try { API.features = await API.getFeatures(); } catch (e) { API.features = {}; }

    UI.toast(`Welcome to CrewCast, ${data.user.firstName}!`);
    Router.navigate('/admin/welcome', true);
  } catch (err) {
    UI.toast(err.message, 'error');
    btn.textContent = 'Create My Account';
    btn.disabled = false;
  }
}
