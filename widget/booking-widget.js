// Praxura Termin-Anfrage-Widget — laeuft IM iframe (booking-widget.html), nie in der Host-Seite.
//
// Bewusst ohne Supabase-Client, Sentry, Cookie-Consent, Analytics oder CDN (guvenlik S-52,
// legal-de 11.10.2026, onprem O-211). Alle fetch-Aufrufe gehen vom Ursprung des iframes aus,
// deshalb braucht die einbettende Seite weder CORS-Freigabe noch Zugriff auf Formularwerte.
// Nach aussen gehen nur zwei inhaltsleere postMessage-Signale: Hoehe und "fertig".
//
// Ablauf in vier Schritten (Reihenfolge entscheidet sich an den Abhaengigkeiten): 1 Anliegen +
// Versicherung (das Anliegen bestimmt, welche Versicherungsarten moeglich sind) · 2 Zeiten ·
// 3 Person + Kontakt · 4 Pruefen und senden · danach Status.
import {
  ANLIEGEN, TAGE, TAGESZEITEN, DRINGLICHKEIT, ERSTBESUCH, SCHRITTE, ApiError, UUID_RE, safeApiBase,
  leererZustand, zeigeAnliegen, zahlartOptionen, waehleAnliegen, setzeFlexibel, schalte,
  pruefeSchritt1, pruefeSchritt2, pruefeSchritt3, zusammenfassung, buildPayload,
  formatSlot, splitLocalIso, pollDelay,
} from './booking-widget.logic.js?v=20261012';
import { renderTerminDatenschutz } from '../module/einwilligung-texte.js?v=20261012';

const NICHT_EINGERICHTET = 'Die Online-Terminvereinbarung dieser Praxis ist noch nicht eingerichtet. Bitte vereinbaren Sie Ihren Termin telefonisch oder direkt in der Praxis.';
const SESSION_KEY = 'bw:req';
const REQUEST_TIMEOUT_MS = 15000;
const STATUS_SCHRITT = SCHRITTE + 1;

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const state = {
  ownerId: null,
  api: null,
  praxis: null,
  betrieb: 'saas',
  mitAnliegen: false,
  z: leererZustand(),
  step: 1,
  pollTimer: null,
  pollCount: 0,
};

/* ---------- Einbettung: nur inhaltsleere Signale nach aussen ---------- */

// Ziel der Signale: nie '*'. embed.js uebergibt den Ursprung der Host-Seite; ein untergeschobener
// Wert schadet nicht, weil der Browser nur zustellt, wenn der echte Eltern-Ursprung stimmt.
function parentOrigin() {
  try { const p = params.get('parent'); if (p) return new URL(p).origin; } catch { /* weiter */ }
  try { if (location.ancestorOrigins?.[0]) return location.ancestorOrigins[0]; } catch { /* weiter */ }
  try { return new URL(document.referrer).origin; } catch { return null; }
}
function signal(type, extra = {}) {
  if (window.parent === window) return;
  const ziel = parentOrigin();
  if (ziel && ziel !== 'null') window.parent.postMessage({ type, ...extra }, ziel);
}
function meldeHoehe() {
  signal('bw:height', { height: Math.ceil(document.documentElement.getBoundingClientRect().height) });
}

/* ---------- HTTP ---------- */

async function http(base, pfad, { method = 'GET', body, token } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(base + pfad, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
      cache: 'no-store',
      signal: ctl.signal,
    });
    let data = null;
    try { data = await res.json(); } catch { /* leere/ungueltige Antwort */ }
    if (!res.ok) throw new ApiError(res.status, data?.error || data?.message || 'Anfrage fehlgeschlagen');
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'netzwerk');
  } finally {
    clearTimeout(timer);
  }
}

function createRealApi(base) {
  return {
    praxis: (ownerId) => http(base, `/booking-request/praxis?owner_id=${encodeURIComponent(ownerId)}`),
    createRequest: (payload) => http(base, '/booking-request/create', { method: 'POST', body: payload }),
    getStatus: (id, token) => http(base, `/booking-request/status?request_id=${encodeURIComponent(id)}`, { token }),
  };
}

/* ---------- Anzeige-Helfer ---------- */

