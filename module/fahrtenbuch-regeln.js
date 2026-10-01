/**
 * fahrtenbuch-regeln.js — Fahrtenbuch- und Patientenverzeichnis-Regeln
 * (Reform 3.12 / S-35, legal-de 30.09.2026).
 *
 * Zweck & rechtlicher Hintergrund:
 * Nach OFD Frankfurt am Main (Verfügung vom 19.01.2011) dürfen Fahrtenbücher von
 * Berufsgeheimnisträgern und Heilberufen KEINE Patientennamen und KEINE
 * Patientenanschriften enthalten, da es sich um besonders geschützte Gesundheitsdaten
 * handelt. Stattdessen wird als Reisezweck einheitlich "Patientenbesuch" und als
 * Reiseziel "Patientenbesuch (s. Verzeichnis Nr. <REF>)" ausgewiesen.
 *
 * Der Patient wird intern über `lead_id` verknüpft. Namen und Anschriften werden
 * ausschließlich in ein separates "Patientenverzeichnis" exportiert, das nur auf
 * ausdrückliche Anforderung des Finanzamts vorgelegt wird. Es gibt keine Option,
 * Patientendaten in das reguläre Fahrtenbuch einzumischen.
 *
 * Referenzbildung:
 * Die Referenz (z. B. "P-A1B2C3D4") wird deterministisch aus `booking_id` abgeleitet:
 * Sie ist je Fahrt eindeutig (UNIQUE), bereits beim Anlegen des Termins bekannt,
 * absolut stabil und erfordert keine zusätzliche Spalte in der Datenbank.
 */

export const FAHRT_ZWECK = 'Patientenbesuch';

export const PATIENTENVERZEICHNIS_HINWEIS =
  'Das Patientenverzeichnis enthält Gesundheitsdaten (Patientennamen und Anschriften) und wird nur auf Anforderung des Finanzamts herausgegeben.';

/**
 * Leitet die Patientenreferenz deterministisch aus bookingId ab:
 * 'P-' + erste 8 Hex-Zeichen (Großbuchstaben).
 * Ungültige oder zu kurze Werte liefern einen leeren String.
 * @param {string|null|undefined} bookingId
 * @returns {string}
 */
export function fahrtReferenz(bookingId) {
  if (typeof bookingId !== 'string') return '';
  const clean = bookingId.replace(/-/g, '').trim();
  if (clean.length < 8) return '';
  const first8 = clean.slice(0, 8);
  if (!/^[0-9a-fA-F]{8}$/.test(first8)) return '';
  return 'P-' + first8.toUpperCase();
}

/**
 * Liefert Reisezweck und anonymisiertes Reiseziel anhand der Buchungs-ID.
 * Ist die Referenz leer, lautet das Reiseziel schlicht 'Patientenbesuch'.
 * @param {string|null|undefined} bookingId
 * @returns {{ zweck: string, zielort: string }}
 */
export function fahrtZweckUndZiel(bookingId) {
  const ref = fahrtReferenz(bookingId);
  return {
    zweck: FAHRT_ZWECK,
    zielort: ref ? 'Patientenbesuch (s. Verzeichnis Nr. ' + ref + ')' : 'Patientenbesuch'
  };
}

/**
 * Zweck/Ziel einer gespeicherten Fahrt fuer ANZEIGE und Export. Patientenbesuche
 * (lead_id gesetzt oder Altzeile "Hausbesuch <Name>") werden immer maskiert —
 * Altzeilen tragen in `zweck`/`zielort` noch Name und Anschrift.
 * @param {{booking_id?:string, lead_id?:string|null, zweck?:string|null, zielort?:string|null}} row
 * @returns {{zweck:string, zielort:string}}
 */
export function fahrtAnzeigeText(row) {
  if (row && (row.lead_id || /^Hausbesuch\b/i.test(String(row.zweck || '')))) {
    return fahrtZweckUndZiel(row.booking_id);
  }
  return { zweck: row?.zweck || '', zielort: row?.zielort || '' };
}

