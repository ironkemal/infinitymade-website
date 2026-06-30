/**
 * booking-request.js — Patient appointment request wizard
 * Vanilla ES module, no framework dependencies
 * VPS API base: https://n8n.infinitymade.de/api
 */

'use strict';

// ─── Constants ──────────────────────────────────────────────────────────────

const API_BASE = 'https://n8n.infinitymade.de/api';

/** How far ahead (days) patients can book */
const MAX_DAYS_AHEAD = 60;

/** Step metadata for the progress bar */
const STEPS = [
  { label: 'Patient' },
  { label: 'Zahlung' },
  { label: 'Leistung' },
  { label: 'Termin' },
  { label: 'Angaben' },
  { label: 'Ihre Daten' },
  { label: 'Absenden' },
];

// ─── State ──────────────────────────────────────────────────────────────────

const state = {
  owner_id: null,
  isNewPatient: true,
  patient_id: null,
  patient: {},
  payment_type: null,
  service_id: null,
  service: null,
  session_count: 1,
  employee_id: null,
  preferred_date: null,
  preferred_time: null,
  // GKV
  krankenkasse: null,
  arzt_name: null,
  verordnung_datum: null,
  icd10_diagnose: null,
  behandlungsart: null,
  verordnung_sitzungen: null,
  frequenz: null,
  verordnung_typ: null,
  doppelbehandlung: false,
  // PKV
  pkv_versicherung: null,
  arzt_ueberweisung: false,
  arzt_ueberweisung_name: null,
  // BG
  bg_aktenzeichen: null,
  bg_name: null,
  unfalldatum: null,
  durchgangsarzt: null,
  bg_diagnose: null,
  bg_behandlungsart: null,
  bg_anzahl: null,
  bg_frequenz: null,
  // common
  notizen: '',
  dsgvo_consent: false,
};

/** Logical step sequence (0-6). Step 4 skipped for Selbstzahler. Step 5 skipped for existing patients. */
let stepSequence = [0, 1, 2, 3, 4, 5, 6];
let currentStepIndex = 0;

// Calendar state
let calYear = 0;
let calMonth = 0;

// Cache loaded data
let teamMembers = [];
let cachedSlots = {}; // key: "employeeId|date" → array of time strings

// ─── Utility helpers ────────────────────────────────────────────────────────

function q(selector) {
  return document.querySelector(selector);
}

function show(el) {
  if (typeof el === 'string') el = q(el);
  if (el) el.hidden = false;
}

function hide(el) {
  if (typeof el === 'string') el = q(el);
  if (el) el.hidden = true;
}

function setLoading(btn, loading) {
  if (!btn) return;
  const spinner = btn.querySelector('.spinner');
  const label = btn.querySelector('[id$="Label"]') || btn;
  if (loading) {
    btn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
  } else {
    btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

function showFieldError(errorElId, msg) {
  const el = document.getElementById(errorElId);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  el.style.display = 'block';
}

function clearFieldError(errorElId) {
  const el = document.getElementById(errorElId);
  if (!el) return;
  el.textContent = '';
  el.classList.remove('visible');
  el.style.display = 'none';
}

function clearAllErrors() {
  document.querySelectorAll('.br-field-error').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
    el.style.display = 'none';
  });
  document.querySelectorAll('input.error, select.error, textarea.error').forEach(el => {
    el.classList.remove('error');
  });
}

function fieldError(inputId, errorId, msg) {
  const inp = document.getElementById(inputId);
  if (inp) inp.classList.add('error');
  showFieldError(errorId, msg);
}

function markValid(inputId) {
  const inp = document.getElementById(inputId);
  if (inp) inp.classList.remove('error');
}

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body.error || body.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }
  return res.json();
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatDateDE(isoStr) {
  if (!isoStr) return '–';
  const [y, m, d] = isoStr.split('-');
  return `${d}.${m}.${y}`;
}

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

// ─── Progress bar ────────────────────────────────────────────────────────────

function buildProgressBar() {
  const labels = document.getElementById('progressLabels');
  if (!labels) return;
  labels.innerHTML = '';
  STEPS.forEach((s, i) => {
    const span = document.createElement('span');
    span.className = 'br-step-label';
    span.textContent = s.label;
    span.dataset.step = i;
    labels.appendChild(span);
  });
}

function updateProgressBar(stepIndex) {
  const totalSteps = STEPS.length;
  const pct = ((stepIndex) / (totalSteps - 1)) * 100;
  const fill = document.getElementById('progressFill');
  if (fill) fill.style.width = `${Math.max(4, pct)}%`;

  document.querySelectorAll('.br-step-label').forEach(el => {
    const i = parseInt(el.dataset.step, 10);
    el.classList.remove('active', 'done');
    if (i === stepIndex) el.classList.add('active');
    else if (i < stepIndex) el.classList.add('done');
  });
}

