// Praxura Onboarding — 8 step state machine + Supabase saves
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PRAXIS_SECTORS = ['physiotherapy', 'logopaedie', 'ergotherapie', 'podologie'];

const STEPS = ['account', 'business', 'billing', 'owner', 'services', 'hours', 'plan', 'done'];

const SERVICE_TEMPLATES = {
  barber: [
    { name: 'Haarschnitt', price_config: { durations: { '15': { price: 15, active: true }, '30': { price: 25, active: true }, '45': { price: 35, active: true } } } },
    { name: 'Bart schneiden', price_config: { durations: { '15': { price: 10, active: true }, '30': { price: 15, active: true } } } },
    { name: 'Rasur', price_config: { durations: { '15': { price: 10, active: true }, '30': { price: 15, active: true } } } },
    { name: 'Färbung', price_config: { durations: { '60': { price: 45, active: true }, '90': { price: 65, active: true }, '120': { price: 85, active: true } } } },
    { name: 'Komplett-Service', price_config: { durations: { '45': { price: 40, active: true }, '60': { price: 50, active: true }, '90': { price: 65, active: true } } } },
    { name: 'Kinderhaarschnitt', price_config: { durations: { '15': { price: 10, active: true }, '30': { price: 15, active: true } } } },
    { name: 'Augenbrauen', price_config: { durations: { '15': { price: 8, active: true } } } },
  ],
  beauty: [
    { name: 'Behandlung', price_config: { durations: { '30': { price: 40, active: true }, '45': { price: 60, active: true }, '60': { price: 80, active: true } } } },
    { name: 'Kosmetische Reinigung', price_config: { durations: { '60': { price: 55, active: true }, '90': { price: 75, active: true } } } },
    { name: 'Anti-Aging', price_config: { durations: { '60': { price: 70, active: true }, '90': { price: 95, active: true }, '120': { price: 120, active: true } } } },
    { name: 'Make-up', price_config: { durations: { '45': { price: 45, active: true }, '60': { price: 60, active: true }, '90': { price: 80, active: true } } } },
    { name: 'Wimpernverlängerung', price_config: { durations: { '60': { price: 50, active: true }, '90': { price: 70, active: true }, '120': { price: 90, active: true } } } },
    { name: 'Faltenglättung', price_config: { durations: { '45': { price: 80, active: true }, '60': { price: 100, active: true }, '90': { price: 130, active: true } } } },
  ],
  nails: [
    { name: 'Nagelmodellage', price_config: { durations: { '30': { price: 25, active: true }, '45': { price: 35, active: true }, '60': { price: 50, active: true } } } },
    { name: 'Nagelreparatur', price_config: { durations: { '15': { price: 10, active: true }, '30': { price: 15, active: true } } } },
    { name: 'French Manicure', price_config: { durations: { '30': { price: 20, active: true }, '45': { price: 30, active: true } } } },
    { name: 'Gel-Nägel', price_config: { durations: { '45': { price: 35, active: true }, '60': { price: 45, active: true }, '90': { price: 60, active: true } } } },
    { name: 'Acryl-Nägel', price_config: { durations: { '45': { price: 35, active: true }, '60': { price: 45, active: true }, '90': { price: 60, active: true } } } },
    { name: 'Nagelpflege', price_config: { durations: { '30': { price: 20, active: true }, '45': { price: 30, active: true } } } },
  ],
  tattoo: [
    { name: 'Tattoo', price_config: { durations: { '60': { price: 80, active: true }, '120': { price: 150, active: true }, '180': { price: 220, active: true } } } },
    { name: 'Cover-up', price_config: { durations: { '60': { price: 90, active: true }, '120': { price: 160, active: true }, '180': { price: 240, active: true } } } },
    { name: 'Piercing', price_config: { durations: { '15': { price: 20, active: true }, '30': { price: 30, active: true }, '45': { price: 40, active: true } } } },
  ],
  spa: [
    { name: 'Massage', price_config: { durations: { '30': { price: 39, active: true }, '60': { price: 69, active: true }, '90': { price: 99, active: true } } } },
    { name: 'Wellness', price_config: { durations: { '60': { price: 80, active: true }, '90': { price: 110, active: true }, '120': { price: 140, active: true } } } },
    { name: 'Aromatherapie', price_config: { durations: { '30': { price: 35, active: true }, '60': { price: 60, active: true }, '90': { price: 85, active: true } } } },
    { name: 'Hot Stone', price_config: { durations: { '60': { price: 75, active: true }, '90': { price: 100, active: true }, '120': { price: 130, active: true } } } },
    { name: 'Body Wraps', price_config: { durations: { '60': { price: 65, active: true }, '90': { price: 90, active: true }, '120': { price: 115, active: true } } } },
  ],
  massage: [
    { name: 'Massage', price_config: { durations: { '30': { price: 40, active: true }, '45': { price: 55, active: true }, '60': { price: 75, active: true } } } },
    { name: 'Thai Massage', price_config: { durations: { '60': { price: 70, active: true }, '90': { price: 95, active: true }, '120': { price: 120, active: true } } } },
    { name: 'Rückenmassage', price_config: { durations: { '30': { price: 35, active: true }, '45': { price: 50, active: true }, '60': { price: 65, active: true } } } },
    { name: 'Fußmassage', price_config: { durations: { '30': { price: 30, active: true }, '45': { price: 40, active: true }, '60': { price: 55, active: true } } } },
    { name: 'Sportmassage', price_config: { durations: { '30': { price: 40, active: true }, '45': { price: 55, active: true }, '60': { price: 70, active: true } } } },
    { name: 'Entspannungsmassage', price_config: { durations: { '60': { price: 65, active: true }, '90': { price: 90, active: true }, '120': { price: 115, active: true } } } },
  ],
  physiotherapy: [
    { name: 'Erstberatung', code: null, price_config: { durations: { '15': { price: 30, active: true }, '30': { price: 45, active: true } } } },
    { name: 'Krankengymnastik (KG)', code: 'KG', price_config: { durations: { '30': { price: 45, active: true }, '45': { price: 65, active: true }, '60': { price: 85, active: true } } } },
    { name: 'Manuelle Therapie', code: 'MT', price_config: { durations: { '30': { price: 50, active: true }, '45': { price: 70, active: true }, '60': { price: 90, active: true } } } },
    { name: 'Manuelle Lymphdrainage', code: 'MLD', price_config: { durations: { '30': { price: 40, active: true }, '45': { price: 55, active: true }, '60': { price: 70, active: true } } } },
    { name: 'Kräftigungstraining', code: null, price_config: { durations: { '30': { price: 40, active: true }, '45': { price: 55, active: true }, '60': { price: 70, active: true } } } },
    { name: 'Klassische Massage / Sportmassage', code: 'KMT', price_config: { durations: { '30': { price: 40, active: true }, '45': { price: 55, active: true }, '60': { price: 70, active: true } } } },
    { name: 'Elektrotherapie', code: 'ES', price_config: { durations: { '30': { price: 35, active: true }, '45': { price: 50, active: true }, '60': { price: 65, active: true } } } },
    { name: 'Ultraschall', code: 'US', price_config: { durations: { '30': { price: 35, active: true }, '45': { price: 50, active: true }, '60': { price: 65, active: true } } } },
    { name: 'Schmerztherapie', code: null, price_config: { durations: { '30': { price: 45, active: true }, '45': { price: 60, active: true }, '60': { price: 80, active: true } } } },
  ],
  logopaedie: [
    { name: 'Erstdiagnostik/Befund', code: null, price_config: { durations: { '45': { price: 80, active: true }, '60': { price: 100, active: true } } } },
    { name: 'Sprachtherapie', code: null, price_config: { durations: { '30': { price: 45, active: true }, '45': { price: 60, active: true }, '60': { price: 80, active: true } } } },
    { name: 'Sprechtherapie', code: null, price_config: { durations: { '30': { price: 45, active: true }, '45': { price: 60, active: true }, '60': { price: 80, active: true } } } },
    { name: 'Stimmtherapie', code: null, price_config: { durations: { '30': { price: 45, active: true }, '45': { price: 60, active: true }, '60': { price: 80, active: true } } } },
    { name: 'Schlucktherapie', code: null, price_config: { durations: { '30': { price: 50, active: true }, '45': { price: 70, active: true }, '60': { price: 90, active: true } } } },
    { name: 'Beratung', code: null, price_config: { durations: { '15': { price: 25, active: true }, '30': { price: 45, active: true } } } },
  ],
  ergotherapie: [
    { name: 'Erstgespräch/Befund', code: null, price_config: { durations: { '45': { price: 75, active: true }, '60': { price: 95, active: true } } } },
    { name: 'Motorisch-funktionelle Behandlung', code: null, price_config: { durations: { '30': { price: 40, active: true }, '45': { price: 55, active: true }, '60': { price: 70, active: true } } } },
    { name: 'Sensomotorisch-perzeptive Behandlung', code: null, price_config: { durations: { '30': { price: 45, active: true }, '45': { price: 60, active: true }, '60': { price: 80, active: true } } } },
    { name: 'Psychisch-funktionelle Behandlung', code: null, price_config: { durations: { '30': { price: 50, active: true }, '45': { price: 65, active: true }, '60': { price: 85, active: true } } } },
    { name: 'Hirnleistungstraining', code: null, price_config: { durations: { '30': { price: 35, active: true }, '45': { price: 50, active: true } } } },
    { name: 'Beratung', code: null, price_config: { durations: { '15': { price: 25, active: true }, '30': { price: 45, active: true } } } },
  ],
  podologie: [
    { name: 'Podologische Erstbehandlung', code: null, price_config: { durations: { '30': { price: 35, active: true }, '45': { price: 48, active: true } } } },
    { name: 'Hornhautabtragung', code: null, price_config: { durations: { '15': { price: 20, active: true }, '30': { price: 35, active: true } } } },
    { name: 'Nagelbearbeitung', code: null, price_config: { durations: { '15': { price: 20, active: true }, '30': { price: 35, active: true } } } },
    { name: 'Hühneraugenbehandlung', code: null, price_config: { durations: { '15': { price: 22, active: true }, '30': { price: 38, active: true } } } },
    { name: 'Komplexbehandlung (beide Füße)', code: null, price_config: { durations: { '45': { price: 55, active: true }, '60': { price: 70, active: true } } } },
    { name: 'Beratung', code: null, price_config: { durations: { '15': { price: 20, active: true }, '30': { price: 35, active: true } } } },
  ],
  restaurant: [
    { name: 'Tischreservierung', price_config: { durations: { '60': { price: 0, active: true }, '90': { price: 0, active: true }, '120': { price: 0, active: true } } } },
    { name: 'Gruppenreservierung', price_config: { durations: { '60': { price: 0, active: true }, '90': { price: 0, active: true }, '120': { price: 0, active: true } } } },
    { name: 'Event-Reservierung', price_config: { durations: { '120': { price: 0, active: true }, '180': { price: 0, active: true }, '240': { price: 0, active: true } } } },
  ],
  other: [
    { name: 'Behandlung', price_config: { durations: { '30': { price: 40, active: true }, '45': { price: 60, active: true }, '60': { price: 80, active: true } } } },
    { name: 'Beratung', price_config: { durations: { '30': { price: 30, active: true }, '45': { price: 45, active: true } } } },
    { name: 'Diagnostik', price_config: { durations: { '30': { price: 50, active: true }, '45': { price: 70, active: true }, '60': { price: 90, active: true } } } },
  ],
  praxis: [
    { name: 'Behandlung', price_config: { durations: { '15': { price: 0, active: true }, '30': { price: 0, active: true }, '45': { price: 65, active: true }, '60': { price: 85, active: true } } } },
    { name: 'Beratung', price_config: { durations: { '15': { price: 0, active: true }, '30': { price: 0, active: true } } } },
    { name: 'Kontrolluntersuchung', price_config: { durations: { '15': { price: 0, active: true }, '30': { price: 0, active: true } } } },
    { name: 'Akupunktur', price_config: { durations: { '30': { price: 50, active: true }, '45': { price: 70, active: true }, '60': { price: 90, active: true } } } },
    { name: 'Chiropraktik', price_config: { durations: { '30': { price: 50, active: true }, '45': { price: 70, active: true }, '60': { price: 90, active: true } } } },
  ],
  gym: [
    { name: 'Training', price_config: { durations: { '30': { price: 20, active: true }, '60': { price: 40, active: true }, '90': { price: 60, active: true } } } },
    { name: 'Persönliches Training', price_config: { durations: { '60': { price: 50, active: true }, '90': { price: 70, active: true }, '120': { price: 90, active: true } } } },
    { name: 'Gruppentraining', price_config: { durations: { '60': { price: 15, active: true }, '90': { price: 20, active: true }, '120': { price: 25, active: true } } } },
    { name: 'Yoga', price_config: { durations: { '60': { price: 20, active: true }, '90': { price: 30, active: true }, '120': { price: 40, active: true } } } },
    { name: 'EMS-Training', price_config: { durations: { '30': { price: 30, active: true }, '45': { price: 40, active: true }, '60': { price: 50, active: true } } } },
  ],
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
  bindBilling();
  bindOwner();
  bindServices();
  bindHours();
  bindPlan();

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    userId = session.user.id;
    document.getElementById('logoutBtn').hidden = false;
    await loadProfile();
    const requestedStep = new URLSearchParams(location.search).get('step');
    let stepName;
    if (requestedStep && STEPS.includes(requestedStep)) {
      stepName = requestedStep;
    } else {
      stepName = profile?.onboarding_step || 'business';
    }
    // WhatsApp/templates steps are purged. Map legacy 'whatsapp' or 'templates' values to 'plan'
    if (stepName === 'whatsapp' || stepName === 'templates') stepName = 'plan';
    if (stepName === 'done') {
      window.location.href = 'dashboard.html';
      return;
    }
    goToStep(STEPS.indexOf(stepName));
  } else {
    // New onboarding flow: no auth yet, load from sessionStorage
    loadSessionProfile();
    goToStep(STEPS.indexOf('account'));
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

  const { data: svcs } = await supabase
    .from('business_services')
    .select('*')
    .eq('business_id', userId)
    .order('display_order');
  services = svcs || [];

  prefillForms();
}