// ── Private CSV-Helfer ──────────────────────────────────────────────────────

/**
 * Formatiert eine Textzelle für CSV:
 * - In doppelte Anführungszeichen eingeschlossen
 * - Bestehende " werden verdoppelt
 * - Formel-Injection-Schutz: Text beginnt mit =, +, -, @, Tab oder CR -> vorangestelltes '
 * @param {*} val
 * @returns {string}
 */
function csvZelle(val) {
  if (val === null || val === undefined) {
    return '""';
  }
  let s = String(val);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return '"' + s.replace(/"/g, '""') + '"';
}

/**
 * Formatiert Km-Zahlen: ungequotet, leer bei null/undefined/''.
 * @param {*} val
 * @returns {string}
 */
function kmZelle(val) {
  if (val === null || val === undefined || val === '') {
    return '';
  }
  return String(val);
}

/**
 * Formatiert Datum nach de-DE (TT.MM.JJJJ). Leer wenn fehlt oder ungültig.
 * @param {*} val
 * @returns {string}
 */
function formatiereDatum(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE');
}

/**
 * Ermittelt den Patientennamen aus leads oder bookings.customer_name.
 * @param {object|null} leads
 * @param {object|null} bookings
 * @returns {string}
 */
function ermittleName(leads, bookings) {
  if (leads && typeof leads === 'object') {
    const fn = (leads.first_name || '').trim();
    const ln = (leads.last_name || '').trim();
    const name = [fn, ln].filter(Boolean).join(' ');
    if (name) return name;
  }
  if (bookings && typeof bookings === 'object') {
    const cn = (bookings.customer_name || '').trim();
    if (cn) return cn;
  }
  return '';
}

/**
 * Ermittelt die Anschrift "street, plz city" (leere Teile weggelassen) aus leads.
 * @param {object|null} leads
 * @returns {string}
 */
function ermittleAnschrift(leads) {
  if (!leads || typeof leads !== 'object') return '';
  const street = (leads.street || '').trim();
  const plz = (leads.plz || '').trim();
  const city = (leads.city || '').trim();
  const plzCity = [plz, city].filter(Boolean).join(' ');
  return [street, plzCity].filter(Boolean).join(', ');
}

// ── Exporte Fahrtenbuch & Verzeichnis ────────────────────────────────────────

const KOPFZEILE_FAHRTENBUCH =
  'lfd. Nr./Referenz;Datum;Kennzeichen;Fahrer;Km-Stand Beginn;Km-Stand Ende;gefahrene km;Abfahrtsort;Reiseziel;Reisezweck;Fahrtart;geändert';

export const GEAENDERT_JA = 'ja (s. Änderungsprotokoll)';

/**
 * Erstellt den Fahrtenbuch-CSV-Export (OHNE BOM, Zeilentrenner '\n', Trenner ';').
 * Enthält grundsätzlich KEINE Patientennamen und KEINE Anschriften.
 * Bei Zeilen mit `lead_id` werden Zweck und Zielort stets anonymisiert generiert.
 * Spalte „geändert" (BMF 18.11.2009, legal-de 01.10.2026): nachträglich geänderte
 * Fahrten müssen in der Finanzamt-Ausgabe erkennbar sein; Details stehen im
 * Änderungsprotokoll (`aenderungsprotokollCsv`). Ohne `aenderungen` bleibt die
 * Spalte leer statt fälschlich „nein" zu behaupten.
 * @param {Array<object>} rows
 * @param {Array<{fahrt_id:string}>} [aenderungen] Zeilen aus fahrten_aenderungen
 * @returns {string}
 */
export function fahrtenbuchCsv(rows, aenderungen) {
  const list = Array.isArray(rows) ? rows : [];
  const lines = [KOPFZEILE_FAHRTENBUCH];
  const geaendert = Array.isArray(aenderungen)
    ? new Set(aenderungen.map(a => a && a.fahrt_id).filter(Boolean))
    : null;

  for (const row of list) {
    if (!row) continue;
    const ref = fahrtReferenz(row.booking_id);
    const datum = formatiereDatum(row.fahrt_started_at);
    const kennzeichen = row.kennzeichen_snapshot || '';
    const fahrer = row._therapist || '';

    const { zweck, zielort } = fahrtAnzeigeText(row);

    let fahrtart = '';
    const kind = String(row.kind_snapshot || '').toLowerCase();
    if (kind === 'gewerblich') {
      fahrtart = 'Gewerblich';
    } else if (kind === 'privat') {
      fahrtart = 'Privat';
    }

    const startKm = kmZelle(row.start_km);
    const endKm = kmZelle(row.end_km);
    const distanceKm = kmZelle(row.distance_km);

    lines.push([
      csvZelle(ref),
      csvZelle(datum),
      csvZelle(kennzeichen),
      csvZelle(fahrer),
      startKm,
      endKm,
      distanceKm,
      csvZelle(row.abfahrtsort || ''),
      csvZelle(zielort),
      csvZelle(zweck),
      csvZelle(fahrtart),
      csvZelle(geaendert ? (geaendert.has(row.id) ? GEAENDERT_JA : 'nein') : '')
    ].join(';'));
  }

  return lines.join('\n');
}

const KOPFZEILE_AENDERUNGSPROTOKOLL =
  'Geändert am;Geändert von;Vorgang;Fahrt vom;Kennzeichen;lfd. Nr./Referenz;Feld;alter Wert;neuer Wert';

// Reihenfolge = Spaltenfolge des Fahrtenbuchs; Felder wie im Trigger
// fahrten_aenderung_protokollieren (Migration 0052).
const PROTOKOLL_FELDER = [
  ['fahrt_started_at', 'Beginn'],
  ['fahrt_arrived_at', 'Ankunft'],
  ['fahrt_ended_at', 'Ende'],
  ['kennzeichen_snapshot', 'Kennzeichen'],
  ['vehicle_id', 'Fahrzeug'],
  ['user_id', 'Fahrer'],
  ['start_km', 'Km-Stand Beginn'],
  ['end_km', 'Km-Stand Ende'],
  ['distance_km', 'gefahrene km'],
  ['abfahrtsort', 'Abfahrtsort'],
  ['zielort', 'Reiseziel'],
  ['zweck', 'Reisezweck'],
  ['notes', 'Notiz']
];
const ZEIT_FELDER = new Set(['fahrt_started_at', 'fahrt_arrived_at', 'fahrt_ended_at']);

/**
 * Erstellt das Änderungsprotokoll des Fahrtenbuchs als CSV (OHNE BOM) — eine
 * Zeile je geändertem Feld, bei Löschungen je belegtem Feld (neuer Wert leer).
 * Patientenschutz wie im Fahrtenbuch: Altzeilen „Hausbesuch <Name>" werden
 * maskiert, Notizen werden nie im Klartext ausgegeben.
 * @param {Array<object>} aenderungen Zeilen aus fahrten_aenderungen
 * @param {{namen?:Object<string,string>, referenzen?:Object<string,string>}} [opts]
 *   namen: userId → Anzeigename · referenzen: fahrt_id → booking_id
 * @returns {string}
 */
export function aenderungsprotokollCsv(aenderungen, opts = {}) {
  const namen = opts.namen || {};
  const referenzen = opts.referenzen || {};
  const list = (Array.isArray(aenderungen) ? aenderungen : [])
    .filter(Boolean)
    .slice()
    .sort((a, b) => String(a.geaendert_am || '').localeCompare(String(b.geaendert_am || '')));
  const lines = [KOPFZEILE_AENDERUNGSPROTOKOLL];
  const person = (id) => (id ? (namen[id] || 'Benutzer ' + String(id).slice(0, 8)) : 'System');

  for (const a of list) {
    const loeschung = a.op === 'DELETE';
    const alt = maskiereProtokollWerte(a.alt || {});
    const neu = loeschung ? {} : maskiereProtokollWerte(a.neu || {});
    const geaenderteFelder = PROTOKOLL_FELDER.filter(([k]) => loeschung
      ? !leer(alt[k])
      : JSON.stringify(alt[k] ?? null) !== JSON.stringify(neu[k] ?? null));
    const kennzeichenGeaendert = geaenderteFelder.some(([k]) => k === 'kennzeichen_snapshot');

    const kopf = [
      csvZelle(formatiereZeitpunkt(a.geaendert_am)),
      csvZelle(person(a.geaendert_von)),
      csvZelle(loeschung ? 'Löschung' : 'Änderung'),
      csvZelle(formatiereDatum(alt.fahrt_started_at)),
      csvZelle(alt.kennzeichen_snapshot || ''),
      csvZelle(fahrtReferenz(referenzen[a.fahrt_id]))
    ];
    for (const [k, label] of geaenderteFelder) {
      // Fahrzeug-ID nur, wenn das Kennzeichen sie nicht schon zeigt
      if (k === 'vehicle_id' && (loeschung || kennzeichenGeaendert)) continue;
      const wert = (v) => protokollWert(k, v, person);
      lines.push([...kopf, csvZelle(label), csvZelle(wert(alt[k])), csvZelle(loeschung ? '' : wert(neu[k]))].join(';'));
    }
  }

  return lines.join('\n');
}

function leer(v) {
  return v === null || v === undefined || v === '';
}

function maskiereProtokollWerte(werte) {
  if (/^Hausbesuch\b/i.test(String(werte.zweck || ''))) {
    return { ...werte, zweck: FAHRT_ZWECK, zielort: FAHRT_ZWECK };
  }
  return werte;
}

function protokollWert(feld, v, person) {
  if (leer(v)) return '';
  if (ZEIT_FELDER.has(feld)) return formatiereZeitpunkt(v);
  if (feld === 'user_id') return person(v);
  if (feld === 'vehicle_id') return 'Fahrzeug ' + String(v).slice(0, 8);
  if (feld === 'notes') return '[Inhalt nicht exportiert]';
  return String(v);
}

/**
 * Formatiert einen Zeitpunkt als TT.MM.JJJJ HH:MM (Europe/Berlin). Leer wenn ungültig.
 * @param {*} val
 * @returns {string}
 */
function formatiereZeitpunkt(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

const KOPFZEILE_PATIENTENVERZEICHNIS = 'Referenz;Datum;Patientenname;Anschrift';

/**
 * Erstellt das separate Patientenverzeichnis als CSV (OHNE BOM).
 * Beinhaltet Referenz, Datum, Patientenname und Anschrift für Zeilen mit Patientenbezug.
 * Zeilen ohne ermittelbaren Namen werden übersprungen.
 * @param {Array<object>} rows
 * @returns {string}
 */
export function patientenverzeichnisCsv(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const lines = [KOPFZEILE_PATIENTENVERZEICHNIS];

  for (const row of list) {
    if (!row) continue;
    const hatBezug = !!(row.lead_id || row.leads || row.bookings?.customer_name);
    if (!hatBezug) continue;

    const name = ermittleName(row.leads, row.bookings);
    if (!name) continue;

    const ref = fahrtReferenz(row.booking_id);
    const datum = formatiereDatum(row.fahrt_started_at);
    const anschrift = ermittleAnschrift(row.leads);

    lines.push([
      csvZelle(ref),
      csvZelle(datum),
      csvZelle(name),
      csvZelle(anschrift)
    ].join(';'));
  }

  return lines.join('\n');
}

/**
 * Triggert den Browser-Download für eine CSV-Datei mit vorangestelltem UTF-8 BOM.
 * @param {string} text
 * @param {string} dateiname
 */
export function csvHerunterladen(text, dateiname) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const inhalt = text != null ? String(text) : '';
  const blob = new Blob(['\uFEFF' + inhalt], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = dateiname || 'export.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    try {
      URL.revokeObjectURL(a.href);
    } catch {}
  }, 1000);
}
