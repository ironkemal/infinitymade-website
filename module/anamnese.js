/**
 * anamnese.js — Panel „Anamnese", Akten-Reiter und Kiosk-Anbindung (DOM-Schicht).
 *
 * Herkunft
 * ────────
 * Aus `dashboard.js` herausgelöst (Konsey 2026-08-13, Einkreisungsverfahren):
 * `loadAnamnese`, `fillAnamneseForm`, `saveAnamnese`, `printAnamneseInline`,
 * `loadPatientDetailAnamnese` u. a. Der Umzug ist einseitig.
 *
 * Was sich am 30.09.2026 geändert hat (Kemal: Anamnese je Fachbereich)
 * ─────────────────────────────────────────────────────────────────────
 *  · Podologie / Ergo / Logo zeichnen ihr Formular aus `anamnese-formulare.js`;
 *    Physio bleibt das feste Markup in dashboard.html (Verhalten unverändert).
 *  · Gespeichert wird IMMER per INSERT (append-only, § 630f BGB); den UPDATE-Zweig
 *    gibt es nicht mehr. „Anamnese unverändert bestätigen" = Kopie als neue Version.
 *  · Leser filtern `ist_aktuell = true` und den Fachbereich der Praxis.
 *  · Kiosk: `quelle='kiosk'`, `nurPraxis`-Felder (Infektion) fehlen, ungeprüft bis „geprüft".
 *
 * ⚠ Die Datenbankspalten kommen aus der Migration von Sitzung B — ohne sie schlägt jedes
 *   Laden/Speichern hier fehl. Siehe anamnese-daten.js.
 */

import { alsISODatum, datumDe } from './datum.js?v=20261001a';
import {
  formular, fachbereichAusSektor, FACHBEREICH_LABEL, ENTWURF_HINWEIS, istSichtbar, istPflicht,
  validiere, antwortAusForm, anzeigeZeilen, baueInsert, vorschlaegeAusRisiken, kioskHinweis, kioskOptionLabel,
} from './anamnese-formulare.js?v=20261001r';
import {
  ladeAktuelle, ladeAlleAktuellen, ladeVersionen, speichereNeu, bestaetige, markiereGeprueft, ladeAltrisiken,
} from './anamnese-daten.js?v=20261001r';
import { rozetHtml } from './anamnese-rozet.js?v=20261001r';
import { ladeWagnerRozet } from './podo-wagner.js?v=20261001z';

let d = {};   // Abhängigkeiten aus dashboard.js
let vorwahl = null;                 // Patient, den ein anderer Bildschirm vorwählt
let aktuellerPatient = null;        // im Panel gewählt
let aktuelleRow = null;             // gültige Anamnese des Fachbereichs (oder null)
let vorschlaege = {};               // Übergang: Vorschläge aus altem Fußbefund
let ladeNr = 0;                     // verwirft veraltete Antworten beim schnellen Patientenwechsel
let akteLead = null;                // Patient im geöffneten Akten-Modal

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {object} injected  supabase, getOwnerId, getUserId, getSector, getProfile, showToast,
 *   displayNameWithBirth, loadAerzte, getAerzte, wireArztFeld, isPraxisSector, printArea, closeModal,
 *   switchPanel, nachSpeichern
 */
export function initAnamnese(injected = {}) {
  d = { showToast: (m) => console.log(m), ...injected };
  // „ungeprüft"-Etikett am Rozet: ein Tipp bestätigt (kein Inline-Handler — Rozet-HTML wird per innerHTML gebaut).
  document.addEventListener('click', (e) => {
    const b = e.target?.closest?.('[data-anamnese-pruefen]');
    if (b) pruefeKlick(b);
  });
  // Kiosk betreten/verlassen: Formular neu zeichnen (nurPraxis-Felder, Hinweise, „weiß nicht").
  document.addEventListener('praxura:kiosk', () => { zeichneFormular(true); aktualisiereKopf(); });
}

/** Andere Bildschirme (Termin, Akte, Tagesbehandlung, Fußbefund) öffnen das Panel mit diesem Patienten. */
export function setzeAnamneseVorwahl(id) { vorwahl = id || null; }
export function oeffneAnamneseFuer(id) { vorwahl = id || null; d.switchPanel?.('anamnese'); }

const istKiosk = () => { const o = $('kioskOverlay'); return !!o && !o.hidden; };
const fachbereich = () => fachbereichAusSektor(d.getSector?.());

// ─────────────────────────────────────────────────────────────────────────────
// Formular zeichnen (Podologie / Ergo / Logo)
// ─────────────────────────────────────────────────────────────────────────────

function optionenHtml(f, { kiosk }) {
  const name = `anf_${f.id}`;
  if (f.typ === 'wahl') {
    return `<div class="anam-radio-row anf-optionen" id="${name}">${f.optionen.map((o) =>
      `<label><input type="radio" name="${name}" value="${esc(o.w)}" /> ${esc(kioskOptionLabel(f, o, kiosk))}</label>`).join('')}</div>`;
  }
  const boxen = `<div class="anam-grid anf-optionen" id="${name}">${f.optionen.map((o) =>
    `<label><input type="checkbox" name="${name}" value="${esc(o.w)}"${f.exklusiv ? ` data-exklusiv="${esc(f.exklusiv)}"` : ''} /> ${esc(o.l)}</label>`).join('')}</div>`;
  return boxen + (f.text ? `<input type="text" class="anam-other" id="${name}_text" placeholder="Weitere / Freitext…" />` : '');
}

