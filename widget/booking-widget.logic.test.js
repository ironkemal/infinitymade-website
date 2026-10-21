import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leererZustand, zeigeAnliegen, zahlartOptionen, waehleAnliegen, setzeFlexibel, schalte,
  geburtsdatumIso, validateBirthDate, validateName, validateContact,
  pruefeSchritt1, pruefeSchritt2, pruefeSchritt3, zusammenfassung, buildPayload,
  formatSlot, splitLocalIso, pollDelay, parseIsoDate,
} from './booking-widget.logic.js';

const JETZT = new Date(2026, 9, 12, 12, 0);

test('Anliegen-Karten nur fuer Podologie', () => {
  assert.equal(zeigeAnliegen('podologie'), true);
  assert.equal(zeigeAnliegen('Podologie'), true);
  assert.equal(zeigeAnliegen('physiotherapie'), false);
  assert.equal(zeigeAnliegen(null), false);
});

test('Versicherungsoptionen folgen dem Anliegen', () => {
  const keys = (a) => zahlartOptionen(a).map((o) => o.key);
  assert.deepEqual(keys('rezept'), ['gkv', 'pkv', 'bg']);
  assert.deepEqual(keys('ohne_rezept'), ['pkv', 'selbstzahler']);
  assert.deepEqual(keys('unsicher'), ['gkv', 'pkv', 'selbstzahler', 'bg']);
  assert.deepEqual(keys(''), ['gkv', 'pkv', 'selbstzahler', 'bg']);
});

test('Anliegen wechseln leert eine nicht mehr passende Versicherung', () => {
  let z = { ...leererZustand(), anliegen: 'rezept', zahlart: 'gkv' };
  z = waehleAnliegen(z, 'ohne_rezept');
  assert.equal(z.zahlart, '');
  z = { ...z, zahlart: 'pkv' };
  assert.equal(waehleAnliegen(z, 'rezept').zahlart, 'pkv');
});

test('flexibel schliesst konkrete Auswahl aus und umgekehrt', () => {
  let z = leererZustand();
  z = schalte(z, 'tage', 'mo');
  z = schalte(z, 'zeiten', 'vormittag');
  assert.deepEqual([z.tage, z.zeiten, z.flexibel], [['mo'], ['vormittag'], false]);
  z = setzeFlexibel(z, true);
  assert.deepEqual([z.tage, z.zeiten, z.flexibel], [[], [], true]);
  z = schalte(z, 'tage', 'di');
  assert.deepEqual([z.tage, z.flexibel], [['di'], false]);
  z = schalte(z, 'tage', 'di');
  assert.deepEqual(z.tage, []);
});

test('Geburtsdatum aus Tag/Monat/Jahr', () => {
  assert.equal(geburtsdatumIso('12', '4', '1975'), '1975-04-12');
  assert.equal(geburtsdatumIso('1', '1', '2001'), '2001-01-01');
  assert.equal(geburtsdatumIso('31', '2', '1980'), null);
  assert.equal(geburtsdatumIso('', '4', '1975'), null);
  assert.equal(geburtsdatumIso('12', '4', '75'), null);
  assert.equal(validateBirthDate('1975-04-12', JETZT), null);
  assert.notEqual(validateBirthDate(null, JETZT), null);
  assert.notEqual(validateBirthDate('1899-12-31', JETZT), null);
  assert.notEqual(validateBirthDate('2026-10-13', JETZT), null);
  assert.equal(validateBirthDate('2026-10-12', JETZT), null);
});

test('Schritt 1: Versicherung Pflicht, Anliegen nur mit Karten', () => {
  const z = leererZustand();
  assert.deepEqual(Object.keys(pruefeSchritt1(z, true)), ['anliegen', 'zahlart']);
  assert.deepEqual(Object.keys(pruefeSchritt1(z, false)), ['zahlart']);
  assert.deepEqual(pruefeSchritt1({ ...z, anliegen: 'rezept', zahlart: 'gkv' }, true), {});
  assert.deepEqual(Object.keys(pruefeSchritt1({ ...z, anliegen: 'ohne_rezept', zahlart: 'gkv' }, true)), ['zahlart']);
});

test('Schritt 2: flexibel oder Tag UND Tageszeit', () => {
  const z = leererZustand();
  assert.ok(pruefeSchritt2(z).zeit);
  assert.match(pruefeSchritt2({ ...z, tage: ['mo'] }).zeit, /Tageszeit/);
  assert.match(pruefeSchritt2({ ...z, zeiten: ['spaet'] }).zeit, /Wochentag/);
  assert.deepEqual(pruefeSchritt2({ ...z, tage: ['mo'], zeiten: ['spaet'] }), {});
  assert.deepEqual(pruefeSchritt2({ ...z, flexibel: true }), {});
});

