import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

// Isolated storage key — admin session lives ONLY on admin.infinitymade.de,
// never shared with tenant app. Must match admin-login.js.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: 'sb-admin-auth' }
});

async function isAdminUser(userId) {
  const { data } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

let currentSession = null;

function showToast(text, type='success') {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type==='error'?'toast-error':''}`;
  el.textContent = text;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

async function apiGet(path) {
  const token = currentSession?.access_token;
  const res = await fetch(path, { headers: { 'Authorization': 'Bearer ' + token } });
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}
async function apiPatch(path, body) {
  const token = currentSession?.access_token;
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}

const fmtEUR = n => {
  const v = Number(n) || 0;
  if (v === 0) return '€0.00';
  if (Math.abs(v) < 0.01) return '€' + v.toFixed(4);   // €0.0034 instead of €0.00
  if (Math.abs(v) < 1)    return '€' + v.toFixed(3);   // €0.123
  return '€' + v.toFixed(2);
};
const fmtInt = n => (Number(n) || 0).toLocaleString('de-DE');
const fmtBytes = b => {
  const u = ['B','KB','MB','GB','TB']; let i = 0; let v = Number(b) || 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 2 : 0)} ${u[i]}`;
};
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function kpiHtml(label, value, sub='', tone='') {
  return `<div class="kpi ${tone}"><div class="label">${escapeHtml(label)}</div><div class="value">${value}</div>${sub?`<div class="sub">${escapeHtml(sub)}</div>`:''}</div>`;
}

// ─── Overview ──────────────────────────────────────────────────────────
async function loadOverview() {
  const s = await apiGet('/api/admin/data?type=stats');
  document.getElementById('kpiBilling').innerHTML = [
    kpiHtml('MRR',                  fmtEUR(s.mrr_eur),               `${s.active} aktive Abos`),
    kpiHtml('Trial',                fmtInt(s.trial),                 `${s.trial_ending_this_week} enden diese Woche`,
            s.trial_ending_this_week > 0 ? 'warn' : ''),
    kpiHtml('Past Due',             fmtInt(s.past_due),              'Zahlung fehlgeschlagen',
            s.past_due > 0 ? 'danger' : ''),
    kpiHtml('Gekündigt',            fmtInt(s.canceled),              ''),
    kpiHtml('Starter',              fmtInt(s.starter_count),         ''),
    kpiHtml('Professional',         fmtInt(s.professional_count),    ''),
    kpiHtml('Klinik',               fmtInt(s.klinik_count),          ''),
    kpiHtml('Geschäfte gesamt',     fmtInt(s.total_owners),          ''),
  ].join('');
  document.getElementById('kpiUsage').innerHTML = [
    kpiHtml('AI-Kosten',            fmtEUR(s.ai_cost_eur_mtd),       `${fmtInt(s.ai_calls_mtd)} Aufrufe`),
    kpiHtml('AI-Aufrufe',           fmtInt(s.ai_calls_mtd),          'Diesen Monat'),
    kpiHtml('Chatbot-Kosten',       fmtEUR(s.chatbot_cost_eur_mtd),  `${fmtInt(s.chatbot_calls_mtd)} Nachrichten`),
    kpiHtml('Chatbot-Tokens',       fmtInt(s.chatbot_tokens_mtd),    'Widget-Verbrauch'),
    kpiHtml('E-Mails',              fmtInt(s.emails_mtd),            'B2B + Patient'),
    kpiHtml('Neue Buchungen',       fmtInt(s.new_bookings_mtd),      'Diesen Monat'),
  ].join('');
}

