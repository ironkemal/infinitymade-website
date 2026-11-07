// M5: Termin an einem Urlaubstag der Therapeut:in warnt ("Trotzdem eintragen"), Abbrechen verhindert das Speichern.
// DOM-Stub nur, damit raumAuswahlVerdrahten() ohne Browser mountet; alle Daten sind synthetisch.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = {
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add() {} }, append() {}, addEventListener() {} }),
  addEventListener() {},
};
const { raumAuswahlVerdrahten, terminWarnungen } = await import('./raum-auswahl.js');

function tabelle(zeilen) {
  const b = {
    select() { return b; }, in() { return b; }, lte() { return b; }, gte() { return b; }, eq() { return b; },
    maybeSingle: async () => ({ data: null }),
    then: (ok) => ok({ data: zeilen, error: null }),
  };
  return b;
}
function verdrahte({ timeOffs, antwort }) {
  const fragen = [];
  raumAuswahlVerdrahten({
    supabase: { from: t => tabelle(t === 'time_offs' ? timeOffs : []) },
    getOwnerId: () => 'owner-1',
    showToast: () => {},
    showConfirmModal: async m => { fragen.push(m.message); return antwort; },
  });
  return fragen;
}
const termin = { empId: 'emp-1', startIso: '2026-11-09T09:00:00Z', endIso: '2026-11-09T09:30:00Z' };
const urlaub = [{ employee_id: 'emp-1', start_date: '2026-11-09', end_date: '2026-11-09', type: 'vacation' }];

test('Urlaubstag: Warnung, Bestätigen speichert weiter', async () => {
  const fragen = verdrahte({ timeOffs: urlaub, antwort: true });
  assert.equal(await terminWarnungen(termin), true);
  assert.equal(fragen.length, 1);
  assert.match(fragen[0], /nicht verfügbar/);
});

test('Urlaubstag: Abbrechen verhindert das Speichern', async () => {
  const fragen = verdrahte({ timeOffs: urlaub, antwort: false });
  assert.equal(await terminWarnungen(termin), false);
  assert.equal(fragen.length, 1);
});

test('Kein Urlaub: keine Warnung', async () => {
  const fragen = verdrahte({ timeOffs: [], antwort: false });
  assert.equal(await terminWarnungen(termin), true);
  assert.equal(fragen.length, 0);
});
