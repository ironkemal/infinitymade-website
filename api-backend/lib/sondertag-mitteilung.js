// Reine Logik fuer Terminabsagen per E-Mail bei geschlossenem Sondertag (Physio-Pilot M6b/S8, 02.11.2026).
// Keine DB, kein Versand — das macht api-backend/routes/sondertag-mitteilung.js. Hier: welche Tage gelten als
// geschlossen, welcher Patient darf eine Mail bekommen (Einwilligung), wer kommt auf die Anrufliste, welcher Text.
//
// Rechtsrahmen (legal-de 01.11.2026, compliance/LEGAL_DECISIONS.md 20.10.2026): die Absage-Info selbst stuetzt sich
// auf den Behandlungsvertrag, der UNVERSCHLUESSELTE Mail-Kanal braucht aber die informierte Entscheidung des
// Patienten -> nur mit Datenschutz-Einwilligung ab v6, Option „Terminerinnerungen und Terminaenderungen".
// Alte Einwilligungen (<= v5) decken nur Erinnerungen -> Anrufliste. Text: Praxis, Datum, Uhrzeit, „entfaellt",
// Rueckrufbitte. Keine Namensanrede, kein Grund, keine Behandlungsangaben.

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Genau eine Adresse, genau ein @, keine Leer-/Steuerzeichen, kein Komma/Semikolon (Altdaten mit Adresslisten, S-56).
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

/**
 * Optionszeile der Datenschutz-Einwilligung ab v6, exakt wie renderEinwilligungText sie einfriert
 * (module/einwilligung-texte.js optionenText: `[X] ${o.text}: JA`). module/sondertag-mitteilung-waechter.test.js
 * bricht npm test, sobald einwilligung-texte.js eine v6+ hat, deren Option nicht genau so lautet.
 */
export const MITTEILUNG_OPTION_TEXT = 'Terminerinnerungen und Terminänderungen per E-Mail (unverschlüsselt, ohne Behandlungsangaben)';
export const MITTEILUNG_MIN_VERSION = 6;
export const MAX_IDS = 200;
export const TAGESDECKEL = 500;
export const MAX_TAGE = 31;

export function istUuid(wert) { return typeof wert === 'string' && UUID_RE.test(wert); }
export function istEinzelneEmail(wert) { return typeof wert === 'string' && wert.length <= 254 && EMAIL_RE.test(wert.trim()); }

/** Versionsnummer aus 'datenschutz-v6-2026-11-05' als Zahl (String-Vergleich bricht ab v10); sonst null. */
export function datenschutzVersion(textVersion) {
  const m = /^datenschutz-v(\d+)-/.exec(String(textVersion || ''));
  return m ? Number(m[1]) : null;
}

/**
 * Darf dieser Patient per Mail informiert werden? Massgeblich ist seine NEUESTE Datenschutz-Einwilligung: eine
 * spaetere ohne Haekchen ersetzt eine fruehere mit, eine widerrufene neueste sperrt (kein Rueckfall auf aeltere).
 * @param {Array<{consent_type,text_version,text_snapshot,consented_at,revoked_at}>} einwilligungen eines Patienten
 */
export function mailErlaubt(einwilligungen) {
  // Neueste Datenschutz-Einwilligung ueberhaupt; ist sie widerrufen, kein Rueckfall auf eine aeltere (legal-de 02.11.).
  const alle = (Array.isArray(einwilligungen) ? einwilligungen : [])
    .filter(e => e && e.consent_type === 'datenschutz')
    .sort((a, b) => String(b.consented_at || '').localeCompare(String(a.consented_at || '')));
  const neueste = alle[0];
  if (!neueste || neueste.revoked_at) return false;
  const v = datenschutzVersion(neueste.text_version);
  if (v === null || v < MITTEILUNG_MIN_VERSION) return false;
  return String(neueste.text_snapshot || '').split('\n').some(z => z.trim() === `[X] ${MITTEILUNG_OPTION_TEXT}: JA`);
}

/** Alle Kalendertage von..bis (inkl.), hoechstens MAX_TAGE; ungueltig -> null. */
export function tageVonBis(von, bis) {
  if (!DATUM_RE.test(von || '') || !DATUM_RE.test(bis || von || '')) return null;
  const ende = bis || von;
  const tage = [];
  for (let d = new Date(`${von}T12:00:00Z`); d <= new Date(`${ende}T12:00:00Z`); d = new Date(d.getTime() + 86400000)) {
    tage.push(d.toISOString().slice(0, 10));
    if (tage.length > MAX_TAGE) return null;
  }
  return tage.length ? tage : null;
}

/** Ganztägig geschlossene Sondertage (wie module/sondertag.js sondertagArt: closed/holiday ohne Uhrzeiten). */
export function geschlosseneTage(customDays) {
  return (Array.isArray(customDays) ? customDays : []).filter(t => t && ['closed', 'holiday'].includes(t.type)
    && !t.start_time && !t.end_time && DATUM_RE.test(String(t.date || '').slice(0, 10)));
}

const berlinTag = iso => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

/**
 * Betroffene Termine: an einem geschlossenen Tag, in der Zukunft, nicht abgesagt, kein Gruppen-Kind.
 * Sondertag mit Standort: nur Termine dieses Standorts (Altzeilen ohne Standort zaehlen mit).
 * @returns {Array<{termin, tag}>} tag = passende custom_days-Zeile
 */