function zeigeBanner(text) {
  const b = $('bw-banner');
  b.textContent = text || '';
  b.hidden = !text;
  if (text) { b.focus(); b.scrollIntoView({ block: 'nearest' }); }
}
// Felder, die ein Gruppenfehler betrifft (Fehlertext steht einmal, gilt fuer alle).
const FEHLER_FELDER = {
  'bw-kontakt': ['bw-telefon', 'bw-email'],
  'bw-geburtsdatum': ['bw-tag', 'bw-monat', 'bw-jahr'],
};
function markiere(el, an) {
  if (!el) return;
  el.classList.toggle('is-invalid', an);
  if (an) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
}
function feldFehler(id, text) {
  const p = $(`${id}-error`);
  if (p) { p.textContent = text || ''; p.hidden = !text; }
  for (const fid of FEHLER_FELDER[id] || [id]) markiere($(fid), Boolean(text));
}
/** Gruppenfehler an die Eingaben haengen, damit Screenreader ihn beim Fokus lesen. */
function verbindeFehler(selektor, errorId) {
  for (const el of document.querySelectorAll(selektor)) el.setAttribute('aria-describedby', errorId);
}
function setzePraxisName(name) {
  for (const el of document.querySelectorAll('[data-bw="praxis-name"]')) el.textContent = name || 'die Praxis';
}
function leseText(el, text) { el.textContent = text; return el; }

/** Zeichnet Gruppen neu und setzt den Fokus auf dasselbe Element zurueck (a11y 2.4.3, Pfeiltasten). */
function mitFokus(fn) {
  const a = document.activeElement;
  const key = a?.dataset?.bwKey;
  const val = a?.value;
  fn();
  if (key) document.querySelector(`input[data-bw-key="${key}"][value="${val}"]`)?.focus();
}

/** Auswahlkarte (Radio oder Checkbox) mit nativem Eingabeelement. */
function auswahlKarte({ typ, name, wert, titel, hinweis, an, bei }) {
  const label = document.createElement('label');
  label.className = 'bw__opt-row';
  const input = document.createElement('input');
  input.type = typ;
  input.name = name;
  input.value = wert;
  input.dataset.bwKey = name;
  input.checked = Boolean(an);
  input.addEventListener('change', () => mitFokus(() => bei(input.checked, wert)));
  const text = document.createElement('span');
  text.className = 'bw__opt-text';
  text.append(leseText(document.createElement('b'), titel));
  if (hinweis) text.append(leseText(document.createElement('small'), hinweis));
  const mark = document.createElement('i');
  mark.className = typ === 'checkbox' ? 'bw__mark bw__mark--box' : 'bw__mark';
  mark.setAttribute('aria-hidden', 'true');
  label.append(input, text, mark);
  label.classList.toggle('is-on', Boolean(an));
  return label;
}
function tagKarte({ wert, kurz, lang, an, bei }) {
  const label = document.createElement('label');
  label.className = 'bw__day';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = wert;
  input.dataset.bwKey = 'bw-tag';
  input.checked = Boolean(an);
  input.setAttribute('aria-label', lang);
  input.addEventListener('change', () => mitFokus(() => bei(input.checked, wert)));
  const b = leseText(document.createElement('b'), kurz);
  const s = leseText(document.createElement('small'), lang);
  label.append(input, b, s);
  label.classList.toggle('is-on', Boolean(an));
  return label;
}

/* ---------- Zeichnen ---------- */

function zeichneSchritt1() {
  const z = state.z;
  $('bw-h1').textContent = state.mitAnliegen ? 'Was möchten Sie?' : 'Wie sind Sie versichert?';
  document.querySelector('[data-bw="anliegen-block"]').hidden = !state.mitAnliegen;

  const anl = $('bw-anliegen-opts');
  anl.replaceChildren();
  if (state.mitAnliegen) {
    for (const a of ANLIEGEN) {
      anl.append(auswahlKarte({
        typ: 'radio', name: 'bw-anliegen', wert: a.key, titel: a.titel, hinweis: a.hinweis, an: z.anliegen === a.key,
        bei: (_an, key) => { state.z = waehleAnliegen(state.z, key); feldFehler('bw-anliegen', ''); zeichneSchritt1(); zeichneSeitenleiste(); },
      }));
    }
  }
  const zahl = $('bw-zahlart-opts');
  zahl.replaceChildren();
  for (const o of zahlartOptionen(state.mitAnliegen ? z.anliegen : null)) {
    zahl.append(auswahlKarte({
      typ: 'radio', name: 'bw-zahlart', wert: o.key, titel: o.titel, an: z.zahlart === o.key,
      bei: (_an, key) => { state.z.zahlart = key; feldFehler('bw-zahlart', ''); zeichneSchritt1(); zeichneSeitenleiste(); },
    }));
  }
  $('bw-hausbesuch').checked = z.hausbesuch;
  verbindeFehler('#bw-anliegen-opts input', 'bw-anliegen-error');
  verbindeFehler('#bw-zahlart-opts input', 'bw-zahlart-error');
  zaehler('bw-mitteilung', 140);
  meldeHoehe();
}

