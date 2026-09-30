// Anliegen-Auswahl der oeffentlichen Terminanfrage (booking-request.html) — Podologie.
//
// Warum: Reform-Sprint S4 („Online-Anfrage: Patient waehlt den Grund"). Ein
// Podologie-Patient weiss nicht, was „GKV / PKV / BG" fuer seinen Besuch heisst;
// er weiss, ob er ein Rezept hat und was er will. v2 (30.09.2026, Podologie-
// Entscheidung „Online-Anfrage (S4)"): drei Karten (Rezept / Nagelspange / ohne
// Rezept) bestimmen die erlaubten Zahlungsarten; Hausbesuch ist ein Schalter unter
// der Karte (Adresse Pflicht, sobald an), keine eigene Karte.
//
// Wohin gespeichert: `booking_requests` hat keine Anliegen-Spalte. Ohne Schema-
// aenderung geht der Grund als erste Zeile in `notizen` (max. 500 Zeichen, die
// Praxis sieht sie im Anfragen-Detail). Reine Funktionen, kein DOM.

export const ANLIEGEN = [
  { key: 'rezept', titel: 'Behandlung mit Rezept', hinweis: 'Rezept liegt vor oder wird vom Arzt noch ausgestellt — bitte zum Termin mitbringen', zahlung: ['gkv', 'pkv', 'bg'] },
  { key: 'nagelspange', titel: 'Nagelspange', hinweis: 'Eingewachsener Nagel — mit oder ohne Rezept', zahlung: ['gkv', 'pkv', 'selbstzahler'] },
  { key: 'ohne_rezept', titel: 'Ohne Rezept – Fußpflege / Beratung', hinweis: 'Ich zahle selbst oder bin privat versichert', zahlung: ['selbstzahler', 'pkv'] },
];

/** Fester Hinweis ueber den Karten: Akutfaelle gehoeren nicht in eine Online-Anfrage. */
export const WUNDE_HINWEIS = 'Offene Wunde, Rötung, Schwellung oder Fieber am Fuß? Bitte nicht online anfragen — rufen Sie uns an oder wenden Sie sich an Ihre Ärztin / Ihren Arzt.';

/** Antworten der freiwilligen Frage „Hausbesuch auf dem Rezept angekreuzt?" -> Notiztext. */
export const HB_REZEPT_ANTWORTEN = { ja: 'ja', nein: 'nein', unklar: 'unklar' };

const ALLE_ZAHLUNG = ['gkv', 'pkv', 'selbstzahler', 'bg'];

/** Das Anliegen-Feld gibt es nur fuer Podologie; andere Fachbereiche bleiben unveraendert. */
export function anliegenFuerBereich(bereich) {
  return String(bereich || '').toLowerCase().startsWith('podolog') ? ANLIEGEN : [];
}

export function findAnliegen(key) {
  return ANLIEGEN.find(a => a.key === key) || null;
}

/** Erlaubte Zahlungsarten; ohne Anliegen alle vier (bisheriges Verhalten). */
export function zahlungsartenFuer(key) {
  return findAnliegen(key)?.zahlung || ALLE_ZAHLUNG;
}

/**
 * Freiwillige Ein-Tap-Frage „Ist auf dem Rezept ‚Hausbesuch: Ja' angekreuzt?" —
 * nur bei Hausbesuch UND (Rezept-Karte oder Zahlungsart GKV/PKV). Blockiert nie.
 * `hausbesuch` ist optional (Standard: an), damit der Aufrufer die Bedingung
 * getrennt pruefen kann.
 */
export function hausbesuchFrageNoetig(key, zahlungsart, hausbesuch = true) {
  if (hausbesuch !== true) return false;
  return key === 'rezept' || zahlungsart === 'gkv' || zahlungsart === 'pkv';
}

/**
 * notizen-Text: „Anliegen: <Titel>[ — Hausbesuch — Adresse: …][ — Hausbesuch auf
 * Rezept: ja|nein|unklar]" als erste Zeile, darunter die freie Notiz. Auf `max`
 * (Server-Grenze 500) gekuerzt; die Kopfzeile bleibt vollstaendig, gekuerzt wird
 * der freie Text. Ist Hausbesuch aus, werden Adresse und Antwort nie geschrieben.
 */
export function anliegenNotiz(key, opts, frei, max = 500) {
  const a = findAnliegen(key);
  const rest = String(frei || '').trim();
  if (!a) return rest ? rest.slice(0, max) : null;
  const { hausbesuch = false, adresse = '', hbAufRezept = null } = opts || {};
  let kopf = `Anliegen: ${a.titel}`;
  if (hausbesuch === true) {
    kopf += ' — Hausbesuch';
    const adr = String(adresse || '').replace(/\s+/g, ' ').trim();
    if (adr) kopf += ` — Adresse: ${adr}`;
    const antwort = HB_REZEPT_ANTWORTEN[hbAufRezept];
    if (antwort) kopf += ` — Hausbesuch auf Rezept: ${antwort}`;
  }
  if (!rest) return kopf.slice(0, max);
  // Kopfzeile nie kuerzen, solange sie passt; nur der freie Text weicht.
  if (kopf.length >= max) return kopf.slice(0, max);
  return `${kopf}\n${rest}`.slice(0, max).trimEnd();
}
