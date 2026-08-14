/**
 * kiosk.js — „Tablet an Patient übergeben" (Kiosk-Modus)
 *
 * Herkunft
 * ────────
 * Aus `dashboard.js:22706-22898` herausgelöst (Konsey 2026-08-13: „neuer Code
 * in eine neue Datei", Einkreisungsverfahren). Der Umzug ist einseitig — zurück
 * nach dashboard.js wandert hier nichts.
 *
 * Was sich am 14.08.2026 geändert hat (Konsey 2026-08-14, Paket P1)
 * ────────────────────────────────────────────────────────────────
 * Der Kiosk war live und hatte drei Löcher. Alle drei sind hier geschlossen:
 *
 *  1. „PIN vergessen?" hat den PIN OHNE Prüfung auf NULL gesetzt und den Kiosk
 *     verlassen. Ein Tipp auf dem Tablet in Patientenhand ergab das volle
 *     Dashboard — und die Sperre war dauerhaft weg. Jetzt beendet der Link die
 *     SITZUNG (signOut + Login). „Vergessen" ist kein Notausgang.
 *  2. `if (!storedPin || entered === storedPin)` akzeptierte jede Eingabe,
 *     solange kein PIN gesetzt war. Der Vergleich ist komplett weg — geprüft
 *     wird serverseitig, fail-closed.
 *  3. Klartext-PIN in `profiles.tablet_kiosk_pin`. Die Spalte ist gedroppt;
 *     der scrypt-Hash liegt in `kiosk_pins` (ohne RLS-Policy, nur service_role).
 *
 * Dazu vier Punkte, die niemand gemeldet hatte und die beim Codelesen auffielen:
 *  4. ESC/F11 verliess den Vollbildmodus — das Overlay blieb, aber die
 *     Browserleiste kam zurück. Wird jetzt bewacht.
 *  5. Der `bookings-realtime`-Kanal lief weiter: der Terminhinweis eines
 *     ANDEREN Patienten poppte vor den Augen des Patienten auf. Wird abgemeldet.
 *  6. Das Verschieben von `#panel-anamnese` ins Overlay lief ohne try/finally —
 *     eine Exception im Kiosk liess das Panel verwaist zurück und das Dashboard
 *     wirkte leer.
 *  7. Es gab überhaupt keine Protokollierung. Laut `legal-de` war genau das der
 *     eigentliche Art.-32-Mangel: ein unbefugter Zugriff wäre nicht nachweisbar.
 *
 * ⚠ EHRLICHE GRENZE (Konsey, „Ödün verilenler"): Der Kiosk ist eine
 *   IRRTUMSSPERRE, keine Sicherheitsgrenze. Die Supabase-Sitzung der Therapeutin
 *   bleibt auf dem Gerät offen, gleicher Origin, gleiches Token. Wer entschlossen
 *   ist, kommt daran vorbei. Das ist bewusst akzeptiert — der Gegenwert wäre die
 *   Token-/Expiry-Infrastruktur einer eigenen sitzungslosen Seite (Option C,
 *   vertagt). Diese Datei soll das NICHT heimlich zu reparieren versuchen.
 */

// Vom Aufrufer (dashboard.js) injizierte Abhängigkeiten.
let supabase = null;
let API = '';
let showToast = (m) => console.log(m);
let t = (k) => k;
let getBookingsChannel = () => null;

let _kioskActive = false;
let _fsHandler = null;

// ─────────────────────────────────────────────────────────────────────────────
// Hilfen
// ─────────────────────────────────────────────────────────────────────────────

const PIN_INPUTS = ['kioskPin1', 'kioskPin2', 'kioskPin3', 'kioskPin4'];

function $(id) { return document.getElementById(id); }

function clearPinInputs() {
  PIN_INPUTS.forEach(id => { const el = $(id); if (el) el.value = ''; });
  $('kioskPin1')?.focus();
}

function setPinError(msg) {
  const el = $('kioskPinError');
  if (el) el.textContent = msg || '';
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (data?.session?.access_token || ''),
  };
}

/**
 * Gerätebezeichnung fürs Protokoll. Bewusst grob: Bildschirmgröße + Plattform.
 * Kein User-Agent-Volltext, kein Fingerprint — protokolliert wird, WER wann in
 * den Kiosk ging, nicht welches Gerät sich wie eindeutig identifizieren lässt.
 */
function deviceLabel() {
  try {
    const w = window.screen?.width || 0;
    const h = window.screen?.height || 0;
    const plat = navigator.platform || navigator.userAgentData?.platform || 'unknown';
    return `${plat} ${w}x${h}`;
  } catch { return 'unknown'; }
}

