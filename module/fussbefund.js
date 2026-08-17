/**
 * fussbefund.js — Die digitale Fußanalyse-Karte der Podologie.
 *
 * Herkunft
 * ────────
 * Diese Datei ist aus `dashboard.js` herausgelöst worden (Konsey 2026-08-13:
 * „neuer Code in eine neue Datei"). Der Podologie-Block war der erste
 * Einkreisungsschritt — angefasst, also umgezogen. Zurück nach dashboard.js
 * wandert hier nichts.
 *
 * Was sich am 14.08.2026 geändert hat (Besprechung 12.08.2026, Nausad)
 * ───────────────────────────────────────────────────────────────────
 *
 * 1. Die Legende gehört der Praxis.
 *    Vorher stand fest, dass ✕ „Cross" heisst und ● „Punkt". Das ist keine
 *    Aussage über einen Fuss. Welches Zeichen welchen Befund meint, entscheidet
 *    jetzt die Praxis in den Einstellungen — „vielleicht will der andere das
 *    Kreuz für etwas anderes haben".
 *
 *    ⚠ Jede Markierung speichert Zeichen, Farbe UND Beschriftung als KOPIE.
 *    Wird die Legende später umbenannt, bleibt der alte Befund lesbar wie er
 *    war. Eine Referenz auf die Legende würde die Bedeutung vergangener
 *    Dokumentation rückwirkend verändern — in einer Patientenakte unzulässig.
 *
 * 2. Der Befund hängt am Termin, nicht an einem freien Datum.
 *    Ausgewählt wird aus den Terminen DIESES Patienten, der zeitlich nächste
 *    oben. Und die Liste rechts zeigt nur noch dessen Befunde: „wenn du bei
 *    Klaus Fischer bist, dass du nicht meine Befunde siehst".
 *
 * 3. Der vorherige Befund wird übernommen — als Kopie.
 *    Neuer Termin, leere Karte: das war jeden Tag dieselbe Tipparbeit. Jetzt
 *    kommt der letzte Befund vorausgefüllt, der Therapeut ändert nur, was sich
 *    geändert hat.
 *
 *    ⚠ Die Übernahme legt eine NEUE Zeile an (`currentId = null`). Speichern
 *    schreibt nie in den Befund des vorherigen Termins zurück — „wenn du
 *    speicherst, soll aber nicht das erste verändert werden". Genau daraus
 *    entsteht nebenbei der Verlauf, den die Kasse bei einer Prüfung sehen will.
 *    `uebernommen_von` hält nur fest, woher kopiert wurde.
 *
 * Datenlage
 * ─────────
 *   pat_fussbefund   eine Zeile je Befund, jede Zeile ein vollständiger
 *                    Schnappschuss (befund + markierungen als JSONB)
 *   booking_id       UNIQUE — ein Termin trägt höchstens einen Befund
 *   profiles.fussbefund_legende   Owner-Ebene (Einzelpraxen haben keine
 *                    businesses-Zeile, dort wäre die Einstellung unsichtbar)
 *
 * Nachtrag 14.08.2026 — Einstieg aus dem Terminkalender
 * ─────────────────────────────────────────────────────
 * Der Weg „Fußbefund öffnen → Patient suchen → Termin suchen" war doppelte
 * Arbeit: der Podologe steht ohnehin schon auf dem Termin. Jetzt trägt der
 * Termin-Seitenbereich den Knopf, und das Panel kommt mit Patient UND Termin
 * bereits gewählt. Die Fallunterscheidung (Befund vorhanden → bearbeiten,
 * sonst Vorbefund übernehmen) macht weiterhin nur `terminGewaehlt()`.
 */

import { resolveSector } from '../nav-registry.js?v=20260815';

// ── Legende ────────────────────────────────────────────────────────────────

/** Vorschlag, kein Gesetz. Sobald die Praxis speichert, gilt nur noch ihre Liste. */
export const STANDARD_LEGENDE = [
  { id: 'std-1', symbol: '✕', color: '#ef4444',         label: 'Clavus (Hühnerauge)' },
  { id: 'std-2', symbol: '◯', color: '#3b82f6',         label: 'Hyperkeratose (Hornhaut)' },
  { id: 'std-3', symbol: '●', color: 'var(--text-main)', label: 'Druckstelle' },
];

export const LEGENDE_SYMBOLE = ['✕', '◯', '●', '▲', '■', '✚', '◆', '★'];

export const LEGENDE_FARBEN = [
  { wert: '#ef4444',          name: 'Rot' },
  { wert: '#3b82f6',          name: 'Blau' },
  { wert: '#16a34a',          name: 'Grün' },
  { wert: '#f59e0b',          name: 'Orange' },
  { wert: '#a855f7',          name: 'Violett' },
  { wert: 'var(--text-main)', name: 'Neutral' },
];

/** Alte Markierungen kennen nur `type`. Ohne diese Brücke verschwänden sie. */
const TYP_SYMBOL = { x: '✕', circle: '◯', dot: '●' };

function normalisiereLegende(roh) {
  if (!Array.isArray(roh)) return [];
  return roh
    .filter(e => e && typeof e === 'object')
    .map((e, i) => ({
      id:     String(e.id || `l${i}`),
      symbol: String(e.symbol || '✕').slice(0, 2),
      color:  String(e.color || '#ef4444').slice(0, 40),
      label:  String(e.label || '').slice(0, 60),
    }))
    .slice(0, 20);
}

// ── Modulzustand ───────────────────────────────────────────────────────────

let ctx = null;                 // Abhängigkeiten aus dashboard.js
let markierungen = [];
let legende = STANDARD_LEGENDE;
let aktiveLegendeId = null;
let patientsMap = {};
let patientsList = [];
let currentId = null;           // offener Befund; null = neue Zeile beim Speichern
let uebernommenVon = null;      // Herkunft der Übernahme, nur Dokumentation
let termine = [];               // Termine des gewählten Patienten
let befundeDesPatienten = [];   // dessen Befunde, für Liste + Übernahme
let dokumentKlick = null;       // Zuhörer zum Schliessen des Patienten-Dropdowns

// Vorwahl aus dem Terminkalender. `switchPanel('fussstatus')` baut das Panel
// selbst auf — der Preset wird deshalb hier hinterlegt und beim Aufbau
// eingelöst, statt ein zweites Mal zu montieren.
let ausstehenderPreset = null;

function aktiveLegende() {
  return legende.find(e => e.id === aktiveLegendeId) || legende[0] || STANDARD_LEGENDE[0];
}

