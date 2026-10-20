/**
 * patienten-import.js — Patientenstamm aus einer CSV-Datei übernehmen.
 *
 * Warum (20.10.2026): Beim Wechsel der Praxissoftware ist die Datenübernahme
 * die größte Hürde (Recherche podoloji: 64 % nennen sie zuerst). Bisher gab es
 * hier nur den „CSV importieren"-Knopf aus der Google-Maps-Zeit, der Leads mit
 * title/rating anlegte — ohne Vorname, Geburtsdatum, Dublettenprüfung. Dieser
 * Import ersetzt ihn auf demselben Knopf.
 *
 * Ablauf: Datei wählen → Vorschau (neu / schon vorhanden / fehlerhaft) →
 * importieren. Jede Übernahme bekommt eine Kennung in `metadata.import_batch`,
 * damit sie rückgängig gemacht werden kann, solange die Patienten nicht
 * benutzt wurden (Einwilligung, Verordnung …). Die Altsystem-Nummer landet in
 * `metadata.altsystem_nr`, NICHT in `patientennummer` — die vergibt ein Trigger
 * fortlaufend (db-ustasi, 20.10.2026).
 *
 * Bewusst nicht: Verordnungen (eigener Schreibweg über /api/rezept/confirm),
 * Speichern der Datei, Zeileninhalte in Logs (onprem O-207).
 */

import { normalisiereGeschlecht } from './geschlecht.js?v=20260816';
import { kartenIkNormalisieren } from './krankenkasse-suche.js?v=20261003e';
import { pruefeKvnr } from './kvnr.js?v=20260814';
import { trennePlzOrt } from './verordnung-an-backend.js?v=20261006b';
import { findePatientDublette, nameGeburtSchluessel } from './patient-dublette.js?v=20261020imp';

// ── CSV lesen ───────────────────────────────────────────────────────────

/** Trennzeichen aus der Kopfzeile raten (außerhalb von Anführungszeichen). */
function trennzeichen(text) {
  const zeile = text.split(/\r?\n/, 1)[0] || '';
  const zaehl = { ';': 0, ',': 0, '\t': 0 };
  let inQ = false;
  for (const c of zeile) {
    if (c === '"') inQ = !inQ;
    else if (!inQ && c in zaehl) zaehl[c]++;
  }
  return Object.entries(zaehl).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(zaehl).sort((a, b) => b[1] - a[1])[0][0]
    : ';';
}

/**
 * CSV nach RFC 4180 lesen: Anführungszeichen, "" als Escape, Zeilenumbrüche
 * im Feld, BOM, ; , oder Tab (Excel-DE speichert mit ;).
 * @returns {string[][]} Zeilen inkl. Kopfzeile, leere Zeilen entfernt
 */
export function leseCsv(text) {
  const t = String(text ?? '').replace(/^﻿/, '');
  const sep = trennzeichen(t);
  const zeilen = [];
  let zeile = [], feld = '', inQ = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) {
      if (c === '"' && t[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inQ = false;
      else feld += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) { zeile.push(feld); feld = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      zeile.push(feld); zeilen.push(zeile); zeile = []; feld = '';
    } else feld += c;
  }
  if (feld !== '' || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  return zeilen.filter(z => z.some(f => f.trim() !== ''));
}

// ── Spalten zuordnen ────────────────────────────────────────────────────

export const norm = (s) => String(s ?? '').trim().toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]/g, '');