// ─── Step navigation ─────────────────────────────────────────────────────────

function rebuildStepSequence() {
  const seq = [0, 1, 2, 3];
  if (state.payment_type !== 'selbstzahler') seq.push(4);
  if (state.isNewPatient) seq.push(5);
  seq.push(6);
  stepSequence = seq;
}

function currentLogicalStep() {
  return stepSequence[currentStepIndex];
}

function showStep(logicalStep) {
  document.querySelectorAll('.br-step').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`step-${logicalStep}`);
  if (el) el.classList.add('active');
  updateProgressBar(logicalStep);
}

function nextStep() {
  clearAllErrors();
  if (!validateCurrentStep()) return;
  currentStepIndex = Math.min(currentStepIndex + 1, stepSequence.length - 1);
  const logical = currentLogicalStep();
  showStep(logical);
  onStepEnter(logical);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prevStep() {
  clearAllErrors();
  currentStepIndex = Math.max(currentStepIndex - 1, 0);
  const logical = currentLogicalStep();
  showStep(logical);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Step 0: Patient type ─────────────────────────────────────────────────────

function initStep0() {
  const btnNew = document.getElementById('toggleNew');
  const btnExisting = document.getElementById('toggleExisting');
  const existingForm = document.getElementById('existingPatientForm');
  const newMsg = document.getElementById('newPatientMessage');

  btnNew.addEventListener('click', () => {
    state.isNewPatient = true;
    state.patient_id = null;
    btnNew.classList.add('active');
    btnExisting.classList.remove('active');
    hide(existingForm);
    show(newMsg);
    hide('foundPatientCard');
    clearFieldError('lookupStatus');
  });

  btnExisting.addEventListener('click', () => {
    state.isNewPatient = false;
    btnExisting.classList.add('active');
    btnNew.classList.remove('active');
    show(existingForm);
    hide(newMsg);
  });

  document.getElementById('step0Next').addEventListener('click', nextStep);
}

async function lookupExistingPatient() {
  const nachname = document.getElementById('lookupNachname').value.trim();
  const geburt = document.getElementById('lookupGeburt').value;
  const status = document.getElementById('lookupStatus');
  const foundCard = document.getElementById('foundPatientCard');

  clearFieldError('lookupNachnameError');
  clearFieldError('lookupGeburtError');
  hide(foundCard);

  if (!nachname) {
    fieldError('lookupNachname', 'lookupNachnameError', 'Bitte Nachname eingeben.');
    return false;
  }
  if (!geburt) {
    fieldError('lookupGeburt', 'lookupGeburtError', 'Bitte Geburtsdatum eingeben.');
    return false;
  }

  status.textContent = 'Suche läuft…';
  status.className = 'br-lookup-state loading';

  try {
    const params = new URLSearchParams({ owner_id: state.owner_id, nachname, geburtsdatum: geburt });
    const data = await apiFetch(`/patients/lookup?${params}`);
    if (data && data.id) {
      state.patient_id = data.id;
      status.textContent = '';
      status.className = 'br-lookup-state';
      document.getElementById('foundPatientName').textContent =
        `${data.vorname || ''} ${data.nachname || ''}`.trim();
      show(foundCard);
      return true;
    } else {
      state.patient_id = null;
      status.textContent = 'Patient nicht gefunden. Bitte als neuer Patient anmelden.';
      status.className = 'br-lookup-state not-found';
      state.isNewPatient = true;
      return true; // allow proceeding as new patient
    }
  } catch (err) {
    state.patient_id = null;
    status.textContent = 'Suche fehlgeschlagen. Bitte erneut versuchen.';
    status.className = 'br-lookup-state not-found';
    return false;
  }
}

function validateStep0() {
  if (!state.isNewPatient) {
    // If existing patient mode, lookup must have been attempted
    // We let them proceed even if not found (they become a new patient)
    const nachname = document.getElementById('lookupNachname').value.trim();
    const geburt = document.getElementById('lookupGeburt').value;
    if (!nachname) {
      fieldError('lookupNachname', 'lookupNachnameError', 'Bitte Nachname eingeben.');
      return false;
    }
    if (!geburt) {
      fieldError('lookupGeburt', 'lookupGeburtError', 'Bitte Geburtsdatum eingeben.');
      return false;
    }
  }
  return true;
}

// ─── Step 1: Zahlungsart ───────────────────────────────────────────────────

function initStep1() {
  document.querySelectorAll('#step-1 .br-select-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('#step-1 .br-select-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.payment_type = card.dataset.value;
      clearFieldError('paymentTypeError');
    });
  });

  document.getElementById('step1Back').addEventListener('click', prevStep);
  document.getElementById('step1Next').addEventListener('click', nextStep);
}