function loadSessionProfile() {
  const sp = sessionStorage.getItem('onboarding_profile');
  profile = sp ? JSON.parse(sp) : {};
  const ss = sessionStorage.getItem('onboarding_services');
  services = ss ? JSON.parse(ss) : [];
}

function saveSessionProfile() {
  sessionStorage.setItem('onboarding_profile', JSON.stringify(profile || {}));
  sessionStorage.setItem('onboarding_services', JSON.stringify(services || []));
}

function prefillForms() {
  if (!profile) return;
  if (typeof window.__refreshDtaVisibility === 'function') window.__refreshDtaVisibility();
  if (profile.business_name) document.getElementById('bizName').value = profile.business_name;
  if (profile.sector) document.getElementById('bizSector').value = profile.sector;
  if (profile.city) document.getElementById('bizCity').value = profile.city;
  if (profile.zip) document.getElementById('bizZip').value = profile.zip;
  if (profile.street) document.getElementById('bizStreet').value = profile.street;
  if (profile.house_number) document.getElementById('bizHouse').value = profile.house_number;
  if (profile.owner_first_name) document.getElementById('ownerFirstName').value = profile.owner_first_name;
  if (profile.owner_last_name) document.getElementById('ownerLastName').value = profile.owner_last_name;
  if (profile.accepts_bookings === false) {
    document.querySelectorAll('#bookingsToggle .ob-toggle-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#bookingsToggle .ob-toggle-btn[data-value="false"]').classList.add('active');
  }

  if (profile.booking_slug) document.getElementById('bookingSlug').value = profile.booking_slug;

  if (profile.ik_number) document.getElementById('bizIk').value = profile.ik_number;
  if (profile.bank_name) document.getElementById('bizBankName').value = profile.bank_name;
  if (profile.iban) document.getElementById('bizIban').value = profile.iban;
  if (profile.bic) document.getElementById('bizBic').value = profile.bic;
  if (profile.steuernummer) document.getElementById('bizSteuernummer').value = profile.steuernummer;
  if (profile.ust_id) document.getElementById('bizUstId').value = profile.ust_id;
  if (profile.tax_exempt_note !== undefined && profile.tax_exempt_note !== null) {
    document.getElementById('bizTaxExempt').checked = profile.tax_exempt_note === '§ 4 Nr. 14 UStG';
  }
}

