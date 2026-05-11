// InfinityMade Onboarding — 7 step state machine + Supabase saves
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STEPS = ['account', 'business', 'owner', 'services', 'hours', 'whatsapp', 'templates', 'plan', 'done'];

const SERVICE_TEMPLATES = {
  barber: [
    { name: 'Haarschnitt',         duration: 30, price: 25 },
    { name: 'Bart',                duration: 15, price: 12 },
    { name: 'Komplett-Service',    duration: 45, price: 35 },
    { name: 'Kinderhaarschnitt',   duration: 20, price: 18 },
    { name: 'Färbung',             duration: 60, price: 45 },
  ],
  beauty: [
    { name: 'Klassische Reinigung', duration: 60, price: 55 },
    { name: 'Microneedling',        duration: 75, price: 95 },
    { name: 'Maniküre',             duration: 45, price: 30 },
    { name: 'Pediküre',             duration: 50, price: 35 },
    { name: 'Wimpernlifting',       duration: 60, price: 65 },
  ],
  nails: [
    { name: 'Maniküre',         duration: 45, price: 25 },
    { name: 'Pediküre',         duration: 50, price: 30 },
    { name: 'Gel-Modellage',    duration: 90, price: 55 },
    { name: 'Nail Art',         duration: 30, price: 15 },
    { name: 'Nagelreparatur',   duration: 20, price: 8 },
  ],
  tattoo: [
    { name: 'Beratung',         duration: 30, price: 0 },
    { name: 'Kleines Tattoo',   duration: 60, price: 120 },
    { name: 'Mittleres Tattoo', duration: 180, price: 350 },
    { name: 'Großes Tattoo',    duration: 300, price: 600 },
    { name: 'Cover-Up',         duration: 240, price: 400 },
  ],
  spa: [
    { name: 'Massage 30 Min',  duration: 30, price: 39 },
    { name: 'Massage 60 Min',  duration: 60, price: 69 },
    { name: 'Aromatherapie',   duration: 60, price: 79 },
    { name: 'Hot Stone',       duration: 75, price: 89 },
    { name: 'Paarmassage',     duration: 60, price: 129 },
  ],
  massage: [
    { name: 'Schultermassage', duration: 25, price: 35 },
    { name: 'Rückenmassage',   duration: 40, price: 50 },
    { name: 'Ganzkörper',      duration: 60, price: 75 },
    { name: 'Fußmassage',      duration: 30, price: 40 },
    { name: 'Sportmassage',    duration: 60, price: 85 },
  ],
  physiotherapy: [
    { name: 'Erstberatung',         duration: 30, price: 0 },
    { name: 'Physiotherapie 30 Min', duration: 30, price: 45 },
    { name: 'Physiotherapie 45 Min', duration: 45, price: 65 },
    { name: 'Physiotherapie 60 Min', duration: 60, price: 85 },
    { name: 'Manuelle Therapie',    duration: 45, price: 75 },
    { name: 'Kräftigungstraining',  duration: 30, price: 40 },
    { name: 'Lymphdrainage',        duration: 45, price: 70 },
  ],
  praxis: [
    { name: 'Allgemeine Beratung',   duration: 30, price: 0 },
    { name: 'Vorsorgeuntersuchung',  duration: 30, price: 0 },
    { name: 'Behandlung 30 Min',     duration: 30, price: 45 },
    { name: 'Behandlung 45 Min',     duration: 45, price: 65 },
    { name: 'Behandlung 60 Min',     duration: 60, price: 85 },
    { name: 'Sprechstunde',          duration: 15, price: 0 },
  ],
  gym: [
    { name: 'Probetraining',    duration: 60, price: 0 },
    { name: 'Personal Training', duration: 60, price: 65 },
    { name: 'Beratung',         duration: 30, price: 0 },
  ],
  other: [],
};