/** Fire-and-forget. Ein fehlgeschlagenes Protokoll darf den Kiosk nie blockieren. */
function auditKiosk(event) {
  authHeaders()
    .then(headers => fetch(`${API}/kiosk/audit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event, deviceLabel: deviceLabel() }),
    }))
    .catch(() => { /* still */ });
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} deps  { supabase, API, showToast, t, getBookingsChannel }
 *   getBookingsChannel() liefert den `bookings-realtime`-Kanal oder null.
 */
export function initKioskMode(deps = {}) {
  if (deps.supabase) supabase = deps.supabase;
  if (deps.API) API = deps.API;
  if (deps.showToast) showToast = deps.showToast;
  if (deps.t) t = deps.t;
  if (deps.getBookingsChannel) getBookingsChannel = deps.getBookingsChannel;

  $('kioskStartBtn')?.addEventListener('click', handleKioskStart);
  $('kioskExitBtn')?.addEventListener('click', () => showKioskPinModal('exit'));

  $('kioskPinCancelBtn')?.addEventListener('click', hideKioskPinModal);
  $('kioskPinConfirmBtn')?.addEventListener('click', handleKioskPinConfirm);
  $('kioskPinForgotBtn')?.addEventListener('click', handleKioskPinForgot);

  $('kioskSetupCancelBtn')?.addEventListener('click', () => {
    const m = $('kioskPinSetupModal');
    if (m) m.hidden = true;
    // Ohne PIN startet der Kiosk NICHT. Abbrechen heisst: kein Kiosk.
  });
  $('kioskSetupSaveBtn')?.addEventListener('click', handleKioskPinSetup);

  // PIN-Ziffern: automatisch weiterspringen
  PIN_INPUTS.forEach((id, idx, arr) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.value = el.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (el.value && idx < arr.length - 1) $(arr[idx + 1])?.focus();
      if (idx === arr.length - 1 && el.value) handleKioskPinConfirm();
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !el.value && idx > 0) $(arr[idx - 1])?.focus();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Start / PIN-Einrichtung
// ─────────────────────────────────────────────────────────────────────────────

async function pinStatus() {
  const headers = await authHeaders();
  const res = await fetch(`${API}/kiosk/pin/status`, { headers });
  if (!res.ok) throw new Error('status');
  return res.json();          // { pinSet, lockedUntil }
}

async function handleKioskStart() {
  let status;
  try {
    status = await pinStatus();
  } catch {
    // Fail-closed: ohne verlässliche Auskunft kein Kiosk. Ein Kiosk, dessen
    // Ausstieg nicht geprüft werden kann, ist schlimmer als gar keiner.
    showToast(t('kiosk_status_error'), 'error');
    return;
  }

  if (!status.pinSet) {
    const setup = $('kioskPinSetupModal');
    if (!setup) return;
    const cur = $('kioskSetupCurrentPinRow');
    if (cur) cur.hidden = true;               // erstmalige Einrichtung
    const f = (id) => { const el = $(id); if (el) el.value = ''; };
    f('kioskSetupPin'); f('kioskSetupPinConfirm'); f('kioskSetupCurrentPin');
    const err = $('kioskSetupError');
    if (err) err.textContent = '';
    setup.hidden = false;
    return;                                    // PIN fehlt -> Kiosk startet NICHT
  }

  enterKioskMode();
}

async function handleKioskPinSetup() {
  const pin = $('kioskSetupPin')?.value || '';
  const confirm2 = $('kioskSetupPinConfirm')?.value || '';
  const currentPin = $('kioskSetupCurrentPin')?.value || '';
  const errEl = $('kioskSetupError');
  const setErr = (m) => { if (errEl) errEl.textContent = m; };

  if (!/^\d{4}$/.test(pin)) return setErr(t('kiosk_err_pin_format'));
  if (pin !== confirm2) return setErr(t('kiosk_err_pin_mismatch'));

  try {
    const headers = await authHeaders();
    const res = await fetch(`${API}/kiosk/pin/set`, {
      method: 'POST',
      headers,
      body: JSON.stringify(currentPin ? { pin, currentPin } : { pin }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(body.error || t('kiosk_err_pin_save'));
  } catch {
    return setErr(t('kiosk_err_network'));
  }

  const m = $('kioskPinSetupModal');
  if (m) m.hidden = true;
  enterKioskMode();
}

// ─────────────────────────────────────────────────────────────────────────────
// Betreten / Verlassen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vollbild-Wächter. ESC/F11 verlässt den Vollbildmodus; das Overlay bliebe
 * stehen, aber Adressleiste und Tabs kämen zurück. Wir fordern Vollbild erneut
 * an — und wenn der Browser das ohne Nutzergeste verweigert (Chrome tut das),
 * erzwingen wir das PIN-Modal, damit niemand halb-offen weiterarbeitet.
 */
function onFullscreenChange() {
  if (!_kioskActive) return;
  if (document.fullscreenElement) return;

  const p = document.documentElement.requestFullscreen?.();
  if (p && typeof p.catch === 'function') {
    p.catch(() => { if (_kioskActive) showKioskPinModal('exit'); });
  } else {
    showKioskPinModal('exit');
  }
}

function enterKioskMode() {
  const overlay = $('kioskOverlay');
  if (!overlay) return;

  const formContent = $('kioskFormContent');
  const anamPanel = $('panel-anamnese');

  // try/finally: wenn das Verschieben mittendrin scheitert, muss der Kiosk
  // trotzdem in einem definierten Zustand landen — sonst hängt das Panel
  // zwischen zwei Eltern und das Dashboard sieht leer aus.
  try {
    if (formContent && anamPanel) {
      formContent.innerHTML = '';
      const startBtn = $('kioskStartBtn');
      if (startBtn) startBtn.style.display = 'none';
      formContent.appendChild(anamPanel);
      anamPanel.classList.add('active');
    }
  } finally {
    _kioskActive = true;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';

    // Terminhinweise anderer Patienten gehören nicht vor die Augen dieses
    // Patienten. Kanal abmelden, beim Verlassen wieder anmelden.
    try { getBookingsChannel()?.unsubscribe(); } catch { /* egal */ }

    _fsHandler = onFullscreenChange;
    document.addEventListener('fullscreenchange', _fsHandler);

    document.documentElement.requestFullscreen?.().catch(() => {});
    auditKiosk('enter');
  }
}

function exitKioskMode() {
  const overlay = $('kioskOverlay');

  try {
    // Idempotent: das Panel geht nach mainArea zurück, egal wo es gerade hängt.
    const anamPanel = $('panel-anamnese');
    const mainArea = $('mainArea');
    if (anamPanel && mainArea && anamPanel.parentElement !== mainArea) {
      mainArea.appendChild(anamPanel);
    }
    const startBtn = $('kioskStartBtn');
    if (startBtn) startBtn.style.display = '';
  } finally {
    _kioskActive = false;
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';

    if (_fsHandler) {
      document.removeEventListener('fullscreenchange', _fsHandler);
      _fsHandler = null;
    }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});

    try { getBookingsChannel()?.subscribe(); } catch { /* egal */ }

    auditKiosk('exit');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN-Modal
// ─────────────────────────────────────────────────────────────────────────────

function showKioskPinModal() {
  clearPinInputs();
  setPinError('');
  const title = $('kioskPinTitle');
  const sub = $('kioskPinSubtitle');
  if (title) title.textContent = t('kiosk_pin_title');
  if (sub) sub.textContent = t('kiosk_pin_subtitle');
  const m = $('kioskPinModal');
  if (m) m.hidden = false;
  $('kioskPin1')?.focus();
}

function hideKioskPinModal() {
  const m = $('kioskPinModal');
  if (m) m.hidden = true;
}

/**
 * Prüfung läuft ausschliesslich auf dem Server. Kein Vergleich im Browser,
 * kein „wenn kein PIN gesetzt ist, lass durch". Bei Netzwerkfehler bleibt der
 * Kiosk zu (fail-closed).
 */
async function handleKioskPinConfirm() {
  const entered = PIN_INPUTS.map(id => $(id)?.value || '').join('');
  if (entered.length < 4) return setPinError(t('kiosk_err_pin_incomplete'));

  const confirmBtn = $('kioskPinConfirmBtn');
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const headers = await authHeaders();
    const res = await fetch(`${API}/kiosk/pin/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ pin: entered }),
    });
    const body = await res.json().catch(() => ({}));

    if (res.ok && body.ok === true) {
      hideKioskPinModal();
      exitKioskMode();
      return;
    }

    if (res.status === 423) {
      const bis = body.lockedUntil
        ? new Date(body.lockedUntil).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        : '';
      setPinError(`${t('kiosk_err_locked')} ${bis}`.trim());
    } else if (typeof body.remainingAttempts === 'number') {
      setPinError(`${t('kiosk_err_pin_wrong')} (${body.remainingAttempts})`);
    } else {
      setPinError(body.error || t('kiosk_err_pin_wrong'));
    }
    clearPinInputs();
  } catch {
    setPinError(t('kiosk_err_network'));
    clearPinInputs();
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

/**
 * „PIN vergessen?" — beendet die SITZUNG, nicht den Kiosk.
 *
 * Vorher war das der schnellste Weg vom Patienten-Tablet ins volle Dashboard:
 * ein Tipp, kein PIN, und `tablet_kiosk_pin` wurde gleich mit gelöscht. Wer den
 * PIN wirklich vergessen hat, meldet sich neu an — das kostet die Therapeutin
 * zwanzig Sekunden und dem Patienten öffnet es nichts.
 */
async function handleKioskPinForgot() {
  if (!window.confirm(t('kiosk_forgot_confirm'))) return;

  auditKiosk('forgot_signout');
  try { await supabase.auth.signOut(); } catch { /* trotzdem weiter */ }
  window.location.href = 'login.html';
}