/** Feld → mögliche Spaltenüberschriften (normalisiert). Reihenfolge = Vorrang. */
export const SPALTEN = {
  vorname: ['vorname', 'firstname', 'rufname'],
  nachname: ['nachname', 'name', 'familienname', 'lastname', 'zuname'],
  vollname: ['patient', 'patientenname', 'patname', 'patientname', 'vollername', 'namevorname', 'vornamename', 'nachnamevorname'],
  geburtsdatum: ['geburtsdatum', 'gebdatum', 'geboren', 'geburtstag', 'dob', 'birthdate', 'gebdat', 'geb', 'gebam'],
  geschlecht: ['geschlecht', 'anrede', 'sex', 'gender'],
  strasse: ['strasse', 'str', 'strassehausnummer', 'anschrift', 'adresse', 'street'],
  hausnummer: ['hausnummer', 'hausnr', 'hnr'],
  plz: ['plz', 'postleitzahl', 'zip'],
  ort: ['ort', 'wohnort', 'stadt', 'city', 'plzort', 'postleitzahlort'],
  telefon: ['telefon', 'tel', 'telefonnummer', 'festnetz', 'phone', 'telefonprivat', 'telefonpriv', 'telpriv', 'telprivat'],
  handy: ['handy', 'mobil', 'mobilnummer', 'mobiltelefon', 'mobile'],
  email: ['email', 'mail', 'emailadresse'],
  krankenkasse: ['krankenkasse', 'kasse', 'kostentraeger', 'versicherung'],
  krankenkasse_ik: ['ik', 'kassenik', 'iknummer', 'krankenkasseik', 'kostentraegerik'],
  versichertennummer: ['versichertennummer', 'versnr', 'kvnr', 'krankenversichertennummer', 'versichertennr'],
  versichertenstatus: ['versichertenstatus', 'status', 'versstatus'],
  versicherungsart: ['versicherungsart', 'gkvprivat', 'kassenart', 'abrechnungsart'],
  altsystem_nr: ['patientennummer', 'patnr', 'patientennr', 'nummer', 'nr', 'id', 'kundennummer'],
  notizen: ['notiz', 'notizen', 'bemerkung', 'bemerkungen', 'hinweis'],
};

/** Beschriftung der Zielfelder für die Zuordnung von Hand. Reihenfolge = Liste. */
export const FELDER = {
  nachname: 'Nachname', vorname: 'Vorname', vollname: 'Name komplett (Vor- + Nachname)',
  geburtsdatum: 'Geburtsdatum', geschlecht: 'Geschlecht / Anrede',
  strasse: 'Straße', hausnummer: 'Hausnummer', plz: 'PLZ', ort: 'Ort (auch „PLZ Ort")',
  telefon: 'Telefon', handy: 'Handy', email: 'E-Mail',
  krankenkasse: 'Krankenkasse (Name)', krankenkasse_ik: 'IK der Krankenkasse',
  versichertennummer: 'Versichertennummer', versichertenstatus: 'Versichertenstatus',
  versicherungsart: 'Versicherungsart (GKV/privat)', altsystem_nr: 'Patientennummer (alt)',
  notizen: 'Bemerkung',
};

/** Welche Pflichtangaben fehlen in einer Zuordnung? */
export function fehlendePflicht(zuordnung) {
  const fehlt = [];
  if (zuordnung.nachname == null && zuordnung.vollname == null) fehlt.push('Nachname');
  if (zuordnung.vorname == null && zuordnung.vollname == null && zuordnung.nachname == null) fehlt.push('Vorname');
  if (zuordnung.geburtsdatum == null) fehlt.push('Geburtsdatum');
  return fehlt;
}

/** @returns {Object<string, number>} Feld → Spaltenindex */
export function ordneSpaltenZu(kopf, spalten = SPALTEN) {
  const k = (kopf || []).map(norm);
  const out = {};
  const vergeben = new Set();
  for (const [feld, namen] of Object.entries(spalten)) {
    for (const n of namen) {
      const i = k.findIndex((h, idx) => h === n && !vergeben.has(idx));
      if (i >= 0) { out[feld] = i; vergeben.add(i); break; }
    }
  }
  return out;
}

// ── Werte umwandeln ─────────────────────────────────────────────────────