function validateStep1() {
  if (!state.payment_type) {
    showFieldError('paymentTypeError', 'Bitte eine Zahlungsart auswählen.');
    document.getElementById('paymentTypeError').style.display = 'block';
    return false;
  }
  return true;
}

// ─── Step 2: Leistung + Sitzungen ─────────────────────────────────────────

function initStep2() {
  document.getElementById('step2Back').addEventListener('click', prevStep);
  document.getElementById('step2Next').addEventListener('click', nextStep);

  const sessionInput = document.getElementById('sessionCount');
  document.getElementById('sessionMinus').addEventListener('click', () => {
    const v = parseInt(sessionInput.value, 10);
    if (v > 1) sessionInput.value = v - 1;
    state.session_count = parseInt(sessionInput.value, 10);
  });
  document.getElementById('sessionPlus').addEventListener('click', () => {
    const v = parseInt(sessionInput.value, 10);
    const max = (state.payment_type === 'gkv' || state.payment_type === 'bg') ? 99 : 20;
    if (v < max) sessionInput.value = v + 1;
    state.session_count = parseInt(sessionInput.value, 10);
  });
  sessionInput.addEventListener('change', () => {
    state.session_count = Math.max(1, parseInt(sessionInput.value, 10) || 1);
    sessionInput.value = state.session_count;
  });
}

async function loadServices() {
  const grid = document.getElementById('servicesGrid');
  const loading = document.getElementById('servicesLoading');
  show(loading);
  hide(grid);

  try {
    const data = await apiFetch(`/services/public?owner_id=${encodeURIComponent(state.owner_id)}`);
    const services = Array.isArray(data) ? data : (data.services || []);

    grid.innerHTML = '';
    if (!services.length) {
      grid.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Keine Leistungen verfügbar.</p>';
      grid.style.display = 'block';
      hide(loading);
      return;
    }

    services.forEach(svc => {
      const btn = document.createElement('button');
      btn.className = 'br-select-card';
      btn.dataset.id = svc.id;

      let priceStr = '';
      if (svc.price != null && svc.price > 0) {
        priceStr = `<span class="card-badge">${Number(svc.price).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>`;
      }
      let durStr = svc.duration ? `<span style="font-size:0.8rem;color:var(--text-muted);">⏱ ${svc.duration} Min.</span>` : '';

      btn.innerHTML = `
        <span class="card-title">${escHtml(svc.name || 'Leistung')}</span>
        <span class="card-desc">${escHtml(svc.description || '')}</span>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.25rem;">${durStr}${priceStr}</div>
      `;

      btn.addEventListener('click', () => {
        grid.querySelectorAll('.br-select-card').forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');
        state.service_id = svc.id;
        state.service = svc;
        clearFieldError('serviceError');
        showSessionPicker();
      });

      grid.appendChild(btn);
    });

    grid.style.display = 'grid';
    hide(loading);
  } catch (err) {
    loading.textContent = 'Leistungen konnten nicht geladen werden.';
  }
}

function showSessionPicker() {
  const picker = document.getElementById('sessionPicker');
  show(picker);
  const label = document.getElementById('sessionPickerLabel');
  const hint = document.getElementById('sessionHint');
  const input = document.getElementById('sessionCount');

  if (state.payment_type === 'gkv' || state.payment_type === 'bg') {
    input.max = 99;
    hint.textContent = 'Entspricht der Anzahl auf Ihrer Verordnung.';
  } else {
    input.max = 20;
    if (parseInt(input.value, 10) > 20) input.value = 1;
    hint.textContent = 'Maximale Buchung: 20 Sitzungen.';
  }
  state.session_count = parseInt(input.value, 10) || 1;
}

function validateStep2() {
  if (!state.service_id) {
    document.getElementById('serviceError').textContent = 'Bitte eine Leistung auswählen.';
    document.getElementById('serviceError').style.display = 'block';
    return false;
  }
  return true;
}

// ─── Step 3: Therapeut + Datum + Uhrzeit ──────────────────────────────────

function initStep3() {
  document.getElementById('step3Back').addEventListener('click', prevStep);
  document.getElementById('step3Next').addEventListener('click', nextStep);
  document.getElementById('calPrev').addEventListener('click', () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); });
  document.getElementById('calNext').addEventListener('click', () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); });
}

async function loadTeam() {
  const list = document.getElementById('teamList');
  list.innerHTML = '<div class="br-slots-loading"><div class="spinner dark"></div></div>';

  try {
    const data = await apiFetch(`/team/public?owner_id=${encodeURIComponent(state.owner_id)}`);
    teamMembers = Array.isArray(data) ? data : (data.team || data.members || []);
  } catch {
    teamMembers = [];
  }

  list.innerHTML = '';

  // "Kein Präferenz" first
  const anyBtn = buildTeamButton(null, 'Kein Präferenz', true);
  anyBtn.classList.add('selected');
  list.appendChild(anyBtn);

  teamMembers.forEach(m => {
    list.appendChild(buildTeamButton(m.id || m.user_id, m.full_name || m.name || 'Therapeut', false));
  });
}