// ---- Navigation ----
function isStepApplicable(stepName) {
  if (stepName === 'billing') {
    return PRAXIS_SECTORS.includes(profile?.sector || '');
  }
  return true;
}

function goToStep(idx) {
  if (idx < 0) idx = 0;
  if (idx >= STEPS.length) idx = STEPS.length - 1;

  const direction = idx - currentStep;
  
  if (direction > 0) {
    while (idx < STEPS.length && !isStepApplicable(STEPS[idx])) {
      idx++;
    }
    if (idx >= STEPS.length) idx = STEPS.length - 1;
  } else if (direction < 0) {
    while (idx >= 0 && !isStepApplicable(STEPS[idx])) {
      idx--;
    }
    if (idx < 0) idx = 0;
  }

  currentStep = idx;
  const stepName = STEPS[idx];

  document.querySelectorAll('.ob-step').forEach(el => {
    el.hidden = el.dataset.step !== stepName;
  });

  // Progress
  const applicableSteps = STEPS.filter(name => name !== 'done' && isStepApplicable(name));
  const currentOrdinal = applicableSteps.indexOf(stepName) + 1;
  const totalCount = applicableSteps.length;

  const pct = stepName === 'done' ? 100 : Math.round((currentOrdinal / totalCount) * 100);
  
  const progressFillEl = document.getElementById('progressFill');
  if (progressFillEl) progressFillEl.style.width = pct + '%';
  
  const stepNumEl = document.getElementById('stepNum');
  if (stepNumEl) stepNumEl.textContent = stepName === 'done' ? '✓' : currentOrdinal;

  const totalStepsEl = document.getElementById('totalSteps');
  if (totalStepsEl) totalStepsEl.textContent = totalCount;

  // Update dynamic step-tag in the active step header
  const currentStepEl = document.querySelector(`.ob-step[data-step="${stepName}"]`);
  if (currentStepEl) {
    const tagEl = currentStepEl.querySelector('.ob-step-tag');
    if (tagEl && stepName !== 'done') {
      tagEl.textContent = `Schritt ${currentOrdinal} / ${totalCount}`;
    }
  }

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

// ---- Password reveal toggles ----
document.querySelectorAll('.ob-pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.querySelector('.ob-eye-icon').hidden = show;
    btn.querySelector('.ob-eye-off-icon').hidden = !show;
    btn.setAttribute('aria-label', show ? 'Passwort verbergen' : 'Passwort anzeigen');
  });
});

