// Tests für den Leistungserbringergruppenschlüssel (LEGS).
//   node api-backend/billing/codes/legs.test.js
//
// Die erwarteten Werte stehen NICHT hier zur Diskussion — sie sind aus den
// §125-Verträgen abgeschrieben. Fundstellen im Kopf von legs.js.

import {
  legsFuer, LE_STATUS, GUELTIGE_LEGS, istGueltigerLegs,
  abrechnungscodeAusLegs, tarifkennzeichenAusLegs,
} from './legs.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('legs');

// ── Regelfall je Fachbereich (ZL ohne weitere Angabe) ──────────────────────

test('Podologie ZL → 7100501', () =>
  assert.equal(legsFuer('podologie'), '7100501'));

test('Physio ZL → 2200501 (Physiotherapeut, nicht Masseur)', () =>
  assert.equal(legsFuer('physiotherapy'), '2200501'));

test('Ergo ZL → 2600501', () =>
  assert.equal(legsFuer('ergotherapie'), '2600501'));

test('Logopädie ZL → 2300501', () =>
  assert.equal(legsFuer('logopaedie'), '2300501'));

// ── Qualifikationsvarianten ────────────────────────────────────────────────

test('Podologie med. Fußpfleger → 7200501', () =>
  assert.equal(legsFuer('podologie', { qualifikation: 'med_fusspfleger' }), '7200501'));

test('Physio Masseur → 2100501', () =>
  assert.equal(legsFuer('physiotherapy', { qualifikation: 'masseur' }), '2100501'));

test('Logopädie Sprachtherapie → 2400501', () =>
  assert.equal(legsFuer('logopaedie', { qualifikation: 'sprachtherapie' }), '2400501'));

test('Logopädie Atem/Stimme → 2500501', () =>
  assert.equal(legsFuer('logopaedie', { qualifikation: 'atem_stimme' }), '2500501'));

// ── § 124 Abs. 5 — Sondertarif je Fachbereich verschieden ──────────────────

test('Physio KH → 2700511', () =>
  assert.equal(legsFuer('physiotherapy', { status: LE_STATUS.KH }), '2700511'));

test('Ergo KH → 2700531 (anderer Sondertarif als Physio)', () =>
  assert.equal(legsFuer('ergotherapie', { status: LE_STATUS.KH }), '2700531'));

test('Podologie KH → 2700541 (wieder anderer)', () =>
  assert.equal(legsFuer('podologie', { status: LE_STATUS.KH }), '2700541'));

test('Podologie Kur → 2800541', () =>
  assert.equal(legsFuer('podologie', { status: LE_STATUS.KUR }), '2800541'));

// ── Vertraglich nicht vorgesehene Kombinationen müssen scheitern ───────────

test('Logopädie kennt kein KH — wirft', () =>
  assert.throws(() => legsFuer('logopaedie', { status: LE_STATUS.KH }),
    /vertraglich nicht vorgesehen/));

test('Podologie kennt kein SON — wirft', () =>
  assert.throws(() => legsFuer('podologie', { status: LE_STATUS.SON }),
    /vertraglich nicht vorgesehen/));

test('unbekannter Fachbereich wirft', () =>
  assert.throws(() => legsFuer('kosmetik'), /Unbekannter Fachbereich/));

test('unbekannte Qualifikation wirft', () =>
  assert.throws(() => legsFuer('podologie', { qualifikation: 'fusspflege_kosmetisch' }),
    /Unbekannte Qualifikation/));

// ── Struktur: alles ist bundeseinheitlich ('00' an Stelle 3–4) ────────────

test('jeder LEGS ist 7-stellig numerisch', () => {
  for (const l of GUELTIGE_LEGS) assert.match(l, /^\d{7}$/, `${l} ist nicht 7-stellig`);
});

test('Tarifbereich ist überall 00 (bundeseinheitlich)', () => {
  for (const l of GUELTIGE_LEGS) {
    assert.equal(l.slice(2, 4), '00', `${l} hat Tarifbereich ${l.slice(2, 4)} statt 00`);
  }
});

test('Sondertarif ist immer 501/511/531/541', () => {
  for (const l of GUELTIGE_LEGS) {
    assert.ok(['501', '511', '531', '541'].includes(l.slice(4)),
      `${l} hat unerwarteten Sondertarif ${l.slice(4)}`);
  }
});

// ── Zerlegung ──────────────────────────────────────────────────────────────

test('Abrechnungscode aus LEGS', () =>
  assert.equal(abrechnungscodeAusLegs('7100501'), '71'));

test('Tarifkennzeichen aus LEGS', () =>
  assert.equal(tarifkennzeichenAusLegs('7100501'), '00501'));

// ── Die Regression, die diese Datei ausgelöst hat ─────────────────────────

test('REGRESSION: 7108000 (aus PLZ abgeleitet) ist KEIN gültiger LEGS', () =>
  assert.equal(istGueltigerLegs('7108000'), false));

test('REGRESSION: 2208000 (Physio aus PLZ) ist KEIN gültiger LEGS', () =>
  assert.equal(istGueltigerLegs('2208000'), false));

test('kein gültiger LEGS endet auf 000', () => {
  for (const l of GUELTIGE_LEGS) assert.notEqual(l.slice(4), '000');
});

test('7100501 ist gültig', () =>
  assert.equal(istGueltigerLegs('7100501'), true));

// ── Vollständigkeit ───────────────────────────────────────────────────────

test('13 vertragliche LEGS insgesamt', () => {
  // Physio 2 ZL + 3 (511) · Ergo 1 + 3 (531) · Logo 3 · Podo 2 + 2 (541)
  // 2700511/2800511/2900511, 2700531/2800531/2900531, 2700541/2800541
  assert.equal(GUELTIGE_LEGS.length, 16);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