function eingabeHtml(f, opt) {
  const name = `anf_${f.id}`;
  switch (f.typ) {
    case 'wahl': case 'mehrfach': return optionenHtml(f, opt);
    case 'zahl': return `<div style="display:flex;align-items:center;gap:8px;"><input type="number" class="form-input" id="${name}" inputmode="decimal" min="${f.min}" max="${f.max}" step="${f.schritt || 1}" style="max-width:140px;" />${f.einheit ? `<span>${esc(f.einheit)}</span>` : ''}</div>`;
    case 'jahr': return `<input type="number" class="form-input" id="${name}" inputmode="numeric" min="1900" max="${new Date().getFullYear()}" step="1" placeholder="JJJJ" style="max-width:140px;" />`;
    case 'datum': return `<input type="date" class="form-input" id="${name}" max="${alsISODatum(new Date())}" style="max-width:200px;" />`;
    case 'langtext': return `<textarea class="form-textarea" id="${name}" rows="2"></textarea>`;
    case 'arzt': return `<div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><input type="text" class="form-input" id="${name}_name" placeholder="Name der Praxis / Arzt" autocomplete="off" /><input type="text" class="form-input" id="${name}_tel" placeholder="Telefonnummer" /></div>`;
    default: return `<input type="text" class="form-input" id="${name}"${f.platzhalter ? ` placeholder="${esc(f.platzhalter)}"` : ''} />`;
  }
}

/** HTML des Formulars. Alle Felder sind im Markup, bedingte per `hidden` (siehe `aktualisiereSichtbarkeit`). */
export function formHtml(def, { kiosk = false } = {}) {
  const sicht = def.felder.filter((f) => !(kiosk && f.nurPraxis));
  const gruppen = def.gruppen.map((g) => {
    const fs = sicht.filter((f) => f.gruppe === g.id);
    if (!fs.length) return '';
    const felder = fs.map((f) => {
      const hinweis = [f.hinweis, kiosk ? kioskHinweis(f) : ''].filter(Boolean).map((h) => `<div class="anf-hinweis">${esc(h)}</div>`).join('');
      return `<div class="anf-feld${f.unter ? ' anf-unter' : ''}" data-anf-feld="${esc(f.id)}">
        <label class="form-label">${esc(f.label)}<span class="anf-stern" hidden> *</span></label>
        ${eingabeHtml(f, { kiosk })}
        ${hinweis}
        <div class="anf-vorschlag" data-anf-vorschlag="${esc(f.id)}" hidden></div>
        <div class="anf-fehler" role="alert" hidden></div>
      </div>`;
    }).join('');
    return `<div class="card anam-gruppe" data-gruppe="${esc(g.id)}" style="margin-bottom:16px;"><h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">${esc(g.titel)}</h3>${felder}</div>`;
  }).join('');
  const entwurf = def.entwurf ? `<div class="anam-entwurf" role="note">${esc(ENTWURF_HINWEIS)}</div>` : '';
  return `${entwurf}<div class="anam-dyn" data-fachbereich="${esc(def.fachbereich)}">${gruppen}</div>`;
}

/** Rohantworten aus dem Formular lesen (Strings / String[]); Gegenstück: `schreibeForm`. */
export function liesForm(root, def) {
  const roh = {};
  for (const f of def.felder) {
    const name = `anf_${f.id}`;
    if (f.typ === 'wahl') { roh[f.id] = root.querySelector(`input[name="${name}"]:checked`)?.value ?? null; }
    else if (f.typ === 'mehrfach') {
      roh[f.id] = Array.from(root.querySelectorAll(`input[name="${name}"]:checked`)).map((c) => c.value);
      if (f.text) roh[`${f.id}_text`] = root.querySelector(`#${name}_text`)?.value ?? '';
    } else if (f.typ === 'arzt') {
      roh[f.id] = { name: root.querySelector(`#${name}_name`)?.value ?? '', telefon: root.querySelector(`#${name}_tel`)?.value ?? '' };
    } else roh[f.id] = root.querySelector(`#${name}`)?.value ?? '';
  }
  return roh;
}

/** Roh-Antworten (oder aus einer Zeile abgeleitete) in das Formular schreiben. */
export function schreibeForm(root, def, roh = {}) {
  for (const f of def.felder) {
    const name = `anf_${f.id}`;
    const w = roh[f.id];
    if (f.typ === 'wahl') root.querySelectorAll(`input[name="${name}"]`).forEach((r) => { r.checked = r.value === w; });
    else if (f.typ === 'mehrfach') {
      const arr = Array.isArray(w) ? w : [];
      root.querySelectorAll(`input[name="${name}"]`).forEach((c) => { c.checked = arr.includes(c.value); });
      const t = root.querySelector(`#${name}_text`); if (t) t.value = roh[`${f.id}_text`] || '';
    } else if (f.typ === 'arzt') {
      const n = root.querySelector(`#${name}_name`); const t = root.querySelector(`#${name}_tel`);
      if (n) n.value = w?.name || ''; if (t) t.value = w?.telefon || '';
    } else { const el = root.querySelector(`#${name}`); if (el) el.value = w == null ? '' : String(w); }
  }
}

