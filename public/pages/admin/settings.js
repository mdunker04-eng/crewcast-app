// ═══════════════════════════════════════════════════════
// CrewCast — Admin Settings / Onboarding
// Interactive questionnaire that saves to business settings
// ═══════════════════════════════════════════════════════

let _settingsData = {};
let _settingsDirty = {};

async function renderSettings(app) {
  app.innerHTML = UI.adminShell('settings', `
    <div class="page">
      <div class="page-header">
        <h1>Settings</h1>
        <p class="subtitle">Configure your CrewCAST instance — update anytime</p>
      </div>
      <div id="settings-content">${UI.loading()}</div>
    </div>
  `);

  try {
    _settingsData = await API.getSettings();
  } catch (e) {
    _settingsData = {};
  }
  _settingsDirty = {};
  renderSettingsSections();
}

function renderSettingsSections() {
  const s = _settingsData;
  const el = document.getElementById('settings-content');

  el.innerHTML = `
    <!-- Section nav pills -->
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px">
      ${['Business','Hours','Stations','Staffing','Scheduling','Preferences','Swaps','Weather','Communication','Onboarding','Reports','Branding'].map((label, i) =>
        `<a href="#settings-sec-${i}" class="btn btn-sm btn-secondary" style="font-size:11px;padding:4px 10px">${label}</a>`
      ).join('')}
    </div>

    <!-- 0. Business Basics -->
    <div class="card mb-4" id="settings-sec-0">
      <div class="card-title mb-3">🏢 Business Basics</div>
      ${settingsField('businessName', 'Business Name', 'text', 'e.g., Center Grove Apple Orchard')}
      ${settingsSelect('businessType', 'Business Type', [
        'Apple Orchard / Pumpkin Patch', 'Farm Market', 'Brewery / Winery', 'Restaurant',
        'Landscaping', 'Event Venue', 'Amusement / Attraction', 'Other'
      ])}
      ${settingsField('location', 'Location', 'text', 'Address or city/state')}
      ${settingsField('websiteUrl', 'Website URL', 'text', 'https://...')}
      ${settingsField('contactName', 'Primary Contact Name', 'text')}
      ${settingsField('contactPhone', 'Primary Contact Phone', 'tel')}
      ${settingsField('contactEmail', 'Primary Contact Email', 'email')}
    </div>

    <!-- 1. Operating Season & Hours -->
    <div class="card mb-4" id="settings-sec-1">
      <div class="card-title mb-3">🕐 Operating Season & Hours</div>
      ${settingsToggle('seasonal', 'Seasonal operation (not year-round)')}
      <div id="seasonal-dates" style="${s.seasonal ? '' : 'display:none'}">
        ${settingsField('seasonStart', 'Season Opens', 'date')}
        ${settingsField('seasonEnd', 'Season Closes', 'date')}
      </div>
      ${settingsField('defaultOpenTime', 'Default Opening Time', 'time', '', '09:00')}
      ${settingsField('defaultCloseTime', 'Default Closing Time', 'time', '', '17:00')}
      ${settingsToggle('weekendHoursDiffer', 'Weekend hours are different')}
      <div id="weekend-hours" style="${s.weekendHoursDiffer ? '' : 'display:none'}">
        ${settingsField('weekendOpenTime', 'Weekend Open', 'time', '', '08:00')}
        ${settingsField('weekendCloseTime', 'Weekend Close', 'time', '', '20:00')}
      </div>
      ${settingsNumber('arriveEarlyMinutes', 'Employees arrive early (minutes)', 0, 60, 15)}
    </div>

    <!-- 2. Stations -->
    <div class="card mb-4" id="settings-sec-2">
      <div class="card-title mb-3">🏗️ Station Configuration</div>
      <p class="text-sm text-muted mb-3">Stations are managed on the <a href="#" onclick="Router.navigate('/admin/stations');return false" style="color:var(--purple)">Stations page</a>. These settings control station behavior.</p>
      ${settingsToggle('stationsRequireTraining', 'Some stations require training/certification')}
      ${settingsTextarea('trainingNotes', 'Training requirements by station', 'e.g., Food Stand requires food handler cert, Hayride requires CDL...')}
      ${settingsToggle('stationsVaryByDay', 'Some stations only open on certain days')}
    </div>

    <!-- 3. Staffing Model -->
    <div class="card mb-4" id="settings-sec-3">
      <div class="card-title mb-3">👥 Staffing Model</div>
      ${settingsNumber('totalEmployees', 'Total employees (approx)', 1, 999, 50)}
      ${settingsSelect('staffMix', 'Staff mix', [
        'Mostly part-time', 'Mostly full-time', 'Even split', 'All seasonal/temp'
      ])}
      ${settingsToggle('useShiftLeads', 'Use shift leads or supervisors')}
      <div id="shift-lead-opts" style="${s.useShiftLeads ? '' : 'display:none'}">
        ${settingsToggle('leadPerStation', 'Require at least one lead per station')}
        ${settingsToggle('leadsFullDay', 'Leads always work full-day shifts')}
      </div>
      ${settingsNumber('minSiteStaff', 'Minimum staff on-site at all times', 0, 100, 0)}
    </div>

    <!-- 4. Scheduling Rules -->
    <div class="card mb-4" id="settings-sec-4">
      <div class="card-title mb-3">📅 Scheduling Rules</div>
      ${settingsSelect('scheduleAdvance', 'Publish schedules how far in advance?', [
        '1 week', '2 weeks', '3 weeks', '1 month'
      ])}
      ${settingsNumber('minShiftHours', 'Minimum shift length (hours)', 1, 12, 4)}
      ${settingsNumber('maxShiftHours', 'Maximum shift length (hours)', 4, 16, 10)}
      ${settingsToggle('enforceOvertime', 'Enforce overtime rules')}
      <div id="overtime-opts" style="${s.enforceOvertime ? '' : 'display:none'}">
        ${settingsNumber('overtimeWeeklyHours', 'Weekly OT threshold (hours)', 20, 60, 40)}
        ${settingsNumber('overtimeDailyHours', 'Daily OT threshold (hours)', 6, 16, 8)}
      </div>
      ${settingsToggle('requireBreaks', 'Require scheduled breaks')}
      <div id="break-opts" style="${s.requireBreaks ? '' : 'display:none'}">
        ${settingsNumber('breakAfterHours', 'Break required after (hours)', 2, 8, 5)}
        ${settingsNumber('breakLengthMinutes', 'Break length (minutes)', 10, 60, 30)}
      </div>
      ${settingsToggle('allowDoubleShifts', 'Employees can work two stations in one day')}
      ${settingsToggle('allowSplitShifts', 'Allow split availability (e.g., morning + evening blocks)')}
      <div id="split-shift-note" style="${s.allowSplitShifts ? '' : 'display:none'}">
        <p class="text-xs text-muted" style="padding:0 0 8px 0">When enabled, employees can indicate multiple time blocks per day (e.g., 8–11am and 2–5pm). You decide whether to schedule them for split shifts.</p>
      </div>
      ${settingsNumber('maxConsecutiveDays', 'Max consecutive workdays', 1, 14, 6)}
    </div>

    <!-- 5. Employee Preferences -->
    <div class="card mb-4" id="settings-sec-5">
      <div class="card-title mb-3">⭐ Employee Preferences & Availability</div>
      ${settingsToggle('employeeSetAvailability', 'Employees can set their own availability', true)}
      ${settingsToggle('employeeRankStations', 'Employees can rank preferred stations', true)}
      ${settingsToggle('usePreferences', 'Use preference matching in auto-fill', true)}
      ${settingsToggle('fairnessRotation', 'Fairness rotation (spread top picks across employees)')}
      ${settingsToggle('employeeRequestDaysOff', 'Employees can request specific days off')}
      ${settingsNumber('availChangeNotice', 'Min notice for availability changes (days)', 0, 14, 1)}
    </div>

    <!-- 6. Shift Swaps -->
    <div class="card mb-4" id="settings-sec-6">
      <div class="card-title mb-3">🔄 Shift Swaps & Coverage</div>
      ${settingsToggle('allowSwaps', 'Allow shift swaps between employees', true)}
      ${settingsToggle('swapsRequireApproval', 'Shift swaps require admin approval', true)}
      ${settingsToggle('openShiftPickup', 'Employees can pick up open/uncovered shifts')}
      ${settingsSelect('calloffNotify', 'When someone calls off, notify:', [
        'Admin only', 'Admin + available staff', 'All staff'
      ])}
    </div>

    <!-- 7. Weather / Storm Mode -->
    <div class="card mb-4" id="settings-sec-7">
      <div class="card-title mb-3">🌧️ Weather / Storm Mode</div>
      ${settingsToggle('weatherAffectsStaffing', 'Weather conditions affect staffing', true)}
      <div id="weather-opts" style="${s.weatherAffectsStaffing !== false ? '' : 'display:none'}">
        ${settingsTextarea('weatherTriggers', 'What triggers reduced staffing?', 'e.g., rain, thunderstorms, extreme heat, below 40°F...')}
        ${settingsNumber('defaultStormCut', 'Default staff reduction (%)', 10, 90, 50)}
        ${settingsTextarea('alwaysOpenStations', 'Stations always staffed in bad weather', 'e.g., Country Store, Admission...')}
        ${settingsTextarea('firstToCloseStations', 'Stations first to close in bad weather', 'e.g., Corn Maze, Apple Picking...')}
        ${settingsSelect('stormModeAuth', 'Who can activate storm mode?', [
          'Owner only', 'Any admin', 'Admin + shift leads'
        ])}
      </div>
    </div>

    <!-- 8. Communication -->
    <div class="card mb-4" id="settings-sec-8">
      <div class="card-title mb-3">📱 Communication</div>
      ${settingsToggle('pushNotifications', 'Push notifications for new schedules', true)}
      ${settingsToggle('smsNotifications', 'SMS notifications (per-message cost)')}
      ${settingsToggle('notifyOnShiftChange', 'Notify employees when shifts change', true)}
      ${settingsToggle('groupAnnouncements', 'Enable group announcements to all staff', true)}
    </div>

    <!-- 9. Employee Onboarding -->
    <div class="card mb-4" id="settings-sec-9">
      <div class="card-title mb-3">🎓 Employee Onboarding</div>
      ${settingsSelect('employeeAddMethod', 'How are employees added?', [
        'Admin enters manually', 'Invite link (self-signup)', 'Bulk import', 'All of the above'
      ])}
      ${settingsToggle('inviteLinks', 'Send invite links for self-setup', true)}
      ${settingsToggle('requireTrainingBeforeAssign', 'New hires must complete station training before assignment')}
    </div>

    <!-- 10. Reports -->
    <div class="card mb-4" id="settings-sec-10">
      <div class="card-title mb-3">📊 Reports & Insights</div>
      ${settingsToggle('reportCoverage', 'Daily staffing coverage by station', true)}
      ${settingsToggle('reportHours', 'Weekly labor hours summary', true)}
      ${settingsToggle('reportAttendance', 'Attendance / no-show tracking')}
      ${settingsToggle('reportGaps', 'Station coverage gaps over time')}
      ${settingsToggle('reportCosts', 'Cost / payroll estimates')}
      ${settingsToggle('reportPrefRate', 'Employee preference fulfillment rate')}
      ${settingsSelect('reportAccess', 'Who can view reports?', [
        'Owner only', 'All admins'
      ])}
      ${settingsField('payrollExport', 'Export to payroll system?', 'text', 'e.g., QuickBooks, ADP, Gusto, None')}
    </div>

    <!-- 11. Branding -->
    <div class="card mb-4" id="settings-sec-11">
      <div class="card-title mb-3">🎨 Branding & Customization</div>
      ${settingsToggle('showLogo', 'Display business logo in the app')}
      ${settingsField('brandColor', 'Brand color (hex)', 'text', '#7C3AED')}
      ${settingsField('customDomain', 'Custom URL', 'text', 'e.g., schedule.yourfarm.com')}
      ${settingsField('termStation', 'Custom term for "Station"', 'text', 'e.g., Zone, Area, Post')}
      ${settingsField('termEmployee', 'Custom term for "Employee"', 'text', 'e.g., Crew Member, Team Member, Staff')}
    </div>

    <!-- Save button -->
    <div style="position:sticky;bottom:16px;z-index:10;padding:12px 0">
      <button class="btn btn-primary btn-block" id="settings-save-btn" onclick="saveAllSettings()" style="display:none">
        💾 Save Changes
      </button>
    </div>

    <!-- Open-ended -->
    <div class="card mb-4">
      <div class="card-title mb-3">💬 Anything Else?</div>
      ${settingsTextarea('painPoint', 'What\'s the #1 scheduling pain point you want CrewCAST to solve?', '')}
      ${settingsTextarea('wishList', 'Features you wish you had?', '')}
      ${settingsTextarea('uniqueRules', 'Any unique rules or policies we should know about?', '')}
    </div>

    <div style="height:20px"></div>
  `;

  // Wire up conditional toggles
  wireToggleVisibility('seasonal', 'seasonal-dates');
  wireToggleVisibility('weekendHoursDiffer', 'weekend-hours');
  wireToggleVisibility('useShiftLeads', 'shift-lead-opts');
  wireToggleVisibility('enforceOvertime', 'overtime-opts');
  wireToggleVisibility('requireBreaks', 'break-opts');
  wireToggleVisibility('allowSplitShifts', 'split-shift-note');
  wireToggleVisibility('weatherAffectsStaffing', 'weather-opts');
}