// ── Hilfen ─────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return String(str);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return String(str);
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** ISO-Datum für <input type="date"> — lokal, damit der Tag nicht kippt. */
function isoDatum(d) {
  const x = new Date(d);
  if (isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function el(id) { return document.getElementById(id); }
function setCb(id, val) { const e = el(id); if (e) e.checked = !!val; }
function getCb(id) { return el(id)?.checked || false; }

// ── Legende laden / speichern ──────────────────────────────────────────────

export async function ladeLegende(supabase, ownerId) {
  if (!ownerId) return STANDARD_LEGENDE;
  const { data, error } = await supabase
    .from('profiles')
    .select('fussbefund_legende')
    .eq('id', ownerId)
    .maybeSingle();

  if (error) {
    console.error('[fussbefund] Legende laden fehlgeschlagen:', error.message);
    return STANDARD_LEGENDE;
  }
  const eigene = normalisiereLegende(data?.fussbefund_legende);
  return eigene.length ? eigene : STANDARD_LEGENDE;
}

// ── Patientenauswahl ───────────────────────────────────────────────────────

function renderPatientDropdown(query) {
  const dropdown = el('fbpPatientDropdown');
  if (!dropdown) return;

  const matches = (patientsList || []).filter(p => ctx.patientMatchesQuery(p, query));
  if (!matches.length) {
    dropdown.innerHTML = '<div style="padding:10px 12px;font-size:13px;color:var(--text-muted);font-style:italic;">Keine Patienten gefunden</div>';
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = matches.slice(0, 50).map(p => {
    const nameBirth = ctx.displayNameWithBirth(p);
    const phone = p.phone || p.metadata?.phone || p.phone_normalized || '';
    const phoneStr = phone ? ` · Tel: ${escapeHtml(phone)}` : '';
    // Patienten-Nr. vorangestellt: dieselbe Nummer steht in der Patientenliste
    // und bildet den ersten Teil der Belegnummer.
    const nrStr = p.patientennummer != null
      ? `<span style="font-family:monospace;color:var(--text-muted);margin-right:6px;">${escapeHtml(String(p.patientennummer))}</span>`
      : '';
    return `
      <div class="fbp-patient-item" data-id="${escapeHtml(p.id)}" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);color:var(--text-main);" onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='transparent'">
        ${nrStr}<strong>${escapeHtml(nameBirth)}</strong><span style="font-size:11px;color:var(--text-muted);">${phoneStr}</span>
      </div>`;
  }).join('');
  dropdown.style.display = 'block';
}

function autofillStammdaten(patientId) {
  const box = el('fbpStammdatenBox');
  if (!box) return;

  if (!patientId) {
    box.innerHTML = '<div style="color:var(--text-muted);font-style:italic;padding:12px;background:var(--bg-card);border-radius:8px;border:1px dashed var(--border);text-align:center;">Bitte Patient auswählen</div>';
    return;
  }

  const p = patientsMap[patientId];
  if (!p) {
    box.innerHTML = '<div style="color:var(--text-muted);font-style:italic;padding:12px;">Patientendaten werden geladen…</div>';
    return;
  }

  const name  = ctx.displayName(p) || [p.last_name, p.first_name].filter(Boolean).join(', ') || '—';
  const bd    = ctx.leadBirthDate(p);
  const geb   = bd ? formatDate(bd) : '—';
  const kk    = p.krankenkasse || p.metadata?.krankenkasse || '—';
  const phone = p.phone || p.metadata?.phone || p.phone_normalized || '—';
  const plz   = p.plz || p.metadata?.plz || '—';
  const vnr   = p.versichertennummer || p.metadata?.versichertennummer || '—';

  const feld = (l, v) => `<div><span style="color:var(--text-muted);display:block;font-size:11px;font-weight:600;">${l}</span><strong>${escapeHtml(v)}</strong></div>`;

  box.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:10px;font-size:13px;background:var(--bg-card);padding:10px;border-radius:8px;border:1px solid var(--border);">
      ${feld('Name, Vorname', name)}${feld('Geburtsdatum', geb)}${feld('Krankenkasse', kk)}
      ${feld('Telefon', phone)}${feld('PLZ', plz)}${feld('Versichertennr.', vnr)}
    </div>`;
}

// ── Markierungen ───────────────────────────────────────────────────────────

function markerSymbol(m) {
  return m.symbol || TYP_SYMBOL[m.type] || '✕';
}

function renderMarkers() {
  document.querySelectorAll('.fbp-diagram-container').forEach(container => {
    const layer = container.querySelector('.fbp-marker-layer');
    if (!layer) return;
    layer.innerHTML = '';
    const view = container.dataset.view;
    const foot = container.dataset.foot;

    markierungen.forEach((m, idx) => {
      if (m.view !== view || m.foot !== foot) return;
      const div = document.createElement('div');
      div.className = 'fbp-marker-item';
      div.dataset.index = idx;
      div.style.cssText = 'position:absolute;transform:translate(-50%,-50%);font-weight:bold;'
        + 'font-size:16px;line-height:1;user-select:none;cursor:pointer;';
      div.style.left  = (m.x * 100) + '%';
      div.style.top   = (m.y * 100) + '%';
      div.style.color = m.color || '#ef4444';
      // Die Beschriftung steckt in der Markierung, nicht in der aktuellen
      // Legende — ein späteres Umbenennen darf alte Befunde nicht umdeuten.
      div.title = (m.label ? `${m.label} — ` : '') + 'Klicken zum Löschen';
      div.innerHTML = `<span style="text-shadow:0 0 2px var(--bg-card-solid,#fff),0 0 4px var(--bg-card-solid,#fff);">${escapeHtml(markerSymbol(m))}</span>`;
      layer.appendChild(div);
    });
  });
}

/** Was auf DIESER Karte tatsächlich vorkommt — inkl. Einträgen, die es in der
 *  heutigen Legende nicht mehr gibt. */
function renderKartenLegende() {
  const box = el('fbpLegendeBox');
  if (!box) return;

  const gesehen = new Map();
  markierungen.forEach(m => {
    const key = `${markerSymbol(m)}|${m.color || ''}`;
    if (!gesehen.has(key)) {
      gesehen.set(key, { symbol: markerSymbol(m), color: m.color || '#ef4444', label: m.label || '', anzahl: 0 });
    }
    gesehen.get(key).anzahl++;
  });

  if (!gesehen.size) {
    box.innerHTML = '<span style="font-size:12px;color:var(--text-muted);font-style:italic;">Noch keine Markierungen gesetzt.</span>';
    return;
  }

  box.innerHTML = Array.from(gesehen.values()).map(e => `
    <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:3px 9px;border-radius:12px;background:var(--bg-card-solid);border:1px solid var(--border);">
      <span style="color:${escapeHtml(e.color)};font-weight:bold;">${escapeHtml(e.symbol)}</span>
      <span style="color:var(--text-main);">${escapeHtml(e.label || 'ohne Bezeichnung')}</span>
      <span style="color:var(--text-muted);">×${e.anzahl}</span>
    </span>`).join('');
}

function renderWerkzeugleiste() {
  const bar = el('fbpToolBar');
  if (!bar) return;

  if (!legende.length) {
    bar.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Keine Legende definiert — bitte in den Einstellungen anlegen.</span>';
    return;
  }
  if (!legende.some(e => e.id === aktiveLegendeId)) aktiveLegendeId = legende[0].id;

  bar.innerHTML = `
    <span style="font-size:12px;color:var(--text-muted);font-weight:600;">Werkzeug:</span>
    ${legende.map(e => `
      <button type="button" class="fbp-tool-btn${e.id === aktiveLegendeId ? ' active' : ''}" data-lid="${escapeHtml(e.id)}"
              style="color:${escapeHtml(e.color)};font-weight:600;">
        ${escapeHtml(e.symbol)} ${escapeHtml(e.label || 'ohne Bezeichnung')}
      </button>`).join('')}
    <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">
      Klick setzt Marker, Klick auf Marker löscht ihn · Legende: Einstellungen
    </span>`;
}

// ── Karte füllen / leeren ──────────────────────────────────────────────────

const DEFORMITAETEN = ['senkfuss','spreizfuss','knickfuss_innen','knickfuss_aussen','hohlfuss','plattfuss','andere','fussschwellungen'];
const RISIKEN       = ['diabetes','allergien','infektionskrankheiten','gerinnungshemmer'];
const HAUT          = ['hornhaut','hallux_valgus','warzen','hautpilz'];
const TOE_KEYS      = ['huehneraugen_auf','huehneraugen_zw','hammerzehen','nagelpilz','eingewachsen','zustand_naegel'];

/** Nur die klinischen Felder — Patient und Termin bleiben stehen. */
function schreibeBefundFelder(row) {
  const b = row?.befund || {};

  const def = b.deformitaeten || {};
  DEFORMITAETEN.forEach(k => {
    setCb(`fbp_def_${k}_l`, def[k]?.l);
    setCb(`fbp_def_${k}_r`, def[k]?.r);
  });

  const ein = b.einlagen || {};
  setCb('fbp_ein_konfektion', ein.konfektion);
  setCb('fbp_ein_nach_mass', ein.nach_mass);

  const kr = b.krampfadern || {};
  setCb('fbp_kramp_ober_l',  kr.oberschenkel?.l);
  setCb('fbp_kramp_ober_r',  kr.oberschenkel?.r);
  setCb('fbp_kramp_unter_l', kr.unterschenkel?.l);
  setCb('fbp_kramp_unter_r', kr.unterschenkel?.r);

  const risk = b.risiken || {};
  RISIKEN.forEach(k => setCb(`fbp_risk_${k}`, risk[k]));

  const haut = b.haut || {};
  HAUT.forEach(k => setCb(`fbp_haut_${k}`, haut[k]));
  const freitext = el('fbpHautFreitext');
  if (freitext) freitext.value = haut.freitext || '';

  const zn = b.zehen_naegel || {};
  TOE_KEYS.forEach(key => {
    const listL = Array.isArray(zn[key]?.l) ? zn[key].l : [];
    const listR = Array.isArray(zn[key]?.r) ? zn[key].r : [];
    document.querySelectorAll(`.fbp-toe-btn[data-key="${key}"][data-foot="l"]`).forEach(btn => {
      btn.classList.toggle('active', listL.includes(parseInt(btn.dataset.toe)));
    });
    document.querySelectorAll(`.fbp-toe-btn[data-key="${key}"][data-foot="r"]`).forEach(btn => {
      btn.classList.toggle('active', listR.includes(parseInt(btn.dataset.toe)));
    });
  });

  const notiz = el('fbpNotiz');
  if (notiz) notiz.value = row?.notiz || b.bemerkungen || '';

  // Tiefe Kopie: sonst zeigt die neue Karte auf die Markierungen der alten und
  // ein gelöschter Marker verschwände auch aus dem Befund des Vortermins.
  markierungen = Array.isArray(row?.markierungen)
    ? JSON.parse(JSON.stringify(row.markierungen))
    : [];

  renderMarkers();
  renderKartenLegende();
}

function leereBefundFelder() {
  schreibeBefundFelder(null);
}

function collectBefund() {
  const collectToe = key => ({
    l: Array.from(document.querySelectorAll(`.fbp-toe-btn[data-key="${key}"][data-foot="l"].active`)).map(b => parseInt(b.dataset.toe)),
    r: Array.from(document.querySelectorAll(`.fbp-toe-btn[data-key="${key}"][data-foot="r"].active`)).map(b => parseInt(b.dataset.toe)),
  });

  const paar = (pfx, k) => ({ l: getCb(`${pfx}_${k}_l`), r: getCb(`${pfx}_${k}_r`) });

  const deformitaeten = {};
  DEFORMITAETEN.forEach(k => { deformitaeten[k] = paar('fbp_def', k); });

  const risiken = {};
  RISIKEN.forEach(k => { risiken[k] = getCb(`fbp_risk_${k}`); });

  const haut = { freitext: el('fbpHautFreitext')?.value || '' };
  HAUT.forEach(k => { haut[k] = getCb(`fbp_haut_${k}`); });

  const zehen_naegel = {};
  TOE_KEYS.forEach(k => { zehen_naegel[k] = collectToe(k); });

  return {
    deformitaeten,
    einlagen: { konfektion: getCb('fbp_ein_konfektion'), nach_mass: getCb('fbp_ein_nach_mass') },
    krampfadern: {
      oberschenkel:  { l: getCb('fbp_kramp_ober_l'),  r: getCb('fbp_kramp_ober_r') },
      unterschenkel: { l: getCb('fbp_kramp_unter_l'), r: getCb('fbp_kramp_unter_r') },
    },
    risiken,
    haut,
    zehen_naegel,
  };
}

// ── Termine des Patienten ──────────────────────────────────────────────────

/** Nächstgelegener Termin zuerst — der von heute ist fast immer der gemeinte. */
function sortiereTermine(liste) {
  const jetzt = Date.now();
  return [...liste].sort((a, b) =>
    Math.abs(new Date(a.start_time) - jetzt) - Math.abs(new Date(b.start_time) - jetzt));
}

async function ladePatientenkontext(leadId) {
  termine = [];
  befundeDesPatienten = [];
  if (!leadId) return;

  const [terminRes, befundRes] = await Promise.all([
    ctx.supabase
      .from('bookings')
      .select('id, start_time, status, service:service_id(title)')
      .eq('owner_id', ctx.ownerId())
      .eq('lead_id', leadId)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: false })
      .limit(100),
    ctx.supabase
      .from('pat_fussbefund')
      .select('id, erstellt_am, befund, markierungen, notiz, lead_id, booking_id, uebernommen_von')
      .eq('owner_id', ctx.ownerId())
      .eq('lead_id', leadId)
      .order('erstellt_am', { ascending: false })
      .limit(100),
  ]);

  if (terminRes.error) console.error('[fussbefund] Termine laden:', terminRes.error.message);
  if (befundRes.error) console.error('[fussbefund] Befunde laden:', befundRes.error.message);

  termine = sortiereTermine(terminRes.data || []);
  befundeDesPatienten = befundRes.data || [];
}

function befundZuTermin(bookingId) {
  return befundeDesPatienten.find(b => b.booking_id === bookingId) || null;
}

/** Der jüngste Befund VOR diesem Zeitpunkt — die Vorlage für die Übernahme. */
function vorherigerBefund(stichtag) {
  const grenze = stichtag ? new Date(stichtag).getTime() : Date.now();
  return befundeDesPatienten
    .filter(b => new Date(b.erstellt_am).getTime() < grenze)
    .sort((a, b) => new Date(b.erstellt_am) - new Date(a.erstellt_am))[0] || null;
}

function renderTerminAuswahl() {
  const sel = el('fbpTermin');
  if (!sel) return;

  const optionen = termine.map(t => {
    const hat = befundZuTermin(t.id) ? ' ✓ Befund' : '';
    const leistung = t.service?.title ? ` · ${t.service.title}` : '';
    return `<option value="${escapeHtml(t.id)}">${escapeHtml(formatDateTime(t.start_time) + leistung + hat)}</option>`;
  }).join('');

  sel.innerHTML = `
    <option value="">${termine.length ? '— Termin wählen —' : '— Keine Termine vorhanden —'}</option>
    ${optionen}
    <option value="__ohne__">Ohne Termin (freies Datum)</option>`;
}

/** Datumsfeld nur zeigen, wenn kein Termin dahintersteht — sonst ist das Datum
 *  eine Kopie des Termins und zwei Wahrheiten laufen auseinander. */
function syncDatumsfeld() {
  const wrap = el('fbpDatumWrap');
  const info = el('fbpTerminInfo');
  const sel  = el('fbpTermin');
  if (!wrap || !sel) return;

  const wert = sel.value;
  const ohneTermin = wert === '__ohne__' || wert === '';
  wrap.hidden = !ohneTermin;

  if (info) {
    const t = termine.find(x => x.id === wert);
    info.textContent = t ? `Befund-Datum: ${formatDateTime(t.start_time)}` : '';
  }
}

function zeigeUebernahme(quelle) {
  const box = el('fbpUebernahme');
  if (!box) return;
  if (!quelle) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = `
    <strong>Aus dem Befund vom ${escapeHtml(formatDate(quelle.erstellt_am))} übernommen.</strong>
    Ändern Sie nur, was sich geändert hat — beim Speichern entsteht ein neuer Eintrag,
    der Befund des vorherigen Termins bleibt unverändert.`;
}

/** Herzstück: was passiert, wenn ein Termin gewählt wird. */
function terminGewaehlt() {
  const sel = el('fbpTermin');
  if (!sel) return;
  syncDatumsfeld();

  const wert = sel.value;
  if (!wert) { return; }

  if (wert === '__ohne__') {
    currentId = null;
    uebernommenVon = null;
    zeigeUebernahme(null);
    const d = el('fbpDatum');
    if (d && !d.value) d.value = isoDatum(new Date());
    return;
  }

  const termin = termine.find(t => t.id === wert);
  const vorhanden = befundZuTermin(wert);

  if (vorhanden) {
    // Vorhandener Befund dieses Termins → bearbeiten, nicht kopieren.
    currentId = vorhanden.id;
    uebernommenVon = vorhanden.uebernommen_von || null;
    zeigeUebernahme(null);
    schreibeBefundFelder(vorhanden);
    return;
  }

  // Neuer Termin: Vorbefund als Kopie, currentId bleibt null → INSERT.
  const quelle = vorherigerBefund(termin?.start_time);
  currentId = null;
  uebernommenVon = quelle ? quelle.id : null;
  schreibeBefundFelder(quelle);
  zeigeUebernahme(quelle);
}

async function patientGewaehlt(leadId) {
  autofillStammdaten(leadId);
  currentId = null;
  uebernommenVon = null;
  zeigeUebernahme(null);
  leereBefundFelder();

  const sel = el('fbpTermin');
  if (sel) sel.innerHTML = '<option value="">Termine werden geladen…</option>';

  await ladePatientenkontext(leadId);
  renderTerminAuswahl();

  // Der zeitlich nächste Termin ist die Vorauswahl — das ist der Griff, den
  // der Podologe sonst jedes Mal selbst machen müsste.
  if (sel && termine.length) {
    sel.value = termine[0].id;
    terminGewaehlt();
  } else {
    if (sel) sel.value = '__ohne__';
    syncDatumsfeld();
    const d = el('fbpDatum');
    if (d) d.value = isoDatum(new Date());
  }

  renderBefundListe();
}

// ── Speichern ──────────────────────────────────────────────────────────────

async function speichern() {
  const patientId = el('fbpPatient')?.value;
  const terminId  = el('fbpTermin')?.value || '';

  if (!patientId) {
    ctx.showToast('Bitte zuerst einen Patienten wählen.', 'error');
    return;
  }
  if (!terminId) {
    ctx.showToast('Bitte einen Termin wählen — oder „Ohne Termin".', 'error');
    return;
  }

  let bookingId = null;
  let erstelltAm = null;

  if (terminId === '__ohne__') {
    const datumVal = el('fbpDatum')?.value;
    if (!datumVal) { ctx.showToast('Bitte ein Befund-Datum angeben.', 'error'); return; }
    erstelltAm = new Date(datumVal).toISOString();
  } else {
    const termin = termine.find(t => t.id === terminId);
    if (!termin) { ctx.showToast('Termin nicht gefunden. Bitte neu wählen.', 'error'); return; }
    bookingId = termin.id;
    erstelltAm = new Date(termin.start_time).toISOString();
  }

  const btn = el('fbpSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Speichert…'; }

  const felder = {
    erstellt_am:  erstelltAm,
    befund:       collectBefund(),
    markierungen: markierungen,
    notiz:        el('fbpNotiz')?.value?.trim() || '',
    booking_id:   bookingId,
  };

  let error = null;
  if (currentId) {
    // Bearbeiten des offenen Befunds. Fremde Zeilen fasst das nie an.
    ({ error } = await ctx.supabase.from('pat_fussbefund').update(felder).eq('id', currentId));
  } else {
    const res = await ctx.supabase
      .from('pat_fussbefund')
      .insert([{
        ...felder,
        owner_id:        ctx.ownerId(),
        lead_id:         patientId,
        uebernommen_von: uebernommenVon,
        erfasst_von:     ctx.userId() || null,
      }])
      .select('id')
      .single();
    error = res.error;
    if (res.data) currentId = res.data.id;
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Speichern'; }

  if (error) {
    // 23505 = der Termin hat schon einen Befund (zweiter Tab, Doppelklick).
    const msg = error.code === '23505'
      ? 'Für diesen Termin gibt es bereits einen Befund. Bitte den Termin neu wählen — er wird dann zum Bearbeiten geladen.'
      : 'Fehler beim Speichern: ' + error.message;
    ctx.showToast(msg, 'error');
    return;
  }

  ctx.showToast('Befund gespeichert ✓');
  zeigeUebernahme(null);

  // Kontext neu ziehen, damit „✓ Befund" am Termin steht und die Liste stimmt.
  await ladePatientenkontext(patientId);
  renderTerminAuswahl();
  const sel = el('fbpTermin');
  if (sel) { sel.value = bookingId || '__ohne__'; syncDatumsfeld(); }
  renderBefundListe();
}

// ── Liste der gespeicherten Befunde ────────────────────────────────────────

function kurzBefund(row) {
  const parts = [];
  const mCount = Array.isArray(row.markierungen) ? row.markierungen.length : 0;
  if (mCount > 0) parts.push(`${mCount} Marker`);

  const b = row.befund || {};
  const risk = b.risiken || {};
  if (risk.diabetes) parts.push('Diabetes');
  if (risk.allergien) parts.push('Allergie');
  if (risk.gerinnungshemmer) parts.push('Gerinnungshemmer');

  const def = b.deformitaeten || {};
  const defLabels = {
    senkfuss: 'Senkfuß', spreizfuss: 'Spreizfuß', knickfuss_innen: 'Knickfuß i.',
    knickfuss_aussen: 'Knickfuß a.', hohlfuss: 'Hohlfuß', plattfuss: 'Plattfuß',
    andere: 'Deformität', fussschwellungen: 'Schwellung',
  };
  Object.keys(defLabels).forEach(k => {
    if (def[k]?.l || def[k]?.r) parts.push(defLabels[k]);
  });

  const haut = b.haut || {};
  if (haut.hornhaut) parts.push('Hornhaut');
  if (haut.hallux_valgus) parts.push('Hallux Valgus');
  if (haut.warzen) parts.push('Warzen');
  if (haut.hautpilz) parts.push('Hautpilz');

  return parts.length ? parts.join(' · ') : 'Keine Besonderheiten';
}

/**
 * Zeigt ausschliesslich die Befunde des gewählten Patienten.
 * Ohne Auswahl bleibt die Liste leer — eine Praxisliste „alle Befunde aller
 * Patienten" war der eigentliche Fehler: „dass du nicht meine Befunde siehst,
 * sondern von Klaus Fischer".
 */
function renderBefundListe() {
  const container = el('fbpTableContainer');
  const titel = el('fbpListeTitel');
  if (!container) return;

  const leadId = el('fbpPatient')?.value;
  if (titel) {
    const p = leadId ? patientsMap[leadId] : null;
    titel.textContent = p ? `Befunde: ${ctx.displayName(p) || 'Patient'}` : 'Gespeicherte Befunde';
  }

  if (!leadId) {
    container.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:12px 0;text-align:center;">Bitte einen Patienten wählen.</div>';
    return;
  }
  if (!befundeDesPatienten.length) {
    container.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:12px 0;text-align:center;">Für diesen Patienten ist noch kein Befund gespeichert.</div>';
    return;
  }

  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table" style="width:100%;font-size:12px;">
        <thead>
          <tr><th>Datum</th><th>Kurz-Befund</th><th style="text-align:right;">Aktion</th></tr>
        </thead>
        <tbody>
          ${befundeDesPatienten.map(row => {
            const kurz = kurzBefund(row);
            const herkunft = row.uebernommen_von ? ' <span title="Aus dem vorherigen Befund übernommen" style="color:var(--text-muted);">↩</span>' : '';
            return `
              <tr${row.id === currentId ? ' style="background:var(--bg-hover);"' : ''}>
                <td style="white-space:nowrap;">${escapeHtml(formatDate(row.erstellt_am))}${herkunft}</td>
                <td style="max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(kurz)}">${escapeHtml(kurz)}</td>
                <td style="text-align:right;white-space:nowrap;">
                  <button type="button" class="btn-sm fbp-btn-open" data-id="${escapeHtml(row.id)}" title="Befund ansehen" style="padding:3px 7px;">👁</button>
                  <button type="button" class="btn-sm btn-danger fbp-btn-del" data-id="${escapeHtml(row.id)}" title="Löschen" style="padding:3px 7px;">✕</button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  container.querySelectorAll('.fbp-btn-open').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = befundeDesPatienten.find(r => r.id === btn.dataset.id);
      if (row) oeffneBefund(row);
    });
  });

  container.querySelectorAll('.fbp-btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const ok = await ctx.showConfirmModal({
        title: 'Fußbefund löschen',
        message: 'Möchten Sie diesen Fußbefund wirklich löschen?',
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        variant: 'danger',
      });
      if (!ok) return;

      const { error } = await ctx.supabase.from('pat_fussbefund').delete().eq('id', id);
      if (error) { ctx.showToast('Fehler beim Löschen: ' + error.message, 'error'); return; }

      ctx.showToast('Befund gelöscht ✓');
      if (currentId === id) { currentId = null; leereBefundFelder(); }

      const leadNow = el('fbpPatient')?.value;
      if (leadNow) {
        await ladePatientenkontext(leadNow);
        renderTerminAuswahl();
        const sel = el('fbpTermin');
        if (sel) syncDatumsfeld();
      }
      renderBefundListe();
    });
  });
}