/** Aus einer gespeicherten Zeile die Rohantworten fürs Formular. */
export function rohAusRow(def, row = {}) {
  const felder = row.felder || {};
  const roh = {};
  for (const f of def.felder) {
    if (f.typ === 'arzt') { roh[f.id] = { name: row[f.spalten[0]] || '', telefon: row[f.spalten[1]] || '' }; continue; }
    roh[f.id] = felder[f.id] ?? (f.typ === 'mehrfach' ? [] : null);
    if (f.text) roh[`${f.id}_text`] = felder[`${f.id}_text`] || '';
  }
  return roh;
}

function aktualisiereSichtbarkeit(root, def, kiosk) {
  const roh = liesForm(root, def);
  for (const f of def.felder) {
    const el = root.querySelector(`[data-anf-feld="${f.id}"]`);
    if (!el) continue;
    el.hidden = !istSichtbar(f, roh, { kiosk });
    const stern = el.querySelector('.anf-stern');
    if (stern) stern.hidden = !(istPflicht(f, roh) && !el.hidden);
  }
}

function verdrahteForm(root, def, kiosk) {
  root.addEventListener('change', (e) => {
    const cb = e.target;
    if (cb?.matches?.('input[type="checkbox"][data-exklusiv]')) {
      const gruppe = root.querySelectorAll(`input[name="${cb.name}"]`);
      if (cb.checked && cb.value === cb.dataset.exklusiv) gruppe.forEach((o) => { if (o !== cb) o.checked = false; });
      else if (cb.checked) gruppe.forEach((o) => { if (o.value === cb.dataset.exklusiv) o.checked = false; });
    }
    aktualisiereSichtbarkeit(root, def, kiosk);
    const fe = cb?.closest?.('.anf-feld'); const fx = fe?.querySelector('.anf-fehler'); if (fx) fx.hidden = true;
  });
  root.addEventListener('input', () => aktualisiereSichtbarkeit(root, def, kiosk));
  root.addEventListener('click', (e) => {
    const b = e.target?.closest?.('[data-anf-uebernehmen]');
    if (!b) return;
    const id = b.dataset.anfUebernehmen; const v = vorschlaege[id];
    if (v?.wert !== undefined) { schreibeForm(root, def, { ...liesForm(root, def), [id]: v.wert }); aktualisiereSichtbarkeit(root, def, kiosk); }
    b.closest('.anf-vorschlag').hidden = true;
  });
  // Hausarzt: gemeinsamer Arzt-Picker; ohne „+": die Anamnese hält fest, was der Patient erzählt.
  const arzt = def.felder.find((f) => f.typ === 'arzt');
  if (arzt && d.wireArztFeld) d.wireArztFeld({ name: `anf_${arzt.id}_name`, tel: `anf_${arzt.id}_tel`, plus: false });
}

function zeigeVorschlaege(root) {
  const kiosk = istKiosk();
  root.querySelectorAll('[data-anf-vorschlag]').forEach((box) => {
    const v = !kiosk ? vorschlaege[box.dataset.anfVorschlag] : null;
    if (!v) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = `<span>Vorschlag aus dem Fußbefund: ${esc(v.text)}</span>${v.wert !== undefined
      ? ` <button type="button" class="btn-ghost btn-sm" data-anf-uebernehmen="${esc(box.dataset.anfVorschlag)}">Übernehmen</button>` : ''}`;
    box.hidden = false;
  });
}

/** Zeichnet das zum Fachbereich passende Formular (oder zeigt das feste Physio-Markup). */
function zeichneFormular(erhalteWerte = false) {
  const phys = $('anamPhysioForm'); const dyn = $('anamDynForm');
  const fb = fachbereich(); const def = formular(fb); const kiosk = istKiosk();
  if (!phys || !dyn) return;
  if (fb === 'physio') { phys.hidden = false; dyn.hidden = true; dyn.innerHTML = ''; return; }
  const alt = erhalteWerte && dyn.dataset.fb === fb && dyn.firstChild ? liesForm(dyn, def) : null;
  phys.hidden = true; dyn.hidden = false;
  const neu = dyn.cloneNode(false);            // frisches Element: alte Listener verfallen mit ihm
  neu.hidden = false; neu.dataset.fb = fb; neu.innerHTML = formHtml(def, { kiosk });
  dyn.replaceWith(neu);
  verdrahteForm(neu, def, kiosk);
  if (alt) schreibeForm(neu, def, alt);
  aktualisiereSichtbarkeit(neu, def, kiosk);
  zeigeVorschlaege(neu);
}

// ─────────────────────────────────────────────────────────────────────────────
// Kopfzeile: Version, geprüft, Aktionen
// ─────────────────────────────────────────────────────────────────────────────

function pruefStatusHtml(row) {
  return row.geprueft_am ? `geprüft am ${esc(datumDe(row.geprueft_am))}` : '<strong>ungeprüft</strong>';
}