// ── Field Helpers ──

function settingsField(key, label, type, placeholder, defaultVal) {
  const val = _settingsData[key] || defaultVal || '';
  const phoneHandler = type === 'tel' ? `oninput="formatSettingsPhone(this)" ` : '';
  return `
    <div class="form-group">
      <label class="form-label">${label}</label>
      <input type="${type}" class="form-input settings-input" data-key="${key}"
        value="${val}" placeholder="${placeholder || (type === 'tel' ? '(555) 123-4567' : '')}"
        ${phoneHandler}onchange="markSettingDirty('${key}', this.value)">
    </div>
  `;
}

function formatSettingsPhone(input) {
  let digits = input.value.replace(/\D/g, '').substring(0, 10);
  if (digits.length >= 7) {
    input.value = '(' + digits.substring(0,3) + ') ' + digits.substring(3,6) + '-' + digits.substring(6);
  } else if (digits.length >= 4) {
    input.value = '(' + digits.substring(0,3) + ') ' + digits.substring(3);
  } else if (digits.length > 0) {
    input.value = '(' + digits;
  }
  markSettingDirty(input.dataset.key, input.value);
}

function settingsNumber(key, label, min, max, defaultVal) {
  const val = _settingsData[key] != null ? _settingsData[key] : defaultVal;
  return `
    <div class="form-group">
      <label class="form-label">${label}</label>
      <input type="number" class="form-input settings-input" data-key="${key}"
        value="${val}" min="${min}" max="${max}"
        onchange="markSettingDirty('${key}', parseInt(this.value))">
    </div>
  `;
}