/** Einen gespeicherten Befund öffnen — inklusive seines Termins. */
function oeffneBefund(row) {
  currentId = row.id;
  uebernommenVon = row.uebernommen_von || null;
  zeigeUebernahme(null);

  const sel = el('fbpTermin');
  if (sel) {
    if (row.booking_id && termine.some(t => t.id === row.booking_id)) {
      sel.value = row.booking_id;
    } else {
      sel.value = '__ohne__';
      const d = el('fbpDatum');
      if (d) d.value = isoDatum(row.erstellt_am);
    }
    syncDatumsfeld();
  }

  schreibeBefundFelder(row);
  renderBefundListe();
}

function neuerBefund() {
  currentId = null;
  uebernommenVon = null;
  zeigeUebernahme(null);

  const patHidden = el('fbpPatient');
  if (patHidden) patHidden.value = '';
  const patSearch = el('fbpPatientSearch');
  if (patSearch) patSearch.value = '';
  const dropdown = el('fbpPatientDropdown');
  if (dropdown) dropdown.style.display = 'none';

  termine = [];
  befundeDesPatienten = [];
  autofillStammdaten('');
  renderTerminAuswahl();
  const sel = el('fbpTermin');
  if (sel) sel.value = '';
  syncDatumsfeld();

  const d = el('fbpDatum');
  if (d) d.value = isoDatum(new Date());

  leereBefundFelder();
  renderBefundListe();
}