// ---- Step 0: Account ----
function bindAccount() {
  let mode = 'signup';
  const acceptWrap = document.querySelector('#accountForm .ob-accept');
  const confirmWrap = document.getElementById('accountConfirmWrap');
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
      if (confirmWrap) confirmWrap.style.display = mode === 'signup' ? '' : 'none';
    });
  });

  document.getElementById('accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('accountEmail').value.trim();
    const password = document.getElementById('accountPassword').value;

    if (!email) { showError('Bitte geben Sie Ihre E-Mail-Adresse ein.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('Bitte geben Sie eine gültige E-Mail-Adresse ein.'); return; }
    if (!password) { showError('Bitte geben Sie ein Passwort ein.'); return; }
    if (mode === 'signup') {
      if (password.length < 8) { showError('Das Passwort muss mindestens 8 Zeichen lang sein.'); return; }
      const confirmPassword = document.getElementById('accountPasswordConfirm').value;
      if (!confirmPassword) { showError('Bitte bestätigen Sie Ihr Passwort.'); return; }
      if (password !== confirmPassword) { showError('Die Passwörter stimmen nicht überein.'); return; }
      const accepted = document.getElementById('accountAccept')?.checked;
      if (!accepted) { showError('Bitte akzeptieren Sie die AGB und die Datenschutzerklärung.'); return; }
    }
    const submit = document.getElementById('accountSubmit');
    submit.disabled = true;
    const orig = submit.textContent;
    submit.textContent = 'Bitte warten…';

    try {
      if (mode === 'signup') {
        // New flow: store in sessionStorage, create Supabase user after payment
        sessionStorage.setItem('onboarding_email', email);
        sessionStorage.setItem('onboarding_password', password);
        profile = { ...profile, email };
        saveSessionProfile();
        goToStep(STEPS.indexOf('business'));
      } else {
        // Existing user sign in
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        const session = result.data.session || (await supabase.auth.getSession()).data.session;
        if (!session?.user) {
          showError('Bitte bestätigen Sie Ihre E-Mail (Posteingang prüfen) und melden Sie sich anschließend an.');
          submit.disabled = false;
          submit.textContent = orig;
          return;
        }
        userId = session.user.id;
        document.getElementById('logoutBtn').hidden = false;
        await loadProfile();
        goToStep(STEPS.indexOf('business'));
      }
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
    const zip = document.getElementById('bizZip').value.trim();
    const street = document.getElementById('bizStreet').value.trim();
    const house_number = document.getElementById('bizHouse').value.trim();

    if (!business_name) { showError('Bitte geben Sie den Namen Ihrer Praxis ein.'); return; }
    if (!sector) { showError('Bitte wählen Sie Ihre Branche aus.'); return; }
    if (!city) { showError('Bitte geben Sie Ihre Stadt ein.'); return; }
    if (!zip) { showError('Bitte geben Sie Ihre Postleitzahl ein.'); return; }
    if (!street) { showError('Bitte geben Sie Ihre Straße ein.'); return; }
    if (!house_number) { showError('Bitte geben Sie Ihre Hausnummer ein.'); return; }

    const booking_slug = cleanBookingSlug(business_name) || cleanBookingSlug((sessionStorage.getItem('onboarding_email') || '').slice(0, 8));

    const isPraxis = PRAXIS_SECTORS.includes(sector);
    const nextStep = isPraxis ? 'billing' : 'owner';

    if (userId) {
      const { error } = await supabase.from('profiles').update({
        business_name, sector, city, zip, street, house_number, booking_slug, onboarding_step: nextStep
      }).eq('id', userId);
      if (error) return showError(error.message);

      // Faz 1 multi-business: default business satırını upsert et (her owner için 1 tane)
      try {
        const { data: existing } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', userId)
          .eq('is_default', true)
          .maybeSingle();

        const bizPayload = {
          owner_id: userId,
          business_name,
          sector,
          city: city || null,
          zip: zip || null,
          street: street || null,
          house_number: house_number || null,
          booking_slug: booking_slug || null,
          is_default: true,
        };

        if (existing?.id) {
          await supabase.from('businesses').update(bizPayload).eq('id', existing.id);
        } else {
          await supabase.from('businesses').insert(bizPayload);
        }
      } catch (bizErr) {
        console.warn('[onboarding] default business upsert failed', bizErr);
      }
    }
    profile = { ...profile, business_name, sector, city, zip, street, house_number, booking_slug, onboarding_step: nextStep };
    saveSessionProfile();
    goToStep(STEPS.indexOf(nextStep));
  });
}

// ---- Step 2: Billing (§302) ----
function bindBilling() {
  const form = document.getElementById('billingForm');
  const skipBtn = document.getElementById('billingSkip');

  async function handleSave(skipValidation = false) {
    const ik_number = document.getElementById('bizIk').value.trim() || null;
    const bank_name = document.getElementById('bizBankName').value.trim() || null;
    let iban = document.getElementById('bizIban').value.trim() || null;
    const bic = document.getElementById('bizBic').value.trim() || null;
    const steuernummer = document.getElementById('bizSteuernummer').value.trim() || null;
    const ust_id = document.getElementById('bizUstId').value.trim() || null;
    const taxExempt = document.getElementById('bizTaxExempt').checked;
    const tax_exempt_note = taxExempt ? '§ 4 Nr. 14 UStG' : null;

    if (iban) {
      iban = iban.replace(/\s+/g, '');
    }

    if (!skipValidation) {
      if (ik_number && !/^\d{9}$/.test(ik_number)) {
        showError('Die IK-Nummer muss genau 9 Ziffern enthalten.');
        return;
      }
      if (iban && iban.length < 15) {
        showError('Bitte geben Sie eine gültige IBAN ein (mindestens 15 Zeichen).');
        return;
      }
    }

    const billingFields = {
      ik_number,
      bank_name,
      iban,
      bic,
      steuernummer,
      ust_id,
      tax_exempt_note
    };

    if (userId) {
      const { error } = await supabase.from('profiles').update({
        ...billingFields,
        onboarding_step: 'owner'
      }).eq('id', userId);
      if (error) return showError(error.message);
    }

    profile = { ...profile, ...billingFields, onboarding_step: 'owner' };
    saveSessionProfile();
    goToStep(STEPS.indexOf('owner'));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSave(false);
  });

  skipBtn.addEventListener('click', () => {
    handleSave(true);
  });
}