function zeichneSchritt2() {
  const z = state.z;
  const flex = $('bw-flexibel');
  flex.checked = z.flexibel;
  $('bw-flexibel-row').classList.toggle('is-on', z.flexibel);

  const tage = $('bw-tage');
  tage.replaceChildren();
  for (const t of TAGE) {
    tage.append(tagKarte({
      wert: t.key, kurz: t.kurz, lang: t.lang, an: z.tage.includes(t.key),
      bei: (_a, key) => { state.z = schalte(state.z, 'tage', key); feldFehler('bw-zeit', ''); zeichneSchritt2(); zeichneSeitenleiste(); },
    }));
  }
  const zeiten = $('bw-zeiten');
  zeiten.replaceChildren();
  for (const t of TAGESZEITEN) {
    zeiten.append(auswahlKarte({
      typ: 'checkbox', name: 'bw-zeit', wert: t.key, titel: t.titel, hinweis: t.hinweis, an: z.zeiten.includes(t.key),
      bei: (_a, key) => { state.z = schalte(state.z, 'zeiten', key); feldFehler('bw-zeit', ''); zeichneSchritt2(); zeichneSeitenleiste(); },
    }));
  }
  const dr = $('bw-dringlichkeit');
  dr.replaceChildren();
  for (const d of DRINGLICHKEIT) {
    dr.append(auswahlKarte({
      typ: 'radio', name: 'bw-dringlichkeit', wert: d.key, titel: d.titel, an: z.dringlichkeit === d.key,
      bei: (_a, key) => { state.z.dringlichkeit = key; zeichneSchritt2(); zeichneSeitenleiste(); },
    }));
  }
  verbindeFehler('#bw-flexibel, #bw-tage input, #bw-zeiten input', 'bw-zeit-error');
  zaehler('bw-anmerkung', 80);
  meldeHoehe();
}

function zeichneSchritt3() {
  const z = state.z;
  const eb = $('bw-erstbesuch');
  eb.replaceChildren();
  for (const e of ERSTBESUCH) {
    eb.append(auswahlKarte({
      typ: 'radio', name: 'bw-erstbesuch', wert: e.key, titel: e.titel, an: z.erstbesuch === e.key,
      bei: (_a, key) => { state.z.erstbesuch = key; zeichneSchritt3(); zeichneSeitenleiste(); },
    }));
  }
  meldeHoehe();
}

function zaehler(feld, max) {
  const el = $(`${feld}-count`);
  if (el) el.textContent = `${$(feld).value.length} von ${max} Zeichen`;
}

function zeichneSeitenleiste() {
  const liste = $('bw-side-list');
  liste.replaceChildren();
  for (const r of zusammenfassung(state.z, state.mitAnliegen)) {
    if (!r.wert && r.optional) continue;
    const row = document.createElement('div');
    const dt = leseText(document.createElement('dt'), r.label);
    const dd = leseText(document.createElement('dd'), r.wert || 'offen');
    if (!r.wert) dd.className = 'is-leer';
    row.append(dt, dd);
    liste.append(row);
  }
}

function zeichnePruefen() {
  const dl = $('bw-review');
  dl.replaceChildren();
  for (const r of zusammenfassung(state.z, state.mitAnliegen)) {
    if (!r.wert && r.optional) continue;
    const row = document.createElement('div');
    const dd = document.createElement('dd');
    dd.append(leseText(document.createElement('span'), r.wert || 'nicht angegeben'));
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Ändern';
    b.setAttribute('aria-label', `${r.label} ändern`);
    b.addEventListener('click', () => gehe(r.step));
    dd.append(b);
    row.append(leseText(document.createElement('dt'), r.label), dd);
    dl.append(row);
  }
}

/* ---------- Navigation ---------- */