// ── Aufbau ─────────────────────────────────────────────────────────────────

const TOE_ZEILEN = [
  { key: 'huehneraugen_auf', label: 'Hühneraugen auf Zehen' },
  { key: 'huehneraugen_zw',  label: 'Hühneraugen zw. Zehen' },
  { key: 'hammerzehen',      label: 'Hammerzehen' },
  { key: 'nagelpilz',        label: 'Nagelpilz' },
  { key: 'eingewachsen',     label: 'Eingewachsene Nägel' },
  { key: 'zustand_naegel',   label: 'Zustand der Nägel' },
];

function zeheZeilen() {
  return TOE_ZEILEN.map(item => `
    <tr>
      <td>${escapeHtml(item.label)}</td>
      ${['l', 'r'].map(f => `
      <td style="text-align:center;">
        <div class="fbp-toe-group" style="justify-content:center;">
          ${[1,2,3,4,5].map(n => `<button type="button" class="fbp-toe-btn" data-key="${item.key}" data-foot="${f}" data-toe="${n}">${n}</button>`).join('')}
        </div>
      </td>`).join('')}
    </tr>`).join('');
}

function paarZeile(label, idBase) {
  return `<tr><td>${escapeHtml(label)}</td>
    <td style="text-align:center;"><input type="checkbox" id="${idBase}_l"></td>
    <td style="text-align:center;"><input type="checkbox" id="${idBase}_r"></td></tr>`;
}