function settingsSelect(key, label, options) {
  const val = _settingsData[key] || '';
  return `
    <div class="form-group">
      <label class="form-label">${label}</label>
      <select class="form-input settings-input" data-key="${key}"
        onchange="markSettingDirty('${key}', this.value)">
        <option value="">— Select —</option>
        ${options.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
      </select>
    </div>
  `;
}

function settingsToggle(key, label, defaultVal) {
  const val = _settingsData[key] != null ? _settingsData[key] : (defaultVal || false);
  return `
    <label class="settings-toggle" style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer">
      <input type="checkbox" class="settings-input" data-key="${key}"
        ${val ? 'checked' : ''}
        onchange="markSettingDirty('${key}', this.checked)"
        style="width:18px;height:18px;accent-color:var(--purple);flex-shrink:0">
      <span class="text-sm">${label}</span>
    </label>
  `;
}

function settingsTextarea(key, label, placeholder) {
  const val = _settingsData[key] || '';
  return `
    <div class="form-group">
      <label class="form-label">${label}</label>
      <textarea class="form-input settings-input" data-key="${key}"
        rows="3" placeholder="${placeholder || ''}"
        onchange="markSettingDirty('${key}', this.value)">${val}</textarea>
    </div>
  `;
}

// ── Save Logic ──

function markSettingDirty(key, value) {
  _settingsDirty[key] = value;
  _settingsData[key] = value;
  const btn = document.getElementById('settings-save-btn');
  if (btn) btn.style.display = 'block';
}

async function saveAllSettings() {
  const btn = document.getElementById('settings-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    await API.updateSettings(_settingsDirty);
    _settingsDirty = {};
    UI.toast('Settings saved!');
    if (btn) btn.style.display = 'none';
    showContinueSetup();
  } catch (err) {
    UI.toast('Failed to save: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Changes'; }
  }
}

// Wire a toggle checkbox to show/hide a section
function wireToggleVisibility(toggleKey, targetId) {
  const cb = document.querySelector(`input[data-key="${toggleKey}"]`);
  const target = document.getElementById(targetId);
  if (cb && target) {
    cb.addEventListener('change', () => {
      target.style.display = cb.checked ? '' : 'none';
    });
  }
}
