// Tests für die Mahnstufen-Logik.
//   node api-backend/billing/mahnwesen/stufe.test.js
import { naechsteStufe, pruefeStufe, MAX_STUFE, LEVEL_DAYS } from './stufe.js';
import { renderMahnung } from '../pdf/mahnung.template.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('mahnwesen/stufe');

// ------------------------------------------------------------ naechsteStufe
test('ohne Historie ist Stufe 1 dran', () => {
  assert.equal(naechsteStufe([]), 1);
  assert.equal(naechsteStufe(), 1);
});

test('nach Stufe 1 folgt Stufe 2', () => {
  assert.equal(naechsteStufe([{ level: 1 }]), 2);
});

test('nach Stufe 2 folgt Stufe 3', () => {
  assert.equal(naechsteStufe([{ level: 1 }, { level: 2 }]), 3);
});

test('nach Stufe 3 ist Schluss', () => {
  assert.equal(naechsteStufe([{ level: 1 }, { level: 2 }, { level: 3 }]), null);
});

test('Reihenfolge in der Historie egal — die höchste zählt', () => {
  assert.equal(naechsteStufe([{ level: 2 }, { level: 1 }]), 3);
});

test('mehrfach dieselbe Stufe schiebt nicht weiter', () => {
  assert.equal(naechsteStufe([{ level: 1 }, { level: 1 }]), 2);
});

// -------------------------------------------------------------- pruefeStufe
test('Stufe 1 als erste Mahnung ist erlaubt', () => {
  const r = pruefeStufe(1, []);
  assert.equal(r.ok, true);
  assert.equal(r.stufe, 1);
});

test('Stufe 3 als ALLERERSTE Mahnung wird abgelehnt', () => {
  // Das war der eigentliche Fehler: die "letzte Mahnung" kündigt das
  // Inkassobüro an und liess sich verschicken, ohne dass der Patient je
  // eine Zahlungserinnerung bekommen hatte.
  const r = pruefeStufe(3, []);
  assert.equal(r.ok, false);
  assert.ok(r.fehler.includes('Stufe 1'));
});

test('Stufe 2 überspringen wird abgelehnt', () => {
  const r = pruefeStufe(3, [{ level: 1 }]);
  assert.equal(r.ok, false);
  assert.ok(r.fehler.includes('Stufe 2'));
});

test('Stufe 2 nach Stufe 1 ist erlaubt', () => {
  const r = pruefeStufe(2, [{ level: 1 }]);
  assert.equal(r.ok, true);
  assert.equal(r.stufe, 2);
});

test('niedrigere Stufe wiederholen ist erlaubt', () => {
  const r = pruefeStufe(1, [{ level: 1 }]);
  assert.equal(r.ok, true, 'zweite Zahlungserinnerung muss möglich bleiben');
});

test('nach Stufe 3 wird jede weitere Mahnung abgelehnt', () => {
  const r = pruefeStufe(3, [{ level: 1 }, { level: 2 }, { level: 3 }]);
  assert.equal(r.ok, false);
  assert.ok(r.fehler.includes('letzte Mahnung'));
});

test('ungültige Stufen werden abgelehnt', () => {
  for (const bad of [0, 4, -1, 'abc', null, undefined]) {
    assert.equal(pruefeStufe(bad, []).ok, false, `Stufe ${bad}`);
  }
});

test('Stufe als String wird akzeptiert', () => {
  assert.equal(pruefeStufe('1', []).ok, true);
});

test('LEVEL_DAYS und MAX_STUFE passen zusammen', () => {
  assert.equal(MAX_STUFE, 3);
  assert.deepEqual(Object.keys(LEVEL_DAYS).map(Number), [1, 2, 3]);
});

// ------------------------------------------------- Vorlage: Forderungsart
console.log('\nmahnung template — Forderungsart');

const basis = {
  praxis:  { name: 'Praxis Müller', ik: '123456789', email: 'info@praxis.de' },
  patient: { vorname: 'Hans', nachname: 'Müller' },
  level: 1, mahnung_nr: 7, amount_eur: 35,
  original_rechnung_nr: 'AF-0003',
};

test('Zuzahlung ist weiterhin die Vorgabe', () => {
  const html = renderMahnung({ ...basis, original_rechnung_nr: 'ZU-ABC12345' });
  assert.ok(html.includes('Offene Zuzahlung'));
  assert.ok(html.includes('Ausstehender Betrag (Zuzahlung)'));
  assert.ok(html.includes('Zuzahlungsrechnung'));
});

test('Ausfall spricht nicht mehr von Zuzahlung', () => {
  const html = renderMahnung({ ...basis, forderungsart: 'ausfall' });
  assert.ok(html.includes('Offene Ausfallrechnung'));
  assert.ok(html.includes('Ausstehender Betrag (Ausfallhonorar)'));
  assert.ok(!html.includes('Zuzahlung'), 'kein Zuzahlungs-Wortlaut auf einer Privatforderung');
});

test('Ausfall zeigt keine IK-Nummer — kein GKV-Dokument', () => {
  const html = renderMahnung({ ...basis, forderungsart: 'ausfall' });
  assert.ok(!html.includes('IK-Nr.'));
  assert.ok(!html.includes('123456789'));
});

test('Zuzahlung zeigt die IK-Nummer weiterhin', () => {
  const html = renderMahnung({ ...basis, forderungsart: 'zuzahlung' });
  assert.ok(html.includes('IK-Nr.'));
  assert.ok(html.includes('123456789'));
});

test('unbekannte Forderungsart fällt auf Zuzahlung zurück', () => {
  const html = renderMahnung({ ...basis, forderungsart: 'quatsch' });
  assert.ok(html.includes('Offene Zuzahlung'));
});

test('alle drei Stufen rendern für Ausfall', () => {
  for (const level of [1, 2, 3]) {
    const html = renderMahnung({ ...basis, level, forderungsart: 'ausfall' });
    assert.ok(html.startsWith('<!DOCTYPE html>'), `Stufe ${level}`);
    assert.ok(html.includes('Ausfallhonorar'), `Stufe ${level}`);
    assert.ok(!html.includes('Zuzahlung'), `Stufe ${level} ohne Zuzahlung`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