function buildTeamButton(id, name, generic) {
  const btn = document.createElement('button');
  btn.className = 'br-team-member';
  btn.dataset.id = id || '';

  const avatar = document.createElement('span');
  avatar.className = 'br-avatar' + (generic ? ' generic' : '');
  avatar.textContent = generic ? '★' : getInitials(name);

  const label = document.createElement('span');
  label.textContent = name;

  btn.appendChild(avatar);
  btn.appendChild(label);

  btn.addEventListener('click', () => {
    document.querySelectorAll('.br-team-member').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.employee_id = id || null;
    // Reload slots if a date is already selected
    if (state.preferred_date) fetchAndRenderSlots(state.preferred_date);
  });

  return btn;
}

function initCalendar() {
  const today = new Date();
  calYear = today.getFullYear();
  calMonth = today.getMonth();
  renderCalendar();
}

function renderCalendar() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD);

  // Prevent going before current month
  const prevBtn = document.getElementById('calPrev');
  const isPastMonth = calYear < today.getFullYear() || (calYear === today.getFullYear() && calMonth <= today.getMonth());
  prevBtn.disabled = isPastMonth;

  // Prevent going beyond max date month
  const nextBtn = document.getElementById('calNext');
  const isMaxMonth = calYear > maxDate.getFullYear() || (calYear === maxDate.getFullYear() && calMonth >= maxDate.getMonth());
  nextBtn.disabled = isMaxMonth;

  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  document.getElementById('calMonthYear').textContent = `${monthNames[calMonth]} ${calYear}`;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  const firstDay = new Date(calYear, calMonth, 1);
  // Adjust so Mon=0
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = (startDow + 6) % 7;   // Mon=0

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  // Leading blanks
  for (let i = 0; i < startDow; i++) {
    const blank = document.createElement('button');
    blank.className = 'br-cal-day empty';
    blank.disabled = true;
    blank.textContent = '';
    grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const btn = document.createElement('button');
    btn.className = 'br-cal-day';
    btn.textContent = d;

    const cellDate = new Date(calYear, calMonth, d);
    cellDate.setHours(0, 0, 0, 0);
    const isoStr = dateStr(calYear, calMonth, d);

    const isPast = cellDate < today;
    const isTooFar = cellDate > maxDate;

    if (isPast || isTooFar) {
      btn.disabled = true;
    } else {
      const isToday = cellDate.getTime() === today.getTime();
      if (isToday) btn.classList.add('today');
      if (state.preferred_date === isoStr) btn.classList.add('selected');

      btn.addEventListener('click', () => {
        grid.querySelectorAll('.br-cal-day').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.preferred_date = isoStr;
        state.preferred_time = null;
        fetchAndRenderSlots(isoStr);
        clearFieldError('schedulerError');
      });
    }

    grid.appendChild(btn);
  }
}

async function fetchAndRenderSlots(date) {
  const slotsList = document.getElementById('slotsList');
  state.preferred_time = null;

  slotsList.innerHTML = '<div class="br-slots-loading"><div class="spinner dark"></div> Zeiten werden geladen…</div>';

  const duration = state.service ? (state.service.duration || 60) : 60;

  try {
    let slots = [];

    if (state.employee_id) {
      // Single therapist
      const cacheKey = `${state.employee_id}|${date}`;
      if (cachedSlots[cacheKey]) {
        slots = cachedSlots[cacheKey];
      } else {
        const data = await apiFetch('/booking/get-slots', {
          method: 'POST',
          body: JSON.stringify({ userId: state.employee_id, date, duration }),
        });
        slots = Array.isArray(data) ? data : (data.slots || []);
        cachedSlots[cacheKey] = slots;
      }
    } else {
      // Aggregate from all team members
      const allSlotSets = await Promise.allSettled(
        teamMembers.map(m => {
          const uid = m.id || m.user_id;
          const cacheKey = `${uid}|${date}`;
          if (cachedSlots[cacheKey]) return Promise.resolve(cachedSlots[cacheKey]);
          return apiFetch('/booking/get-slots', {
            method: 'POST',
            body: JSON.stringify({ userId: uid, date, duration }),
          }).then(data => {
            const s = Array.isArray(data) ? data : (data.slots || []);
            cachedSlots[cacheKey] = s;
            return s;
          });
        })
      );
      const allFlat = allSlotSets
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value);
      // Unique sorted times
      slots = [...new Set(allFlat.map(s => (typeof s === 'string' ? s : s.time || s.start)))].sort();
    }

    renderSlots(slots);
  } catch (err) {
    slotsList.innerHTML = '<p class="br-slots-empty">Termine konnten nicht geladen werden. Bitte erneut versuchen.</p>';
  }
}

