import test from 'node:test';
import assert from 'node:assert/strict';
import { ostersonntag, feiertage, feiertageZeilen, BUNDESLAENDER } from './feiertage.js';

const d = (j, l) => Object.fromEntries(feiertage(j, l).map(f => [f.name, f.datum]));

test('Ostersonntag bekannte Jahre', () => {
  assert.deepEqual(ostersonntag(2024), [3, 31]);
  assert.deepEqual(ostersonntag(2025), [4, 20]);
  assert.deepEqual(ostersonntag(2026), [4, 5]);
  assert.deepEqual(ostersonntag(2027), [3, 28]);
});

test('2026 NW: bewegliche Feiertage', () => {
  const x = d(2026, 'NW');
  assert.equal(x['Karfreitag'], '2026-04-03');
  assert.equal(x['Ostermontag'], '2026-04-06');
  assert.equal(x['Christi Himmelfahrt'], '2026-05-14');
  assert.equal(x['Pfingstmontag'], '2026-05-25');
  assert.equal(x['Fronleichnam'], '2026-06-04');
  assert.equal(x['Allerheiligen'], '2026-11-01');
  assert.equal(x['1. Weihnachtstag'], '2026-12-25');
  assert.equal(x['Buß- und Bettag'], undefined);
});

test('Buß- und Bettag nur Sachsen: 18.11.2026 und 17.11.2027', () => {
  assert.equal(d(2026, 'SN')['Buß- und Bettag'], '2026-11-18');
  assert.equal(d(2027, 'SN')['Buß- und Bettag'], '2027-11-17');
  assert.equal(d(2026, 'BY')['Buß- und Bettag'], undefined);
});

test('regionale Regeln', () => {
  assert.ok(d(2026, 'BY')['Heilige Drei Könige']);
  assert.equal(d(2026, 'NI')['Heilige Drei Könige'], undefined);
  assert.ok(d(2026, 'BE')['Internationaler Frauentag']);
  assert.ok(d(2026, 'TH')['Weltkindertag']);
  assert.ok(d(2026, 'HH')['Reformationstag']);
  assert.equal(d(2026, 'BY')['Reformationstag'], undefined);
});

test('jedes Land hat die 9 bundesweiten Feiertage; nach Datum sortiert; Kuerzel unbekannt -> []', () => {
  for (const land of Object.keys(BUNDESLAENDER)) {
    const l = feiertage(2026, land);
    const pflicht = l.filter(f => !f.optional).map(f => f.name);
    for (const n of ['Neujahr', 'Karfreitag', 'Ostermontag', 'Tag der Arbeit', 'Christi Himmelfahrt', 'Pfingstmontag', 'Tag der Deutschen Einheit', '1. Weihnachtstag', '2. Weihnachtstag']) {
      assert.ok(pflicht.includes(n), `${land} ${n}`);
    }
    assert.deepEqual(l.map(f => f.datum), [...l.map(f => f.datum)].sort());
  }
  assert.deepEqual(feiertage(2026, 'XX'), []);
});

test('Zeilen: nur ab heute, optionale nur wenn gewaehlt, ganztaegig holiday', () => {
  const basis = { ownerId: 'o1', land: 'BY', heute: '2026-11-10', jahre: [2026, 2027] };
  const z = feiertageZeilen(basis);
  assert.ok(z.every(r => r.date >= '2026-11-10' && r.type === 'holiday' && r.start_time === null && r.end_time === null && r.owner_id === 'o1'));
  assert.ok(z.some(r => r.date === '2026-12-25'));
  assert.ok(!z.some(r => /nur in Gemeinden/.test(r.note)));
  const mit = feiertageZeilen({ ...basis, optionaleNamen: ['Mariä Himmelfahrt (nur in Gemeinden mit überwiegend katholischer Bevölkerung)'] });
  assert.ok(mit.some(r => r.date === '2027-08-15'));
  assert.equal(new Set(z.map(r => r.date)).size, z.length);
});
