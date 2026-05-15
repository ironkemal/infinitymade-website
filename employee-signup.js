import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const DAYS = ['So','Mo','Di','Mi','Do','Fr','Sa'];

function cleanSlug(str) {
  const map = {'ä':'ae','ö':'oe','ü':'ue','Ä':'ae','Ö':'oe','Ü':'ue','ß':'ss','İ':'i','ı':'i','ş':'s','ğ':'g','ç':'c'};
  return (str||'').replace(/[äöüÄÖÜßİışğç]/g, m => map[m]||'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,35);
}
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
  ['vorname','nachname','email','password','password2'].forEach(id => showFieldErr(id, false));
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
  const vorname = $('vorname').value.trim();
  const nachname = $('nachname').value.trim();
  const email = $('email').value.trim();
  const pw = $('password').value;
  const pw2 = $('password2').value;

  if (!vorname) { showFieldErr('vorname', true); ok = false; }
  if (!nachname) { showFieldErr('nachname', true); ok = false; }
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
  const fullName = ($('vorname').value.trim() + ' ' + $('nachname').value.trim()).trim();
  $('sumName').textContent = fullName;
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

/* ─── Enter key navigation ─── */
function handleEnter(e, btnId) {
  if (e.key === 'Enter') { e.preventDefault(); $(btnId).click(); }
}
['vorname','nachname','email','password','password2'].forEach(id => {
  $(id).addEventListener('keydown', e => handleEnter(e, 'btnStep1'));
});

/* ─── Final Submit ─── */
$('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (currentStep !== 3) return;
  msg.className = 'msg';

  const name = ($('vorname').value.trim() + ' ' + $('nachname').value.trim()).trim();
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

    // Supabase returns existing user with empty identities on duplicate email
    if (!authData.user || authData.user.identities?.length === 0) {
      throw new Error('Diese E-Mail-Adresse ist bereits registriert. Bitte melden Sie sich an.');
    }

    if (authData.user) {
      // Wait briefly so Supabase auth trigger can initialize the profile row first
      await new Promise(r => setTimeout(r, 800));
      const slug = cleanSlug(name) + '-' + Math.random().toString(36).slice(2, 6);
      const fullName = ($('vorname').value.trim() + ' ' + $('nachname').value.trim()).trim();
      const { error: upErr } = await supabase.from('profiles').update({
        role: 'employee', owner_id: ownerId, business_name: name,
        plan: 'mitarbeiter', plan_status: 'active',
        is_active: true, booking_slug: slug,
        approval_status: 'pending', invited_at: new Date().toISOString(),
        owner_first_name: $('vorname').value.trim(),
        owner_last_name: $('nachname').value.trim()
      }).eq('id', authData.user.id);
      if (upErr) console.error('[employee-signup] profile update error:', upErr);

      const whRows = collectWorkingHours().map(h => ({
        user_id: authData.user.id, day_of_week: h.day_of_week,
        start_time: h.start_time, end_time: h.end_time, is_active: h.is_active
      }));
      await supabase.from('working_hours').insert(whRows);
    }

    showMsg('Konto erstellt! Ihr Konto wartet auf die Bestätigung durch den Inhaber. Sie erhalten eine Benachrichtigung, sobald freigeschaltet.', 'success');
    setTimeout(() => { window.location.href = 'login.html'; }, 4000);

  } catch (error) {
    showMsg(error.message || 'Ein Fehler ist aufgetreten.', 'error');
    btn.disabled = false;
    btn.textContent = 'Konto erstellen';
  }
});