function renderSlots(slots) {
  const slotsList = document.getElementById('slotsList');
  slotsList.innerHTML = '';

  if (!slots || slots.length === 0) {
    slotsList.innerHTML = '<p class="br-slots-empty">Für diesen Tag keine freien Termine. Bitte einen anderen Tag wählen.</p>';
    return;
  }

  slots.forEach(s => {
    const time = typeof s === 'string' ? s : (s.time || s.start || '');
    const display = time.substring(0, 5); // "HH:MM"
    const btn = document.createElement('button');
    btn.className = 'br-slot';
    btn.textContent = display;
    if (state.preferred_time === time) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      slotsList.querySelectorAll('.br-slot').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.preferred_time = time;
      clearFieldError('schedulerError');
    });
    slotsList.appendChild(btn);
  });
}

function validateStep3() {
  let ok = true;
  if (!state.preferred_date) {
    showFieldError('schedulerError', 'Bitte ein Datum auswählen.');
    document.getElementById('schedulerError').style.display = 'block';
    ok = false;
  } else if (!state.preferred_time) {
    showFieldError('schedulerError', 'Bitte eine Uhrzeit auswählen.');
    document.getElementById('schedulerError').style.display = 'block';
    ok = false;
  }
  return ok;
}

// ─── Step 4: Zusatzinfos ────────────────────────────────────────────────────

function initStep4() {
  document.getElementById('step4Back').addEventListener('click', prevStep);
  document.getElementById('step4Next').addEventListener('click', nextStep);

  // PKV ueberweisung toggle
  document.querySelectorAll('input[name="pkvUeberweisung"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const pkvArztWrap = document.getElementById('pkvArztWrap');
      if (radio.value === 'ja' && radio.checked) {
        show(pkvArztWrap);
      } else if (radio.value === 'nein' && radio.checked) {
        hide(pkvArztWrap);
      }
    });
  });
}

function showStep4Fields() {
  hide('fields-gkv');
  hide('fields-pkv');
  hide('fields-selbstzahler');
  hide('fields-bg');

  const desc = document.getElementById('step4Desc');
  switch (state.payment_type) {
    case 'gkv':
      show('fields-gkv');
      desc.textContent = 'Bitte füllen Sie die Angaben zur Verordnung aus.';
      break;
    case 'pkv':
      show('fields-pkv');
      desc.textContent = 'Angaben zu Ihrer Privatversicherung.';
      break;
    case 'selbstzahler':
      show('fields-selbstzahler');
      desc.textContent = 'Keine weiteren Angaben erforderlich.';
      break;
    case 'bg':
      show('fields-bg');
      desc.textContent = 'Bitte füllen Sie die Angaben zum Arbeitsunfall aus.';
      break;
  }
}

async function loadKrankenkassen() {
  const sel = document.getElementById('gkvKrankenkasse');
  sel.innerHTML = '<option value="">Wird geladen…</option>';
  try {
    const data = await apiFetch(`/krankenkassen?owner_id=${encodeURIComponent(state.owner_id)}`);
    const list = Array.isArray(data) ? data : (data.krankenkassen || []);
    sel.innerHTML = '<option value="">Bitte wählen…</option>';
    list.forEach(kk => {
      const opt = document.createElement('option');
      opt.value = kk.id || kk.name;
      opt.textContent = kk.name || kk.bezeichnung || kk.id;
      sel.appendChild(opt);
    });
  } catch {
    sel.innerHTML = '<option value="">Laden fehlgeschlagen — bitte manuell eingeben</option>';
    // Replace with text input fallback
    const wrapper = sel.closest('.br-field');
    if (wrapper && !wrapper.querySelector('#gkvKrankenkasseText')) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.id = 'gkvKrankenkasseText';
      inp.placeholder = 'z.B. AOK Bayern';
      wrapper.insertBefore(inp, sel.nextSibling);
      sel.style.display = 'none';
    }
  }
}

