import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ADMIN_UUID = 'a82285cb-48c8-4c6c-b346-5f97343e7691';

let currentSession = null;

function showToast(text, type='success') {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type==='error'?'toast-error':''}`;
  el.textContent = text;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function json(res) { return res.json(); }

async function apiGet(path) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(path, { headers: { 'Authorization': 'Bearer ' + token } });
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}

async function apiPatch(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(path, { method: 'PATCH', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}

async function loadKpis() {
  const { data: owners } = await supabase.from('profiles').select('id,plan,plan_status').eq('role','owner');
  const { data: emps } = await supabase.from('profiles').select('id').eq('role','employee');
  const { data: bookings } = await supabase.from('bookings').select('id', { count: 'exact', head: true });
  const { data: fb } = await apiGet('/api/admin/feedbacks');
  const grid = document.getElementById('adminKpi');
  const trialCount = (owners||[]).filter(o=>o.plan_status==='trial').length;
  grid.innerHTML = `
    <div class="admin-kpi"><div class="label">Kunden</div><div class="value">${(owners||[]).length}</div></div>
    <div class="admin-kpi"><div class="label">Mitarbeiter</div><div class="value">${(emps||[]).length}</div></div>
    <div class="admin-kpi"><div class="label">Termine</div><div class="value">${bookings?.length ?? 0}</div></div>
    <div class="admin-kpi"><div class="label">Feedback</div><div class="value">${fb?.items?.length ?? 0}</div></div>
    <div class="admin-kpi"><div class="label">Trial läuft</div><div class="value">${trialCount}</div></div>
    <div class="admin-kpi"><div class="label">Starter</div><div class="value">${(owners||[]).filter(o=>o.plan==='starter').length}</div></div>
    <div class="admin-kpi"><div class="label">Professional</div><div class="value">${(owners||[]).filter(o=>o.plan==='professional').length}</div></div>
  `;
}

async function loadCustomers() {
  const { data } = await supabase.from('profiles').select('id,email,business_name,plan,plan_status,created_at,city,role').eq('role','owner').order('created_at',{ascending:false});
  const owners = data || [];
  const ids = owners.map(o=>o.id);
  let bookingsMap = {}, leadsMap = {};
  if (ids.length) {
    const { data: bk } = await supabase.from('bookings').select('owner_id').in('owner_id',ids);
    (bk||[]).forEach(b=>{ bookingsMap[b.owner_id]=(bookingsMap[b.owner_id]||0)+1; });
    const { data: ld } = await supabase.from('leads').select('owner_id').in('owner_id',ids);
    (ld||[]).forEach(l=>{ leadsMap[l.owner_id]=(leadsMap[l.owner_id]||0)+1; });
  }
  const tbody = document.getElementById('custTable');
  const planFilter = document.getElementById('custFilterPlan').value;
  const statusFilter = document.getElementById('custFilterStatus').value;
  const search = document.getElementById('custSearch').value.trim().toLowerCase();
  let rows = owners.filter(o=>{
    if (planFilter && o.plan!==planFilter) return false;
    if (statusFilter && o.plan_status!==statusFilter) return false;
    if (search && !(o.business_name||'').toLowerCase().includes(search) && !o.email.toLowerCase().includes(search)) return false;
    return true;
  });
  tbody.innerHTML = rows.map(o=>`
    <tr>
      <td>${o.business_name||'—'}</td>
      <td class="td-muted">${o.email}</td>
      <td><span class="badge badge-${o.plan==='starter'?'yellow':o.plan==='professional'?'green':'gray'}">${o.plan||'—'}</span></td>
      <td><span class="badge badge-${o.plan_status==='active'?'green':o.plan_status==='trial'?'blue':o.plan_status==='past_due'?'red':'gray'}">${o.plan_status||'—'}</span></td>
      <td>${bookingsMap[o.id]||0}</td>
      <td>${leadsMap[o.id]||0}</td>
    </tr>
  `).join('');
}

async function loadAdminFeedbacks() {
  const { items } = await apiGet('/api/admin/feedbacks');
  const tbody = document.getElementById('fbAdminTable');
  if (!items||items.length===0){ tbody.innerHTML='<tr><td colspan="7" class="table-empty">Keine Tickets.</td></tr>'; return; }
  tbody.innerHTML = items.map(f=>{
    const date = new Date(f.created_at).toLocaleDateString('de-DE');
    const cust = f.profiles?.business_name || f.profiles?.email || '—';
    const statusColor = {open:'badge-yellow',in_progress:'badge-blue',resolved:'badge-green',closed:'badge-gray'};
    const priColor = {low:'badge-gray',medium:'badge-yellow',high:'badge-red',critical:'badge-red'};
    return `<tr data-fb-id="${f.id}">
      <td class="td-muted">${date}</td>
      <td>${cust}</td>
      <td><span class="badge badge-gray">${f.type}</span></td>
      <td>${f.title}</td>
      <td><span class="badge ${statusColor[f.status]||'badge-gray'}">${f.status}</span></td>
      <td><span class="badge ${priColor[f.priority]||'badge-gray'}">${f.priority}</span></td>
      <td><input class="form-input" style="min-width:160px;font-size:12px;" value="${f.admin_notes||''}" onchange="updateFbNote('${f.id}',this.value)" placeholder="Notiz..."></td>
    </tr>`;
  }).join('');
}

window.updateFbNote = async function(id, notes) {
  try {
    await apiPatch('/api/admin/feedbacks', { id, admin_notes: notes });
    showToast('Notiz gespeichert.');
  } catch(e) { showToast('Fehler: '+e.message, 'error'); }
};

document.querySelectorAll('.nav-item[data-panel]').forEach(el=>{
  el.addEventListener('click',()=>{
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('panel-'+el.dataset.panel).classList.add('active');
    if (el.dataset.panel==='feedbacks') loadAdminFeedbacks();
    if (el.dataset.panel==='customers') loadCustomers();
    if (el.dataset.panel==='overview') loadKpis();
  });
});

['custFilterPlan','custFilterStatus','custSearch'].forEach(id=>{
  document.getElementById(id)?.addEventListener('input', loadCustomers);
});

document.getElementById('logoutBtn').addEventListener('click', async ()=>{
  await supabase.auth.signOut();
  window.location.href='login.html';
});

async function boot() {
  const { data: { session }, error } = await supabase.auth.getSession();
  console.log('[admin] session', session);
  console.log('[admin] session.user.id', session?.user?.id);
  console.log('[admin] ADMIN_UUID', ADMIN_UUID);
  console.log('[admin] match?', session?.user?.id === ADMIN_UUID);
  console.log('[admin] match lower?', String(session?.user?.id).toLowerCase() === String(ADMIN_UUID).toLowerCase());
  if (error||!session) { window.location.href='login.html'; return; }
  currentSession = session;
  if (String(session.user.id).toLowerCase() !== String(ADMIN_UUID).toLowerCase()) {
    window.location.href = 'dashboard.html';
    return;
  }
  document.getElementById('loading').style.display='none';
  document.getElementById('app').style.display='';
  await loadKpis();
  await loadCustomers();
}

boot();
