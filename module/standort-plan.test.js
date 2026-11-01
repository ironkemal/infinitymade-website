import test from 'node:test';
import assert from 'node:assert/strict';
import {
  musterAusZeilen, einzeltageAusZeilen, tageImZeitraum, sollZeilen, planAenderung, konflikte, standortPlanHtml, warnlisteHtml,
  MAX_VERSETZEN_TAGE,
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
  assert.deepEqual(neu, [{ owner_id: 'o', employee_id: 'e1', business_id: 'B', weekday: 3, datum: null }]);
});

test('Aenderung: unveraendert -> nichts zu tun', () => {
  const soll = sollZeilen({ muster: musterAusZeilen(alt), einzeltage: einzeltageAusZeilen(alt, HEUTE) }, { ownerId: 'o', empId: 'e1' });
  assert.deepEqual(planAenderung(alt, soll, HEUTE), { loeschen: [], neu: [] });
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