function validateStep4() {
  let ok = true;
  clearAllErrors();

  if (state.payment_type === 'gkv') {
    const kk = document.getElementById('gkvKrankenkasse');
    const kkText = document.getElementById('gkvKrankenkasseText');
    const kkVal = (kkText && kkText.style.display !== 'none') ? kkText.value.trim() : kk.value;
    if (!kkVal) { fieldError('gkvKrankenkasse', 'gkvKrankenkasseError', 'Bitte Krankenkasse auswählen.'); ok = false; }
    else state.krankenkasse = kkVal;

    const arzt = document.getElementById('gkvArzt').value.trim();
    if (!arzt) { fieldError('gkvArzt', 'gkvArztError', 'Bitte Arztname eingeben.'); ok = false; }
    else state.arzt_name = arzt;

    const vd = document.getElementById('gkvVerordDatum').value;
    if (!vd) { fieldError('gkvVerordDatum', 'gkvVerordDatumError', 'Bitte Verordnungsdatum eingeben.'); ok = false; }
    else state.verordnung_datum = vd;

    state.icd10_diagnose = document.getElementById('gkvIcd10').value.trim() || null;

    const hm = document.getElementById('gkvHeilmittel').value;
    if (!hm) { fieldError('gkvHeilmittel', 'gkvHeilmittelError', 'Bitte Heilmittel auswählen.'); ok = false; }
    else state.behandlungsart = hm;

    const anzahl = document.getElementById('gkvAnzahl').value;
    if (!anzahl || parseInt(anzahl, 10) < 1) { fieldError('gkvAnzahl', 'gkvAnzahlError', 'Bitte Anzahl eingeben.'); ok = false; }
    else state.verordnung_sitzungen = parseInt(anzahl, 10);

    const freq = document.getElementById('gkvFrequenz').value;
    if (!freq) { fieldError('gkvFrequenz', 'gkvFrequenzError', 'Bitte Frequenz wählen.'); ok = false; }
    else state.frequenz = freq;

    const vtRadio = document.querySelector('input[name="verordnungTyp"]:checked');
    if (!vtRadio) { showFieldError('gkvVerordnungTypError', 'Bitte Art der Verordnung wählen.'); document.getElementById('gkvVerordnungTypError').style.display = 'block'; ok = false; }
    else state.verordnung_typ = vtRadio.value;

    state.doppelbehandlung = document.getElementById('gkvDoppelbehandlung').checked;
  }

  if (state.payment_type === 'pkv') {
    state.pkv_versicherung = document.getElementById('pkvVersicherung').value.trim() || null;
    const ueR = document.querySelector('input[name="pkvUeberweisung"]:checked');
    if (!ueR) {
      showFieldError('pkvUeberweisungError', 'Bitte auswählen.');
      document.getElementById('pkvUeberweisungError').style.display = 'block';
      ok = false;
    } else {
      state.arzt_ueberweisung = ueR.value === 'ja';
      if (state.arzt_ueberweisung) {
        const arztName = document.getElementById('pkvArzt').value.trim();
        if (!arztName) { fieldError('pkvArzt', 'pkvArztError', 'Bitte Arztname eingeben.'); ok = false; }
        else state.arzt_ueberweisung_name = arztName;
      }
    }
  }

  if (state.payment_type === 'bg') {
    const ak = document.getElementById('bgAktenzeichen').value.trim();
    if (!ak) { fieldError('bgAktenzeichen', 'bgAktenzeichenError', 'Bitte Aktenzeichen eingeben.'); ok = false; }
    else state.bg_aktenzeichen = ak;

    const bgN = document.getElementById('bgName').value.trim();
    if (!bgN) { fieldError('bgName', 'bgNameError', 'Bitte BG-Name eingeben.'); ok = false; }
    else state.bg_name = bgN;

    const ufd = document.getElementById('bgUnfalldatum').value;
    if (!ufd) { fieldError('bgUnfalldatum', 'bgUnfalldatumError', 'Bitte Unfalldatum eingeben.'); ok = false; }
    else state.unfalldatum = ufd;

    state.durchgangsarzt = document.getElementById('bgDurchgangsarzt').value.trim() || null;
    state.bg_diagnose = document.getElementById('bgDiagnose').value.trim() || null;

    const bgBeh = document.getElementById('bgBehandlungsart').value;
    if (!bgBeh) { fieldError('bgBehandlungsart', 'bgBehandlungsartError', 'Bitte Behandlungsart wählen.'); ok = false; }
    else state.bg_behandlungsart = bgBeh;

    const bgAnz = document.getElementById('bgAnzahl').value;
    if (!bgAnz || parseInt(bgAnz, 10) < 1) { fieldError('bgAnzahl', 'bgAnzahlError', 'Bitte Anzahl eingeben.'); ok = false; }
    else state.bg_anzahl = parseInt(bgAnz, 10);

    const bgFq = document.getElementById('bgFrequenz').value;
    if (!bgFq) { fieldError('bgFrequenz', 'bgFrequenzError', 'Bitte Frequenz wählen.'); ok = false; }
    else state.bg_frequenz = bgFq;
  }

  return ok;
}

// ─── Step 5: Patientendaten ─────────────────────────────────────────────────

function initStep5() {
  document.getElementById('step5Back').addEventListener('click', prevStep);
  document.getElementById('step5Next').addEventListener('click', nextStep);
}