/** 31.12.1950 · 31.12.50 · 1950-12-31 · 31/12/1950 → '1950-12-31' oder null */
export function leseDatum(roh) {
  const s = String(roh ?? '').trim();
  let j, m, t;
  let r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (r) [, j, m, t] = r;
  else if ((r = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/))) {
    [, t, m, j] = r;
    if (j.length === 2) {
      // Zweistellig: Geburtsjahre in der Zukunft gibt es nicht.
      const jetzt = new Date().getFullYear() % 100;
      j = (Number(j) > jetzt ? '19' : '20') + j;
    }
  } else return null;
  const d = new Date(Date.UTC(+j, +m - 1, +t));
  if (d.getUTCFullYear() !== +j || d.getUTCMonth() !== +m - 1 || d.getUTCDate() !== +t) return null;
  if (d > new Date() || +j < 1900) return null;
  return `${j}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
}

/** „Müller, Anna" oder „Anna Müller" → { vor, nach } */
export function teileName(voll) {
  const s = String(voll ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return { vor: '', nach: '' };
  if (s.includes(',')) {
    const [nach, ...rest] = s.split(',');
    return { vor: rest.join(',').trim(), nach: nach.trim() };
  }
  const teile = s.split(' ');
  return teile.length < 2 ? { vor: '', nach: s } : { vor: teile.slice(0, -1).join(' '), nach: teile.at(-1) };
}

function versicherungsart(roh, hatKasse) {
  const s = norm(roh);
  if (/^(gkv|gesetzlich|kasse|kassenpatient|k)$/.test(s)) return 'gkv';
  if (/^(privat|pkv|p|privatpatient|selbstzahler|sz)$/.test(s)) return 'privat';
  return hatKasse ? 'gkv' : null;
}

/**
 * Eine CSV-Zeile → leads-Felder + Fehler/Hinweise.
 * Fehler = Zeile wird nicht importiert. Hinweise = wird importiert, prüfen.
 */
export function zeileZuPatient(werte, zuordnung) {
  const w = (f) => (zuordnung[f] != null ? String(werte[zuordnung[f]] ?? '').trim() : '');
  const fehler = [], hinweise = [];

  let vor = w('vorname'), nach = w('nachname');
  if ((!vor || !nach) && w('vollname')) ({ vor, nach } = teileName(w('vollname')));
  else if (!vor && nach && zuordnung.vorname == null) ({ vor, nach } = teileName(nach));
  if (!nach) fehler.push('Nachname fehlt');
  if (!vor) fehler.push('Vorname fehlt');

  const gebRoh = w('geburtsdatum');
  const geburtsdatum = leseDatum(gebRoh);
  if (!gebRoh) fehler.push('Geburtsdatum fehlt');
  else if (!geburtsdatum) fehler.push(`Geburtsdatum „${gebRoh}" nicht lesbar`);

  const gRoh = w('geschlecht');
  const geschlecht = normalisiereGeschlecht(gRoh);
  if (gRoh && !geschlecht && !/^(herr|frau)\b/i.test(gRoh)) hinweise.push(`Geschlecht „${gRoh}" unbekannt`);

  const ikRoh = w('krankenkasse_ik');
  const krankenkasse_ik = kartenIkNormalisieren(ikRoh);
  if (ikRoh && !krankenkasse_ik) hinweise.push('IK nicht 9-stellig — leer gelassen');

  let versichertennummer = null;
  if (w('versichertennummer')) {
    const k = pruefeKvnr(w('versichertennummer'));
    versichertennummer = k.normalisiert || null;
    if (!k.ok) hinweise.push('Versichertennummer auffällig');
  }

  const vs = w('versichertenstatus');
  const versichertenstatus = /^[1359]\d{4}$/.test(vs) ? vs : null;
  if (vs && !versichertenstatus && zuordnung.versichertenstatus != null) hinweise.push(`Versichertenstatus „${vs}" ungewöhnlich`);

  let plz = w('plz') || null, ort = w('ort') || null;
  if (!plz && ort) ({ plz, city: ort } = trennePlzOrt(ort));   // „53721 Siegburg" in einer Spalte
  const krankenkasse = w('krankenkasse') || null;

  const patient = {
    first_name: vor,
    last_name: nach,
    title: `${vor} ${nach}`.trim(),
    geburtsdatum,
    geschlecht,
    street: [w('strasse'), w('hausnummer')].filter(Boolean).join(' ') || null,
    plz: plz || null,
    city: ort || null,
    phone: w('telefon') || null,
    handy: w('handy') || null,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w('email')) ? w('email') : null,
    krankenkasse,
    krankenkasse_ik,
    versichertennummer,
    versichertenstatus,
    insurance_type: versicherungsart(w('versicherungsart'), !!(krankenkasse || krankenkasse_ik)),
    notes: w('notizen') || null,
  };
  if (w('email') && !patient.email) hinweise.push('E-Mail ungültig — leer gelassen');
  if (patient.plz && !/^\d{5}$/.test(patient.plz)) hinweise.push('PLZ nicht 5-stellig');
  return { patient, fehler, hinweise, altsystemNr: w('altsystem_nr') || null };
}