// ─── Customers ────────────────────────────────────────────────────────
let customerCache = [];
async function loadCustomers() {
  const { items } = await apiGet('/api/admin/data?type=customers');
  customerCache = items || [];
  renderCustomers();
}
function renderCustomers() {
  const planFilter   = document.getElementById('custFilterPlan').value;
  const statusFilter = document.getElementById('custFilterStatus').value;
  const search       = document.getElementById('custSearch').value.trim().toLowerCase();
  const tbody = document.getElementById('custTable');

  const rows = customerCache.filter(o => {
    if (planFilter && o.plan !== planFilter) return false;
    if (statusFilter && o.plan_status !== statusFilter) return false;
    if (search && !(o.business_name || '').toLowerCase().includes(search) && !(o.email || '').toLowerCase().includes(search)) return false;
    return true;
  });

  if (rows.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Keine Treffer.</td></tr>'; return; }

  tbody.innerHTML = rows.map(o => {
    const ig = o.integrations || {};
    const integ = `
      <div class="integ-row">
        <span class="integ ${ig.gmail  ? 'on':''}" title="Gmail B2B">📧</span>
        <span class="integ ${ig.gcal   ? 'on':''}" title="Google Calendar">📅</span>
        <span class="integ ${ig.stripe ? 'on':''}" title="Stripe">💳</span>
      </div>`;
    const u = o.usage_mtd || {};
    const usage = `<div class="usage-mini">
      <b>${fmtInt(u.ai_calls)}</b> AI · <b>${fmtInt(u.emails)}</b> Mail · <b>${fmtInt(u.bookings)}</b> Buchung
    </div>`;
    const planBadge   = `<span class="badge badge-${o.plan==='starter'?'yellow':o.plan==='professional'?'green':o.plan==='klinik'?'blue':o.plan==='enterprise'?'purple':'gray'}">${escapeHtml(o.plan || '—')}</span>`;
    const statusBadge = `<span class="badge badge-${o.plan_status==='active'?'green':o.plan_status==='trial'?'blue':o.plan_status==='past_due'?'red':'gray'}">${escapeHtml(o.plan_status || '—')}</span>`;
    return `
      <tr class="clickable" data-owner-id="${o.id}">
        <td>
          <div style="font-weight:600;">${escapeHtml(o.business_name || '—')}</div>
          <div class="td-muted" style="font-size:11px;">${escapeHtml(o.email || '')} ${o.city ? '· ' + escapeHtml(o.city) : ''}</div>
        </td>
        <td>${planBadge}</td>
        <td>${statusBadge}</td>
        <td>${integ}</td>
        <td>${usage}</td>
        <td class="cost-cell">${fmtEUR(u.ai_cost_eur)}</td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('tr.clickable').forEach(tr => {
    tr.addEventListener('click', () => openDrawer(tr.dataset.ownerId));
  });
}

// ─── Drawer ────────────────────────────────────────────────────────────
async function openDrawer(ownerId) {
  const o = customerCache.find(x => x.id === ownerId);
  if (!o) return;
  document.getElementById('drawerOverlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
  document.getElementById('dwName').textContent = o.business_name || '—';
  document.getElementById('dwMeta').textContent = `${o.email || ''} · ${o.plan || '—'} (${o.plan_status || '—'})`;
  document.getElementById('dwBody').innerHTML = '<div class="td-muted">Lade Details...</div>';

  try {
    const bd = await apiGet(`/api/admin/data?type=ai_breakdown&owner_id=${encodeURIComponent(ownerId)}`);
    const modelRows = Object.entries(bd.by_model || {}).map(([m, v]) => `
      <tr><td>${escapeHtml(m)}</td><td>${fmtInt(v.calls)}</td><td>${fmtInt(v.prompt_tokens + v.completion_tokens)}</td><td>${fmtEUR(v.cost_eur)}</td></tr>
    `).join('') || '<tr><td colspan="4" class="td-muted">Keine AI-Nutzung diesen Monat.</td></tr>';
    const taskRows = Object.entries(bd.by_task || {}).map(([t, v]) => `
      <tr><td>${escapeHtml(t)}</td><td>${fmtInt(v.calls)}</td><td>${fmtEUR(v.cost_eur)}</td></tr>
    `).join('') || '<tr><td colspan="3" class="td-muted">—</td></tr>';
    const errs = (bd.recent_errors || []).map(e => `
      <div class="err"><b>${escapeHtml(e.task || '—')}</b> · ${escapeHtml(e.model || '')} · ${escapeHtml(e.status || '')}<br/><span class="td-muted">${escapeHtml(e.error || '')}</span></div>
    `).join('') || '<div class="td-muted" style="font-size:12px;">Keine Fehler diesen Monat. ✓</div>';

    document.getElementById('dwBody').innerHTML = `
      <div class="kpi" style="margin-bottom:12px;">
        <div class="label">AI-Kosten diesen Monat</div>
        <div class="value">${fmtEUR(bd.total_cost_eur)}</div>
        <div class="sub">${fmtInt(bd.total_calls)} Aufrufe insgesamt</div>
      </div>

      <div class="section-title">Pro Modell</div>
      <table class="mini-table">
        <thead><tr><th>Modell</th><th>Aufrufe</th><th>Tokens</th><th>Kosten</th></tr></thead>
        <tbody>${modelRows}</tbody>
      </table>

      <div class="section-title">Pro Aufgabe</div>
      <table class="mini-table">
        <thead><tr><th>Task</th><th>Aufrufe</th><th>Kosten</th></tr></thead>
        <tbody>${taskRows}</tbody>
      </table>

      <div class="section-title">Letzte Fehler</div>
      ${errs}

      <div class="section-title">Verbrauch diesen Monat</div>
      <div class="usage-mini" style="font-size:13px;line-height:1.8;">
        <b>${fmtInt(o.usage_mtd.emails)}</b> E-Mails · <b>${fmtInt(o.usage_mtd.bookings)}</b> neue Buchungen
      </div>
    `;
  } catch (e) {
    document.getElementById('dwBody').innerHTML = `<div class="err">Fehler beim Laden: ${escapeHtml(e.message)}</div>`;
  }
}
function closeDrawer() {
  document.getElementById('drawerOverlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
}
document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
document.getElementById('drawerClose').addEventListener('click', closeDrawer);

// ─── DB Health ─────────────────────────────────────────────────────────
async function loadDbHealth() {
  const d = await apiGet('/api/admin/data?type=db_health');
  const maxTableBytes = (d.tables[0]?.size_bytes) || 1;
  document.getElementById('kpiDb').innerHTML = [
    kpiHtml('DB-Gesamtgröße',  fmtBytes(d.total_bytes), 'Supabase Postgres'),
    kpiHtml('Größte Tabelle',  d.tables[0] ? escapeHtml(d.tables[0].table_name) : '—',
            d.tables[0] ? fmtBytes(d.tables[0].size_bytes) : ''),
    kpiHtml('Top Tenant',      d.top_tenants[0] ? escapeHtml(d.top_tenants[0].business_name || d.top_tenants[0].email || '—') : '—',
            d.top_tenants[0] ? `${fmtInt(d.top_tenants[0].total_rows)} Zeilen` : ''),
  ].join('');

  document.getElementById('dbTables').innerHTML = d.tables.map(t => {
    const pct = Math.round((t.size_bytes / maxTableBytes) * 100);
    return `<tr>
      <td>${escapeHtml(t.table_name)}<div class="bar"><div style="width:${pct}%"></div></div></td>
      <td>${fmtBytes(t.size_bytes)}</td>
      <td>${fmtInt(t.row_estimate)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="3" class="table-empty">—</td></tr>';

  document.getElementById('dbTenants').innerHTML = d.top_tenants.map(t => `
    <tr>
      <td>${escapeHtml(t.business_name || '—')}</td>
      <td class="td-muted">${escapeHtml(t.email || '—')}</td>
      <td>${fmtInt(t.total_rows)}</td>
    </tr>
  `).join('') || '<tr><td colspan="3" class="table-empty">—</td></tr>';
}

// ─── Feedbacks (kept) ──────────────────────────────────────────────────
async function loadAdminFeedbacks() {
  const { items } = await apiGet('/api/admin/feedbacks');
  const tbody = document.getElementById('fbAdminTable');
  if (!items || items.length === 0) { tbody.innerHTML='<tr><td colspan="7" class="table-empty">Keine Tickets.</td></tr>'; return; }
  tbody.innerHTML = items.map(f => {
    const date = new Date(f.created_at).toLocaleDateString('de-DE');
    const cust = f.profiles?.business_name || f.profiles?.email || '—';
    const statusColor = {open:'badge-yellow',in_progress:'badge-blue',resolved:'badge-green',closed:'badge-gray'};
    const priColor    = {low:'badge-gray',medium:'badge-yellow',high:'badge-red',critical:'badge-red'};
    return `<tr data-fb-id="${f.id}">
      <td class="td-muted">${date}</td>
      <td>${escapeHtml(cust)}</td>
      <td><span class="badge badge-gray">${escapeHtml(f.type || '')}</span></td>
      <td>${escapeHtml(f.title || '')}</td>
      <td><span class="badge ${statusColor[f.status]||'badge-gray'}">${escapeHtml(f.status || '')}</span></td>
      <td><span class="badge ${priColor[f.priority]||'badge-gray'}">${escapeHtml(f.priority || '')}</span></td>
      <td><input class="form-input" style="min-width:160px;font-size:12px;" value="${escapeHtml(f.admin_notes || '')}" onchange="updateFbNote('${f.id}',this.value)" placeholder="Notiz..."></td>
    </tr>`;
  }).join('');
}
window.updateFbNote = async function(id, notes) {
  try { await apiPatch('/api/admin/feedbacks', { id, admin_notes: notes }); showToast('Notiz gespeichert.'); }
  catch(e) { showToast('Fehler: '+e.message, 'error'); }
};

// ─── Navigation ────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item[data-panel]').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + el.dataset.panel);
    panel.classList.add('active');
    if (el.dataset.panel === 'customers') loadCustomers();
    if (el.dataset.panel === 'overview')  loadOverview();
    if (el.dataset.panel === 'dbhealth')  loadDbHealth();
    if (el.dataset.panel === 'feedbacks') loadAdminFeedbacks();
  });
});

['custFilterPlan','custFilterStatus','custSearch'].forEach(id =>
  document.getElementById(id)?.addEventListener('input', renderCustomers)
);

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/login';
});

// ─── Boot ──────────────────────────────────────────────────────────────
async function boot() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) { window.location.href = '/login'; return; }
  currentSession = session;
  if (!(await isAdminUser(session.user.id))) {
    await supabase.auth.signOut();
    window.location.href = '/login';
    return;
  }
  document.getElementById('loading').style.display = 'none';
  document.getElementById('app').style.display = '';
  await loadOverview();
}
boot();
