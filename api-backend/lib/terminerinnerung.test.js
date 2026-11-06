import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fensterOffen, berlinStunde, morgenBerlin, zuErinnern, protokollZustandErinnerung, erinnerungsText, WIEDERHOLBAR,
} from './terminerinnerung.js';
import { protokollSchluessel, IN_ARBEIT, einteilen } from './sondertag-mitteilung.js';

const J = iso => new Date(iso);

// ── G-3 Berliner Zeit ───────────────────────────────────────────────────────────────────────────
test('G-3 Fenster 18:00–22:00 Berliner Zeit im Winter (UTC+1): Grenzen exakt', () => {
  assert.equal(fensterOffen(J('2026-12-10T16:59:59Z')), false); // 17:59:59
  assert.equal(fensterOffen(J('2026-12-10T17:00:00Z')), true);  // 18:00
  assert.equal(fensterOffen(J('2026-12-10T20:59:59Z')), true);  // 21:59:59
  assert.equal(fensterOffen(J('2026-12-10T21:00:00Z')), false); // 22:00
  assert.equal(berlinStunde(J('2026-12-10T23:30:00Z')), 0);     // 00:30 naechster Tag
});

test('G-3 Fenster im Sommer (UTC+2) und an beiden Zeitumstellungen', () => {
  assert.equal(fensterOffen(J('2026-07-10T15:59:59Z')), false); // 17:59:59 MESZ
  assert.equal(fensterOffen(J('2026-07-10T16:00:00Z')), true);  // 18:00 MESZ
  // 25.10.2026 Umstellung auf Winterzeit: 16:00Z = 17:00 MEZ (zu), 17:00Z = 18:00 MEZ (auf); Vortag noch MESZ.
  assert.equal(fensterOffen(J('2026-10-24T16:00:00Z')), true);  // 18:00 MESZ
  assert.equal(fensterOffen(J('2026-10-25T16:00:00Z')), false); // 17:00 MEZ
  assert.equal(fensterOffen(J('2026-10-25T17:00:00Z')), true);  // 18:00 MEZ
  // 29.03.2026 Umstellung auf Sommerzeit: 16:00Z = 18:00 MESZ.
  assert.equal(fensterOffen(J('2026-03-29T15:59:59Z')), false);
  assert.equal(fensterOffen(J('2026-03-29T16:00:00Z')), true);
});

test('G-3 morgenBerlin: Mitternacht, Jahreswechsel, Zeitumstellung, Monatsende', () => {
  assert.equal(morgenBerlin(J('2026-12-10T17:00:00Z')), '2026-12-11');
  // 23:30Z am 31.12. ist in Berlin schon der 01.01. -> morgen ist der 02.01. (UTC-Rechnung gaebe 01.01.)
  assert.equal(morgenBerlin(J('2026-12-31T23:30:00Z')), '2027-01-02');
  assert.equal(morgenBerlin(J('2026-12-31T22:30:00Z')), '2027-01-01'); // 23:30 Berlin
  assert.equal(morgenBerlin(J('2026-10-24T21:00:00Z')), '2026-10-25'); // 23:00 MESZ, Tag mit 25 Stunden folgt
  assert.equal(morgenBerlin(J('2026-10-25T17:00:00Z')), '2026-10-26');
  assert.equal(morgenBerlin(J('2026-03-28T17:30:00Z')), '2026-03-29'); // Tag mit 23 Stunden folgt
  assert.equal(morgenBerlin(J('2026-02-28T17:30:00Z')), '2026-03-01'); // kein Schaltjahr
  assert.equal(morgenBerlin(J('2028-02-28T17:30:00Z')), '2028-02-29'); // Schaltjahr
});

// ── Auswahl der Termine ──────────────────────────────────────────────────────────────────────────
const jetzt = J('2026-12-10T17:00:00Z'); // 18:00 MEZ, morgen = 2026-12-11
const b = (id, start, extra = {}) => ({ id, start_time: start, status: 'confirmed', created_at: '2026-01-01T08:00:00Z', ...extra });