// ---- Step 3: Owner Info ----
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

    if (userId) {
      const { error } = await supabase.from('profiles').update({
        owner_first_name, owner_last_name, accepts_bookings: acceptsBookings, onboarding_step: 'services'
      }).eq('id', userId);
      if (error) return showError(error.message);
    }
    profile = { ...profile, owner_first_name, owner_last_name, accepts_bookings: acceptsBookings, onboarding_step: 'services' };
    saveSessionProfile();
    goToStep(STEPS.indexOf('services'));
  });
}

// ---- Step 4: Services ----
function renderServices() {
  const list = document.getElementById('servicesList');
  list.innerHTML = '';

  const tpl = SERVICE_TEMPLATES[profile?.sector] || SERVICE_TEMPLATES.other;
  const existingNames = new Set((services || []).map(s => s.name.toLowerCase()));
  const rows = [
    ...(services || []).map(s => ({
      checked: s.is_active !== false,
      name: s.name,
      duration: s.duration_minutes || 30,
      price: s.price_eur || '',
      id: s.id,
      code: s.code || null,
    })),
    ...tpl.filter(t => !existingNames.has(t.name.toLowerCase())).map(t => ({
      checked: true,
      name: t.name,
      duration: t.duration,
      price: t.price || '',
      code: t.code || null,
    })),
  ];

  if (rows.length === 0) rows.push({ checked: true, name: '', duration: 30, price: '', code: null });

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
  div.dataset.code = r.code || '';
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
      code: row.dataset.code || null,
    })).filter(s => s.name);

    if (items.length === 0) return showError('Mindestens eine Dienstleistung wird benötigt.');

    if (userId) {
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

        const svcInserts = items.map(s => {
          if (s.price_config) {
            return {
              user_id: userId,
              owner_id: userId,
              title: s.name,
              code: s.code || null,
              price_config: s.price_config,
              duration_minutes: null,
              price: null,
              is_online_meeting: false,
            };
          }
          return {
            user_id: userId,
            owner_id: userId,
            title: s.name,
            code: s.code || null,
            duration_minutes: s.duration_minutes,
            price: s.price_eur,
            is_online_meeting: false,
          };
        });
        const { data: inserted, error: svcErr } = await supabase.from('services').insert(svcInserts).select();
        if (svcErr) throw svcErr;

        const empRows = inserted.map(s => ({ employee_id: userId, service_id: s.id }));
        const { error: empErr } = await supabase.from('employee_services').insert(empRows);
        if (empErr) throw empErr;

        const bsInserts = items.map(({ id, ...rest }) => rest);
        const { error: bsErr } = await supabase.from('business_services').insert(bsInserts);
        if (bsErr) throw bsErr;

        await saveStepProgress('hours');
      } catch (err) {
        showError(err.message);
        return;
      }
    }

    services = items;
    saveSessionProfile();
    goToStep(STEPS.indexOf('hours'));
  });
}