test('Schritt 3: Felder in Formularreihenfolge, Kontakt Pflicht', () => {
  const f = pruefeSchritt3(leererZustand(), JETZT);
  assert.deepEqual(Object.keys(f), ['vorname', 'nachname', 'geburtsdatum', 'kontakt']);
  const gut = { ...leererZustand(), vorname: 'Erika', nachname: 'Musterfrau', tag: '12', monat: '4', jahr: '1975', telefon: '0151 1234567' };
  assert.deepEqual(pruefeSchritt3(gut, JETZT), {});
  assert.ok(pruefeSchritt3({ ...gut, email: 'kaputt' }, JETZT).email);
  assert.ok(pruefeSchritt3({ ...gut, telefon: '12' }, JETZT).telefon);
  assert.ok(pruefeSchritt3({ ...gut, vorname: '<b>' }, JETZT).vorname);
});

test('validateContact', () => {
  assert.ok(validateContact('', '').kontakt);
  assert.equal(validateContact('a@b.de', '').kontakt, null);
  assert.ok(validateContact('x', '').email);
  assert.equal(validateName('Anna', 'Vornamen'), null);
});

test('Zusammenfassung folgt der Reihenfolge der Schritte', () => {
  const z = {
    ...leererZustand(), anliegen: 'nagelspange', hausbesuch: true, zahlart: 'gkv', mitteilung: 'großer Zeh',
    tage: ['mi', 'mo'], zeiten: ['vormittag'], dringlichkeit: 'wochen', anmerkung: 'ab 16 Uhr',
    vorname: 'Erika', nachname: 'Musterfrau', tag: '12', monat: '4', jahr: '1975', erstbesuch: 'nein', telefon: '0151 1', email: 'e@x.de',
  };
  const zeilen = zusammenfassung(z, true);
  assert.deepEqual(zeilen.map((r) => r.key), ['anliegen', 'zahlart', 'mitteilung', 'zeit', 'dringlichkeit', 'anmerkung', 'person', 'erstbesuch', 'kontakt']);
  assert.deepEqual(zeilen.map((r) => r.step), [1, 1, 1, 2, 2, 2, 3, 3, 3]);
  assert.equal(zeilen[0].wert, 'Nagelspange · Hausbesuch');
  assert.equal(zeilen[3].wert, 'Mo, Mi · Vormittag (8–12)');
  assert.equal(zeilen[6].wert, 'Erika Musterfrau, geb. 12.04.1975');
  assert.equal(zeilen[8].wert, '0151 1 · e@x.de');
});

test('Zusammenfassung: leere optionale Zeilen entfallen, Pflichtzeilen bleiben', () => {
  const zeilen = zusammenfassung(leererZustand(), false);
  assert.deepEqual(zeilen.map((r) => r.key), ['zahlart', 'zeit', 'person', 'kontakt']);
  assert.ok(zeilen.every((r) => r.wert === ''));
});

test('buildPayload: Server baut die Notiz, kein fertiger Text, kein Datum', () => {
  const z = {
    ...leererZustand(), anliegen: 'rezept', zahlart: 'gkv', flexibel: true, tage: ['mo'], zeiten: ['spaet'],
    vorname: ' Erika ', nachname: 'Musterfrau', tag: '12', monat: '4', jahr: '1975', telefon: '0151 1234567',
    mitteilung: 'x'.repeat(200), fuerAndere: true,
  };
  const p = buildPayload(z, { ownerId: 'o-1', mitAnliegen: true, honeypot: '' });
  assert.equal(p.source, 'widget');
  assert.equal(p.owner_id, 'o-1');
  assert.equal(p.payment_type, 'gkv');
  assert.deepEqual(p.patient, { vorname: 'Erika', nachname: 'Musterfrau', geburtsdatum: '1975-04-12', telefon: '0151 1234567' });
  assert.equal(p.widget.anliegen, 'rezept');
  assert.deepEqual([p.widget.tage, p.widget.tageszeiten], [[], []]);   // flexibel gewinnt
  assert.equal(p.widget.mitteilung.length, 140);
  assert.equal(p.widget.fuerAndere, true);
  assert.equal('notizen' in p, false);
  assert.equal('preferred_date' in p, false);
  assert.equal(p.website, '');
  assert.equal(buildPayload(z, { ownerId: 'o', mitAnliegen: false }).widget.anliegen, null);
});

test('formatSlot, splitLocalIso, parseIsoDate, pollDelay', () => {
  assert.equal(formatSlot({ date: '2026-10-20', time: '09:30' }), 'Di., 20.10.2026, 09:30 Uhr');
  assert.deepEqual(splitLocalIso('2026-10-20T09:30'), { date: '2026-10-20', time: '09:30' });
  assert.equal(splitLocalIso('nope'), null);
  assert.equal(parseIsoDate('2026-02-30'), null);
  assert.deepEqual([0, 1, 2, 3, 9].map(pollDelay), [3000, 6000, 12000, 30000, 30000]);
});