test('zuErinnern: nur morgen, Zukunft, aktiv, kein Gruppen-Kind, nicht kurz vorher gebucht', () => {
  const liste = zuErinnern([
    b('ok-frueh', '2026-12-10T23:00:00Z'),                       // 00:00 MEZ am 11.12. – gehoert zu morgen
    b('ok-spaet', '2026-12-11T22:59:00Z'),                       // 23:59 MEZ am 11.12.
    b('zu-frueh', '2026-12-10T22:59:00Z'),                       // 23:59 MEZ am 10.12. – heute
    b('zu-spaet', '2026-12-11T23:00:00Z'),                       // 00:00 MEZ am 12.12.
    b('abgesagt', '2026-12-11T09:00:00Z', { status: 'cancelled' }),
    b('ausgeblieben', '2026-12-11T09:00:00Z', { status: 'No_Show' }),
    b('gruppe-kind', '2026-12-11T09:00:00Z', { group_parent_id: 'p' }),
    b('gerade-gebucht', '2026-12-11T09:00:00Z', { created_at: '2026-12-10T10:00:00Z' }), // 7 h vorher
    b('vor-12h-gebucht', '2026-12-11T10:00:00Z', { created_at: '2026-12-10T04:59:00Z' }),   // 12 h 1 min vorher
    b('ohne-start', null),
    b('kaputtes-datum', 'morgen'),
  ], { jetzt });
  assert.deepEqual(liste.map(x => x.termin.id), ['ok-frueh', 'vor-12h-gebucht', 'ok-spaet']);
  assert.ok(liste.every(x => x.tag === null));
});

test('zuErinnern: Zeitumstellungstage (23 und 25 Stunden) werden vollstaendig und ohne Nachbartage erfasst', () => {
  // morgen = 29.03.2026 (23 Stunden): 00:00 MEZ = 28.03. 23:00Z; Ende 23:59 MESZ = 29.03. 21:59Z
  const maerz = zuErinnern([
    b('m-davor', '2026-03-28T22:59:00Z'), b('m-anfang', '2026-03-28T23:00:00Z'),
    b('m-ende', '2026-03-29T21:59:00Z'), b('m-danach', '2026-03-29T22:00:00Z'),
  ], { jetzt: J('2026-03-28T17:30:00Z') });
  assert.deepEqual(maerz.map(x => x.termin.id), ['m-anfang', 'm-ende']);
  // morgen = 25.10.2026 (25 Stunden): 00:00 MESZ = 24.10. 22:00Z; Ende 23:59 MEZ = 25.10. 22:59Z
  const oktober = zuErinnern([
    b('o-davor', '2026-10-24T21:59:00Z'), b('o-anfang', '2026-10-24T22:00:00Z'),
    b('o-mitte', '2026-10-25T01:30:00Z'), b('o-ende', '2026-10-25T22:59:00Z'), b('o-danach', '2026-10-25T23:00:00Z'),
  ], { jetzt: J('2026-10-24T17:00:00Z') });
  assert.deepEqual(oktober.map(x => x.termin.id), ['o-anfang', 'o-mitte', 'o-ende']);
});

// ── G-1 Wiederholung nur nach Transportfehler ─────────────────────────────────────────────────────
test('G-1 protokollZustandErinnerung: gesendet/endgueltig/unklar nie erneut, nur sicher nicht angenommene Mails wiederholbar', () => {
  const beginn = '2026-12-11T09:00:00Z';
  const zeilen = [
    { booking_id: 'a', termin_beginn: beginn, status: 'gesendet', fehler_code: null },
    { booking_id: 'b', termin_beginn: beginn, status: 'fehler', fehler_code: IN_ARBEIT },
    { booking_id: 'c', termin_beginn: beginn, status: 'fehler', fehler_code: 'EENVELOPE' },     // Empfaenger endgueltig abgelehnt
    { booking_id: 'd', termin_beginn: beginn, status: 'fehler', fehler_code: 'ETIMEDOUT' },     // Timeout: Mail evtl. schon angenommen
    { booking_id: 'e', termin_beginn: beginn, status: 'fehler', fehler_code: 'VERSAND_FEHLER' }, // unbekannt -> sicher: nie erneut
    { booking_id: 'f', termin_beginn: beginn, status: 'fehler', fehler_code: 'SMTP_4XX' },      // Greylisting: nicht angenommen
    { booking_id: 'g', termin_beginn: beginn, status: 'fehler', fehler_code: 'ESOCKET' },       // wie ETIMEDOUT: unsicher
  ];
  const m = protokollZustandErinnerung(zeilen, protokollSchluessel, IN_ARBEIT);
  const z = id => m.get(protokollSchluessel(id, beginn));
  assert.equal(z('a'), 'gesendet'); assert.equal(z('b'), 'unklar'); assert.equal(z('c'), 'unklar');
  assert.equal(z('d'), 'unklar'); assert.equal(z('e'), 'unklar'); assert.equal(z('g'), 'unklar');
  assert.equal(z('f'), undefined); // einzig SMTP_4XX wird wieder angeboten
  assert.deepEqual([...WIEDERHOLBAR].sort(), ['EAUTH', 'EDNS', 'SMTP_4XX']);
  for (const code of WIEDERHOLBAR) assert.equal(protokollZustandErinnerung(
    [{ booking_id: 'x', termin_beginn: beginn, status: 'fehler', fehler_code: code }], protokollSchluessel, IN_ARBEIT).size, 0);
});