// ── Gesamtprüfung ───────────────────────────────────────────────────────

/**
 * @param {string} text CSV-Inhalt
 * @param {object[]} bestehende vorhandene leads des Owners
 * @param {Object<string, number>} [zuordnung] von Hand gewählt; sonst aus der Kopfzeile geraten
 * @returns {{ zuordnung, fehltSpalte: string[], zeilen: object[], neu: number, dubletten: number, fehlerhaft: number }}
 */
export function pruefeImport(text, bestehende = [], zuordnungVonHand = null) {
  const [kopf = [], ...daten] = leseCsv(text);
  const zuordnung = zuordnungVonHand || ordneSpaltenZu(kopf);
  const fehltSpalte = fehlendePflicht(zuordnung);

  const gesehen = new Map();
  const zeilen = daten.map((werte, i) => {
    const z = { nr: i + 2, ...zeileZuPatient(werte, zuordnung), dublette: null };
    if (!z.fehler.length) {
      const vorhanden = findePatientDublette(z.patient, bestehende);
      if (vorhanden) z.dublette = 'vorhanden';
      else {
        const s = nameGeburtSchluessel(z.patient);
        if (s && gesehen.has(s)) z.dublette = `doppelt in Datei (Zeile ${gesehen.get(s)})`;
        else if (s) gesehen.set(s, z.nr);
      }
    }
    return z;
  });
  return {
    zuordnung,
    fehltSpalte,
    zeilen,
    neu: zeilen.filter(z => !z.fehler.length && !z.dublette).length,
    dubletten: zeilen.filter(z => z.dublette).length,
    fehlerhaft: zeilen.filter(z => z.fehler.length).length,
  };
}

/** Datensatz für leads.insert */
export function insertDatensatz(z, ownerId, batchId) {
  const metadata = { import_batch: batchId, import_am: new Date().toISOString().slice(0, 10) };
  if (z.altsystemNr) metadata.altsystem_nr = z.altsystemNr;
  if (z.patient.krankenkasse) metadata.krankenkasse = z.patient.krankenkasse;
  if (z.patient.versichertennummer) metadata.krankenkassennummer = z.patient.versichertennummer;
  if (z.patient.versichertenstatus) metadata.versichertenstatus = z.patient.versichertenstatus;
  return { owner_id: ownerId, status: 'new', ...z.patient, metadata };
}

export const VORLAGE_CSV = '﻿Nachname;Vorname;Geburtsdatum;Geschlecht;Straße;PLZ;Ort;Telefon;Handy;E-Mail;Krankenkasse;IK;Versichertennummer;Versichertenstatus;Patientennummer;Bemerkung\n'
  + 'Muster;Erika;01.02.1950;w;Hauptstraße 1;53721;Siegburg;02241 12345;0170 1234567;;AOK Rheinland/Hamburg;104212505;A123456780;10000;4711;\n';

/** false = unbenutzt · Text = was es schon gibt · null = Prüfung gescheitert */
async function istSchonBenutzt(supabase, ids) {
  const pruefen = [['bookings', 'lead_id', 'Termine'], ['prescriptions', 'patient_id', 'Verordnungen'],
    ['pat_fussbefund', 'lead_id', 'Befunde'], ['patient_notes', 'lead_id', 'Notizen']];
  for (let i = 0; i < ids.length; i += 200) {
    const teil = ids.slice(i, i + 200);
    for (const [tabelle, spalte, name] of pruefen) {
      const { count, error } = await supabase.from(tabelle).select('id', { count: 'exact', head: true }).in(spalte, teil);
      if (error) return null;
      if (count) return name;
    }
  }
  return false;
}

// ── Oberfläche ──────────────────────────────────────────────────────────

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const BTN = 'padding:9px 16px;border-radius:6px;font-size:14px;cursor:pointer;';

