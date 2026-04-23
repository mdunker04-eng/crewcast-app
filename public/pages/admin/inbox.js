// ═══════════════════════════════════════════════════════
// CrewCast — Admin Inbox
// Thread list + thread detail (two-pane, collapses to one on mobile).
// ═══════════════════════════════════════════════════════

async function renderInbox(app) {
  app.innerHTML = UI.adminShell('inbox', `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Inbox</h1>
          <div class="subtitle">Conversations with your team</div>
        </div>
        <button class="btn btn-primary" onclick="openComposeModal()">✉️ Compose</button>
      </div>
      <div id="inbox-body">
        <div class="card" style="padding:20px">Loading…</div>
      </div>
    </div>
  `);

  await loadInboxThreads();
}

async function loadInboxThreads() {
  const body = document.getElementById('inbox-body');
  try {
    const { threads } = await API.getThreads();
    if (!threads || threads.length === 0) {
      body.innerHTML = `
        <div class="card" style="padding:30px;text-align:center">
          <div style="font-size:40px;margin-bottom:10px">💬</div>
          <div class="semi">No messages yet</div>
          <div class="text-muted" style="font-size:13px;margin-top:6px">
            Conversations appear here when employees reply to your messages.
          </div>
        </div>
      `;
      return;
    }

    body.innerHTML = `
      <div class="inbox-layout" style="display:grid;grid-template-columns:minmax(280px,360px) 1fr;gap:16px;align-items:start">
        <div class="card" style="padding:0;overflow:hidden">
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <div class="semi" style="font-size:13px">Threads (${threads.length})</div>
            <button class="btn btn-ghost btn-sm" onclick="loadInboxThreads()" title="Refresh">↻</button>
          </div>
          <div id="thread-list" style="max-height:calc(100vh - 240px);overflow-y:auto">
            ${threads.map(renderThreadItem).join('')}
          </div>
        </div>
        <div id="thread-detail" class="card" style="padding:0;min-height:400px;overflow:hidden">
          <div style="padding:30px;text-align:center;color:var(--muted)">
            Select a conversation to view messages
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div class="card" style="padding:20px;color:#F87171">Failed to load inbox: ${err.message}</div>`;
  }
}

function renderThreadItem(t) {
  const name = `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Unknown';
  const preview = (t.last_body || '').slice(0, 60);
  const when = fmtInboxTime(t.last_at);
  const unread = t.unread > 0;
  const dir = t.last_direction === 'outbound' ? '→ ' : '';
  return `
    <div class="thread-item" onclick="openThread(${t.employee_id})"
         style="padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;${unread ? 'background:rgba(99,102,241,0.06)' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <div class="semi" style="font-size:14px">${escapeHtml(name)}</div>
        <div class="text-muted" style="font-size:11px;white-space:nowrap">${when}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px">
        <div class="text-muted" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${dir}${escapeHtml(preview)}
        </div>
        ${unread ? `<span class="nav-badge" style="flex-shrink:0">${t.unread}</span>` : ''}
      </div>
    </div>
  `;
}

async function openThread(empId) {
  const detail = document.getElementById('thread-detail');
  detail.innerHTML = '<div style="padding:30px;text-align:center">Loading…</div>';

  try {
    const { employee, messages } = await API.getThread(empId);
    const name = `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
    detail.innerHTML = `
      <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="semi">${escapeHtml(name)}</div>
          <div class="text-muted" style="font-size:12px">${escapeHtml(employee.phone || '')}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="loadInboxThreads()">← Back</button>
      </div>
      <div id="thread-messages" style="padding:16px;max-height:calc(100vh - 380px);overflow-y:auto;display:flex;flex-direction:column;gap:8px">
        ${messages.map(renderMessageBubble).join('')}
      </div>
      <div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:flex-end">
        <textarea id="reply-body" rows="2" placeholder="Type a reply…"
          style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--input-bg);color:var(--text);resize:vertical;font-family:inherit;font-size:14px"></textarea>
        <button class="btn btn-primary" onclick="sendReply(${empId})">Send</button>
      </div>
    `;

    // Scroll to bottom
    const box = document.getElementById('thread-messages');
    if (box) box.scrollTop = box.scrollHeight;

    // Mark as read (fire-and-forget)
    API.markThreadRead(empId).catch(() => {});
  } catch (err) {
    detail.innerHTML = `<div style="padding:20px;color:#F87171">Failed to load thread: ${err.message}</div>`;
  }
}

