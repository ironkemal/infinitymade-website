// node api-backend/billing/zuzahlung/calculator.test.js
import {
  calcSessionZuzahlung,
  calcAbrechnungsfallZuzahlung,
  isUnter18,
  isBefreit,
} from './calculator.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('session zuzahlung');
test('uses explicit per-position Zuzahlung', () => {
  assert.equal(calcSessionZuzahlung({ preis_eur: 29.63, zuzahlung_eur_position: 2.96 }), 2.96);
});
test('fallback 10% wenn position-Zuzahlung null', () => {
  assert.equal(calcSessionZuzahlung({ preis_eur: 22.50, zuzahlung_eur_position: null }), 2.25);
});
test('frei position → 0', () => {
  assert.equal(calcSessionZuzahlung({ preis_eur: 58.83, zuzahlung_eur_position: null, position_frei: true }), 0);
});

console.log('abrechnungsfall');
test('6×KG mit Zuzahlung → brutto 177.78, prozZ 17.78, pausch 10€, ges 27.78', () => {
  const t = calcAbrechnungsfallZuzahlung({
    sessions: Array.from({length:6}, () => ({ preis_eur:29.63, zuzahlung_eur_position:2.96 })),
    patient:  { geburtsdatum: '1980-01-01', befreit_im_jahr: false },
    behandlungsende: '2026-05-18',
  });
  assert.equal(t.brutto, 177.78);
  assert.equal(t.prozZuzahlung, 17.76);
  assert.equal(t.pauschZuzahlung, 10.00);
  assert.equal(t.gesZuzahlung, 27.76);
  assert.equal(t.netto, 150.02);
  assert.equal(t.befreiungsgrund, null);
});

test('Kind unter 18 → keine Zuzahlung', () => {
  const t = calcAbrechnungsfallZuzahlung({
    sessions: [{ preis_eur:22.50, zuzahlung_eur_position:2.25 }],
    patient:  { geburtsdatum: '2020-04-01', befreit_im_jahr: false },
    behandlungsende: '2026-05-18',
  });
  assert.equal(t.gesZuzahlung, 0);
  assert.equal(t.befreiungsgrund, 'unter_18');
});

test('Befreiungsausweis → keine Zuzahlung, befreiungsgrund gesetzt', () => {
  const t = calcAbrechnungsfallZuzahlung({
    sessions: [{ preis_eur:22.50, zuzahlung_eur_position:2.25 }],
    patient:  { geburtsdatum: '1960-01-01', befreit_im_jahr: true },
    behandlungsende: '2026-05-18',
  });
  assert.equal(t.gesZuzahlung, 0);
  assert.equal(t.befreiungsgrund, 'befreiungsausweis');
});

test('Verordnung-zuzahlungsfrei (ZuzahlungsKZ 4/5) → keine Zuzahlung', () => {
  const t = calcAbrechnungsfallZuzahlung({
    sessions: [{ preis_eur:22.50, zuzahlung_eur_position:2.25 }],
    patient:  { geburtsdatum: '1960-01-01' },
    behandlungsende: '2026-05-18',
    verordnung_zuzahlungsfrei: true,
  });
  assert.equal(t.gesZuzahlung, 0);
  assert.equal(t.befreiungsgrund, 'verordnung');
});

test('kleine Brutto (3€) → Pauschale capped', () => {
  const t = calcAbrechnungsfallZuzahlung({
    sessions: [{ preis_eur:3.00, zuzahlung_eur_position:0.30 }],
    patient:  { geburtsdatum: '1960-01-01' },
    behandlungsende: '2026-05-18',
  });
  assert.equal(t.brutto, 3.00);
  assert.equal(t.prozZuzahlung, 0.30);
  assert.equal(t.pauschZuzahlung, 2.70);    // capped at brutto-prozZ
  assert.equal(t.gesZuzahlung, 3.00);
  assert.equal(t.netto, 0);
});

console.log('helpers');
test('isUnter18: 15-jährig am Stichtag', () => {
  assert.equal(isUnter18('2011-01-01', '2026-05-18'), true);
});
test('isUnter18: 18 am Geburtstag', () => {
  assert.equal(isUnter18('2008-05-18', '2026-05-18'), false);
});
test('isBefreit: aktive Befreiung im Jahr', () => {
  const b = [{ jahr: 2026, befreit_ab: '2026-03-01', befreit_bis: null }];
  assert.equal(isBefreit(b, 2026, '2026-05-18'), true);
});
test('isBefreit: befreit_ab in Zukunft → false', () => {
  const b = [{ jahr: 2026, befreit_ab: '2026-12-01', befreit_bis: null }];
  assert.equal(isBefreit(b, 2026, '2026-05-18'), false);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