/**
 * Zwischenschritt beider Importe (Patienten, Verordnungen): jede Spalte der
 * Datei einem Feld zuordnen. Vorbelegt aus der Überschrift; die letzte
 * Zuordnung zu gleichen Überschriften wird gemerkt (nur Spaltennamen, keine
 * Inhalte — localStorage dieses Browsers).
 *
 * @param {object} o
 * @param {HTMLElement} o.inhalt  Inhaltsbereich des Dialogs
 * @param {HTMLElement} o.fuss    Knopfleiste des Dialogs
 * @param {string[]} o.kopf       Kopfzeile der Datei
 * @param {string[][]} o.daten    Datenzeilen (für Beispielwerte)
 * @param {Object<string,string>} o.felder   Feld → Beschriftung
 * @param {Object<string,string[]>} o.spalten Feld → erkannte Überschriften
 * @param {(zu:object) => string[]} o.fehlendePflicht
 * @param {string[]} o.pflichtNamen  Anzeige oben, in dieser Reihenfolge
 * @param {string} o.merkPraefix
 * @param {string} [o.hinweis]
 * @param {Function} o.zurueck
 * @param {(zu:object, wiederZeigen:Function) => void} o.weiter
 */
export function zuordnungsSchritt(o) {
  const { inhalt, fuss, kopf, daten, felder, spalten, pflichtNamen } = o;
  const merkKey = o.merkPraefix + kopf.map(norm).join('|');
  const auto = ordneSpaltenZu(kopf, spalten);
  let zu = { ...auto };
  try { const alt = JSON.parse(localStorage.getItem(merkKey) || 'null'); if (alt) zu = alt; } catch { /* ohne Merken */ }
  // Spalte → Feld (Umkehrung), damit jede Zeile ein Auswahlfeld hat
  const spalteFeld = () => Object.fromEntries(Object.entries(zu).map(([f, i]) => [i, f]));
  const beispiele = (i) => daten.map(z => String(z[i] ?? '').trim()).filter(Boolean).slice(0, 3);

  const zeichne = () => {
    const sf = spalteFeld();
    const fehlt = o.fehlendePflicht(zu);
    const pflicht = pflichtNamen.map(p => {
      const ok = !fehlt.includes(p);
      return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;font-size:12px;border:1px solid ${ok ? 'var(--border)' : 'var(--danger,#b42318)'};color:${ok ? 'var(--text-main)' : 'var(--danger,#b42318)'};">${ok ? '✓' : '○'} ${esc(p)}</span>`;
    }).join('');
    const optionen = (aktiv) => `<option value="">— nicht übernehmen —</option>` + Object.entries(felder)
      .map(([f, l]) => `<option value="${f}" ${f === aktiv ? 'selected' : ''}>${esc(l)}</option>`).join('');
    const reihen = kopf.map((h, i) => {
      const f = sf[i] || '';
      const bsp = beispiele(i);
      const markierung = f && auto[f] === i ? ' <span style="font-size:11px;font-weight:500;color:var(--text-muted);">· erkannt</span>' : '';
      return `
        <div style="display:grid;grid-template-columns:minmax(0,1fr) 24px minmax(0,1fr);gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--border);${f ? '' : 'opacity:.72;'}">
          <div style="min-width:0;">
            <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(h || `Spalte ${i + 1}`)}${markierung}</div>
            <div style="font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${bsp.length ? bsp.map(esc).join(' · ') : 'leer'}</div>
          </div>
          <div aria-hidden="true" style="color:var(--text-muted);text-align:center;">→</div>
          <div style="display:flex;align-items:center;min-width:0;">
            <select data-spalte="${i}" aria-label="Feld für Spalte ${esc(h)}" style="width:100%;min-width:0;padding:7px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card-solid);color:var(--text-main);font-size:13px;">${optionen(f)}</select>
          </div>
        </div>`;
    }).join('');
    const anzahl = Object.keys(zu).length;
    inhalt.innerHTML = `
      <p style="margin:0 0 10px;font-size:14px;color:var(--text-muted);line-height:1.5;">
        Ordnen Sie jede Spalte Ihrer Datei einem Feld zu. ${anzahl} von ${kopf.length} Spalten sind schon zugeordnet — bitte kurz prüfen.
      </p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 6px;">${pflicht}</div>
      <div>${reihen}</div>
      <p style="font-size:12px;color:var(--text-muted);margin:10px 0 16px;">Nicht zugeordnete Spalten werden nicht übernommen. ${esc(o.hinweis || '')}</p>`;
    inhalt.querySelectorAll('select[data-spalte]').forEach(sel => sel.addEventListener('change', () => {
      const i = Number(sel.dataset.spalte);
      for (const [f, idx] of Object.entries(zu)) if (idx === i) delete zu[f];   // Spalte war vorher woanders
      if (sel.value) zu[sel.value] = i;                                       // Feld nur einmal vergeben
      zeichne();
    }));
    fuss.innerHTML = `
      <button type="button" class="btn-ghost" data-pi="zurueck" style="${BTN}">Andere Datei</button>
      <button type="button" class="btn-primary" data-pi="weiter" style="${BTN}${fehlt.length ? 'opacity:.45;cursor:not-allowed;' : ''}" ${fehlt.length ? `disabled title="Erst zuordnen: ${esc(fehlt.join(', '))}"` : ''}>Weiter zur Vorschau</button>`;
    fuss.querySelector('[data-pi="zurueck"]').addEventListener('click', o.zurueck);
    fuss.querySelector('[data-pi="weiter"]').addEventListener('click', () => {
      try { localStorage.setItem(merkKey, JSON.stringify(zu)); } catch { /* egal */ }
      o.weiter({ ...zu }, zeichne);
    });
  };
  zeichne();
}

