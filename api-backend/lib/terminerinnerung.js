// Terminerinnerung am Vortag (O-206 Phase A, Physio-Pilot P1, 06.11.2026) – reine Logik, keine DB, kein Versand.
// Lauf und Versand: lib/terminerinnerung-job.js (nutzt sendeLauf() aus routes/sondertag-mitteilung.js).
//
// Garantien (Tests: lib/terminerinnerung.test.js, lib/terminerinnerung-job.test.js, db/…quota.integration.test.js):
//   G-1 kein Doppelversand      – UNIQUE (booking_id, anlass, termin_beginn) in termin_mitteilungen; hier: nur
//                                 Transportfehler duerfen erneut versucht werden, alles andere nie (maximal einmal).
//   G-2 Einwilligung            – dieselbe Pruefung wie Sondertag-Absage: einteilen()/mailErlaubt() (Datenschutz ab v6).
//   G-3 richtiger Berliner Tag  – morgenBerlin()/fensterOffen() ueber Intl, nie ueber UTC-Rechnung oder Containerzeit.
//   G-4 keine Personendaten     – Text: Praxis, Datum, Uhrzeit, ggf. Standort; kein Name, kein Grund, keine Behandlung.
import { berlinHeute } from './berlin-tag.js';
import { datumUhrDe, clean } from './sondertag-mitteilung.js';

export const ANLASS_ERINNERUNG = 'erinnerung_vortag';
/** Gleicher Wert wie in Migration 0110 (Trigger) – die DB entscheidet, hier nur die Vorabpruefung. */
export const DECKEL_ERINNERUNG = 1000;
/** Versandfenster am Vorabend (Berliner Stunde, von inklusiv, bis exklusiv): keine Nachtmails. */
export const FENSTER_VON = 18;
export const FENSTER_BIS = 22;
/** Kurz vor dem Termin gebuchte Termine bekommen keine Erinnerung (die Buchungsbestaetigung genuegt). */
export const MIN_VORLAUF_STUNDEN = 12;

/**
 * Fehlercodes, nach denen die Mail NACHWEISLICH nicht angenommen wurde – nur dann ist ein erneuter Versuch sicher:
 * SMTP_4XX (Server lehnt voruebergehend ab, z. B. Greylisting; sendeLauf bildet responseCode 4xx darauf ab),
 * EAUTH (Anmeldung scheitert vor dem Mailtext), EDNS (Servername nicht aufloesbar).
 * NICHT dazu: ETIMEDOUT/ESOCKET/ECONNECTION. nodemailer meldet einen Timeout NACH der Datenuebertragung genauso
 * (command 'CONN') wie beim Verbindungsaufbau (gemessen 06.11.2026) – ein Wiederholen koennte doppelt senden (G-1).
 * Ob der Server grundsaetzlich erreichbar ist, prueft der Lauf VOR der ersten Reservierung (transport.verify()).
 */
export const WIEDERHOLBAR = new Set(['SMTP_4XX', 'EAUTH', 'EDNS']);

const STUNDE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' });

/** Berliner Stunde 0–23. */
export function berlinStunde(jetzt = new Date()) {
  return Number(STUNDE.format(jetzt));
}

/** Ist jetzt (Berliner Zeit) Versandzeit fuer den morgigen Tag? */
export function fensterOffen(jetzt = new Date()) {
  const h = berlinStunde(jetzt);
  return h >= FENSTER_VON && h < FENSTER_BIS;
}

/** Morgiger Berliner Kalendertag 'YYYY-MM-DD' (Mittagsanker: Zeitumstellung verschiebt den Tag nie). */
export function morgenBerlin(jetzt = new Date()) {
  const heute = berlinHeute(jetzt);
  const d = new Date(`${heute}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Termine, die erinnert werden sollen: am morgigen Berliner Tag, noch in der Zukunft, nicht abgesagt/ausgeblieben,
 * kein Gruppen-Kind (die Gruppe hat einen Elterntermin), nicht erst kurz vorher gebucht.
 * @returns {Array<{termin, tag: null}>} im Format von einteilen()
 */
export function zuErinnern(termine, { jetzt = new Date(), morgen = morgenBerlin(jetzt) } = {}) {
  const grenze = jetzt.getTime() - MIN_VORLAUF_STUNDEN * 3600 * 1000;
  const aus = [];
  for (const b of Array.isArray(termine) ? termine : []) {
    if (!b?.start_time) continue;
    const beginn = new Date(b.start_time);
    if (Number.isNaN(beginn.getTime()) || beginn <= jetzt) continue;
    if (['cancelled', 'no_show'].includes(String(b.status || '').toLowerCase())) continue;
    if (b.group_parent_id) continue;
    if (berlinHeute(beginn) !== morgen) continue;
    const gebucht = b.created_at ? new Date(b.created_at).getTime() : NaN;
    if (!Number.isNaN(gebucht) && gebucht > grenze) continue;
    aus.push({ termin: b, tag: null });
  }
  return aus.sort((x, y) => String(x.termin.start_time).localeCompare(String(y.termin.start_time)));
}

/**
 * Protokollzeilen (nur Anlass erinnerung_vortag) -> Map fuer einteilen():
 * gesendet -> 'gesendet'; Reservierung ohne Abschluss (IN_ARBEIT) -> 'unklar'; endgueltiger Fehler -> 'unklar'
 * (nie erneut senden); nur WIEDERHOLBARE Fehler (siehe oben) fehlen in der Map und werden erneut versucht.
 */
export function protokollZustandErinnerung(zeilen, schluessel, inArbeit) {
  const m = new Map();
  for (const z of Array.isArray(zeilen) ? zeilen : []) {
    if (!z?.booking_id) continue;
    const k = schluessel(z.booking_id, z.termin_beginn);
    if (z.status === 'gesendet') m.set(k, 'gesendet');
    else if (z.status === 'fehler' && (z.fehler_code === inArbeit || !WIEDERHOLBAR.has(z.fehler_code))) m.set(k, 'unklar');
  }
  return m;
}

/** Fester Text. Keine Namensanrede, kein Grund, keine Behandlung; Absage telefonisch (Phase A ohne Link). */
export function erinnerungsText({ praxis, telefon, startIso, standort }) {
  const { datum, uhr } = datumUhrDe(startIso);
  const name = clean(praxis) || 'Ihre Praxis';
  const ort = clean(standort);
  const tel = clean(telefon);
  return {
    betreff: `Terminerinnerung – ${name}`,
    text: 'Guten Tag,\n\n'
      + `wir erinnern Sie an Ihren Termin am ${datum} um ${uhr} Uhr bei ${name}${ort ? ` (${ort})` : ''}.\n\n`
      + `Können Sie den Termin nicht wahrnehmen, sagen Sie ihn bitte rechtzeitig telefonisch ab${tel ? `: ${tel}` : ''}.\n\n`
      + `Mit freundlichen Grüßen\n${name}`,
  };
}