const DAYS = [
  { key: 'mon', label: 'Montag' },
  { key: 'tue', label: 'Dienstag' },
  { key: 'wed', label: 'Mittwoch' },
  { key: 'thu', label: 'Donnerstag' },
  { key: 'fri', label: 'Freitag' },
  { key: 'sat', label: 'Samstag' },
  { key: 'sun', label: 'Sonntag' },
];

const DEFAULT_HOURS = {
  mon: { open: '09:00', close: '18:00', closed: false },
  tue: { open: '09:00', close: '18:00', closed: false },
  wed: { open: '09:00', close: '18:00', closed: false },
  thu: { open: '09:00', close: '18:00', closed: false },
  fri: { open: '09:00', close: '18:00', closed: false },
  sat: { open: '09:00', close: '14:00', closed: false },
  sun: { open: '09:00', close: '18:00', closed: true },
};

// ---- State ----
let currentStep = 0; // index into STEPS
let userId = null;
let profile = null;
let services = [];
let calMode = null; // 'yes' | 'no'

// ---- Boot ----
init();

async function init() {
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.querySelectorAll('[data-back]').forEach(el => el.addEventListener('click', () => goToStep(currentStep - 1)));

  bindAccount();
  bindBusiness();
  bindOwner();
  bindServices();
  bindHours();
  bindWhatsapp();
  bindTemplates();
  bindPlan();

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    userId = session.user.id;
    document.getElementById('logoutBtn').hidden = false;
    await loadProfile();
    // Allow ?step=<name> to jump directly (e.g. from dashboard "Plan wählen")
    const requestedStep = new URLSearchParams(location.search).get('step');
    let stepName;
    if (requestedStep && STEPS.includes(requestedStep)) {
      stepName = requestedStep;
    } else {
      stepName = profile?.onboarding_step || 'business';
    }
    if (stepName === 'done') {
      window.location.href = 'dashboard.html';
      return;
    }
    goToStep(STEPS.indexOf(stepName));
  } else {
    goToStep(0);
  }
}

async function loadProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('profile load error', error);
    return;
  }
  profile = data || null;

  if (!profile) {
    // First-time: create skeleton row
    const { data: created, error: insertErr } = await supabase
      .from('profiles')
      .insert({ id: userId, onboarding_step: 'business' })
      .select()
      .single();
    if (insertErr) {
      showError('Profil konnte nicht erstellt werden: ' + insertErr.message);
      return;
    }
    profile = created;
  }

  // load services (may exist if user is editing later)
  const { data: svcs } = await supabase
    .from('business_services')
    .select('*')
    .eq('business_id', userId)
    .order('display_order');
  services = svcs || [];

  prefillForms();
}

function prefillForms() {
  if (!profile) return;
  if (profile.business_name) document.getElementById('bizName').value = profile.business_name;
  if (profile.sector) document.getElementById('bizSector').value = profile.sector;
  if (profile.city) document.getElementById('bizCity').value = profile.city;
  if (profile.language) document.getElementById('bizLanguage').value = profile.language;
  if (profile.zip) document.getElementById('bizZip').value = profile.zip;
  if (profile.street) document.getElementById('bizStreet').value = profile.street;
  if (profile.house_number) document.getElementById('bizHouse').value = profile.house_number;
  if (profile.owner_first_name) document.getElementById('ownerFirstName').value = profile.owner_first_name;
  if (profile.owner_last_name) document.getElementById('ownerLastName').value = profile.owner_last_name;
  if (profile.accepts_bookings === false) {
    document.querySelectorAll('#bookingsToggle .ob-toggle-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#bookingsToggle .ob-toggle-btn[data-value="false"]').classList.add('active');
  }

  if (profile.cal_username) document.getElementById('calUsername').value = profile.cal_username;

  if (profile.whatsapp_number) document.getElementById('waNumber').value = profile.whatsapp_number;
  if (profile.whatsapp_phone_number_id) document.getElementById('waPhoneNumberId').value = profile.whatsapp_phone_number_id;
  if (profile.whatsapp_waba_id) document.getElementById('waBaId').value = profile.whatsapp_waba_id;

  const tpl = profile.message_templates || {};
  if (tpl.greeting) document.getElementById('tplGreeting').value = tpl.greeting;
  if (tpl.opt_in) document.getElementById('tplOptIn').value = tpl.opt_in;
  if (tpl.reminder) document.getElementById('tplReminder').value = tpl.reminder;
  if (tpl.reactivation) document.getElementById('tplReactivation').value = tpl.reactivation;
}