test('G-1/G-2 einteilen mit Erinnerungs-Protokoll: schon gesendet -> nicht erneut; unklar -> Anrufliste; verschobener Termin wieder angeboten', () => {
  const liste = zuErinnern([b('t1', '2026-12-11T09:00:00Z', { lead_id: 'L' })], { jetzt });
  const leads = new Map([['L', { id: 'L', email: 'patient@example.invalid' }]]);
  const einw = new Map([['L', [{
    consent_type: 'datenschutz', text_version: 'datenschutz-v6-2026-11-05', consented_at: '2026-11-06T08:00:00Z', revoked_at: null,
    text_snapshot: '[X] Terminerinnerungen und Terminänderungen per E-Mail (unverschlüsselt, ohne Behandlungsangaben): JA',
  }]]]);
  const key = protokollSchluessel('t1', '2026-12-11T09:00:00Z');
  assert.equal(einteilen(liste, leads, einw, new Map(), true).mail.length, 1);
  assert.equal(einteilen(liste, leads, einw, new Map([[key, 'gesendet']]), true).schon.length, 1);
  assert.equal(einteilen(liste, leads, einw, new Map([[key, 'unklar']]), true).anruf[0].grund, 'versand_unklar');
  const verschoben = zuErinnern([b('t1', '2026-12-11T10:00:00Z', { lead_id: 'L' })], { jetzt }); // gleiche Buchung, neue Zeit
  assert.equal(einteilen(verschoben, leads, einw, new Map([[key, 'gesendet']]), true).mail.length, 1);
});

// ── G-4 Text ─────────────────────────────────────────────────────────────────────────────────────
test('G-4 Text: Praxis, Datum, Uhrzeit, Standort, Telefon – keine Namensanrede, keine Header-/Zeilen-Injektion', () => {
  const { betreff, text } = erinnerungsText({
    praxis: 'Physio Nord\r\nBcc: x@example.invalid', telefon: '0123 456\n789', startIso: '2026-12-11T09:30:00Z', standort: 'Standort B, Weg 1, 12345 Ort',
  });
  assert.equal(betreff, 'Terminerinnerung – Physio Nord Bcc: x@example.invalid');
  assert.ok(!/[\r\n]/.test(betreff));
  assert.match(text, /Freitag, 11\.12\.2026 um 10:30 Uhr bei Physio Nord Bcc: x@example\.invalid \(Standort B, Weg 1, 12345 Ort\)\./);
  assert.match(text, /telefonisch ab: 0123 456 789\./);
  assert.ok(!/Guten Tag [A-ZÄÖÜ]/.test(text));
  assert.doesNotMatch(text, /Herr|Frau|Behandlung|Rezept|Diagnose/);
});

test('G-4 Text ohne Praxisname, Telefon und Standort bleibt vollstaendig', () => {
  const { betreff, text } = erinnerungsText({ startIso: '2026-12-11T09:30:00Z' });
  assert.equal(betreff, 'Terminerinnerung – Ihre Praxis');
  assert.match(text, /bei Ihre Praxis\.\n/);
  assert.match(text, /telefonisch ab\.\n/);
});