function checkbox(id, label) {
  return `<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
    <input type="checkbox" id="${id}"> ${escapeHtml(label)}</label>`;
}

function diagramm(view, foot, datei, maxW) {
  return `
    <div class="fbp-diagram-container" data-view="${view}" data-foot="${foot}" style="position:relative;flex:1;max-width:${maxW}px;">
      <img src="/assets/img/foot/${datei}.png" alt="${view}" style="width:100%;height:auto;display:block;pointer-events:none;user-select:none;" draggable="false">
      <div class="fbp-marker-layer" style="position:absolute;top:0;left:0;width:100%;height:100%;cursor:crosshair;z-index:2;"></div>
    </div>`;
}

function kartenHtml(heute) {
  const feldStil = 'width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-card-solid);color:var(--text-main);font-size:14px;';

  return `
    <!-- Steuerzeile -->
    <div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px;flex-wrap:wrap;">
      <div style="position:relative;flex:1;min-width:240px;">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600;">Patient</label>
        <input type="text" id="fbpPatientSearch" placeholder="Patient suchen (Name, Geb.-Datum oder Telefon)…" autocomplete="off" class="input-control" style="${feldStil}">
        <input type="hidden" id="fbpPatient" value="">
        <div id="fbpPatientDropdown" style="display:none;position:absolute;top:100%;left:0;right:0;max-height:220px;overflow-y:auto;background:var(--bg-card-solid);border:1px solid var(--border);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:100;margin-top:2px;"></div>
      </div>

      <div style="flex:1;min-width:240px;">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600;">Termin</label>
        <select id="fbpTermin" class="input-control" style="${feldStil}">
          <option value="">Bitte zuerst Patient wählen</option>
        </select>
        <div id="fbpTerminInfo" style="font-size:11px;color:var(--text-muted);margin-top:4px;"></div>
      </div>

      <div style="width:160px;" id="fbpDatumWrap" hidden>
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;font-weight:600;">Befund-Datum</label>
        <input type="date" id="fbpDatum" value="${heute}" class="input-control" style="${feldStil}">
      </div>

      <div style="display:flex;gap:8px;">
        <button type="button" id="fbpNewBtn" class="btn" style="height:38px;padding:0 14px;">+ Neuer Befund</button>
        <button type="button" id="fbpSaveBtn" class="btn-primary" style="height:38px;padding:0 18px;">Speichern</button>
      </div>
    </div>

    <div id="fbpUebernahme" hidden style="margin-bottom:14px;padding:10px 12px;border-radius:8px;font-size:12.5px;line-height:1.5;
         background:rgba(37,99,235,0.10);border:1px solid rgba(37,99,235,0.32);color:var(--text-main);"></div>

    <div class="fbp-card-container">
      <div class="fbp-paper-card">

        <div class="fbp-section">
          <div class="fbp-section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Patienten-Stammdaten (aus Akte)
          </div>
          <div id="fbpStammdatenBox">
            <div style="color:var(--text-muted);font-style:italic;padding:12px;background:var(--bg-card);border-radius:8px;border:1px dashed var(--border);text-align:center;">Bitte Patient auswählen</div>
          </div>
        </div>

        <div class="fbp-section">
          <div class="fbp-section-title">Fußdeformitäten</div>
          <table class="fbp-grid-table">
            <thead><tr><th>Befund</th><th style="width:65px;text-align:center;">Links</th><th style="width:65px;text-align:center;">Rechts</th></tr></thead>
            <tbody>
              ${paarZeile('Senkfuß', 'fbp_def_senkfuss')}
              ${paarZeile('Spreizfuß', 'fbp_def_spreizfuss')}
              ${paarZeile('Knickfuß nach innen', 'fbp_def_knickfuss_innen')}
              ${paarZeile('Knickfuß nach außen', 'fbp_def_knickfuss_aussen')}
              ${paarZeile('Hohlfuß', 'fbp_def_hohlfuss')}
              ${paarZeile('Plattfuß', 'fbp_def_plattfuss')}
              ${paarZeile('Andere Fußdeformitäten', 'fbp_def_andere')}
              ${paarZeile('Fußschwellungen', 'fbp_def_fussschwellungen')}
            </tbody>
          </table>
        </div>

        <div class="fbp-section">
          <div class="fbp-section-title">Einlagen</div>
          <div style="display:flex;gap:24px;font-size:13px;">
            ${checkbox('fbp_ein_konfektion', 'Konfektion')}
            ${checkbox('fbp_ein_nach_mass', 'Nach Maß')}
          </div>
        </div>

        <div class="fbp-section">
          <div class="fbp-section-title">Krampfadern</div>
          <table class="fbp-grid-table">
            <thead><tr><th>Bereich</th><th style="width:65px;text-align:center;">Links</th><th style="width:65px;text-align:center;">Rechts</th></tr></thead>
            <tbody>
              ${paarZeile('Oberschenkel', 'fbp_kramp_ober')}
              ${paarZeile('Unterschenkel', 'fbp_kramp_unter')}
            </tbody>
          </table>
        </div>

        <div class="fbp-section">
          <div class="fbp-section-title">Risiken</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:10px;font-size:13px;">
            ${checkbox('fbp_risk_diabetes', 'Diabetes')}
            ${checkbox('fbp_risk_allergien', 'Allergien')}
            ${checkbox('fbp_risk_infektionskrankheiten', 'Infektionskrankheiten')}
            ${checkbox('fbp_risk_gerinnungshemmer', 'Gerinnungshemmer')}
          </div>
        </div>

        <div class="fbp-section">
          <div class="fbp-section-title">Haut-Befund</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:10px;font-size:13px;margin-bottom:12px;">
            ${checkbox('fbp_haut_hornhaut', 'Hornhaut')}
            ${checkbox('fbp_haut_hallux_valgus', 'Hallux Valgus')}
            ${checkbox('fbp_haut_warzen', 'Warzen')}
            ${checkbox('fbp_haut_hautpilz', 'Hautpilz')}
          </div>
          <input type="text" id="fbpHautFreitext" class="input-control" placeholder="Freitext / Ergänzungen zum Hautbefund…" style="${feldStil}font-size:13px;">
        </div>

        <div class="fbp-section">
          <div class="fbp-section-title">Zehen &amp; Nägel</div>
          <table class="fbp-grid-table">
            <thead><tr><th>Befund</th><th style="width:150px;text-align:center;">Links (Zehe 1–5)</th><th style="width:150px;text-align:center;">Rechts (Zehe 1–5)</th></tr></thead>
            <tbody>${zeheZeilen()}</tbody>
          </table>
        </div>

        <div class="fbp-section">
          <div class="fbp-section-title">Fußdiagramme (Interaktive Befund-Markierung)</div>

          <div class="fbp-toolbar" id="fbpToolBar"></div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:20px;align-items:start;">
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;">
              <div style="font-weight:700;font-size:13px;color:var(--text-main);margin-bottom:10px;text-align:center;">Plantar (Sohle)</div>
              <div style="display:flex;gap:6px;justify-content:center;align-items:flex-start;">
                ${diagramm('plantar', 'r', 'plantar-right', 165)}
                ${diagramm('plantar', 'l', 'plantar-left', 165)}
              </div>
            </div>

            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;">
              <div style="font-weight:700;font-size:13px;color:var(--text-main);margin-bottom:10px;text-align:center;">Dorsal (Rücken)</div>
              <div style="display:flex;gap:6px;justify-content:center;align-items:flex-start;">
                ${diagramm('dorsal', 'l', 'dorsal-left', 165)}
                ${diagramm('dorsal', 'r', 'dorsal-right', 165)}
              </div>
            </div>

            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;">
              <div style="font-weight:700;font-size:13px;color:var(--text-main);margin-bottom:10px;text-align:center;">Lateral</div>
              <div style="display:flex;gap:8px;justify-content:center;align-items:center;">
                ${diagramm('lateral', 'l', 'lateral-left', 210)}
                ${diagramm('lateral', 'r', 'lateral-right', 210)}
              </div>
            </div>
          </div>

          <div style="margin-top:14px;">
            <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px;">Legende dieser Karte</div>
            <div id="fbpLegendeBox" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
          </div>
        </div>

        <div class="fbp-section">
          <div class="fbp-section-title">Bemerkungen</div>
          <textarea id="fbpNotiz" rows="3" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-card-solid);color:var(--text-main);font-size:13px;resize:vertical;" placeholder="Therapieempfehlungen, Folgetermin-Notizen..."></textarea>
        </div>

      </div>

      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;box-shadow:var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05));position:sticky;top:20px;">
        <h4 id="fbpListeTitel" style="margin:0 0 14px;color:var(--text-main);font-size:15px;">Gespeicherte Befunde</h4>
        <div id="fbpTableContainer">
          <div style="font-size:13px;color:var(--text-muted);padding:12px 0;text-align:center;">Bitte einen Patienten wählen.</div>
        </div>
      </div>
    </div>`;
}