// ---- Navigation ----
function goToStep(idx) {
  if (idx < 0) idx = 0;
  if (idx >= STEPS.length) idx = STEPS.length - 1;
  currentStep = idx;
  const stepName = STEPS[idx];

  document.querySelectorAll('.ob-step').forEach(el => {
    el.hidden = el.dataset.step !== stepName;
  });

  // Progress
  const visibleSteps = STEPS.length - 1; // exclude 'done'
  const pct = stepName === 'done' ? 100 : Math.round(((idx + 1) / visibleSteps) * 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('stepNum').textContent = stepName === 'done' ? '✓' : (idx + 1);

  // Step-specific render hooks
  if (stepName === 'services') renderServices();
  if (stepName === 'hours') renderHours();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveStepProgress(nextStepName) {
  if (!userId) return;
  await supabase.from('profiles').update({ onboarding_step: nextStepName }).eq('id', userId);
  if (profile) profile.onboarding_step = nextStepName;
}

// ---- Step 0: Account ----
function bindAccount() {
  let mode = 'signup';
  const acceptWrap = document.querySelector('#accountForm .ob-accept');
  document.querySelectorAll('#accountToggle .ob-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#accountToggle .ob-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.dataset.mode;
      document.getElementById('accountSubmit').textContent = mode === 'signup'
        ? 'Konto erstellen & weiter →'
        : 'Anmelden & weiter →';
      const pwInput = document.getElementById('accountPassword');
      pwInput.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
      if (acceptWrap) acceptWrap.style.display = mode === 'signup' ? 'flex' : 'none';
    });
  });

  document.getElementById('accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (mode === 'signup') {
      const accepted = document.getElementById('accountAccept')?.checked;
      if (!accepted) { showError('Bitte akzeptieren Sie die AGB und die Datenschutzerklärung.'); return; }
    }
    const submit = document.getElementById('accountSubmit');
    submit.disabled = true;
    const orig = submit.textContent;
    submit.textContent = 'Bitte warten…';

    const email = document.getElementById('accountEmail').value.trim();
    const password = document.getElementById('accountPassword').value;

    try {
      let result;
      if (mode === 'signup') {
        result = await supabase.auth.signUp({ email, password });
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
      }

      if (result.error) throw result.error;

      const session = result.data.session || (await supabase.auth.getSession()).data.session;
      if (!session?.user) {
        // Email confirmation required
        showError('Bitte bestätigen Sie Ihre E-Mail (Posteingang prüfen) und melden Sie sich anschließend an.');
        submit.disabled = false;
        submit.textContent = orig;
        return;
      }

      userId = session.user.id;
      document.getElementById('logoutBtn').hidden = false;
      await loadProfile();
      goToStep(1); // business
    } catch (err) {
      showError(err.message || 'Anmeldung fehlgeschlagen');
      submit.disabled = false;
      submit.textContent = orig;
    }
  });
}

// ---- Step 1: Business ----
function bindBusiness() {
  document.getElementById('businessForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const business_name = document.getElementById('bizName').value.trim();
    const sector = document.getElementById('bizSector').value;
    const city = document.getElementById('bizCity').value.trim();
    const language = document.getElementById('bizLanguage').value;
    const zip = document.getElementById('bizZip').value.trim();
    const street = document.getElementById('bizStreet').value.trim();
    const house_number = document.getElementById('bizHouse').value.trim();

    const { error } = await supabase.from('profiles').update({
      business_name, sector, city, language, zip, street, house_number, onboarding_step: 'owner'
    }).eq('id', userId);

    if (error) return showError(error.message);
    profile = { ...profile, business_name, sector, city, language, zip, street, house_number, onboarding_step: 'owner' };
    goToStep(2);
  });
}

