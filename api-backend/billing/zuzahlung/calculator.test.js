// node api-backend/billing/zuzahlung/calculator.test.js
import {
  calcSessionZuzahlung,
  calcAbrechnungsfallZuzahlung,
  resolvePositionZuzahlung,
  isUnter18,
  isBefreit,
} from './calculator.js';
import { findPosition } from '../codes/physio_positions.js';
import { findPodologiePosition } from '../codes/podologie_positions.js';
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

// ── resolvePositionZuzahlung: die drei Katalog-Zustände ────────────────────
// Vorher wurden alle drei mit `pos?.zuzahlung ?? preis * 0.10` in denselben
// 10-%-Fall gekippt — zuzahlungsfreie Positionen wurden dem Patienten belastet.

test('resolvePositionZuzahlung: Position mit Betrag → dieser Betrag', () => {
  const r = resolvePositionZuzahlung({ preis: 30.00, zuzahlung: 3.00 }, 30.00);
  assert.equal(r.zuzahlungUnit, 3.00);
  assert.equal(r.positionFrei, false);
  assert.equal(r.gefunden, true);
});

test('resolvePositionZuzahlung: zuzahlung null → zuzahlungsfrei, nicht 10 %', () => {
  const r = resolvePositionZuzahlung({ preis: 58.83, zuzahlung: null }, 58.83);
  assert.equal(r.zuzahlungUnit, 0);
  assert.equal(r.positionFrei, true);
  assert.equal(r.gefunden, true);
});

test('resolvePositionZuzahlung: Position unbekannt → 10 % als Ersatzwert', () => {
  const r = resolvePositionZuzahlung(null, 30.00);
  assert.equal(r.zuzahlungUnit, 3.00);
  assert.equal(r.positionFrei, false);
  assert.equal(r.gefunden, false);
});

test('resolvePositionZuzahlung: rundet kaufmaennisch auf 2 Stellen', () => {
  assert.equal(resolvePositionZuzahlung(null, 58.83).zuzahlungUnit, 5.88);
  assert.equal(resolvePositionZuzahlung({ preis: 1, zuzahlung: 2.345 }, 1).zuzahlungUnit, 2.35);
});

test('KG-ZNS Kinder X0708 ist im Katalog zuzahlungsfrei', () => {
  const pos = findPosition('X0708', '22');
  assert.ok(pos, 'X0708 muss im Physio-Katalog stehen');
  assert.equal(resolvePositionZuzahlung(pos, pos.preis).positionFrei, true);
});

test('Therapiebericht X1906 und Uebermittlungsgebuehr X9701 sind zuzahlungsfrei', () => {
  for (const code of ['X1906', 'X9701']) {
    const pos = findPosition(code, '22');
    assert.ok(pos, `${code} muss im Physio-Katalog stehen`);
    assert.equal(resolvePositionZuzahlung(pos, pos.preis).positionFrei, true, `${code} sollte frei sein`);
  }
});

test('Normale Physio-Position X0501 ist NICHT zuzahlungsfrei', () => {
  const pos = findPosition('X0501', '22');
  assert.ok(pos, 'X0501 muss im Physio-Katalog stehen');
  const r = resolvePositionZuzahlung(pos, pos.preis);
  assert.equal(r.positionFrei, false);
  assert.ok(r.zuzahlungUnit > 0);
});

test('Podologie 78530 (Therapiebericht UI2) ist zuzahlungsfrei', () => {
  const pos = findPodologiePosition('78530', '2026-01-15');
  assert.ok(pos, '78530 muss im Podologie-Katalog stehen');
  assert.equal(resolvePositionZuzahlung(pos, pos.preis).positionFrei, true);
});

test('Podologie 78010 traegt eine Zuzahlung', () => {
  const pos = findPodologiePosition('78010', '2026-01-15');
  assert.ok(pos, '78010 muss im Podologie-Katalog stehen');
  const r = resolvePositionZuzahlung(pos, pos.preis);
  assert.equal(r.positionFrei, false);
  assert.equal(r.zuzahlungUnit, 3.52);
});

test('zuzahlungsfreie Position: weder Prozente noch die 10-Euro-Pauschale', () => {
  const pos = findPosition('X1906', '22');
  const { zuzahlungUnit, positionFrei } = resolvePositionZuzahlung(pos, pos.preis);
  const totals = calcAbrechnungsfallZuzahlung({
    sessions: [{ preis_eur: pos.preis, zuzahlung_eur_position: positionFrei ? 0 : zuzahlungUnit, position_frei: positionFrei }],
    patient: { geburtsdatum: '1980-01-01', befreit_im_jahr: false },
    behandlungsende: '2026-06-01',
    verordnung_zuzahlungsfrei: positionFrei,
  });
  assert.equal(totals.prozZuzahlung, 0, 'keine prozentuale Zuzahlung');
  assert.equal(totals.pauschZuzahlung, 0, 'keine Verordnungspauschale');
  assert.equal(totals.gesZuzahlung, 0);
  assert.equal(totals.netto, totals.brutto);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