function gehe(step, { fokus = true } = {}) {
  state.step = step;
  const root = $('bw');
  for (const p of document.querySelectorAll('[data-bw-panel]')) p.hidden = Number(p.dataset.bwPanel) !== step;
  for (const s of document.querySelectorAll('[data-bw-seg]')) s.classList.toggle('is-on', Number(s.dataset.bwSeg) <= Math.min(step, SCHRITTE));
  $('bw-count').textContent = step <= SCHRITTE ? `Schritt ${step} von ${SCHRITTE}` : 'Anfrage gesendet';
  root.classList.toggle('bw--seitenleiste', step <= 3);
  root.classList.toggle('bw--status', step === STATUS_SCHRITT);
  $('bw-back').hidden = step === 1 || step === STATUS_SCHRITT;
  $('bw-next').textContent = step === SCHRITTE ? 'Terminanfrage senden' : 'Weiter';
  if (step === 1) zeichneSchritt1();
  if (step === 2) zeichneSchritt2();
  if (step === 3) zeichneSchritt3();
  if (step === SCHRITTE) zeichnePruefen();
  if (step <= 3) zeichneSeitenleiste();
  const h = $(`bw-h${step}`);
  if (h && fokus) h.focus({ preventScroll: false });
  meldeHoehe();
}

function sperreFormular(text) {
  zeigeBanner(text);
  $('bw-form').hidden = true;
  document.querySelector('.bw__seg').hidden = true;
  $('bw-count').hidden = true;
  meldeHoehe();
}

/* ---------- Eingaben ---------- */

const TEXTFELDER = {
  'bw-mitteilung': 'mitteilung', 'bw-anmerkung': 'anmerkung',
  'bw-vorname': 'vorname', 'bw-nachname': 'nachname', 'bw-tag': 'tag', 'bw-monat': 'monat', 'bw-jahr': 'jahr',
  'bw-telefon': 'telefon', 'bw-email': 'email',
};

function verdrahteEingaben() {
  for (const [id, feld] of Object.entries(TEXTFELDER)) {
    $(id).addEventListener('input', () => {
      state.z[feld] = $(id).value;
      if (id === 'bw-mitteilung') zaehler(id, 140);
      if (id === 'bw-anmerkung') zaehler(id, 80);
      feldFehler(id, '');
      if (['bw-tag', 'bw-monat', 'bw-jahr'].includes(id)) feldFehler('bw-geburtsdatum', '');
      if (['bw-telefon', 'bw-email'].includes(id)) feldFehler('bw-kontakt', '');
      zeichneSeitenleiste();
    });
  }
  $('bw-hausbesuch').addEventListener('change', (e) => { state.z.hausbesuch = e.target.checked; zeichneSeitenleiste(); });
  $('bw-andere').addEventListener('change', (e) => { state.z.fuerAndere = e.target.checked; zeichneSeitenleiste(); });
  $('bw-flexibel').addEventListener('change', (e) => {
    state.z = setzeFlexibel(state.z, e.target.checked);
    feldFehler('bw-zeit', '');
    mitFokus(() => { zeichneSchritt2(); zeichneSeitenleiste(); });
    $('bw-flexibel').focus();
  });
}

/* ---------- Pruefen je Schritt ---------- */

const FOKUS = {
  anliegen: () => document.querySelector('#bw-anliegen-opts input'),
  zahlart: () => document.querySelector('#bw-zahlart-opts input'),
  zeit: () => document.querySelector('#bw-tage input'),
  vorname: () => $('bw-vorname'), nachname: () => $('bw-nachname'),
  geburtsdatum: () => $('bw-tag'), telefon: () => $('bw-telefon'), email: () => $('bw-email'), kontakt: () => $('bw-telefon'),
};

function zeigeFehler(fehler) {
  // Einzelfelder vor Gruppenfehlern: 'kontakt' markiert Telefon UND E-Mail und darf nicht von deren
  // eigenem (leeren) Fehler wieder zurueckgesetzt werden.
  const alle = ['anliegen', 'zahlart', 'zeit', 'vorname', 'nachname', 'telefon', 'email', 'geburtsdatum', 'kontakt'];
  for (const f of alle) feldFehler(`bw-${f}`, fehler[f] || '');
  const erstes = Object.keys(fehler)[0];
  if (erstes) FOKUS[erstes]?.()?.focus();
  return !erstes;
}