// ---- Step 5: Hours ----
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
      const closed = val.closed;
      const openTime = val.open ? val.open + ':00' : '00:00:00';
      const closeTime = val.close ? val.close + ':00' : '00:00:00';
      whRows.push({
        user_id: userId,
        owner_id: userId,
        day_of_week: dayMap[key],
        start_time: closed ? '00:00:00' : openTime,
        end_time: closed ? '00:00:00' : closeTime,
        is_active: !closed,
      });
    });

    if (userId) {
      await supabase.from('working_hours').delete().eq('user_id', userId);
      if (whRows.length) {
        const { error: whErr } = await supabase.from('working_hours').insert(whRows);
        if (whErr) console.error('working_hours insert', whErr);
      }
      const { error } = await supabase.from('profiles').update({
        working_hours: out, onboarding_step: 'plan',
      }).eq('id', userId);
      if (error) return showError(error.message);
    }

    profile = { ...profile, working_hours: out, working_hours_rows: whRows, onboarding_step: 'plan' };
    saveSessionProfile();
    goToStep(STEPS.indexOf('plan'));
  });
}

function cleanBookingSlug(input) {
  return (input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---- Step 6: Plan & Payment ----
function bindPlan() {
  const intervalBtns = document.querySelectorAll('.plan-toggle-btn');
  let currentInterval = 'month';

  intervalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      intervalBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentInterval = btn.dataset.interval;
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

      const consentAgb = document.getElementById('consentAgb');
      const consentAvv = document.getElementById('consentAvv');
      const consentError = document.getElementById('consentError');
      if (!consentAgb?.checked || !consentAvv?.checked) {
        if (consentError) consentError.style.display = 'block';
        consentAgb?.closest('div')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (consentError) consentError.style.display = 'none';
      const consents = {
        agb_accepted: true,
        avv_accepted: true,
        accepted_at: new Date().toISOString(),
        agb_version: '2026-05-23',
        avv_version: '2026-05-23',
        user_agent: navigator.userAgent,
      };

      btn.disabled = true;
      btn.textContent = 'Weiterleitung...';
      try {
        if (userId) {
          // Existing user flow
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch('/api/stripe/create-checkout-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ planSlug, interval: currentInterval, consents }),
          });
          const data = await res.json();
          if (!res.ok || !data.url) {
            showError(data.error || 'Checkout konnte nicht gestartet werden.');
            btn.disabled = false;
            btn.textContent = `${planSlug.charAt(0).toUpperCase() + planSlug.slice(1)} wählen`;
            return;
          }
          await supabase.from('profiles').update({
            plan: planSlug,
            billing_interval: currentInterval,
          }).eq('id', userId);
          window.location.href = data.url;
          return;
        }

        // New user flow: gather sessionStorage data, send to pending endpoint, then checkout
        const email = sessionStorage.getItem('onboarding_email');
        const password = sessionStorage.getItem('onboarding_password');
        if (!email || !password) { showError('Kontodaten fehlen. Bitte starten Sie von Schritt 1.'); btn.disabled = false; return; }

        const onboarding_data = {
          business_name: profile.business_name || null,
          sector: profile.sector || null,
          city: profile.city || null,
          zip: profile.zip || null,
          street: profile.street || null,
          house_number: profile.house_number || null,
          owner_first_name: profile.owner_first_name || null,
          owner_last_name: profile.owner_last_name || null,
          accepts_bookings: profile.accepts_bookings !== false,
          booking_slug: profile.booking_slug || null,
          ik_number: profile.ik_number || null,
          bank_name: profile.bank_name || null,
          iban: profile.iban || null,
          bic: profile.bic || null,
          steuernummer: profile.steuernummer || null,
          ust_id: profile.ust_id || null,
          tax_exempt_note: profile.tax_exempt_note || null,
          working_hours: profile.working_hours || null,
          working_hours_rows: profile.working_hours_rows || null,
          services: services.map(s => ({
            name: s.name,
            duration_minutes: s.duration_minutes,
            price_eur: s.price_eur,
            is_active: s.is_active,
            display_order: s.display_order,
            code: s.code || null
          })),
          plan: planSlug,
          billing_interval: currentInterval,
          consents,
        };

        let pendingData;
        const pendingRes = await fetch('/api/onboarding/pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, onboarding_data }),
        });
        pendingData = await pendingRes.json();
        if (!pendingRes.ok || !pendingData.pending_id) {
          showError(pendingData.error || 'Vorbereitung fehlgeschlagen.');
          btn.disabled = false;
          btn.textContent = `${planSlug.charAt(0).toUpperCase() + planSlug.slice(1)} wählen`;
          return;
        }
        const checkoutRes = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pending_id: pendingData.pending_id, planSlug, interval: currentInterval }),
        });
        const checkoutData = await checkoutRes.json();
        if (!checkoutRes.ok || !checkoutData.url) {
          showError(checkoutData.error || 'Checkout konnte nicht gestartet werden.');
          btn.disabled = false;
          btn.textContent = `${planSlug.charAt(0).toUpperCase() + planSlug.slice(1)} wählen`;
          return;
        }
        // Clear sensitive data only right before leaving — keeps retry possible if checkout failed
        sessionStorage.removeItem('onboarding_password');
        sessionStorage.removeItem('onboarding_email');
        window.location.href = checkoutData.url;
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
