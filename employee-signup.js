import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const DAYS = ['So','Mo','Di','Mi','Do','Fr','Sa'];
let currentStep = 1;
let resolvedOwnerId = null;   // set early from verify-code, reused on submit

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
  ['anrede','vorname','nachname','email','password','password2'].forEach(id => showFieldErr(id, false));
}
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

/* ─── Working Hours UI ─── */
function renderWorkingHours(ownerHours = null) {
  $('workingHoursList').innerHTML = DAYS.map((label, i) => {
    const ownerDay = ownerHours?.find(h => h.day_of_week === i);
    const start5 = ownerDay?.start_time?.slice(0, 5);
    const end5   = ownerDay?.end_time?.slice(0, 5);
    // Valid open day: is_active true AND has a real (non-midnight, non-equal) time range
    const isValidRange = start5 && end5 && start5 !== end5 && start5 !== '00:00' && end5 !== '00:00';
    const ownerActive = !ownerHours || (ownerDay?.is_active === true && isValidRange);
    const startVal  = ownerActive ? (start5 || '09:00') : '09:00';
    const endVal    = ownerActive ? (end5   || '18:00') : '18:00';
    const minAttr   = ownerActive && start5 ? `min="${start5}"` : '';
    const maxAttr   = ownerActive && end5   ? `max="${end5}"`   : '';
    const closedAttr   = ownerActive ? '' : 'data-owner-closed';
    const checkedAttr  = ownerActive ? 'checked' : '';
    const disabledAttr = ownerActive ? '' : 'disabled';
    const hintHtml = ownerHours
      ? (ownerActive
          ? `<span class="wh-hint">${startVal}–${endVal}</span>`
          : `<span class="wh-hint wh-hint--closed">Geschlossen</span>`)
      : '';
    return `
    <div class="wh-row" data-day="${i}" ${closedAttr}>
      <label>
        <input type="checkbox" class="wh-active" ${checkedAttr} ${disabledAttr} />
        <span>${label}</span>
      </label>
      <div class="wh-times">
        <input type="time" class="wh-start" value="${startVal}" ${minAttr} ${maxAttr} ${disabledAttr} />
        <span class="wh-sep">–</span>
        <input type="time" class="wh-end" value="${endVal}" ${minAttr} ${maxAttr} ${disabledAttr} />
        ${hintHtml}
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('.wh-active').forEach(cb => {
    cb.addEventListener('change', e => {
      const row = e.target.closest('.wh-row');
      row.querySelectorAll('input[type="time"]').forEach(t => t.disabled = !e.target.checked);
    });
  });
}

/* ─── Fetch owner hours and init working-hours step ─── */
async function initWorkingHours() {
  if (!resolvedOwnerId) { renderWorkingHours(); return; }
  try {
    const { data: ownerHours, error } = await supabase
      .from('working_hours')
      .select('day_of_week, is_active, start_time, end_time')
      .eq('user_id', resolvedOwnerId);
    if (error || !ownerHours?.length) throw new Error('no working_hours rows');
    renderWorkingHours(ownerHours);
  } catch {
    // Graceful degradation: render unconstrained if owner hours unavailable
    renderWorkingHours();
  }
}

function collectWorkingHours() {
  return [...document.querySelectorAll('.wh-row')].map(row => ({
    day_of_week: parseInt(row.dataset.day),
    is_active: row.querySelector('.wh-active').checked,
    start_time: row.querySelector('.wh-start').value,
    end_time: row.querySelector('.wh-end').value
  }));
}

/* ─── Auto-fill company code + early owner lookup ─── */
const params = new URLSearchParams(location.search);
const urlCode = params.get('code');
if (urlCode) {
  $('company_code').value = urlCode.toUpperCase();
}

// Resolve owner early so working hours can be fetched before step 2 is shown.
// If the code is missing or the call fails, initWorkingHours() falls back to
// unconstrained hours — no error is surfaced to the user at this point.
(async () => {
  if (!urlCode) { renderWorkingHours(); return; }
  try {
    const res = await fetch('https://n8n.infinitymade.de/api/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: urlCode.toUpperCase() })
    });
    if (res.ok) {
      const { ownerId } = await res.json();
      resolvedOwnerId = ownerId || null;
    }
  } catch { /* network error — proceed unconstrained */ }
  await initWorkingHours();
})();

const msg = $('message');
function showMsg(text, type) {
  msg.textContent = text;
  msg.className = `msg show ${type}`;
}

/* ─── Step 1 validation ─── */
function validateStep1() {
  clearStep1Errors();
  let ok = true;
  const anrede = $('anrede').value;
  const vorname = $('vorname').value.trim();
  const nachname = $('nachname').value.trim();
  const email = $('email').value.trim();
  const pw = $('password').value;
  const pw2 = $('password2').value;

  if (!anrede) { showFieldErr('anrede', true); ok = false; }
  if (!vorname) { showFieldErr('vorname', true); ok = false; }
  if (!nachname) { showFieldErr('nachname', true); ok = false; }
  if (!isValidEmail(email)) { showFieldErr('email', true); ok = false; }
  if (pw.length < 8) { showFieldErr('password', true); ok = false; }
  if (pw !== pw2 || !pw2) { showFieldErr('password2', true); ok = false; }
  return ok;
}

/* ─── Step 2 validation ─── */
async function fetchOwnerHoursMap() {
  if (!resolvedOwnerId) return null;
  try {
    const { data, error } = await supabase
      .from('working_hours')
      .select('day_of_week, is_active, start_time, end_time')
      .eq('user_id', resolvedOwnerId);
    if (error || !data?.length) return null;
    return Object.fromEntries(data.map(h => [h.day_of_week, h]));
  } catch { return null; }
}

function validateStep2(ownerMap = null) {
  $('err-wh').style.display = 'none';
  const wh = collectWorkingHours();
  const active = wh.filter(h => h.is_active);
  if (active.length === 0) { $('err-wh').style.display = 'block'; return false; }
  for (const h of active) {
    if (!h.start_time || !h.end_time || h.start_time >= h.end_time) {
      $('err-wh').style.display = 'block'; return false;
    }
    if (ownerMap) {
      const owner = ownerMap[h.day_of_week];
      const os = owner?.start_time?.slice(0, 5);
      const oe = owner?.end_time?.slice(0, 5);
      const ownerValid = owner?.is_active === true && os && oe && os !== oe && os !== '00:00';
      if (ownerValid && (h.start_time < os || h.end_time > oe)) {
        $('err-wh').style.display = 'block';
        $('err-wh').textContent = 'Ihre Zeiten liegen außerhalb der Betriebszeiten. Bitte passen Sie die Zeiten an.';
        return false;
      }
    }
  }
  $('err-wh').textContent = 'Bitte aktivieren Sie mindestens einen Tag mit gültigen Zeiten.';
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
$('btnStep2').addEventListener('click', async () => {
  const ownerMap = await fetchOwnerHoursMap();
  if (!validateStep2(ownerMap)) return;
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
    // 1. Verify company code (reuse early-resolved ownerId if available)
    let ownerId = resolvedOwnerId;
    if (!ownerId) {
      const res = await fetch('https://n8n.infinitymade.de/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: companyCode })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Ungültiger Unternehmens-Code.'); }
      ({ ownerId } = await res.json());
    }

    // 2. Store pending registration data so confirm.html can apply it after email verification
    const { error: pendingErr } = await supabase
      .from('pending_employee_registrations')
      .upsert({
        email,
        owner_id: ownerId,
        anrede: $('anrede').value || null,
        full_name: name,
        working_hours: collectWorkingHours(),
      }, { onConflict: 'email' });
    if (pendingErr) console.warn('[employee-signup] pending insert failed', pendingErr);

    // 3. Sign up — email confirmation required; session will be null until confirmed
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: 'https://app.praxura.de/confirm.html',
      }
    });
    if (authErr) throw authErr;

    // resend() as fallback — 60s cooldown prevents double-send if signUp already sent
    await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: 'https://app.praxura.de/confirm.html' },
    }).catch(() => {});

    // 4. Show confirmation message — profile setup happens in confirm.html after click
    showMsg(
      'Bestätigungs-E-Mail gesendet. Bitte prüfen Sie Ihr Postfach und klicken Sie den Link, um Ihr Konto zu aktivieren.',
      'success'
    );
    btn.textContent = 'E-Mail bestätigen…';
    // Hide form steps so user doesn't accidentally resubmit
    document.querySelectorAll('.step').forEach(s => s.hidden = true);

  } catch (error) {
    showMsg(error.message || 'Ein Fehler ist aufgetreten.', 'error');
    btn.disabled = false;
    btn.textContent = 'Konto erstellen';
  }
});