// ---- Step 2: Owner Info ----
function bindOwner() {
  let acceptsBookings = true;
  document.querySelectorAll('#bookingsToggle .ob-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#bookingsToggle .ob-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      acceptsBookings = btn.dataset.value === 'true';
    });
  });

  document.getElementById('ownerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const owner_first_name = document.getElementById('ownerFirstName').value.trim();
    const owner_last_name = document.getElementById('ownerLastName').value.trim();
    if (!owner_first_name || !owner_last_name) return showError('Vorname und Nachname sind erforderlich.');

    const { error } = await supabase.from('profiles').update({
      owner_first_name, owner_last_name, accepts_bookings: acceptsBookings, onboarding_step: 'services'
    }).eq('id', userId);

    if (error) return showError(error.message);
    profile = { ...profile, owner_first_name, owner_last_name, accepts_bookings: acceptsBookings, onboarding_step: 'services' };
    goToStep(3);
  });
}

// ---- Step 3: Services ----
function renderServices() {
  const list = document.getElementById('servicesList');
  list.innerHTML = '';

  const tpl = SERVICE_TEMPLATES[profile?.sector] || SERVICE_TEMPLATES.other;
  // Merge: existing services first, then template suggestions not yet present
  const existingNames = new Set((services || []).map(s => s.name.toLowerCase()));
  const rows = [
    ...(services || []).map(s => ({
      checked: s.is_active !== false,
      name: s.name,
      duration: s.duration_minutes || 30,
      price: s.price_eur || '',
      id: s.id,
    })),
    ...tpl.filter(t => !existingNames.has(t.name.toLowerCase())).map(t => ({
      checked: true,
      name: t.name,
      duration: t.duration,
      price: t.price || '',
    })),
  ];

  if (rows.length === 0) rows.push({ checked: true, name: '', duration: 30, price: '' });

  rows.forEach(r => list.appendChild(createServiceRow(r)));
}

function createServiceRow(r = {}) {
  const div = document.createElement('div');
  div.className = 'ob-service-row';
  div.innerHTML = `
    <input type="checkbox" class="svc-active" ${r.checked !== false ? 'checked' : ''} />
    <input type="text" class="svc-name" placeholder="Dienstleistung" value="${escapeAttr(r.name || '')}" />
    <input type="number" class="svc-duration" placeholder="Min" min="5" max="480" step="1" value="${r.duration || 30}" />
    <input type="number" class="svc-price" placeholder="€" min="0" max="9999" step="0.01" value="${r.price ?? ''}" />
    <button type="button" class="ob-service-remove" title="Entfernen">×</button>
  `;
  if (r.id) div.dataset.svcId = r.id;
  div.querySelector('.ob-service-remove').addEventListener('click', () => div.remove());
  return div;
}