/**
 * Öffnet den Import-Dialog.
 * @param {{ supabase, ownerId: string, bestehende: () => object[], showToast: Function, nachImport: (anzahl:number) => Promise<void>|void, zuVerordnungen?: Function }} d
 *   `zuVerordnungen`: öffnet den Verordnungs-Import (verordnung-import.js) — als
 *   Rückruf, damit die beiden Module sich nicht gegenseitig importieren.
 */
export function oeffnePatientenImport(d) {
  document.getElementById('patientenImportModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'patientenImportModal';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="piTitel" style="background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:12px;max-width:760px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px 12px;">
        <h3 id="piTitel" style="margin:0;font-size:18px;">Patienten importieren</h3>
        <button type="button" data-pi="zu" aria-label="Schließen" style="background:none;border:none;font-size:22px;color:var(--text-muted);cursor:pointer;">✕</button>
      </div>
      <div data-pi="inhalt" style="padding:0 24px;overflow:auto;flex:1;"></div>
      <div data-pi="fuss" style="display:flex;gap:8px;justify-content:flex-end;padding:16px 24px;border-top:1px solid var(--border);"></div>
    </div>`;
  document.body.appendChild(modal);

  const inhalt = modal.querySelector('[data-pi="inhalt"]');
  const fuss = modal.querySelector('[data-pi="fuss"]');
  const schliessen = () => { modal.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = (e) => { if (e.key === 'Escape') schliessen(); };
  document.addEventListener('keydown', esc_);
  modal.querySelector('[data-pi="zu"]').addEventListener('click', schliessen);
  modal.addEventListener('click', (e) => { if (e.target === modal) schliessen(); });

  const schritt1 = () => {
    inhalt.innerHTML = `
      <p style="margin:0 0 12px;color:var(--text-muted);font-size:14px;line-height:1.5;">
        Exportieren Sie den Patientenstamm aus Ihrer bisherigen Software als CSV (Excel: „Speichern unter → CSV").
        Nötig sind <b>Nachname, Vorname, Geburtsdatum</b>. Die Spalten ordnen Sie im nächsten Schritt zu —
        passende Überschriften (Straße, PLZ, Telefon, Krankenkasse, IK …) erkennt Praxura selbst.
        Patienten, die es schon gibt, werden übersprungen. Verordnungen werden nicht übernommen.
      </p>
      <label style="display:block;border:1px dashed var(--border);border-radius:8px;padding:28px;text-align:center;cursor:pointer;">
        <input type="file" accept=".csv,.txt,text/csv" data-pi="datei" style="display:none;" />
        <span style="font-weight:600;">CSV-Datei auswählen</span>
      </label>
      <p style="margin:12px 0 16px;font-size:13px;"><a href="#" data-pi="vorlage">Vorlage herunterladen</a>${d.zuVerordnungen
        ? ' · <a href="#" data-pi="vo">Offene Verordnungen importieren (Podologie) →</a>' : ''}</p>`;
    fuss.innerHTML = `<button type="button" class="btn-ghost" data-pi="abbr" style="${BTN}">Abbrechen</button>`;
    fuss.querySelector('[data-pi="abbr"]').addEventListener('click', schliessen);
    inhalt.querySelector('[data-pi="vo"]')?.addEventListener('click', (e) => { e.preventDefault(); schliessen(); d.zuVerordnungen(); });
    inhalt.querySelector('[data-pi="vorlage"]').addEventListener('click', (e) => {
      e.preventDefault();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([VORLAGE_CSV], { type: 'text/csv;charset=utf-8' }));
      a.download = 'praxura-patienten-vorlage.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    inhalt.querySelector('[data-pi="datei"]').addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      let text = await f.text();
      // Ältere Praxissoftware exportiert Windows-1252 — dann stehen Ersatzzeichen statt Umlauten.
      if (text.includes('�')) {
        try { text = new TextDecoder('windows-1252').decode(await f.arrayBuffer()); } catch { /* bleibt UTF-8 */ }
      }
      zuordnen(text);
    });
  };

  const zuordnen = (text) => {
    const [kopf = [], ...daten] = leseCsv(text);
    if (!kopf.length || !daten.length) { schritt2(pruefeImport(text, [])); return; }
    zuordnungsSchritt({
      inhalt, fuss, kopf, daten,
      felder: FELDER, spalten: SPALTEN, fehlendePflicht, pflichtNamen: ['Nachname', 'Vorname', 'Geburtsdatum'],
      merkPraefix: 'praxura.import.zuordnung.',
      hinweis: 'Ein „Name komplett" wird automatisch in Vor- und Nachname geteilt.',
      zurueck: schritt1,
      weiter: (zu, wiederZeigen) => schritt2(pruefeImport(text, d.bestehende() || [], zu), wiederZeigen),
    });
  };

  const schritt2 = (erg, zurZuordnung = null) => {
    if (erg.fehltSpalte.length || !erg.zeilen.length) {
      inhalt.innerHTML = `<p style="margin:0 0 16px;font-size:14px;">${erg.zeilen.length
        ? `Diese Spalten wurden nicht gefunden: <b>${esc(erg.fehltSpalte.join(', '))}</b>. Bitte die Überschriften anpassen (Vorlage) und erneut versuchen.`
        : 'Die Datei enthält keine Patientenzeilen.'}</p>`;
      fuss.innerHTML = `<button type="button" class="btn-ghost" data-pi="zurueck" style="${BTN}">Andere Datei</button>`;
      fuss.querySelector('[data-pi="zurueck"]').addEventListener('click', schritt1);
      return;
    }
    const status = (z) => z.fehler.length
      ? `<span style="color:var(--danger,#b42318);">${esc(z.fehler.join(' · '))}</span>`
      : z.dublette ? `<span style="color:var(--text-muted);">übersprungen — ${esc(z.dublette === 'vorhanden' ? 'schon vorhanden' : z.dublette)}</span>`
      : z.hinweise.length ? `<span style="color:var(--warning,#b54708);">neu · ${esc(z.hinweise.join(' · '))}</span>`
      : 'neu';
    const zeilen = erg.zeilen.slice(0, 200).map(z => `
      <tr style="border-top:1px solid var(--border);">
        <td style="padding:6px 8px;color:var(--text-muted);">${z.nr}</td>
        <td style="padding:6px 8px;white-space:nowrap;">${esc(z.patient.last_name)}, ${esc(z.patient.first_name)}</td>
        <td style="padding:6px 8px;white-space:nowrap;">${esc(z.patient.geburtsdatum ? z.patient.geburtsdatum.split('-').reverse().join('.') : '')}</td>
        <td style="padding:6px 8px;">${status(z)}</td>
      </tr>`).join('');
    inhalt.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin:0 0 12px;font-size:14px;">
        <span><b>${erg.neu}</b> neu</span>
        <span style="color:var(--text-muted);"><b>${erg.dubletten}</b> schon vorhanden / doppelt</span>
        <span style="color:${erg.fehlerhaft ? 'var(--danger,#b42318)' : 'var(--text-muted)'};"><b>${erg.fehlerhaft}</b> fehlerhaft</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="text-align:left;color:var(--text-muted);"><th style="padding:6px 8px;">Zeile</th><th style="padding:6px 8px;">Name</th><th style="padding:6px 8px;">Geboren</th><th style="padding:6px 8px;">Ergebnis</th></tr></thead>
        <tbody>${zeilen}</tbody>
      </table>
      ${erg.zeilen.length > 200 ? `<p style="font-size:13px;color:var(--text-muted);">… und ${erg.zeilen.length - 200} weitere Zeilen.</p>` : ''}
      <p style="font-size:13px;color:var(--text-muted);margin:12px 0 16px;">Fehlerhafte und vorhandene Zeilen werden nicht übernommen. Die Übernahme lässt sich danach rückgängig machen, solange die Patienten noch nicht verwendet wurden.</p>`;
    fuss.innerHTML = `
      ${zurZuordnung ? `<button type="button" class="btn-ghost" data-pi="zuordnung" style="${BTN}">Zuordnung ändern</button>` : `<button type="button" class="btn-ghost" data-pi="zurueck" style="${BTN}">Andere Datei</button>`}
      <button type="button" class="btn-primary" data-pi="los" style="${BTN}${erg.neu ? '' : 'opacity:.45;cursor:not-allowed;'}" ${erg.neu ? '' : 'disabled'}>${erg.neu} Patient${erg.neu === 1 ? '' : 'en'} importieren</button>`;
    fuss.querySelector('[data-pi="zurueck"]')?.addEventListener('click', schritt1);
    fuss.querySelector('[data-pi="zuordnung"]')?.addEventListener('click', zurZuordnung);
    fuss.querySelector('[data-pi="los"]').addEventListener('click', (e) => importiere(erg, e.currentTarget));
  };

  const importiere = async (erg, knopf) => {
    knopf.disabled = true;
    knopf.textContent = 'Wird importiert …';
    const batchId = crypto.randomUUID();
    const daten = erg.zeilen.filter(z => !z.fehler.length && !z.dublette).map(z => insertDatensatz(z, d.ownerId, batchId));
    let ok = 0;
    const ids = [];
    for (let i = 0; i < daten.length; i += 100) {
      const { data, error } = await d.supabase.from('leads').insert(daten.slice(i, i + 100)).select('id');
      if (error) {
        // Inhalt nicht loggen (Patientendaten) — nur, dass es scheiterte.
        d.showToast(`Import nach ${ok} Patienten abgebrochen. Bitte erneut versuchen — bereits übernommene werden dann übersprungen.`, 'error');
        break;
      }
      ids.push(...(data || []).map(r => r.id));
      ok += Math.min(100, daten.length - i);
    }
    if (ok) await d.nachImport(ok);
    schritt3(ok, batchId, ids);
  };

  const schritt3 = (ok, batchId, ids) => {
    inhalt.innerHTML = `<p style="margin:0 0 16px;font-size:15px;"><b>${ok}</b> Patient${ok === 1 ? '' : 'en'} übernommen.</p>`;
    fuss.innerHTML = `
      ${ok ? `<button type="button" class="btn-ghost" data-pi="rueck" style="${BTN}">Rückgängig machen</button>` : ''}
      <button type="button" class="btn-primary" data-pi="fertig" style="${BTN}">Fertig</button>`;
    fuss.querySelector('[data-pi="fertig"]').addEventListener('click', schliessen);
    fuss.querySelector('[data-pi="rueck"]')?.addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      // Löschen kaskadiert (Fußbefund, Notizen, Befreiung) bzw. trennt Termine und
      // Verordnungen. Wurde ein übernommener Patient schon benutzt: nicht anfassen.
      const benutzt = await istSchonBenutzt(d.supabase, ids);
      if (benutzt !== false) {
        d.showToast(benutzt ? `Rückgängig nicht möglich — für übernommene Patienten gibt es schon ${benutzt}.` : 'Rückgängig nicht möglich — Prüfung fehlgeschlagen.', 'error');
        return;
      }
      const { error } = await d.supabase.from('leads').delete()
        .eq('owner_id', d.ownerId).eq('metadata->>import_batch', batchId);
      if (error) {
        d.showToast('Rückgängig nicht möglich — einige Patienten werden schon verwendet (z. B. Einwilligung).', 'error');
        return;
      }
      await d.nachImport(0);
      inhalt.innerHTML = '<p style="margin:0 0 16px;font-size:15px;">Import rückgängig gemacht.</p>';
      fuss.innerHTML = `<button type="button" class="btn-primary" data-pi="fertig" style="${BTN}">Fertig</button>`;
      fuss.querySelector('[data-pi="fertig"]').addEventListener('click', schliessen);
    });
  };

  schritt1();
}