function verdrahte(wurzel) {
  const searchInput = el('fbpPatientSearch');
  const dropdown = el('fbpPatientDropdown');
  const hidden = el('fbpPatient');

  if (searchInput && dropdown) {
    searchInput.addEventListener('input', e => {
      if (!e.target.value.trim()) {
        if (hidden) hidden.value = '';
        autofillStammdaten('');
      }
      renderPatientDropdown(e.target.value);
    });
    // Klick in ein Feld, in dem schon ein Patient steht: ganze Liste zeigen und
    // den alten Namen markieren, statt nach dem fertigen Text zu filtern.
    // Vorher blieb dabei nur der ohnehin gewählte Patient übrig — man musste
    // den Namen erst löschen, um einen anderen wählen zu können.
    let markierungOffen = false;
    searchInput.addEventListener('focus', () => {
      if (searchInput.value) {
        markierungOffen = true;
        try { searchInput.select(); } catch { /* nicht jeder Feldtyp kann das */ }
      }
      renderPatientDropdown('');
    });
    // Der Klick, der den Fokus setzt, würde die Markierung sofort aufheben.
    searchInput.addEventListener('mouseup', e => {
      if (!markierungOffen) return;
      markierungOffen = false;
      e.preventDefault();
    });
    searchInput.addEventListener('blur', () => { markierungOffen = false; });
    // Zweiter Klick ins bereits fokussierte Feld: wieder aufklappen.
    searchInput.addEventListener('click', () => {
      if (dropdown.style.display === 'none') renderPatientDropdown('');
    });

    dropdown.addEventListener('click', async e => {
      const item = e.target.closest('.fbp-patient-item');
      if (!item) return;
      const p = patientsMap[item.dataset.id];
      if (!p) return;
      if (hidden) hidden.value = p.id;
      searchInput.value = ctx.displayNameWithBirth(p);
      dropdown.style.display = 'none';
      await patientGewaehlt(p.id);
    });

    // Das Panel wird bei jedem Öffnen neu aufgebaut. Ohne das Abmelden sammelte
    // sich je Besuch ein weiterer Zuhörer am document an.
    if (dokumentKlick) document.removeEventListener('click', dokumentKlick);
    dokumentKlick = e => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    };
    document.addEventListener('click', dokumentKlick);
  }

  el('fbpTermin')?.addEventListener('change', terminGewaehlt);
  el('fbpNewBtn')?.addEventListener('click', neuerBefund);
  el('fbpSaveBtn')?.addEventListener('click', speichern);

  wurzel.querySelectorAll('.fbp-toe-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.preventDefault(); btn.classList.toggle('active'); });
  });

  el('fbpToolBar')?.addEventListener('click', e => {
    const btn = e.target.closest('.fbp-tool-btn');
    if (!btn) return;
    e.preventDefault();
    aktiveLegendeId = btn.dataset.lid;
    renderWerkzeugleiste();
  });

  wurzel.querySelectorAll('.fbp-diagram-container').forEach(container => {
    const layer = container.querySelector('.fbp-marker-layer');
    if (!layer) return;

    layer.addEventListener('click', e => {
      const item = e.target.closest('.fbp-marker-item');
      if (item) {
        e.stopPropagation();
        const idx = parseInt(item.dataset.index);
        if (!isNaN(idx) && idx >= 0 && idx < markierungen.length) {
          markierungen.splice(idx, 1);
          renderMarkers();
          renderKartenLegende();
        }
        return;
      }

      const rect = layer.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const eintrag = aktiveLegende();
      markierungen.push({
        view: container.dataset.view,
        foot: container.dataset.foot,
        x: Math.round(((e.clientX - rect.left) / rect.width) * 10000) / 10000,
        y: Math.round(((e.clientY - rect.top) / rect.height) * 10000) / 10000,
        // Kopie der Legende, nicht Verweis darauf — siehe Kopfkommentar.
        symbol: eintrag.symbol,
        color:  eintrag.color,
        label:  eintrag.label,
        legende_id: eintrag.id,
        type:   'x',   // Rückwärtskompatibilität für ältere Leser dieser Daten
      });
      renderMarkers();
      renderKartenLegende();
    });
  });
}