function bindServices() {
  document.getElementById('addServiceBtn').addEventListener('click', () => {
    document.getElementById('servicesList').appendChild(createServiceRow());
  });

  document.getElementById('servicesForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const rows = [...document.querySelectorAll('#servicesList .ob-service-row')];
    const items = rows.map((row, i) => ({
      id: row.dataset.svcId || undefined,
      business_id: userId,
      name: row.querySelector('.svc-name').value.trim(),
      duration_minutes: parseInt(row.querySelector('.svc-duration').value, 10) || 30,
      price_eur: parseFloat(String(row.querySelector('.svc-price').value).replace(',', '.')) || null,
      is_active: row.querySelector('.svc-active').checked,
      display_order: i,
    })).filter(s => s.name);

    if (items.length === 0) return showError('Mindestens eine Dienstleistung wird benötigt.');

    try {
      const { error: delBs } = await supabase.from('business_services').delete().eq('business_id', userId);
      if (delBs) throw delBs;
      const { error: delEs } = await supabase.from('employee_services').delete().eq('employee_id', userId);
      if (delEs) throw delEs;
      const { data: oldSvcs } = await supabase.from('services').select('id').eq('owner_id', userId);
      if (oldSvcs?.length) {
        const { error: delSvc } = await supabase.from('services').delete().in('id', oldSvcs.map(s => s.id));
        if (delSvc) throw delSvc;
      }

      const svcInserts = items.map(s => ({
        owner_id: userId,
        title: s.name,
        duration_minutes: s.duration_minutes,
        price: s.price_eur,
        buffer_time: 0,
        is_online_meeting: false,
      }));
      const { data: inserted, error: svcErr } = await supabase.from('services').insert(svcInserts).select();
      if (svcErr) throw svcErr;

      const empRows = inserted.map(s => ({ employee_id: userId, service_id: s.id }));
      const { error: empErr } = await supabase.from('employee_services').insert(empRows);
      if (empErr) throw empErr;

      const bsInserts = items.map(({ id, ...rest }) => rest);
      const { error: bsErr } = await supabase.from('business_services').insert(bsInserts);
      if (bsErr) throw bsErr;

      services = items;

      // Auto-provision event-types in Cal.com (best-effort, non-blocking)
      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (session) {
          fetch('/api/cal/create-event-types', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).catch(() => {}); // fire-and-forget; errors surface in dashboard later
        }
      } catch {}

      await saveStepProgress('hours');
      goToStep(4);
    } catch (err) {
      showError(err.message);
    }
  });
}

// ---- Step 4: Hours ----
function renderHours() {
  const grid = document.getElementById('hoursGrid');
  grid.innerHTML = '';
  const stored = profile?.working_hours && Object.keys(profile.working_hours).length
    ? profile.working_hours
    : DEFAULT_HOURS;

  DAYS.forEach(({ key, label }) => {
    const h = stored[key] || DEFAULT_HOURS[key];
    const row = document.createElement('div');
    row.className = 'ob-hours-row' + (h.closed ? ' is-closed' : '');
    row.dataset.day = key;
    row.innerHTML = `
      <span class="day-name">${label}</span>
      <label>
        <input type="checkbox" class="day-open" ${h.closed ? '' : 'checked'} />
        <span>Geöffnet</span>
      </label>
      <input type="time" class="day-from" value="${h.open || '09:00'}" />
      <span class="ob-dash">–</span>
      <input type="time" class="day-to" value="${h.close || '18:00'}" />
    `;
    row.querySelector('.day-open').addEventListener('change', (e) => {
      row.classList.toggle('is-closed', !e.target.checked);
    });
    grid.appendChild(row);
  });
}

function bindHours() {
  document.getElementById('hoursForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = {};
    document.querySelectorAll('.ob-hours-row').forEach(row => {
      const key = row.dataset.day;
      const open = row.querySelector('.day-open').checked;
      out[key] = open
        ? { open: row.querySelector('.day-from').value, close: row.querySelector('.day-to').value, closed: false }
        : { open: null, close: null, closed: true };
    });

    const dayMap = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
    const whRows = [];
    Object.entries(out).forEach(([key, val]) => {
      if (dayMap[key] === undefined) return;
      whRows.push({
        user_id: userId,
        day_of_week: dayMap[key],
        start_time: val.closed ? null : val.open,
        end_time: val.closed ? null : val.close,
        is_active: !val.closed,
      });
    });

    await supabase.from('working_hours').delete().eq('user_id', userId);
    if (whRows.length) {
      const { error: whErr } = await supabase.from('working_hours').insert(whRows);
      if (whErr) console.error('working_hours insert', whErr);
    }

    const { error } = await supabase.from('profiles').update({
      working_hours: out, onboarding_step: 'whatsapp',
    }).eq('id', userId);
    if (error) return showError(error.message);
    profile = { ...profile, working_hours: out, onboarding_step: 'whatsapp' };

    goToStep(5);
  });
}

