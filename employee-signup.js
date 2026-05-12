import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const DAYS = ['So','Mo','Di','Mi','Do','Fr','Sa'];
let currentStep = 1;

/* ─── Helpers ─── */
function $(id) { return document.getElementById(id); }
function showStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.querySelector(`.step[data-step="${n}"]`).classList.add('active');
  [1,2,3].forEach(i => {
    const el = $(`p${i}`);
    el.classList.remove('done','current');
    if (i < n) el.classList.add('done');
    else if (i === n) el.classList.add('current');
  });
  currentStep = n;
}
function showFieldErr(id, show) {
  const el = $(`err-${id}`);
  const inp = $(id);
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  if (inp) inp.classList.toggle('error', show);
}
function clearStep1Errors() {
  ['name','email','password','password2'].forEach(id => showFieldErr(id, false));
}
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

/* ─── Working Hours UI ─── */
function renderWorkingHours() {
  $('workingHoursList').innerHTML = DAYS.map((label, i) => `
    <div class="wh-row" data-day="${i}">
      <label><input type="checkbox" class="wh-active" checked /> <span>${label}</span></label>
      <div class="wh-times">
        <input type="time" class="wh-start" value="09:00" />
        <span style="color:var(--text-secondary);">–</span>
        <input type="time" class="wh-end" value="18:00" />
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.wh-active').forEach(cb => {
    cb.addEventListener('change', e => {
      const row = e.target.closest('.wh-row');
      row.querySelectorAll('input[type="time"]').forEach(t => t.disabled = !e.target.checked);
    });
  });
}
renderWorkingHours();

function collectWorkingHours() {
  return [...document.querySelectorAll('.wh-row')].map(row => ({
    day_of_week: parseInt(row.dataset.day),
    is_active: row.querySelector('.wh-active').checked,
    start_time: row.querySelector('.wh-start').value,
    end_time: row.querySelector('.wh-end').value
  }));
}

/* ─── Auto-fill company code ─── */
const params = new URLSearchParams(location.search);
const urlCode = params.get('code');
if (urlCode) {
  $('company_code').value = urlCode.toUpperCase();
}

const msg = $('message');
function showMsg(text, type) {
  msg.textContent = text;
  msg.className = `msg show ${type}`;
}

/* ─── Step 1 validation ─── */
function validateStep1() {
  clearStep1Errors();
  let ok = true;
  const name = $('name').value.trim();
  const email = $('email').value.trim();
  const pw = $('password').value;
  const pw2 = $('password2').value;

  if (!name) { showFieldErr('name', true); ok = false; }
  if (!isValidEmail(email)) { showFieldErr('email', true); ok = false; }
  if (pw.length < 8) { showFieldErr('password', true); ok = false; }
  if (pw !== pw2 || !pw2) { showFieldErr('password2', true); ok = false; }
  return ok;
}

/* ─── Step 2 validation ─── */
function validateStep2() {
  $('err-wh').style.display = 'none';
  const wh = collectWorkingHours();
  const active = wh.filter(h => h.is_active);
  if (active.length === 0) { $('err-wh').style.display = 'block'; return false; }
  for (const h of active) {
    if (h.start_time >= h.end_time) { $('err-wh').style.display = 'block'; return false; }
  }
  return true;
}

/* ─── Step 3 summary ─── */
function updateSummary() {
  $('badgeCode').textContent = $('company_code').value || '—';
  $('sumName').textContent = $('name').value.trim();
  $('sumEmail').textContent = $('email').value.trim();
  const activeDays = collectWorkingHours().filter(h => h.is_active).length;
  $('sumDays').textContent = activeDays + ' / 7 Tagen';
}

/* ─── Navigation ─── */
$('btnStep1').addEventListener('click', () => {
  if (!validateStep1()) return;
  showStep(2);
});

$('backStep2').addEventListener('click', () => showStep(1));
$('btnStep2').addEventListener('click', () => {
  if (!validateStep2()) return;
  updateSummary();
  showStep(3);
});

$('backStep3').addEventListener('click', () => showStep(2));

/* ─── Final Submit ─── */
$('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.className = 'msg';

  const name = $('name').value.trim();
  const email = $('email').value.trim();
  const password = $('password').value;
  const companyCode = $('company_code').value.trim().toUpperCase();
  const btn = $('submitBtn');

  btn.disabled = true;
  btn.textContent = 'Lädt...';

  try {
    const res = await fetch('https://n8n.infinitymade.de/api/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: companyCode })
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Ungültiger Unternehmens-Code.'); }
    const { ownerId } = await res.json();

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: name } }
    });
    if (authErr) throw authErr;

    if (authData.user) {
      await supabase.from('profiles').update({
        role: 'employee', owner_id: ownerId, business_name: name,
        plan: 'mitarbeiter', billing: null, plan_status: 'active'
      }).eq('id', authData.user.id);

      const whRows = collectWorkingHours().map(h => ({
        user_id: authData.user.id, day_of_week: h.day_of_week,
        start_time: h.start_time, end_time: h.end_time, is_active: h.is_active
      }));
      await supabase.from('working_hours').insert(whRows);
    }

    showMsg('Konto erfolgreich erstellt! Sie werden weitergeleitet...', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);

  } catch (error) {
    showMsg(error.message || 'Ein Fehler ist aufgetreten.', 'error');
    btn.disabled = false;
    btn.textContent = 'Konto erstellen';
  }
});
