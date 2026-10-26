import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berlinHeute, istStichtag, jahresendePlus, berlinTagesgrenzen, berlinMonatsgrenzen } from './berlin-tag.js';

test('berlinHeute: kurz nach Mitternacht Berliner Zeit ist UTC noch am Vortag (Sommerzeit)', () => {
  // 30.09.2026 22:30 UTC = 01.10.2026 00:30 MESZ
  assert.equal(berlinHeute(new Date('2026-09-30T22:30:00Z')), '2026-10-01');
  assert.equal(berlinHeute(new Date('2026-09-30T21:59:59Z')), '2026-09-30');
});

test('berlinHeute: Winterzeit — 23:30 UTC ist schon der nächste Berliner Tag', () => {
  assert.equal(berlinHeute(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
});

test('istStichtag: nur echte Kalendertage im Format YYYY-MM-DD', () => {
  assert.equal(istStichtag('2026-10-01'), true);
  assert.equal(istStichtag('2026-02-30'), false);
  assert.equal(istStichtag('2026-13-01'), false);
  assert.equal(istStichtag('20261001'), false);
  assert.equal(istStichtag(null), false);
  assert.equal(istStichtag(undefined), false);
});

test('jahresendePlus: addiert Jahre auf das Berliner Jahr und liefert YYYY-12-31', () => {
  const d = new Date('2026-10-02T10:00:00Z');
  assert.equal(jahresendePlus(10, d), '2036-12-31');
  assert.equal(jahresendePlus(8, d), '2034-12-31');
  assert.equal(jahresendePlus(6, d), '2032-12-31');
  assert.equal(jahresendePlus(0, d), '2026-12-31');
  // Silvester kurz vor Mitternacht Berliner Zeit
  assert.equal(jahresendePlus(10, new Date('2026-12-31T22:00:00Z')), '2036-12-31');
  // 23:30 UTC an Silvester ist bereits Neujahr Berliner Zeit
  assert.equal(jahresendePlus(10, new Date('2026-12-31T23:30:00Z')), '2037-12-31');
});


test('berlinTagesgrenzen: DST, Schaltjahr, Jahreswechsel und ungültige Werte', () => {
  assert.deepEqual(berlinTagesgrenzen('2026-03-29'), { tag: '2026-03-29', von: '2026-03-28T23:00:00.000Z', bisExklusiv: '2026-03-29T22:00:00.000Z' });
  assert.deepEqual(berlinTagesgrenzen('2026-10-25'), { tag: '2026-10-25', von: '2026-10-24T22:00:00.000Z', bisExklusiv: '2026-10-25T23:00:00.000Z' });
  assert.equal(berlinTagesgrenzen('2028-02-29').bisExklusiv, '2028-02-29T23:00:00.000Z');
  assert.equal(berlinTagesgrenzen('2026-12-31').bisExklusiv, '2026-12-31T23:00:00.000Z');
  for (const value of ['2026-02-29', '2026-02-30', '2026-13-01', '0000-01-01', null, [], '']) assert.equal(berlinTagesgrenzen(value), null);
});

test('berlinMonatsgrenzen: März 2026 enthält wegen Sommerzeitbeginn 743 Stunden', () => {
  const grenzen = berlinMonatsgrenzen(new Date('2026-03-15T12:00:00Z'));
  assert.deepEqual(grenzen, {
    monat: '2026-03', von: '2026-02-28T23:00:00.000Z', bisExklusiv: '2026-03-31T22:00:00.000Z',
  });
  assert.equal((Date.parse(grenzen.bisExklusiv) - Date.parse(grenzen.von)) / 3_600_000, 743);
});

test('berlinMonatsgrenzen: Oktober 2026 enthält wegen Winterzeitbeginn 745 Stunden', () => {
  const grenzen = berlinMonatsgrenzen(new Date('2026-10-15T12:00:00Z'));
  assert.deepEqual(grenzen, {
    monat: '2026-10', von: '2026-09-30T22:00:00.000Z', bisExklusiv: '2026-10-31T23:00:00.000Z',
  });
  assert.equal((Date.parse(grenzen.bisExklusiv) - Date.parse(grenzen.von)) / 3_600_000, 745);
});

test('berlinMonatsgrenzen: Februar 2028 schließt Schalttag vollständig ein', () => {
  assert.deepEqual(berlinMonatsgrenzen(new Date('2028-02-29T12:00:00Z')), {
    monat: '2028-02', von: '2028-01-31T23:00:00.000Z', bisExklusiv: '2028-02-29T23:00:00.000Z',
  });
});

test('berlinMonatsgrenzen: Winter-Monatswechsel direkt vor und auf Berliner Mitternacht', () => {
  assert.deepEqual(berlinMonatsgrenzen(new Date('2026-01-31T22:59:59.999Z')), {
    monat: '2026-01', von: '2025-12-31T23:00:00.000Z', bisExklusiv: '2026-01-31T23:00:00.000Z',
  });
  assert.deepEqual(berlinMonatsgrenzen(new Date('2026-01-31T23:00:00.000Z')), {
    monat: '2026-02', von: '2026-01-31T23:00:00.000Z', bisExklusiv: '2026-02-28T23:00:00.000Z',
  });
});

test('berlinMonatsgrenzen: Sommer-Monatswechsel direkt vor und auf Berliner Mitternacht', () => {
  assert.deepEqual(berlinMonatsgrenzen(new Date('2026-07-31T21:59:59.999Z')), {
    monat: '2026-07', von: '2026-06-30T22:00:00.000Z', bisExklusiv: '2026-07-31T22:00:00.000Z',
  });
  assert.deepEqual(berlinMonatsgrenzen(new Date('2026-07-31T22:00:00.000Z')), {
    monat: '2026-08', von: '2026-07-31T22:00:00.000Z', bisExklusiv: '2026-08-31T22:00:00.000Z',
  });
});

test('berlinMonatsgrenzen: DST-Monatsende ist exklusiv und gehört bereits zum Folgemonat', () => {
  for (const [vorher, grenze, alterMonat, neuerMonat] of [
    ['2026-03-31T21:59:59.999Z', '2026-03-31T22:00:00.000Z', '2026-03', '2026-04'],
    ['2026-10-31T22:59:59.999Z', '2026-10-31T23:00:00.000Z', '2026-10', '2026-11'],
  ]) {
    const davor = berlinMonatsgrenzen(new Date(vorher));
    const danach = berlinMonatsgrenzen(new Date(grenze));
    assert.equal(davor.monat, alterMonat);
    assert.equal(davor.bisExklusiv, grenze);
    assert.equal(danach.monat, neuerMonat);
    assert.equal(danach.von, grenze);
  }
});

test('berlinMonatsgrenzen: Dezember rollt ins Folgejahr und Silvester 23:30 UTC ist Januar', () => {
  assert.deepEqual(berlinMonatsgrenzen(new Date('2026-12-31T22:59:59.999Z')), {
    monat: '2026-12', von: '2026-11-30T23:00:00.000Z', bisExklusiv: '2026-12-31T23:00:00.000Z',
  });
  assert.deepEqual(berlinMonatsgrenzen(new Date('2026-12-31T23:30:00Z')), {
    monat: '2027-01', von: '2026-12-31T23:00:00.000Z', bisExklusiv: '2027-01-31T23:00:00.000Z',
  });
});

test('berlinMonatsgrenzen: ungültige Daten und falsche Typen liefern null ohne Throw', () => {
  for (const value of [new Date(''), new Date('ungueltig'), new Date(NaN), null, '', '2026-03-01', 0, NaN, true, [], {}, Symbol('datum'), 1n]) {
    assert.doesNotThrow(() => assert.equal(berlinMonatsgrenzen(value), null));
  }
});