function pruefeAktuellenSchritt() {
  if (state.step === 1) return zeigeFehler(pruefeSchritt1(state.z, state.mitAnliegen));
  if (state.step === 2) return zeigeFehler(pruefeSchritt2(state.z));
  if (state.step === 3) return zeigeFehler(pruefeSchritt3(state.z));
  return true;
}

function weiter() {
  zeigeBanner('');
  if (!pruefeAktuellenSchritt()) return;
  gehe(state.step + 1);
}

function fehlerText(e) {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'Die Verbindung ist fehlgeschlagen. Bitte prüfen Sie Ihr Internet und versuchen Sie es erneut.';
    if (e.status === 429) return 'Es liegen zu viele Anfragen vor. Bitte versuchen Sie es später erneut oder rufen Sie die Praxis an.';
    if (e.status >= 500) return 'Ihre Anfrage konnte nicht gespeichert werden. Bitte versuchen Sie es später erneut oder rufen Sie die Praxis an.';
    return e.message;
  }
  return 'Es ist ein unerwarteter Fehler aufgetreten.';
}

async function absenden() {
  zeigeBanner('');
  // Alle drei Eingabeschritte noch einmal pruefen (Ueber „Aendern“ kann etwas geleert worden sein).
  for (const [s, f] of [[1, pruefeSchritt1(state.z, state.mitAnliegen)], [2, pruefeSchritt2(state.z)], [3, pruefeSchritt3(state.z)]]) {
    if (Object.keys(f).length) { gehe(s); zeigeFehler(f); return; }
  }
  if (state.sendet) return;
  state.sendet = true;
  const btn = $('bw-next');
  btn.setAttribute('aria-disabled', 'true');
  btn.textContent = 'Wird gesendet …';
  try {
    const payload = buildPayload(state.z, { ownerId: state.ownerId, mitAnliegen: state.mitAnliegen, honeypot: $('bw-website').value });
    const res = await state.api.createRequest(payload);
    if (!res?.id || !res?.token) throw new ApiError(500, 'Antwort unvollständig');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: res.id, token: res.token, owner: state.ownerId }));
    // Personenbezogene Eingaben sofort verwerfen — es bleibt nur die Kennung.
    state.z = leererZustand();
    $('bw-form').reset();
    zeigeStatus({ status: 'pending', message: 'Die Praxis meldet sich bei Ihnen.' });
    gehe(STATUS_SCHRITT);
    startePolling();
  } catch (e) {
    zeigeBanner(fehlerText(e));
  } finally {
    state.sendet = false;
    btn.removeAttribute('aria-disabled');
    btn.textContent = state.step === SCHRITTE ? 'Terminanfrage senden' : 'Weiter';
  }
}

/* ---------- Status ---------- */

const STATUS_TEXT = {
  pending: { badge: 'Gesendet', titel: 'Anfrage gesendet – das ist noch kein Termin' },
  accepted: { badge: 'Bestätigt', titel: 'Termin bestätigt' },
  rejected: { badge: 'Nicht möglich', titel: 'Anfrage nicht möglich' },
};

function zeigeStatus(s) {
  const art = STATUS_TEXT[s.status] ? s.status : 'pending';
  let text = String(s.message || '');
  const slot = splitLocalIso(s.confirmedSlot);
  if (art === 'accepted' && slot) text = `${text} ${formatSlot(slot)}.`.trim();
  if (art === 'pending') text = `${text} Bitte kommen Sie erst zu einem Termin, wenn die Praxis ihn bestätigt hat.`.trim();
  const neu = `${art}|${text}`;
  if (neu !== state.statusStand) {
    state.statusStand = neu;
    $('bw-status').className = `bw__status bw__status--${art}`;
    $('bw-status-badge').textContent = STATUS_TEXT[art].badge;
    $('bw-status-title').textContent = STATUS_TEXT[art].titel;
    $('bw-status-text').textContent = text;
  }
  $('bw-new').hidden = art === 'pending';
  meldeHoehe();
}

function beendePolling() {
  clearTimeout(state.pollTimer);
  state.pollTimer = null;
}

function sitzung() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    return s && s.owner === state.ownerId && UUID_RE.test(s.id) ? s : null;
  } catch { return null; }
}

function startePolling() {
  beendePolling();
  state.pollCount = 0;
  planePoll();
}
function planePoll() { state.pollTimer = setTimeout(pollEinmal, pollDelay(state.pollCount)); }

