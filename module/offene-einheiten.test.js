import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offeneEinheiten, vorausgewaehltPodo, offeneAuswahl, bestaetigungsText, frageOffeneEinheiten }
  from './offene-einheiten.js';

test('offeneEinheiten: verordnet minus erbracht, nie negativ, unbekannt = 0', () => {
  assert.equal(offeneEinheiten(6, 4), 2);
  assert.equal(offeneEinheiten(6, 6), 0);
  assert.equal(offeneEinheiten(6, 9), 0);
  assert.equal(offeneEinheiten(null, 3), 0);
  assert.equal(offeneEinheiten('6', 0), 6);
});

test('vorausgewaehltPodo: offene Einheiten -> nicht vorgewählt', () => {
  assert.equal(vorausgewaehltPodo({ offen: 2 }), false);
  assert.equal(vorausgewaehltPodo({ offen: 0 }), true);
  assert.equal(vorausgewaehltPodo({}), true);
});

test('offeneAuswahl filtert auf offen > 0', () => {
  const r = offeneAuswahl([{ id: 'a', offen: 0 }, { id: 'b', offen: 3, patient: 'X', nummer: '7' }]);
  assert.deepEqual(r, [{ id: 'b', patient: 'X', nummer: '7', offen: 3 }]);
});

test('bestaetigungsText: freigegebener Wortlaut, einzeln', () => {
  const t = bestaetigungsText([{ patient: 'X', nummer: '7', offen: 2 }]);
  assert.equal(t.title, 'Verordnung vorzeitig abrechnen?');
  assert.equal(t.confirmText, 'Trotzdem abrechnen');
  assert.equal(t.cancelText, 'Abbrechen');
  assert.ok(t.message.startsWith('Es sind noch 2 Einheit(en) offen. Mit der Abrechnung wird die Verordnung beendet'));
  assert.ok(t.message.includes('Bitte das Datum des Behandlungsabbruchs auf der Rückseite der Verordnung vermerken.\n\nBereits erbrachte, aber noch nicht dokumentierte Einheiten bitte vorher nachtragen.'));
});

test('bestaetigungsText: mehrere -> Liste oben', () => {
  const t = bestaetigungsText([
    { patient: 'A', nummer: '1', offen: 2 }, { patient: 'B', nummer: '2', offen: 5 }]);
  assert.ok(t.message.startsWith('A · 1: 2 offen\nB · 2: 5 offen\n\n'));
});

test('frageOffeneEinheiten: nichts offen -> kein Dialog; Abbruch -> null; Ja -> Ids', async () => {
  let gefragt = 0;
  const ja = async () => { gefragt++; return true; };
  const nein = async () => false;
  assert.deepEqual(await frageOffeneEinheiten([{ id: 'a', offen: 0 }], ja), []);
  assert.equal(gefragt, 0);
  assert.equal(await frageOffeneEinheiten([{ id: 'a', offen: 1 }], nein), null);
  assert.deepEqual(await frageOffeneEinheiten([{ id: 'a', offen: 1 }, { id: 'b', offen: 0 }], ja), ['a']);
  assert.equal(await frageOffeneEinheiten([{ id: 'a', offen: 1 }], undefined), null);
});

import { bestaetigungNochGueltig, gueltigBestaetigteIds } from './offene-einheiten.js';

test('S2.3b: bestaetigungNochGueltig', () => {
  assert.equal(bestaetigungNochGueltig({ offenJetzt: 3, snapshotOffen: 3, kuenftigeTermine: 0 }), true);
  assert.equal(bestaetigungNochGueltig({ offenJetzt: 3, snapshotOffen: 4, kuenftigeTermine: 0 }), false);
  assert.equal(bestaetigungNochGueltig({ offenJetzt: 3, snapshotOffen: 3, kuenftigeTermine: 2 }), false);
  assert.equal(bestaetigungNochGueltig({ offenJetzt: 3, snapshotOffen: undefined, kuenftigeTermine: 0 }), false);
});

test('S2.3b: gueltigBestaetigteIds + Vorauswahl + Dialog überspringt bestätigte', async () => {
  const offene = [{ id: 'a', offen: 2 }, { id: 'b', offen: 2 }];
  const zeilen = [
    { prescription_id: 'a', input_snapshot: { offen: 2 }, created_at: '2026-09-01' },
    { prescription_id: 'b', input_snapshot: { offen: 3 }, created_at: '2026-09-01' },
  ];
  const ids = gueltigBestaetigteIds(offene, zeilen, []);
  assert.deepEqual([...ids], ['a']);
  assert.equal(vorausgewaehltPodo({ offen: 2, bereitBestaetigt: true }), true);
  assert.equal(vorausgewaehltPodo({ offen: 2, bereitBestaetigt: false }), false);
  let gefragt = 0;
  const r = await frageOffeneEinheiten([{ id: 'a', offen: 2, bereitBestaetigt: true }], async () => { gefragt++; return true; });
  assert.deepEqual(r, []);
  assert.equal(gefragt, 0);
});