// ---- Step 5: WhatsApp ----
function bindWhatsapp() {
  document.getElementById('whatsappForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const number = normalizePhone(document.getElementById('waNumber').value);
    const phoneNumberId = document.getElementById('waPhoneNumberId').value.trim() || null;
    const wabaId = document.getElementById('waBaId').value.trim() || null;
    const accessToken = document.getElementById('waAccessToken').value.trim();

    try {
      if (accessToken) {
        const { error: rpcErr } = await supabase.rpc('business_save_secret', {
          p_user_id: userId,
          p_secret_kind: 'whatsapp_access_token',
          p_secret_value: accessToken,
        });
        if (rpcErr) throw rpcErr;
      }

      const { error } = await supabase.from('profiles').update({
        whatsapp_number: number,
        whatsapp_phone_number_id: phoneNumberId,
        whatsapp_waba_id: wabaId,
        onboarding_step: 'templates',
      }).eq('id', userId);
      if (error) throw error;

      profile = { ...profile, whatsapp_number: number, whatsapp_phone_number_id: phoneNumberId, whatsapp_waba_id: wabaId, onboarding_step: 'templates' };
      goToStep(6);
    } catch (err) {
      showError(err.message);
    }
  });
}

function normalizePhone(input) {
  return (input || '').replace(/[\s\-()]/g, '');
}

// Strip cal.com/ prefix, leading @, trailing slashes, lowercase
function cleanCalUsername(input) {
  return (input || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^cal\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

// ---- Step 6: Templates ----
function bindTemplates() {
  document.getElementById('templatesForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const message_templates = {
      greeting: document.getElementById('tplGreeting').value,
      opt_in: document.getElementById('tplOptIn').value,
      reminder: document.getElementById('tplReminder').value,
      reactivation: document.getElementById('tplReactivation').value,
    };

    const { error } = await supabase.from('profiles').update({
      message_templates,
      onboarding_step: 'plan',
    }).eq('id', userId);
    if (error) return showError(error.message);

    profile = { ...profile, message_templates, onboarding_step: 'plan' };
    goToStep(7); // plan
  });
}

// ---- Step 8: Plan & Payment ----
function bindPlan() {
  const intervalBtns = document.querySelectorAll('.plan-toggle-btn');
  let currentInterval = 'month';

  intervalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      intervalBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentInterval = btn.dataset.interval;
      // Update prices + billing label
      document.querySelectorAll('.plan-price-num').forEach(el => {
        el.textContent = currentInterval === 'year' ? el.dataset.year : el.dataset.month;
      });
      document.querySelectorAll('[data-billing]').forEach(el => {
        el.textContent = currentInterval === 'year'
          ? 'jährlich abgerechnet · 15% gespart'
          : 'monatlich abgerechnet';
      });
    });
  });

  document.querySelectorAll('.plan-select').forEach(btn => {
    btn.addEventListener('click', async () => {
      const planSlug = btn.dataset.plan;
      btn.disabled = true;
      btn.textContent = 'Weiterleitung...';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ planSlug, interval: currentInterval }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          showError(data.error || 'Checkout konnte nicht gestartet werden.');
          btn.disabled = false;
          btn.textContent = `${planSlug.charAt(0).toUpperCase() + planSlug.slice(1)} wählen`;
          return;
        }
        // Save chosen plan in profile before redirect (so we have it if checkout abandoned)
        await supabase.from('profiles').update({
          plan: planSlug,
          billing_interval: currentInterval,
        }).eq('id', userId);
        window.location.href = data.url;
      } catch (err) {
        showError(err.message);
        btn.disabled = false;
        btn.textContent = `${planSlug.charAt(0).toUpperCase() + planSlug.slice(1)} wählen`;
      }
    });
  });
}

// ---- Helpers ----
async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = msg;
  box.hidden = false;
  setTimeout(() => { box.hidden = true; }, 6000);
}

function escapeAttr(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