async function pollEinmal() {
  if (document.hidden) { state.pollTimer = null; return; }   // visibilitychange setzt fort
  const s = sitzung();
  if (!s) return;
  try {
    const r = await state.api.getStatus(s.id, s.token);
    zeigeStatus(r);
    if (r.status === 'pending') { state.pollCount += 1; planePoll(); return; }
    sessionStorage.removeItem(SESSION_KEY);
    signal('bw:done');
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      sessionStorage.removeItem(SESSION_KEY);
      zeigeStatus({ status: 'rejected', message: 'Diese Anfrage ist nicht mehr abrufbar. Bitte wenden Sie sich an die Praxis.' });
      return;
    }
    state.pollCount += 1;   // Netz oder 5xx: still weiterversuchen
    planePoll();
  }
}

function neueAnfrage() {
  beendePolling();
  sessionStorage.removeItem(SESSION_KEY);
  state.z = leererZustand();
  zeigeBanner('');
  gehe(1);
}

/* ---------- Datenschutzhinweis ---------- */

function verdrahteDatenschutz() {
  const a = $('bw-privacy-link');
  const url = state.praxis.datenschutzUrl;
  if (url) {
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', 'Datenschutzhinweise (öffnet in neuem Tab)');
    return;
  }
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const r = renderTerminDatenschutz(
      { praxis_name: state.praxis.name, inhaber_name: state.praxis.inhaber, praxis_anschrift: state.praxis.anschrift },
      { betrieb: state.betrieb },
    );
    $('bw-dialog-title').textContent = r.titel;
    const body = $('bw-dialog-body');
    body.replaceChildren();
    for (const abs of r.absaetze) {
      const h = document.createElement('h3');
      h.textContent = abs.ueberschrift;
      const p = document.createElement('p');
      p.textContent = abs.text;
      body.append(h, p);
    }
    const dlg = $('bw-dialog');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    $('bw-dialog-title').focus();
  });
  $('bw-dialog-close').addEventListener('click', () => $('bw-dialog').close());
}

/* ---------- Start ---------- */

async function ladeKonfiguration() {
  const mockModus = params.get('mock');
  const lokal = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (mockModus && lokal) {
    const { createMockApi } = await import('./booking-widget.mock.js?v=20261012');
    const mock = createMockApi(mockModus, { bereich: params.get('bereich') || 'podologie' });
    state.api = mock;
    state.praxis = mock.praxis;
    return;
  }
  const cfg = await http('', '/api/config');
  const base = safeApiBase(cfg?.apiBase);
  if (!base) throw new ApiError(500, 'apiBase ungueltig');
  state.betrieb = cfg.istKutu === true ? 'kutu' : 'saas';
  const api = createRealApi(base);
  state.api = api;
  state.praxis = await api.praxis(state.ownerId);
}

async function start() {
  const owner = params.get('owner') || '';
  if (!UUID_RE.test(owner)) { sperreFormular(NICHT_EINGERICHTET); return; }
  state.ownerId = owner.toLowerCase();

  $('bw-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (state.step === SCHRITTE) absenden(); else if (state.step < SCHRITTE) weiter();
  });
  $('bw-back').addEventListener('click', () => { zeigeBanner(''); gehe(state.step - 1); });
  $('bw-new').addEventListener('click', neueAnfrage);
  verdrahteEingaben();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.step === STATUS_SCHRITT && !state.pollTimer && sitzung()) pollEinmal();
  });
  new ResizeObserver(meldeHoehe).observe(document.documentElement);

  try {
    await ladeKonfiguration();
  } catch {
    sperreFormular('Die Online-Terminanfrage ist gerade nicht erreichbar. Bitte rufen Sie die Praxis an.');
    return;
  }
  if (!state.praxis?.vollstaendig) { sperreFormular(NICHT_EINGERICHTET); return; }
  state.mitAnliegen = zeigeAnliegen(state.praxis.bereich);
  setzePraxisName(state.praxis.name);
  verdrahteDatenschutz();

  const s = sitzung();
  if (s) {
    zeigeStatus({ status: 'pending', message: 'Wir rufen den Stand Ihrer Anfrage ab …' });
    gehe(STATUS_SCHRITT, { fokus: false });
    pollEinmal();
  } else {
    gehe(1, { fokus: false });
  }
}

start();