function validateStep5() {
  let ok = true;

  const vname = document.getElementById('patVorname').value.trim();
  if (!vname) { fieldError('patVorname', 'patVornameError', 'Bitte Vorname eingeben.'); ok = false; }

  const nname = document.getElementById('patNachname').value.trim();
  if (!nname) { fieldError('patNachname', 'patNachnameError', 'Bitte Nachname eingeben.'); ok = false; }

  const geb = document.getElementById('patGeburt').value;
  if (!geb) { fieldError('patGeburt', 'patGeburtError', 'Bitte Geburtsdatum eingeben.'); ok = false; }

  const email = document.getElementById('patEmail').value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldError('patEmail', 'patEmailError', 'Bitte gültige E-Mail-Adresse eingeben.');
    ok = false;
  }

  if (ok) {
    state.patient = {
      vorname: vname,
      nachname: nname,
      geburtsdatum: geb,
      email: email || null,
      telefon: document.getElementById('patTelefon').value.trim() || null,
    };
  }

  return ok;
}

// ─── Step 6: Summary + DSGVO + Submit ──────────────────────────────────────

function initStep6() {
  document.getElementById('step6Back').addEventListener('click', prevStep);
  document.getElementById('submitBtn').addEventListener('click', handleSubmit);

  const notizen = document.getElementById('notizen');
  const counter = document.getElementById('notizenCount');
  notizen.addEventListener('input', () => {
    const len = notizen.value.length;
    counter.textContent = len;
    counter.closest('.br-char-count').classList.toggle('warn', len > 450);
    state.notizen = notizen.value;
  });
}

function buildSummary() {
  const rows = document.getElementById('summaryRows');
  rows.innerHTML = '';

  const payLabels = { gkv: 'GKV (Kassenpatient)', pkv: 'PKV (Privatpatient)', selbstzahler: 'Selbstzahler', bg: 'BG (Berufsgenossenschaft)' };

  const data = [
    { label: 'Patient', value: state.isNewPatient ? (state.patient.vorname ? `${state.patient.vorname} ${state.patient.nachname}` : 'Neuer Patient') : 'Bestehender Patient' },
    { label: 'Zahlungsart', value: payLabels[state.payment_type] || state.payment_type },
    { label: 'Leistung', value: state.service ? state.service.name : '–' },
    { label: 'Sitzungen', value: state.session_count },
    { label: 'Wunschtermin', value: state.preferred_date ? `${formatDateDE(state.preferred_date)} um ${(state.preferred_time || '').substring(0, 5)} Uhr` : '–' },
    { label: 'Therapeut', value: state.employee_id ? (teamMembers.find(m => (m.id || m.user_id) === state.employee_id) || {}).full_name || 'Gewählt' : 'Kein Präferenz' },
  ];

  // Add payment-specific fields
  if (state.payment_type === 'gkv' && state.krankenkasse) {
    data.push({ label: 'Krankenkasse', value: state.krankenkasse });
    if (state.arzt_name) data.push({ label: 'Verordnender Arzt', value: state.arzt_name });
    if (state.behandlungsart) data.push({ label: 'Heilmittel', value: state.behandlungsart });
  }
  if (state.payment_type === 'bg' && state.bg_name) {
    data.push({ label: 'Berufsgenossenschaft', value: state.bg_name });
    if (state.bg_aktenzeichen) data.push({ label: 'Aktenzeichen', value: state.bg_aktenzeichen });
  }

  data.forEach(row => {
    const div = document.createElement('div');
    div.className = 'br-summary-row';
    div.innerHTML = `<span class="sum-label">${escHtml(row.label)}</span><span class="sum-value">${escHtml(String(row.value))}</span>`;
    rows.appendChild(div);
  });
}