/**
 * Panel aufbauen. Wird von dashboard.js beim Öffnen des Moduls gerufen.
 *
 * @param {object} deps    supabase, ownerId(), userId(), bizScope(), showToast(),
 *                         showConfirmModal(), displayName(), displayNameWithBirth(),
 *                         leadBirthDate(), patientMatchesQuery(), sector(),
 *                         switchPanel(), closePanel()
 * @param {object} [preset] { leadId, bookingId } — Vorwahl aus dem Terminkalender.
 *                         Ohne Preset bleibt das Verhalten unverändert.
 */
export async function mountFussbefund(deps, preset) {
  ctx = deps;
  // Sofort einlösen, nicht erst am Ende: `oeffneFussbefundFuerTermin` erkennt am
  // geleerten Feld, dass der Panelwechsel den Aufbau bereits angestossen hat.
  const vorwahl = preset || ausstehenderPreset;
  ausstehenderPreset = null;

  const wurzel = el('fussstatusContent');
  if (!wurzel) return;
  wurzel.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">Lade Fußbefund-Karte…</span>';

  const ownerId = ctx.ownerId();

  // bizScope ist Pflicht: ohne sie zeigte die Karte Patienten ALLER Standorte
  // und wich damit von Patientenliste und Verordnung ab.
  const [patRes, legendeGeladen] = await Promise.all([
    ctx.bizScope(ctx.supabase
      .from('leads')
      .select('id, first_name, last_name, geburtsdatum, metadata, krankenkasse, phone, phone_normalized, plz, versichertennummer, patientennummer')
      .eq('owner_id', ownerId)
      .order('last_name', { ascending: true }), 'patients'),
    ladeLegende(ctx.supabase, ownerId),
  ]);

  if (patRes.error) console.error('[fussbefund] Patienten laden:', patRes.error.message);

  patientsList = patRes.data || [];
  patientsMap = {};
  patientsList.forEach(p => { patientsMap[p.id] = p; });

  legende = legendeGeladen;
  aktiveLegendeId = legende[0]?.id || null;

  currentId = null;
  uebernommenVon = null;
  markierungen = [];
  termine = [];
  befundeDesPatienten = [];

  wurzel.innerHTML = kartenHtml(isoDatum(new Date()));
  verdrahte(wurzel);
  renderWerkzeugleiste();
  renderTerminAuswahl();
  syncDatumsfeld();
  leereBefundFelder();
  renderBefundListe();

  if (vorwahl?.leadId) await wendePresetAn(vorwahl);
}

// ── Einstieg aus dem Terminkalender ────────────────────────────────────────

/**
 * Patient und Termin so setzen, als hätte der Podologe beides selbst gewählt.
 * Bewusst über `patientGewaehlt()` + `terminGewaehlt()` — die Entscheidung
 * „bearbeiten oder Vorbefund übernehmen" darf es nur an einer Stelle geben.
 */
async function wendePresetAn(preset) {
  const p = patientsMap[preset.leadId];
  if (!p) {
    ctx.showToast('Der Patient dieses Termins steht nicht in Ihrer Patientenliste.', 'error');
    return;
  }

  const hidden = el('fbpPatient');
  if (hidden) hidden.value = p.id;
  const suche = el('fbpPatientSearch');
  if (suche) suche.value = ctx.displayNameWithBirth(p);

  await patientGewaehlt(p.id);

  if (!preset.bookingId) return;
  const sel = el('fbpTermin');
  if (!sel) return;

  // Abgesagte Termine stehen nicht in der Liste — dann bleibt die Vorauswahl
  // aus `patientGewaehlt()` stehen, statt ins Leere zu zeigen.
  if (!termine.some(t => t.id === preset.bookingId)) {
    ctx.showToast('Dieser Termin steht nicht in der Terminliste — bitte manuell wählen.', 'error');
    return;
  }

  sel.value = preset.bookingId;
  terminGewaehlt();
}

