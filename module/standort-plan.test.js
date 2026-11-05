import test from 'node:test';
import assert from 'node:assert/strict';
import {
  musterAusZeilen, einzeltageAusZeilen, tageImZeitraum, sollZeilen, planAenderung, konflikte, standortPlanHtml, warnlisteHtml,
  MAX_VERSETZEN_TAGE, fensterAusZeilen, fensterFehler, fensterListeHtml,
} from './standort-plan.js';

const HEUTE = '2026-11-02';
const alt = [
  { id: 'w1', employee_id: 'e1', business_id: 'A', weekday: 1, datum: null },
  { id: 'w2', employee_id: 'e1', business_id: 'B', weekday: 2, datum: null },
  { id: 'd-alt', employee_id: 'e1', business_id: 'B', weekday: null, datum: '2026-10-20' },
  { id: 'd1', employee_id: 'e1', business_id: 'A', weekday: null, datum: '2026-11-10' },
];

test('Muster: nur Wochenzeilen, Schluessel weekday|standort', () => {
  assert.deepEqual([...musterAusZeilen(alt)].sort(), ['1|A', '2|B']);
  assert.equal(musterAusZeilen(null).size, 0);
});

test('Einzeltage: vergangene ausgeblendet, nach Datum sortiert, entdoppelt', () => {
  const z = [...alt, { id: 'd2', employee_id: 'e1', business_id: 'A', datum: '2026-11-05' }, { id: 'd3', employee_id: 'e1', business_id: 'A', datum: '2026-11-05' }];
  assert.deepEqual([...einzeltageAusZeilen(z, HEUTE).entries()], [['2026-11-05', ['A']], ['2026-11-10', ['A']]]);
});

