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

import { datumKurz, rueckfrageGrund, grundDaten } from './offene-einheiten.js';

const HEUTE = new Date(2026, 8, 30);

test('datumKurz: Jahr nur, wenn nicht das laufende', () => {
  assert.equal(datumKurz(new Date(2026, 9, 14, 10, 0), HEUTE), '14.10.');
  assert.equal(datumKurz('2027-01-05', HEUTE), '05.01.2027');
  assert.equal(datumKurz('', HEUTE), '');
});

test('rueckfrageGrund: ein Termin, mehrere Termine, geänderte Zahl, kein Grund', () => {
  assert.deepEqual(rueckfrageGrund({ termine: [new Date(2026, 9, 14, 9)] }, HEUTE),
    { zeilen: ['Für diese Verordnung ist noch ein Termin am 14.10. geplant.'], kurz: ' · Termin am 14.10. geplant' });
  const m = rueckfrageGrund({ termine: [new Date(2027, 0, 3), new Date(2026, 9, 20)] }, HEUTE);
  assert.equal(m.zeilen[0], 'Für diese Verordnung sind noch 2 Termine geplant (nächster am 20.10.).');
  const z = rueckfrageGrund({ offen: 1, freigabeAm: new Date(2026, 8, 2, 12), freigabeOffen: 2 }, HEUTE);
  assert.equal(z.zeilen[0], 'Seit der Freigabe am 02.09. hat sich die Zahl offener Einheiten geändert (damals 2, jetzt 1).');
  assert.deepEqual(rueckfrageGrund({ offen: 2 }, HEUTE), { zeilen: [], kurz: '' });
  assert.deepEqual(rueckfrageGrund({ offen: 2, freigabeAm: new Date(2026, 8, 2), freigabeOffen: 2 }, HEUTE).zeilen, []);
});

test('bestaetigungsText: Grund unter dem Haupttext bzw. an der Listenzeile', () => {
  const ein = bestaetigungsText([{ patient: 'X', nummer: '7', offen: 2, termine: [new Date(2026, 9, 14, 9)] }], HEUTE);
  assert.ok(ein.message.startsWith('Es sind noch 2 Einheit(en) offen. '));
  assert.ok(ein.message.endsWith('nachtragen.\n\nFür diese Verordnung ist noch ein Termin am 14.10. geplant.'));
  const viele = bestaetigungsText([
    { patient: 'A', nummer: '1', offen: 2, termine: [new Date(2026, 9, 14, 9)] },
    { patient: 'B', nummer: '2', offen: 5 }], HEUTE);
  assert.ok(viele.message.startsWith('A · 1: 2 offen · Termin am 14.10. geplant\nB · 2: 5 offen\n\n'));
  assert.ok(!viele.message.includes('Für diese Verordnung'));
});

test('grundDaten: Termine je Verordnung, Freigabe nur bei geänderter Zahl (neuester Eintrag)', () => {
  const m = grundDaten(
    [{ id: 'a', offen: 1 }, { id: 'b', offen: 2 }],
    [{ prescription_id: 'a', input_snapshot: { offen: 3 }, created_at: '2026-09-01T10:00:00Z' },
     { prescription_id: 'a', input_snapshot: { offen: 2 }, created_at: '2026-09-05T10:00:00Z' },
     { prescription_id: 'b', input_snapshot: { offen: 2 }, created_at: '2026-09-05T10:00:00Z' }],
    [{ verordnung_id: 'a', start_time: '2026-10-14T08:00:00Z' }]);
  assert.deepEqual(m.get('a'), { termine: ['2026-10-14T08:00:00Z'], freigabeAm: '2026-09-05T10:00:00Z', freigabeOffen: 2 });
  assert.deepEqual(m.get('b'), { termine: [] });
});