async function handleSubmit() {
  clearAllErrors();
  const dsgvo1 = document.getElementById('dsgvo1').checked;
  const dsgvo2 = document.getElementById('dsgvo2').checked;
  if (!dsgvo1 || !dsgvo2) {
    showFieldError('dsgvoError', 'Bitte beide Datenschutz-Checkboxen bestätigen.');
    document.getElementById('dsgvoError').style.display = 'block';
    return;
  }
  state.dsgvo_consent = true;

  const submitBtn = document.getElementById('submitBtn');
  const submitError = document.getElementById('submitError');
  submitError.style.display = 'none';
  setLoading(submitBtn, true);
  document.getElementById('submitLabel').textContent = 'Wird gesendet…';

  const payload = {
    owner_id: state.owner_id,
    patient_id: state.isNewPatient ? null : state.patient_id,
    patient: state.isNewPatient ? state.patient : undefined,
    payment_type: state.payment_type,
    service_id: state.service_id,
    employee_id: state.employee_id,
    preferred_date: state.preferred_date,
    preferred_time: state.preferred_time,
    session_count: state.session_count,
    // GKV
    krankenkasse: state.krankenkasse,
    arzt_name: state.arzt_name,
    verordnung_datum: state.verordnung_datum,
    icd10_diagnose: state.icd10_diagnose,
    behandlungsart: state.behandlungsart || state.bg_behandlungsart,
    verordnung_sitzungen: state.verordnung_sitzungen || state.bg_anzahl,
    frequenz: state.frequenz || state.bg_frequenz,
    verordnung_typ: state.verordnung_typ,
    doppelbehandlung: state.doppelbehandlung,
    // PKV
    pkv_versicherung: state.pkv_versicherung,
    arzt_ueberweisung: state.arzt_ueberweisung,
    arzt_ueberweisung_name: state.arzt_ueberweisung_name,
    // BG
    bg_aktenzeichen: state.bg_aktenzeichen,
    bg_name: state.bg_name,
    unfalldatum: state.unfalldatum,
    durchgangsarzt: state.durchgangsarzt,
    icd10_diagnose: state.icd10_diagnose || state.bg_diagnose,
    // common
    notizen: state.notizen || null,
    dsgvo_consent: true,
  };

  try {
    await apiFetch('/booking-request/create', { method: 'POST', body: JSON.stringify(payload) });
    showSuccessScreen();
  } catch (err) {
    submitError.textContent = `Fehler beim Senden: ${err.message}. Bitte erneut versuchen.`;
    submitError.style.display = 'block';
    setLoading(submitBtn, false);
    document.getElementById('submitLabel').textContent = 'Anfrage senden';
  }
}

function showSuccessScreen() {
  hide('step-6');
  document.querySelectorAll('.br-step').forEach(s => s.classList.remove('active'));
  hide('progressBar');

  const successScreen = document.getElementById('successScreen');
  successScreen.classList.add('active');

  const email = state.isNewPatient ? state.patient.email : null;
  if (email) {
    const emailNote = document.getElementById('successEmailNote');
    document.getElementById('successEmailAddr').textContent = email;
    show(emailNote);
  }
}

// ─── Cancel flow ──────────────────────────────────────────────────────────────

async function handleCancelFlow(requestId, token) {
  hide('progressBar');
  document.querySelectorAll('.br-step').forEach(s => s.classList.remove('active'));
  document.getElementById('cancelScreen').classList.add('active');

  document.getElementById('confirmCancelBtn').addEventListener('click', async () => {
    const btn = document.getElementById('confirmCancelBtn');
    const status = document.getElementById('cancelStatus');
    btn.disabled = true;
    btn.textContent = 'Wird storniert…';
    status.textContent = '';

    try {
      await apiFetch('/booking-request/cancel', {
        method: 'POST',
        body: JSON.stringify({ request_id: requestId, token }),
      });
      btn.style.display = 'none';
      status.textContent = 'Ihre Terminanfrage wurde erfolgreich storniert.';
      status.style.color = 'var(--success)';
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Ja, stornieren';
      status.textContent = `Fehler: ${err.message}`;
      status.style.color = 'var(--error)';
    }
  });
}

// ─── Step entry side-effects ──────────────────────────────────────────────────

function onStepEnter(logicalStep) {
  rebuildStepSequence();

  switch (logicalStep) {
    case 2:
      // Load services if not yet loaded
      if (!document.getElementById('servicesGrid').children.length) {
        loadServices();
      }
      // Update session picker max based on payment type
      if (state.service_id) showSessionPicker();
      break;
    case 3:
      loadTeam();
      initCalendar();
      break;
    case 4:
      showStep4Fields();
      if (state.payment_type === 'gkv') loadKrankenkassen();
      break;
    case 6:
      buildSummary();
      break;
  }
}

// ─── Validation dispatcher ────────────────────────────────────────────────────

function validateCurrentStep() {
  switch (currentLogicalStep()) {
    case 0: return validateStep0();
    case 1: return validateStep1();
    case 2: return validateStep2();
    case 3: return validateStep3();
    case 4: return validateStep4();
    case 5: return validateStep5();
    case 6: return true; // submit handles its own validation
    default: return true;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function init() {
  const params = new URLSearchParams(window.location.search);
  const businessId = params.get('business');
  const cancelId = params.get('cancel');
  const cancelToken = params.get('token');

  // Cancel flow
  if (cancelId && cancelToken) {
    state.owner_id = businessId || null;
    handleCancelFlow(cancelId, cancelToken);
    return;
  }

  // Missing business param
  if (!businessId) {
    document.getElementById('errorScreen').classList.add('active');
    return;
  }

  state.owner_id = businessId;

  // Show wizard
  show('progressBar');
  buildProgressBar();
  rebuildStepSequence();

  // Init all steps
  initStep0();
  initStep1();
  initStep2();
  initStep3();
  initStep4();
  initStep5();
  initStep6();

  // Show first step
  showStep(currentLogicalStep());
}

document.addEventListener('DOMContentLoaded', init);