export function betroffene(termine, tage, jetzt = new Date()) {
  const jeDatum = new Map();
  for (const t of geschlosseneTage(tage)) {
    const k = String(t.date).slice(0, 10);
    if (!jeDatum.has(k)) jeDatum.set(k, []);
    jeDatum.get(k).push(t);
  }
  const aus = [];
  for (const b of Array.isArray(termine) ? termine : []) {
    if (!b?.start_time || ['cancelled', 'no_show'].includes(String(b.status || '').toLowerCase())) continue;
    if (b.group_parent_id) continue;
    if (new Date(b.start_time) <= jetzt) continue;
    const passend = (jeDatum.get(berlinTag(b.start_time)) || [])
      .find(t => !t.business_id || !b.business_id || t.business_id === b.business_id);
    if (passend) aus.push({ termin: b, tag: passend });
  }
  return aus.sort((x, y) => String(x.termin.start_time).localeCompare(String(y.termin.start_time)));
}

/** Reservierung vor dem Versand (status 'fehler' + dieser Code): weder gesendet noch wiederholbar. */
export const IN_ARBEIT = 'IN_ARBEIT';

/** Dedup-Schluessel wie UNIQUE (booking_id, anlass, termin_beginn): Beginn als Zeitstempel normiert. */
export function protokollSchluessel(bookingId, beginn) {
  const t = new Date(beginn).getTime();
  return `${bookingId}|${Number.isNaN(t) ? String(beginn) : t}`;
}

/** Protokollzeilen -> Map Schluessel -> 'gesendet' | 'unklar'. Echte Fehler fehlen (= erneut versendbar). */
export function protokollZustand(zeilen) {
  const m = new Map();
  for (const z of Array.isArray(zeilen) ? zeilen : []) {
    if (!z?.booking_id) continue;
    const k = protokollSchluessel(z.booking_id, z.termin_beginn);
    if (z.status === 'gesendet') m.set(k, 'gesendet');
    else if (z.status === 'fehler' && z.fehler_code === IN_ARBEIT) m.set(k, 'unklar');
  }
  return m;
}

/**
 * Einteilen: Mail (Einwilligung + Adresse + Versandweg) | Anrufliste (mit Grund) | bereits informiert.
 * Dedup je Buchung UND Beginn: ein verschobener Termin ist eine neue Lage und wird wieder angeboten.
 * Unklarer Versandstatus (Reservierung ohne Abschluss) -> Anrufliste, nie automatisch erneut senden.
 * @param {Array<{termin,tag}>} liste aus betroffene()
 * @param {Map<string,{email}>} leads  id -> Lead
 * @param {Map<string,Array>} einwilligungen  lead id -> Einwilligungen
 * @param {Map<string,string>} protokoll  aus protokollZustand()
 * @param {boolean} versandMoeglich
 */
export function einteilen(liste, leads, einwilligungen, protokoll, versandMoeglich) {
  const mail = [];
  const anruf = [];
  const schon = [];
  for (const { termin, tag } of liste) {
    const zustand = protokoll?.get?.(protokollSchluessel(termin.id, termin.start_time));
    if (zustand === 'gesendet') { schon.push({ termin, tag }); continue; }
    if (zustand === 'unklar') { anruf.push({ termin, tag, grund: 'versand_unklar' }); continue; }
    const lead = termin.lead_id ? leads.get(termin.lead_id) : null;
    let grund = null;
    if (!termin.lead_id || !lead) grund = 'kein_patient';
    else if (!mailErlaubt(einwilligungen.get(termin.lead_id))) grund = 'keine_einwilligung';
    else if (!istEinzelneEmail(lead.email)) grund = 'keine_email';
    else if (!versandMoeglich) grund = 'versand_nicht_eingerichtet';
    if (grund) anruf.push({ termin, tag, grund }); else mail.push({ termin, tag, email: lead.email.trim() });
  }
  return { mail, anruf, schon };
}

export const GRUND_TEXT = {
  kein_patient: 'kein Patientenbezug',
  keine_einwilligung: 'keine Einwilligung für Mail',
  keine_email: 'keine gültige E-Mail',
  versand_nicht_eingerichtet: 'E-Mail-Versand nicht eingerichtet',
  versand_unklar: 'Versandstatus unklar – bitte anrufen',
};

export const clean = s => String(s || '').replace(/[\r\n]+/g, ' ').trim();

/** Datum und Uhrzeit eines Termins in Berliner Zeit (gemeinsam fuer Absage- und Erinnerungsmail). */
export function datumUhrDe(startIso) {
  const d = new Date(startIso);
  return {
    datum: d.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }),
    uhr: d.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }),
  };
}

/** Fester Text. Keine Anrede mit Namen, kein Grund, keine Behandlung. */
export function mitteilungsText({ praxis, telefon, startIso }) {
  const { datum, uhr } = datumUhrDe(startIso);
  const name = clean(praxis) || 'Ihre Praxis';
  const tel = clean(telefon);
  return {
    betreff: `Terminabsage – ${name}`,
    text: 'Guten Tag,\n\n'
      + `Ihr Termin am ${datum} um ${uhr} Uhr bei ${name} entfällt leider.\n\n`
      + `Bitte melden Sie sich bei uns, um einen neuen Termin zu vereinbaren${tel ? `: ${tel}` : ''}.\n\n`
      + `Mit freundlichen Grüßen\n${name}`,
  };
}