/**
 * Vom Termin-Seitenbereich in die Fußbefund-Karte springen.
 * Der Panelwechsel baut das Modul selbst auf; der Preset liegt so lange bereit.
 */
export async function oeffneFussbefundFuerTermin(deps, booking) {
  if (!booking?.lead_id) return;

  ausstehenderPreset = { leadId: booking.lead_id, bookingId: booking.id };
  deps.closePanel?.();

  if (typeof deps.switchPanel === 'function') await deps.switchPanel('fussstatus');

  // Sicherheitsnetz: hat der Panelwechsel den Aufbau nicht ausgelöst, liegt der
  // Preset noch da — dann selbst montieren.
  if (ausstehenderPreset) await mountFussbefund(deps);
}

/**
 * Den Fußbefund-Knopf im Termin-Seitenbereich einrichten.
 * Sichtbar nur in der Podologie und nur bei einem Termin mit Patientenakte:
 * ältere Termine tragen den Namen bloss als Text (`customer_name`), dort gibt
 * es keinen Patienten, an dem ein Befund hängen könnte.
 */
export async function verdrahteFussbefundKnopf(deps, booking) {
  const btn = document.getElementById('bkActionFussbefundBtn');
  if (!btn) return;

  const podologie = resolveSector(deps.sector?.() || '') === 'podologie';
  if (!podologie || !booking?.lead_id || !document.getElementById('panel-fussstatus')) {
    btn.hidden = true;
    return;
  }

  btn.hidden = false;
  btn.dataset.bookingId = booking.id;
  btn.textContent = '🦶 Fußbefund';
  btn.onclick = () => oeffneFussbefundFuerTermin(deps, booking);

  // Beschriftung erst, wenn feststeht, ob es schon einen Befund gibt.
  const { data, error } = await deps.supabase
    .from('pat_fussbefund')
    .select('id')
    .eq('booking_id', booking.id)
    .maybeSingle();

  // Inzwischen ein anderer Termin geöffnet → diese Antwort ist veraltet.
  if (btn.dataset.bookingId !== booking.id) return;
  if (error) { console.error('[fussbefund] Befund-Prüfung:', error.message); return; }

  btn.textContent = data ? '🦶 Fußbefund öffnen' : '🦶 Fußbefund anlegen';
}

// ── Einstellungen: Legende bearbeiten ──────────────────────────────────────

let legendeEntwurf = null;   // Bearbeitungsstand, erst beim Speichern verbindlich

function zeileHtml(e, idx) {
  return `
    <div class="fbp-leg-row" data-idx="${idx}" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
      <select class="form-select fbp-leg-symbol" style="width:74px;font-size:16px;text-align:center;">
        ${LEGENDE_SYMBOLE.map(s => `<option value="${s}"${s === e.symbol ? ' selected' : ''}>${s}</option>`).join('')}
      </select>
      <select class="form-select fbp-leg-color" style="width:130px;color:${escapeHtml(e.color)};font-weight:600;">
        ${LEGENDE_FARBEN.map(f => `<option value="${escapeHtml(f.wert)}"${f.wert === e.color ? ' selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
      </select>
      <input class="form-input fbp-leg-label" type="text" maxlength="60" style="flex:1;min-width:180px;"
             placeholder="Bedeutung, z. B. Hühnerauge" value="${escapeHtml(e.label)}">
      <button type="button" class="btn-sm btn-danger fbp-leg-del" title="Eintrag entfernen" style="padding:4px 9px;">✕</button>
    </div>`;
}

function renderLegendeListe() {
  const liste = el('setLegendeList');
  if (!liste) return;

  liste.innerHTML = legendeEntwurf.length
    ? legendeEntwurf.map(zeileHtml).join('')
    : '<div style="font-size:13px;color:var(--text-muted);padding:8px 0;">Keine Einträge — mit „＋ Eintrag" beginnen.</div>';

  liste.querySelectorAll('.fbp-leg-row').forEach(row => {
    const idx = parseInt(row.dataset.idx);
    row.querySelector('.fbp-leg-symbol')?.addEventListener('change', ev => {
      legendeEntwurf[idx].symbol = ev.target.value;
    });
    row.querySelector('.fbp-leg-color')?.addEventListener('change', ev => {
      legendeEntwurf[idx].color = ev.target.value;
      ev.target.style.color = ev.target.value;
    });
    row.querySelector('.fbp-leg-label')?.addEventListener('input', ev => {
      legendeEntwurf[idx].label = ev.target.value;
    });
    row.querySelector('.fbp-leg-del')?.addEventListener('click', () => {
      legendeEntwurf.splice(idx, 1);
      renderLegendeListe();
    });
  });
}

/**
 * Einstellungen → „Legende der Fußgrafik".
 * Nur für Owner: die Legende ist eine Praxisfestlegung, keine persönliche.
 * Bereits gesetzte Markierungen ändern sich durch eine Umbenennung NICHT.
 */
export async function renderLegendeSettings(deps) {
  const section = document.getElementById('settingsLegendeSection');
  if (!section) return;

  const zeigen = deps.profile?.role === 'owner';
  section.hidden = !zeigen;
  if (!zeigen) return;

  const geladen = await ladeLegende(deps.supabase, deps.ownerId());
  // Kopie: solange nicht gespeichert ist, darf die laufende Karte nichts merken.
  legendeEntwurf = geladen.map(e => ({ ...e }));
  renderLegendeListe();

  if (section.dataset.wired) return;
  section.dataset.wired = '1';

  document.getElementById('setLegendeAddBtn')?.addEventListener('click', () => {
    if (legendeEntwurf.length >= 20) {
      deps.showToast('Mehr als 20 Einträge sind nicht sinnvoll lesbar.', 'error');
      return;
    }
    legendeEntwurf.push({
      id: `l${Date.now()}${legendeEntwurf.length}`,
      symbol: LEGENDE_SYMBOLE[legendeEntwurf.length % LEGENDE_SYMBOLE.length],
      color: LEGENDE_FARBEN[legendeEntwurf.length % LEGENDE_FARBEN.length].wert,
      label: '',
    });
    renderLegendeListe();
  });

  document.getElementById('setLegendeResetBtn')?.addEventListener('click', () => {
    legendeEntwurf = STANDARD_LEGENDE.map(e => ({ ...e }));
    renderLegendeListe();
  });

  document.getElementById('setLegendeSaveBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('setLegendeSaveBtn');
    const sauber = normalisiereLegende(legendeEntwurf).filter(e => e.label.trim());

    if (legendeEntwurf.length && !sauber.length) {
      deps.showToast('Bitte jedem Zeichen eine Bedeutung geben.', 'error');
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    const { error } = await deps.supabase
      .from('profiles')
      .update({ fussbefund_legende: sauber })
      .eq('id', deps.ownerId());
    if (btn) { btn.disabled = false; btn.textContent = 'Speichern'; }

    if (error) {
      console.error('[fussbefund] Legende speichern:', error.message);
      deps.showToast('Fehler beim Speichern: ' + error.message, 'error');
      return;
    }

    // Die offene Karte sofort nachziehen, ohne bestehende Markierungen zu berühren.
    legende = sauber.length ? sauber : STANDARD_LEGENDE;
    aktiveLegendeId = legende[0]?.id || null;
    renderWerkzeugleiste();

    deps.showToast('Legende gespeichert ✓');
  });
}