test('Zeitraum: einschliesslich, ueber Monatswechsel und Zeitumstellung', () => {
  assert.deepEqual(tageImZeitraum('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepEqual(tageImZeitraum('2026-03-28', '2026-03-30'), ['2026-03-28', '2026-03-29', '2026-03-30']);
});

test('Zeitraum: ungueltig, rueckwaerts oder zu lang -> null', () => {
  assert.equal(tageImZeitraum('kaputt', '2026-11-02'), null);
  assert.equal(tageImZeitraum('2026-11-05', '2026-11-02'), null);
  assert.equal(tageImZeitraum('2026-01-01', '2026-12-31'), null);
  assert.equal(tageImZeitraum('2026-11-01', '2026-11-01').length, 1);
  assert.ok(tageImZeitraum('2026-11-01', '2027-01-01', MAX_VERSETZEN_TAGE).length <= MAX_VERSETZEN_TAGE);
});

test('Aenderung: Muster umstellen loescht alte Zeile, legt neue an, vergangene Einzeltage bleiben', () => {
  const soll = sollZeilen({ muster: new Set(['1|A', '3|B']), einzeltage: new Map([['2026-11-10', ['A']]]) }, { ownerId: 'o', empId: 'e1' });
  const { loeschen, neu } = planAenderung(alt, soll, HEUTE);
  assert.deepEqual(loeschen, ['w2']);
  assert.deepEqual(neu, [{ owner_id: 'o', employee_id: 'e1', business_id: 'B', weekday: 3, datum: null, gueltig_ab: null, von: null, bis: null }]);
});

test('Aenderung: unveraendert -> nichts zu tun', () => {
  const soll = sollZeilen({ muster: musterAusZeilen(alt), einzeltage: einzeltageAusZeilen(alt, HEUTE) }, { ownerId: 'o', empId: 'e1' });
  assert.deepEqual(planAenderung(alt, soll, HEUTE), { loeschen: [], neu: [], aendern: [] });
});

test('Aenderung: Einzeltag entfernen loescht genau diese Zeile', () => {
  const soll = sollZeilen({ muster: musterAusZeilen(alt), einzeltage: new Map() }, { ownerId: 'o', empId: 'e1' });
  assert.deepEqual(planAenderung(alt, soll, HEUTE).loeschen, ['d1']);
});

test('Konflikte: Montag A geplant, Termin Montag in B -> Warnung; ohne Standort, Hausbesuch, abgesagt nie', () => {
  const plan = [{ employee_id: 'e1', business_id: 'A', weekday: 1, datum: null }];
  const termine = [
    { id: 't1', start_time: '2026-11-09T09:00:00Z', business_id: 'B' },
    { id: 't2', start_time: '2026-11-09T10:00:00Z', business_id: 'A' },
    { id: 't3', start_time: '2026-11-09T11:00:00Z', business_id: null },
    { id: 't4', start_time: '2026-11-09T12:00:00Z', business_id: 'B', hausbesuch: true },
    { id: 't5', start_time: '2026-11-09T13:00:00Z', business_id: 'B', status: 'cancelled' },
    { id: 't6', start_time: '2026-11-10T09:00:00Z', business_id: 'B' },
  ];
  assert.deepEqual(konflikte(termine, plan, 'e1', ['A', 'B']).map(t => t.id), ['t1']);
});

test('Konflikte: Termin 00:30 Berlin zaehlt zum Berliner Tag, nicht zum UTC-Vortag', () => {
  const plan = [{ employee_id: 'e1', business_id: 'A', weekday: 1, datum: null }];
  // Montag 09.11.2026 00:30 Berlin = Sonntag 08.11. 23:30 UTC
  const t = [{ id: 'n', start_time: '2026-11-08T23:30:00Z', business_id: 'B' }];
  assert.deepEqual(konflikte(t, plan, 'e1', ['A', 'B']).map(x => x.id), ['n']);
});

test('Konflikte: Einzeltag gewinnt gegen Wochenmuster', () => {
  const plan = [{ employee_id: 'e1', business_id: 'A', weekday: 1, datum: null }, { employee_id: 'e1', business_id: 'B', weekday: null, datum: '2026-11-09' }];
  const t = [{ id: 'a', start_time: '2026-11-09T09:00:00Z', business_id: 'A' }, { id: 'b', start_time: '2026-11-09T10:00:00Z', business_id: 'B' }];
  assert.deepEqual(konflikte(t, plan, 'e1', ['A', 'B']).map(x => x.id), ['a']);
});

test('HTML: Haekchen gesetzt, Standortnamen escaped, Hinweis zur Regel', () => {
  const html = standortPlanHtml({
    standorte: [{ id: 'A', business_name: 'Praxis <A>' }, { id: 'B', business_name: 'Praxis B' }],
    muster: new Set(['1|A']), einzeltage: new Map([['2026-11-10', ['B']]]), heute: HEUTE,
  });
  assert.match(html, /data-weekday="1" data-standort="A"[\s\S]*?checked/);
  assert.ok(!html.includes('<A>'));
  assert.match(html, /Ein Tag ohne Häkchen: wie bisher an allen Standorten/);
  assert.match(html, /data-datum="2026-11-10"/);
});

test('Warnliste: leer ohne Konflikt, sonst Patient, Leistung, gebuchter Standort, escaped', () => {
  assert.equal(warnlisteHtml([], () => ''), '');
  const html = warnlisteHtml([{ id: 'x', start_time: '2026-11-09T09:00:00Z', customer_name: 'Muster <b>', business_id: 'B', services: { title: 'KG' } }], () => 'Praxis B');
  assert.match(html, /1 Termin liegt danach am falschen Standort/);
  assert.match(html, /gebucht: Praxis B/);
  assert.match(html, /KG/);
  assert.ok(!html.includes('<b>'));
});

// ── Versionen „gilt ab" (0098) ───────────────────────────────────────────────
import { aktuelleVersion, kuenftigeVersionen, planNachher, naechsterTag, musterText } from './standort-plan.js';

const versioniert = [
  { id: 'v0', employee_id: 'e1', business_id: 'A', weekday: 1, datum: null, gueltig_ab: null },
  { id: 'v1', employee_id: 'e1', business_id: 'B', weekday: 1, datum: null, gueltig_ab: '2026-10-01' },
  { id: 'v2', employee_id: 'e1', business_id: 'A', weekday: 3, datum: null, gueltig_ab: '2027-01-05' },
];

test('Versionen: aktuelle = groesstes gueltig_ab <= heute, kuenftige aufsteigend', () => {
  assert.equal(aktuelleVersion(versioniert, HEUTE), '2026-10-01');
  assert.equal(aktuelleVersion(versioniert.slice(0, 1), HEUTE), null);
  assert.equal(aktuelleVersion([], HEUTE), undefined);
  assert.deepEqual(kuenftigeVersionen(versioniert, HEUTE), ['2027-01-05']);
  assert.deepEqual([...musterAusZeilen(versioniert, '2026-10-01')], ['1|B']);
});

test('Versionen: geplante Umstellung aendert nur ihre Version, heutiges Muster bleibt', () => {
  const soll = sollZeilen({ muster: new Set(['3|B']), einzeltage: new Map() }, { ownerId: 'o', empId: 'e1' }, '2027-01-05');
  const { loeschen, neu } = planAenderung(versioniert, soll, HEUTE, { version: '2027-01-05' });
  assert.deepEqual(loeschen, ['v2']);
  assert.deepEqual(neu.map(z => [z.weekday, z.business_id, z.gueltig_ab]), [[3, 'B', '2027-01-05']]);
});

test('Versionen: aktuelle Version leer speichern raeumt abgeloeste alte mit ab (keine Wiederauferstehung)', () => {
  const soll = sollZeilen({ muster: new Set(), einzeltage: new Map() }, { ownerId: 'o', empId: 'e1' }, '2026-10-01');
  const { loeschen } = planAenderung(versioniert, soll, HEUTE, { version: '2026-10-01', aufraeumen: true });
  assert.deepEqual(loeschen.sort(), ['v0', 'v1']);
});

test('Versionen: Umstellung entfernen loescht nur deren Zeilen; planNachher fuer die Warnliste', () => {
  const soll = sollZeilen({ muster: musterAusZeilen(versioniert, '2026-10-01'), einzeltage: new Map() }, { ownerId: 'o', empId: 'e1' }, '2026-10-01');
  const aend = planAenderung(versioniert, soll, HEUTE, { version: '2026-10-01', entfernteVersionen: ['2027-01-05'] });
  assert.deepEqual(aend.loeschen, ['v2']);
  assert.deepEqual(planNachher(versioniert, aend).map(z => z.id), ['v0', 'v1']);
});

test('Versionen: Warnliste sieht kuenftige Version (Termin nach Stichtag am alten Standort)', () => {
  const nachher = [...versioniert.slice(0, 2), { employee_id: 'e1', business_id: 'A', weekday: 1, datum: null, gueltig_ab: '2027-01-05' }];
  const t = [{ id: 'vor', start_time: '2026-12-28T09:00:00Z', business_id: 'B' }, { id: 'nach', start_time: '2027-01-11T09:00:00Z', business_id: 'B' }];
  assert.deepEqual(konflikte(t, nachher, 'e1', ['A', 'B']).map(x => x.id), ['nach']);
});

test('Helfer: naechsterTag ueber Jahreswechsel, musterText', () => {
  assert.equal(naechsterTag('2026-12-31'), '2027-01-01');
  assert.equal(naechsterTag('kaputt'), '');
  assert.equal(musterText(new Set(['3|B', '1|A']), id => ({ A: 'Nord', B: 'Süd' })[id]), 'Mo Nord · Mi Süd');
  assert.equal(musterText(new Set(), () => ''), 'kein Muster (alle Standorte)');
});

// ── Zeitfenster (0109) ──────────────────────────────────────────────────────
const mitFenster = [
  { id: 'f1', employee_id: 'e1', business_id: 'A', weekday: 1, datum: null, von: '08:00:00', bis: '12:00:00' },
  { id: 'f2', employee_id: 'e1', business_id: 'B', weekday: 1, datum: null, von: '14:00:00', bis: '18:00:00' },
  { id: 'f3', employee_id: 'e1', business_id: 'A', weekday: 2, datum: null, von: null, bis: null },
];

test('Fenster: aus Zeilen lesen, ganzer Tag ohne Eintrag', () => {
  const f = fensterAusZeilen(mitFenster);
  assert.deepEqual(f.get('1|A'), { von: '08:00', bis: '12:00' });
  assert.deepEqual(f.get('1|B'), { von: '14:00', bis: '18:00' });
  assert.equal(f.has('2|A'), false);
});

test('Fenster: nur Uhrzeit geändert -> UPDATE derselben Zeile, kein Insert (UNIQUE)', () => {
  const fenster = fensterAusZeilen(mitFenster);
  fenster.set('1|A', { von: '07:30', bis: '12:30' });
  const soll = sollZeilen({ muster: musterAusZeilen(mitFenster), fenster, einzeltage: new Map() }, { ownerId: 'o', empId: 'e1' });
  const aenderung = planAenderung(mitFenster, soll, HEUTE);
  assert.deepEqual(aenderung.neu, []);
  assert.deepEqual(aenderung.loeschen, []);
  assert.deepEqual(aenderung.aendern, [{ id: 'f1', von: '07:30', bis: '12:30' }]);
  assert.equal(planNachher(mitFenster, aenderung).find(z => z.id === 'f1').von, '07:30');
});

test('Fenster: Uhrzeit leeren -> ganzer Tag (UPDATE auf null)', () => {
  const soll = sollZeilen({ muster: musterAusZeilen(mitFenster), fenster: new Map([['1|B', { von: '14:00', bis: '18:00' }]]), einzeltage: new Map() }, { ownerId: 'o', empId: 'e1' });
  assert.deepEqual(planAenderung(mitFenster, soll, HEUTE).aendern, [{ id: 'f1', von: null, bis: null }]);
});

test('Fenster: Prüfung halb leer / rückwärts', () => {
  assert.equal(fensterFehler(new Map([['1|A', { von: '', bis: '' }]])), null);
  assert.match(fensterFehler(new Map([['1|A', { von: '08:00', bis: '' }]])), /Beginn und Ende/);
  assert.match(fensterFehler(new Map([['1|A', { von: '12:00', bis: '08:00' }]])), /vor dem Ende/);
  assert.equal(fensterFehler(new Map([['1|A', { von: '08:00', bis: '12:00' }]])), null);
});

test('Konflikte: Termin Mo 15:00 an A liegt außerhalb des Vormittagsfensters', () => {
  const termine = [
    { id: 'in', start_time: '2026-11-09T09:00:00+01:00', end_time: '2026-11-09T09:30:00+01:00', business_id: 'A' },
    { id: 'aus', start_time: '2026-11-09T15:00:00+01:00', end_time: '2026-11-09T15:30:00+01:00', business_id: 'A' },
    { id: 'rand', start_time: '2026-11-09T11:40:00+01:00', end_time: '2026-11-09T12:10:00+01:00', business_id: 'A' },
    { id: 'b', start_time: '2026-11-09T15:00:00+01:00', end_time: '2026-11-09T15:30:00+01:00', business_id: 'B' },
    { id: 'di', start_time: '2026-11-10T17:00:00+01:00', end_time: '2026-11-10T17:30:00+01:00', business_id: 'A' },
  ];
  assert.deepEqual(konflikte(termine, mitFenster, 'e1', ['A', 'B']).map(t => t.id), ['aus', 'rand']);
});

test('Fenster-Liste: je Häkchen zwei Zeitfelder, escaped, sonst Hinweis', () => {
  const standorte = [{ id: 'A', business_name: 'Nord <b>' }, { id: 'B', business_name: 'Süd' }];
  const html = fensterListeHtml({ standorte, muster: new Set(['1|A']), fenster: new Map([['1|A', { von: '08:00', bis: '12:00' }]]) });
  assert.match(html, /class="form-input sp-von" data-key="1\|A" value="08:00"/);
  assert.match(html, /Mo Nord &lt;b&gt;/);
  assert.match(fensterListeHtml({ standorte, muster: new Set(), fenster: new Map() }), /Erst Häkchen/);
});