function renderMessageBubble(m) {
  const outbound = m.direction === 'outbound';
  const bg = outbound ? 'var(--primary)' : 'var(--card-bg-elevated, #1a2235)';
  const color = outbound ? '#fff' : 'var(--text)';
  const align = outbound ? 'flex-end' : 'flex-start';
  const when = fmtInboxTime(m.created_at);
  const statusBits = [];
  if (m.channel) statusBits.push(m.channel);
  if (m.status === 'failed') statusBits.push('failed');
  return `
    <div style="display:flex;justify-content:${align}">
      <div style="max-width:75%;background:${bg};color:${color};padding:8px 12px;border-radius:12px;word-break:break-word">
        <div style="font-size:14px;white-space:pre-wrap">${escapeHtml(m.body || '')}</div>
        <div style="font-size:10px;opacity:0.7;margin-top:4px;text-align:right">
          ${when}${statusBits.length ? ' · ' + statusBits.join(' · ') : ''}
        </div>
      </div>
    </div>
  `;
}

async function sendReply(empId) {
  const ta = document.getElementById('reply-body');
  const body = (ta.value || '').trim();
  if (!body) return;
  const btn = ta.nextElementSibling;
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    await API.sendMessage({ employeeIds: [empId], body });
    ta.value = '';
    await openThread(empId);
  } catch (err) {
    UI.toast('Send failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send';
  }
}

function openComposeModal() {
  UI.showModal('Compose message', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div id="compose-recips-wrap">
        <label class="text-xs text-muted">Recipients</label>
        <div id="compose-recips" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px">
          Loading employees…
        </div>
      </div>
      <div>
        <label class="text-xs text-muted">Message</label>
        <textarea id="compose-body" rows="4"
          placeholder="Hi {{firstName}}, …"
          style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--input-bg);color:var(--text);font-family:inherit;font-size:14px"></textarea>
        <div class="text-xs text-muted" style="margin-top:4px">
          Use <code>{{firstName}}</code> for personalization.
        </div>
      </div>
    </div>
  `, `
    <button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="sendCompose()">Send</button>
  `);

  // Load employees
  API.getEmployees().then(list => {
    const el = document.getElementById('compose-recips');
    if (!list || list.length === 0) { el.textContent = 'No employees'; return; }
    el.innerHTML = `
      <div style="margin-bottom:6px">
        <label style="display:inline-flex;gap:6px;align-items:center;font-size:13px">
          <input type="checkbox" id="compose-all" onchange="toggleAllRecips(this.checked)"> Select all
        </label>
      </div>
      ${list.filter(e => e.active !== false).map(e => `
        <label style="display:flex;gap:6px;align-items:center;padding:4px 0;font-size:13px">
          <input type="checkbox" class="compose-recip" value="${e.id}">
          <span>${escapeHtml(e.first_name || '')} ${escapeHtml(e.last_name || '')}</span>
          <span class="text-muted" style="font-size:11px">${escapeHtml(e.phone || '')}</span>
        </label>
      `).join('')}
    `;
  }).catch(err => {
    document.getElementById('compose-recips').textContent = 'Failed: ' + err.message;
  });
}

function toggleAllRecips(checked) {
  document.querySelectorAll('.compose-recip').forEach(cb => { cb.checked = checked; });
}

async function sendCompose() {
  const body = (document.getElementById('compose-body').value || '').trim();
  const ids = Array.from(document.querySelectorAll('.compose-recip:checked')).map(cb => parseInt(cb.value, 10));
  if (!body) return UI.toast('Message body required');
  if (ids.length === 0) return UI.toast('Select at least one recipient');

  try {
    const r = await API.sendMessage({ employeeIds: ids, body });
    UI.closeModal();
    UI.toast(`Sent ${r.sent}/${r.total} (push: ${r.byChannel.push}, sms: ${r.byChannel.sms})`);
    await loadInboxThreads();
  } catch (err) {
    UI.toast('Send failed: ' + err.message);
  }
}

// ── utils ──
function fmtInboxTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