function aktualisiereKopf() {
  const box = $('anamKopfBox'); if (!box) return;
  if (istKiosk() || !aktuellerPatient) { box.hidden = true; box.innerHTML = ''; return; }
  const fb = fachbereich(); const label = FACHBEREICH_LABEL[fb];
  const row = aktuelleRow;
  let html;
  if (!row) {
    html = `<div class="anam-kopf">Noch keine Anamnese ${esc(label)} für diesen Patienten.</div>`;
  } else {
    html = `<div class="anam-kopf">
      <span>Anamnese ${esc(label)} · Version ${esc(row.version ?? 1)} vom ${esc(datumDe(row.created_at, '—'))} · ${row.quelle === 'kiosk' ? 'vom Patienten (Kiosk)' : 'Praxis'} · ${pruefStatusHtml(row)}</span>
      <span class="anam-kopf-aktionen">
        ${row.geprueft_am ? '' : '<button type="button" class="btn-ghost btn-sm" data-anam-aktion="pruefen">Als geprüft markieren</button>'}
        <button type="button" class="btn-ghost btn-sm" data-anam-aktion="bestaetigen" title="Legt eine neue Version mit unverändertem Inhalt an — für Folgeverordnungen">Anamnese unverändert bestätigen</button>
      </span></div>`;
  }
  box.innerHTML = html; box.hidden = false;
  box.querySelector('[data-anam-aktion="pruefen"]')?.addEventListener('click', () => pruefeKlick({ dataset: { anamnesePruefen: row.id } }));
  box.querySelector('[data-anam-aktion="bestaetigen"]')?.addEventListener('click', () => bestaetigeUnveraendert(row, () => fuelleFormular(aktuellerPatient)));
}

async function pruefeKlick(b) {
  const id = b.dataset.anamnesePruefen; if (!id) return;
  const r = await markiereGeprueft(d.supabase, id, d.getUserId?.());
  if (r.error) { d.showToast('Fehler: ' + r.error, 'error'); return; }
  d.showToast('Anamnese als geprüft markiert.');
  b.remove?.();
  if (aktuelleRow?.id === id) { aktuelleRow = { ...aktuelleRow, geprueft_am: new Date().toISOString() }; aktualisiereKopf(); }
  if (akteLead && $('patientDetailModal') && !$('patientDetailModal').hidden) ladePatientenAnamnese(akteLead);
}

