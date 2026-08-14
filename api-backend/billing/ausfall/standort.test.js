// node api-backend/billing/ausfall/standort.test.js
import { standortFuerName, standortFuerZuordnung } from './standort.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('Ausfallrechnung — Herkunft des Praxisnamens');

const einzel = [{ id: 'b1', business_name: 'Fußpflege Alt', is_default: true }];
const mehrere = [
  { id: 'b1', business_name: 'Standort Siegburg', is_default: true },
  { id: 'b2', business_name: 'Standort Bonn' },
];

// Der eigentliche Fehlerfall aus dem Meeting: Einzelpraxis, Name in den
// Einstellungen geändert, businesses-Eintrag noch auf dem alten Namen.
test('Einzelpraxis → Name kommt NICHT vom businesses-Eintrag', () => {
  assert.equal(standortFuerName(einzel, 'b1'), null);
});
test('Einzelpraxis ohne business_id am Termin → ebenfalls null', () => {
  assert.equal(standortFuerName(einzel, null), null);
});
test('gar keine businesses-Zeile → null', () => {
  assert.equal(standortFuerName([], 'b1'), null);
  assert.equal(standortFuerName(null, null), null);
});

// Mehrere Standorte: dort bedeutet der Standortname wirklich etwas.
test('mehrere Standorte + Termin am Standort → Standortname gewinnt', () => {
  assert.equal(standortFuerName(mehrere, 'b2')?.business_name, 'Standort Bonn');
});
test('mehrere Standorte, Termin ohne Standort → Inhaberprofil', () => {
  assert.equal(standortFuerName(mehrere, null), null);
});
test('unbekannte business_id → Inhaberprofil statt falschem Namen', () => {
  assert.equal(standortFuerName(mehrere, 'b99'), null);
});

// Die Zuordnung (Hinweistext, business_id in der Zeile) folgt der alten Regel
// und bleibt unverändert — sonst wanderten bestehende Rechnungen auf einen
// anderen Standort.
console.log('Zuordnung (unverändert)');
test('nimmt den Standort des Termins', () => {
  assert.equal(standortFuerZuordnung(mehrere, 'b2')?.id, 'b2');
});
test('fällt auf den Default-Standort zurück', () => {
  assert.equal(standortFuerZuordnung(mehrere, null)?.id, 'b1');
  assert.equal(standortFuerZuordnung(einzel, null)?.id, 'b1');
});
test('ohne Standorte → null', () => {
  assert.equal(standortFuerZuordnung([], 'b1'), null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