async function bestaetigeUnveraendert(row, danach) {
  const r = await bestaetige(d.supabase, row, { userId: d.getUserId?.(), heute: alsISODatum(new Date()) });
  if (r.error) { d.showToast('Fehler: ' + r.error, 'error'); return; }
  d.showToast('Anamnese unverändert bestätigt — neue Version angelegt.');
  await danach?.();
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel: Patientenliste, Formular füllen, speichern, drucken
// ─────────────────────────────────────────────────────────────────────────────

export async function loadAnamnese() {
  const { data } = await d.supabase.from('leads')
    .select('id,first_name,last_name,title,phone,email,metadata,geschlecht')
    .eq('owner_id', d.getOwnerId())
    .order('first_name', { ascending: true });
  const sel = $('anamPatientSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Patient auswählen --</option>' +
    (data || []).map((l) => `<option value="${esc(l.id)}">${esc(d.displayNameWithBirth(l))}</option>`).join('');
  zeichneFormular();
  if (vorwahl) {
    sel.value = vorwahl;
    const id = vorwahl; vorwahl = null;
    await fuelleFormular(id);
  } else {
    resetForm();
  }
}

// ── Physio: bisheriges Markup ───────────────────────────────────────────────

const PHYSIO_CHECKS = [
  ['anamChkBeschwerden', 'anamBeschwerdenOther', 'anamHauptbeschwerde', 'hauptbeschwerde'],
  ['anamChkVorerkrankungen', 'anamVorerkrankungenOther', 'anamVorerkrankungen', 'vorerkrankungen'],
  ['anamChkOperationen', 'anamOperationenOther', 'anamOperationen', 'operationen'],
  ['anamChkMedikamente', 'anamMedikamenteOther', 'anamMedikamente', 'medikamente'],
  ['anamChkAllergien', 'anamAllergienOther', 'anamAllergien', 'allergien'],
  ['anamChkBeruf', 'anamBerufOther', 'anamBeruf', 'beruf'],
  ['anamChkSport', 'anamSportOther', 'anamSport', 'sport'],
  ['anamChkDiagnose', 'anamDiagnoseOther', 'anamDiagnose', 'diagnose'],
];

function getAnamChecks(containerId) {
  const wrap = $(containerId);
  return wrap ? Array.from(wrap.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => cb.value) : [];
}

function setAnamChecks(containerId, dbString, otherInputId) {
  const wrap = $(containerId); if (!wrap) return;
  wrap.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
  if (!dbString) { if (otherInputId && $(otherInputId)) $(otherInputId).value = ''; return; }
  const items = dbString.split(',').map((s) => s.trim()).filter(Boolean);
  const unmatched = [];
  items.forEach((item) => {
    const cb = Array.from(wrap.querySelectorAll('input[type="checkbox"]')).find((c) => c.value === item);
    if (cb) cb.checked = true; else unmatched.push(item);
  });
  if (otherInputId && $(otherInputId)) $(otherInputId).value = unmatched.join(', ');
}

function syncAnamTextarea(containerId, otherInputId, textareaId) {
  const vals = getAnamChecks(containerId);
  const other = $(otherInputId)?.value.trim();
  if (other) vals.push(other);
  const ta = $(textareaId); if (ta) ta.value = vals.join(', ');
}

function leerePhysio() {
  $('anamBeschwerdeSeit').value = '';
  $('anamSchmerzSkala').value = '0'; $('anamSkalaVal').textContent = '0';
  $('anamRaucher').checked = false;
  $('anamArztName').value = ''; $('anamArztNummer').value = '';
  $('anamRezeptSitzungen').value = '';
  $('anamHausbesuch').checked = false;
  $('anamWuensche').value = ''; $('anamNotizen').value = '';
  PHYSIO_CHECKS.forEach(([cId, oId, tId]) => {
    $(cId)?.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
    if ($(oId)) $(oId).value = ''; if ($(tId)) $(tId).value = '';
  });
  document.querySelectorAll('input[name="anamVerlauf"], input[name="anamSchmerzArt"]').forEach((r) => { r.checked = false; });
  $('anamSchmerzArtOther').value = '';
}

function resetForm() {
  aktuelleRow = null; aktuellerPatient = null; vorschlaege = {};
  $('anamAufnahme').value = alsISODatum(new Date());
  if (fachbereich() === 'physio') leerePhysio(); else zeichneFormular();
  $('anamSaveBtn').textContent = 'Speichern';
  $('anamPrintBtn').hidden = true;
  aktualisiereKopf();
}

function fuellePhysio(data) {
  $('anamBeschwerdeSeit').value = data.beschwerde_seit || '';
  const s = data.schmerz_skala != null ? String(data.schmerz_skala) : '0';
  $('anamSchmerzSkala').value = s; $('anamSkalaVal').textContent = s;
  $('anamRaucher').checked = data.raucher === true;
  $('anamArztName').value = data.arzt_name || ''; $('anamArztNummer').value = data.arzt_nummer || '';
  $('anamRezeptSitzungen').value = data.rezept_sitzungen != null ? String(data.rezept_sitzungen) : '';
  $('anamHausbesuch').checked = data.hausbesuch === true;
  $('anamWuensche').value = data.besondere_wuensche || ''; $('anamNotizen').value = data.notizen || '';
  PHYSIO_CHECKS.forEach(([cId, oId, tId, col]) => { setAnamChecks(cId, data[col], oId); syncAnamTextarea(cId, oId, tId); });
  document.querySelectorAll('input[name="anamVerlauf"]').forEach((r) => { r.checked = r.value === (data.beschwerde_verlauf || ''); });
  document.querySelectorAll('input[name="anamSchmerzArt"]').forEach((r) => { r.checked = r.value === (data.schmerz_art || ''); });
  const andere = document.querySelector('input[name="anamSchmerzArt"][value="andere"]');
  if (andere && !andere.checked) {
    const bekannt = ['stechend', 'dumpf', 'brennend', 'ziehend', 'krampfartig', 'pulsierend'];
    if (data.schmerz_art && !bekannt.includes(data.schmerz_art)) { $('anamSchmerzArtOther').value = data.schmerz_art; andere.checked = true; }
  }
}

function physioSpalten() {
  const getRadio = (n) => document.querySelector(`input[name="${n}"]:checked`)?.value ?? null;
  let schmerzArt = getRadio('anamSchmerzArt');
  if (schmerzArt === 'andere') schmerzArt = $('anamSchmerzArtOther').value.trim() || null;
  const t = (id) => $(id).value.trim() || null;
  const n = (id) => ($(id).value !== '' ? parseInt($(id).value, 10) : null);
  return {
    hauptbeschwerde: t('anamHauptbeschwerde'), beschwerde_seit: t('anamBeschwerdeSeit'), beschwerde_verlauf: getRadio('anamVerlauf'),
    schmerz_skala: n('anamSchmerzSkala'), schmerz_art: schmerzArt, vorerkrankungen: t('anamVorerkrankungen'),
    operationen: t('anamOperationen'), medikamente: t('anamMedikamente'), allergien: t('anamAllergien'), beruf: t('anamBeruf'),
    sport: t('anamSport'), raucher: $('anamRaucher').checked, diagnose: t('anamDiagnose'), arzt_name: t('anamArztName'),
    arzt_nummer: t('anamArztNummer'), rezept_sitzungen: n('anamRezeptSitzungen'), hausbesuch: $('anamHausbesuch').checked,
    besondere_wuensche: t('anamWuensche'), notizen: t('anamNotizen'),
  };
}

// ── Kontext der aktiven Verordnung (unverändert aus dashboard.js) ───────────

async function ladeRxKontext(patientId) {
  const box = $('anamRxContext'); if (!box) return;
  if (!patientId || !d.isPraxisSector(d.getSector())) { box.style.display = 'none'; return; }
  const { data: rx } = await d.supabase.from('prescriptions')
    .select('id, rezept_typ, status, heilmittel, icd10, diagnosegruppe, anzahl_einheiten, frequenz, ausstellungsdatum, gueltig_bis, hausbesuch, is_dringend, prescription_sessions(status)')
    .eq('patient_id', patientId).in('status', ['parsed', 'confirmed', 'in_therapy'])
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!rx) { box.style.display = 'none'; return; }

  const typLabel = { standard: 'Standard', blanko: 'Blanko', lhb_bvb: 'LHB/BVB' }[rx.rezept_typ] || rx.rezept_typ;
  const statusLabel = { parsed: 'Erfasst', confirmed: 'Bestätigt', in_therapy: 'In Therapie' }[rx.status] || rx.status;
  let farbe = '#15803d', notiz = '';
  if (rx.gueltig_bis) {
    const heute0 = new Date(); heute0.setHours(0, 0, 0, 0);
    const tage = Math.round((new Date(rx.gueltig_bis) - heute0) / 86400000);
    if (tage < 0) { farbe = '#ef4444'; notiz = ' · überfällig'; }
    else if (tage <= 3) { farbe = '#ef4444'; notiz = ` · in ${tage}T`; }
    else if (tage <= 10) { farbe = '#f59e0b'; notiz = ` · in ${tage}T`; }
  }
  const gueltig = rx.gueltig_bis
    ? `<span style="color:${farbe};font-weight:600;">Gültig bis ${esc(datumDe(rx.gueltig_bis))}${notiz}</span>` : 'Gültig bis —';
  const flags = [rx.is_dringend ? '<span class="badge badge-red">Dringend</span>' : '', rx.hausbesuch ? '<span class="badge badge-blue">Hausbesuch</span>' : ''].filter(Boolean).join(' ');
  $('anamRxBadges').innerHTML = `<span class="badge badge-blue">${esc(typLabel)}</span> <span class="badge badge-gray">${esc(statusLabel)}</span> ${flags}`;
  $('anamRxHeading').textContent = `${rx.heilmittel || '—'}${rx.icd10 ? ' · ' + rx.icd10 : ''}${rx.diagnosegruppe ? ' · ' + rx.diagnosegruppe : ''}`;
  $('anamRxMeta').innerHTML = `${gueltig} · Frequenz: ${esc(rx.frequenz || '—')}`;
  const total = rx.anzahl_einheiten || (rx.prescription_sessions || []).length || 0;
  const done = (rx.prescription_sessions || []).filter((s) => s.status === 'done').length;
  $('anamRxProgressBar').style.width = (total ? Math.round((done / total) * 100) : 0) + '%';
  $('anamRxProgressLabel').textContent = `${done}/${total}`;
  box.style.display = '';
}

/** Hausarzt-Vorbelegung: der verordnende Arzt der jüngsten Verordnung (PRODUKT-ENTSCHEIDUNGEN F). */
async function verordnenderArzt(patientId) {
  try {
    const { data } = await d.supabase.from('prescriptions').select('arzt_id')
      .eq('patient_id', patientId).not('arzt_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const a = data?.arzt_id ? (d.getAerzte?.() || []).find((x) => x.id === data.arzt_id) : null;
    return a ? { name: a.arzt_name || '', telefon: a.telefon || a.fax || a.lanr || '' } : null;
  } catch { return null; }
}

async function fuelleFormular(patientId) {
  const nr = ++ladeNr;
  ladeRxKontext(patientId).catch(() => { });
  if (!(d.getAerzte?.() || []).length) await d.loadAerzte?.();
  if (!patientId) { resetForm(); return; }
  aktuellerPatient = patientId; vorschlaege = {};
  const fb = fachbereich();
  const { row, fehler } = await ladeAktuelle(d.supabase, patientId, fb, d.getOwnerId());
  if (nr !== ladeNr) return;
  if (fehler) d.showToast('Anamnese konnte nicht geladen werden.', 'error');
  aktuelleRow = row;
  $('anamAufnahme').value = row?.aufnahmedatum || alsISODatum(new Date());
  $('anamSaveBtn').textContent = row ? 'Als neue Version speichern' : 'Speichern';
  $('anamPrintBtn').hidden = !row;

  if (fb === 'physio') {
    if (row) fuellePhysio(row); else leerePhysio();
    aktualisiereKopf();
    return;
  }
  zeichneFormular();
  const wurzel = $('anamDynForm'); const def = formular(fb);
  if (row) {
    schreibeForm(wurzel, def, rohAusRow(def, row));
  } else if (fb === 'podo') {
    // Übergang: noch keine Podo-Anamnese → alte Fußbefund-Risiken nur VORSCHLAGEN (nie still übernehmen).
    const [alt, arzt] = await Promise.all([ladeAltrisiken(d.supabase, patientId), verordnenderArzt(patientId)]);
    if (nr !== ladeNr) return;
    if (alt) vorschlaege = vorschlaegeAusRisiken(alt.risiken);
    if (arzt) schreibeForm(wurzel, def, { ...liesForm(wurzel, def), hausarzt: arzt });
  }
  aktualisiereSichtbarkeit(wurzel, def, istKiosk());
  zeigeVorschlaege(wurzel);
  aktualisiereKopf();
}

async function speichere() {
  const patientId = $('anamPatientSelect').value;
  if (!patientId) { d.showToast('Bitte wählen Sie einen Patienten aus.', 'error'); return; }
  const fb = fachbereich(); const def = formular(fb); const kiosk = istKiosk();
  let felder = {}; let spalten;
  if (fb === 'physio') {
    spalten = physioSpalten();
  } else {
    const wurzel = $('anamDynForm');
    const roh = liesForm(wurzel, def);
    const fehler = validiere(def, antwortAusForm(def, roh, { kiosk }).felder, { kiosk });
    wurzel.querySelectorAll('.anf-fehler').forEach((x) => { x.hidden = true; });
    if (fehler.length) {
      fehler.forEach((f) => {
        const box = wurzel.querySelector(`[data-anf-feld="${f.id}"] .anf-fehler`);
        if (box) { box.textContent = f.meldung; box.hidden = false; }
      });
      wurzel.querySelector(`[data-anf-feld="${fehler[0].id}"]`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      d.showToast('Bitte die markierten Pflichtfelder beantworten.', 'error');
      return;
    }
    ({ felder, spalten } = antwortAusForm(def, roh, { kiosk }));
  }
  const payload = baueInsert({
    def, ownerId: d.getOwnerId(), patientId, aufnahmedatum: $('anamAufnahme').value || null,
    felder, spalten, quelle: kiosk ? 'kiosk' : 'praxis', userId: d.getUserId?.(),
  });
  const btn = $('anamSaveBtn'); btn.disabled = true;
  const r = await speichereNeu(d.supabase, payload);
  btn.disabled = false;
  if (r.error) { d.showToast('Fehler: ' + r.error, 'error'); return; }
  d.showToast(kiosk ? 'Vielen Dank — die Angaben wurden gespeichert.' : 'Anamnese gespeichert.');
  const { row } = await ladeAktuelle(d.supabase, patientId, fb, d.getOwnerId());
  aktuelleRow = row; vorschlaege = {};
  $('anamSaveBtn').textContent = 'Als neue Version speichern'; $('anamPrintBtn').hidden = !row;
  if (fb !== 'physio') zeigeVorschlaege($('anamDynForm'));
  aktualisiereKopf();
  d.nachSpeichern?.();   // Hausbesuch-Ablauf: Fahrt beenden (dashboard.js)
}

async function druckeInline() {
  const patientId = aktuellerPatient;
  if (!patientId) { d.showToast('Bitte wählen Sie einen Patienten aus.', 'error'); return; }
  const fb = fachbereich();
  const { row: a } = await ladeAktuelle(d.supabase, patientId, fb, d.getOwnerId());
  if (!a) { d.showToast('Keine Anamnese für diesen Patienten gefunden.', 'error'); return; }
  const def = formular(fb);
  const name = document.querySelector('#anamPatientSelect option:checked')?.textContent || 'Unbekannt';
  const p = d.getProfile?.() || {};
  $('anamPrintBizName').textContent = p.business_name || '—';
  const bm = []; if (p.city) bm.push(p.city); if (p.phone) bm.push('Tel: ' + p.phone);
  $('anamPrintBizMeta').textContent = bm.join(' · ');
  $('anamPrintDate').textContent = datumDe(a.aufnahmedatum || a.created_at, '—');
  $('anamPrintPatient').innerHTML = `<strong>${esc(name)}</strong> · ${esc(FACHBEREICH_LABEL[fb])} · Version ${esc(a.version ?? 1)}`;
  const zeilen = [{ label: 'Aufnahmedatum', text: datumDe(a.aufnahmedatum, '—') }, ...anzeigeZeilen(def, a)];
  $('anamPrintFields').innerHTML = zeilen.map((z) =>
    `<div class="anamnese-print-row"><div class="anamnese-print-label">${esc(z.label)}</div><div class="anamnese-print-value">${esc(z.text)}</div></div>`).join('');
  $('anamPrintNotesWrap').hidden = true;   // Notizen stehen als Zeile in den Feldern
  d.printArea();
}

export function bindAnamneseEvents() {
  const sel = $('anamPatientSelect'); if (sel) sel.onchange = (e) => fuelleFormular(e.target.value);
  const save = $('anamSaveBtn'); if (save) save.onclick = speichere;
  const print = $('anamPrintBtn'); if (print) print.onclick = druckeInline;

  // anamArztNummer trägt „Telefon / Fax": bevorzugt Telefon aus dem Register, LANR nur als Rückfall.
  // Ohne „+": ein hier angelegter Arzt hätte weder LANR noch BSNR (Halbdatensätze im Register).
  d.wireArztFeld?.({ name: 'anamArztName', tel: 'anamArztNummer', plus: false });

  const slider = $('anamSchmerzSkala'); const skala = $('anamSkalaVal');
  if (slider && skala) slider.oninput = () => { skala.textContent = slider.value; };
  PHYSIO_CHECKS.forEach(([cId, oId, tId]) => {
    $(cId)?.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.onchange = () => syncAnamTextarea(cId, oId, tId); });
    const other = $(oId); if (other) other.oninput = () => syncAnamTextarea(cId, oId, tId);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Patientenakte: Reiter „Anamnese" + Rozet-Kopf
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Füllt den Akten-Reiter und — nur Podologie — die Rozets im Aktenkopf.
 * Ersetzt `loadPatientDetailAnamnese` aus dashboard.js.
 */
export async function ladePatientenAnamnese(leadId) {
  akteLead = leadId;
  const content = $('pdAnamContent'); const loading = $('pdAnamLoading'); const host = $('pdRozetHost');
  if (host) host.innerHTML = '';
  if (!content) return;
  const fb = fachbereich(); const def = formular(fb);
  // Wagner-Rozet (Konsey S0 2a): unabhängig davon, ob schon eine Anamnese existiert; eigener Platz im Host.
  if (fb === 'podo' && host) {
    ladeWagnerRozet(d.supabase, d.getOwnerId(), leadId, esc).then((html) => {
      if (akteLead !== leadId || !html) return;
      let w = host.querySelector('[data-wagner-host]');
      if (!w) { w = document.createElement('span'); w.dataset.wagnerHost = '1'; host.prepend(w); }
      w.innerHTML = html;
    });
  }
  const { rows, fehler } = await ladeAlleAktuellen(d.supabase, leadId);
  if (akteLead !== leadId) return;          // Modal wurde inzwischen für jemand anderen geöffnet
  if (loading) loading.hidden = true;
  if (fehler) { content.innerHTML = '<div class="pd-empty">Anamnese konnte nicht geladen werden.</div>'; return; }
  const row = rows.find((r) => (r.fachbereich || 'physio') === fb);
  if (!row) {
    const andere = rows.map((r) => FACHBEREICH_LABEL[r.fachbereich]).filter(Boolean);
    content.innerHTML = `<div class="pd-empty">Keine Anamnese ${esc(FACHBEREICH_LABEL[fb])} vorhanden.${andere.length ? ` Vorhanden ist eine Anamnese aus dem Fachbereich ${esc(andere.join(', '))}.` : ''}</div>`;
    return;
  }
  if (fb === 'podo' && host) host.insertAdjacentHTML('beforeend', rozetHtml(row, esc));

  let ersteller = '';
  if (row.created_by) {
    // profiles hat keine first_name/last_name (Namen: owner_first_name/owner_last_name) — bis 30.09.2026 400 bei jedem Öffnen (canli-test).
    const { data: c } = await d.supabase.from('profiles').select('owner_first_name,owner_last_name,business_name').eq('id', row.created_by).maybeSingle();
    if (c) ersteller = [c.owner_first_name, c.owner_last_name].filter(Boolean).join(' ') || c.business_name || '';
  }
  const versionen = await ladeVersionen(d.supabase, leadId, fb);
  if (akteLead !== leadId) return;

  let html = `<div class="anam-kopf" style="margin:12px 20px;">
    <span>Anamnese ${esc(FACHBEREICH_LABEL[fb])} · Version ${esc(row.version ?? 1)} vom ${esc(datumDe(row.created_at, '—'))} · ${row.quelle === 'kiosk' ? 'vom Patienten (Kiosk)' : 'Praxis'} · ${pruefStatusHtml(row)}</span>
    <span class="anam-kopf-aktionen">
      <button class="btn-primary btn-sm" id="pdAnamViewBtn">Dokument anzeigen</button>
      ${row.geprueft_am ? '' : `<button class="btn-ghost btn-sm" data-anamnese-pruefen="${esc(row.id)}">Als geprüft markieren</button>`}
      <button class="btn-ghost btn-sm" id="pdAnamBestaetigenBtn" title="Neue Version mit unverändertem Inhalt — für Folgeverordnungen">Anamnese unverändert bestätigen</button>
    </span></div>`;
  if (def.entwurf) html += `<div class="anam-entwurf" style="margin:0 20px 8px;" role="note">${esc(ENTWURF_HINWEIS)}</div>`;
  anzeigeZeilen(def, row).forEach((z) => {
    html += `<div class="pd-section"><div class="pd-section-title">${esc(z.label)}</div><div class="pd-text">${esc(z.text)}</div></div>`;
  });
  html += `<div class="pd-section"><div class="pd-section-title">Erstellt</div><div class="pd-text">${esc(datumDe(row.created_at, '—'))}${ersteller ? ' · ' + esc(ersteller) : ''}</div></div>`;
  if (versionen.length > 1) {
    html += `<details class="pd-section"><summary class="pd-section-title" style="cursor:pointer;">Frühere Versionen (${versionen.length - 1})</summary>${versionen.map((v) =>
      `<div class="pd-text" style="font-size:12px;">Version ${esc(v.version)} · ${esc(datumDe(v.created_at, '—'))} · ${v.quelle === 'kiosk' ? 'Kiosk' : 'Praxis'}${v.geprueft_am ? '' : ' · ungeprüft'}${v.ist_aktuell ? ' · gültig' : ''}</div>`).join('')}</details>`;
  }
  content.innerHTML = html;

  $('pdAnamViewBtn')?.addEventListener('click', () => { d.closeModal('patientDetailModal'); oeffneAnamneseFuer(leadId); });
  $('pdAnamBestaetigenBtn')?.addEventListener('click', () => bestaetigeUnveraendert(row, () => ladePatientenAnamnese(leadId)));
}
