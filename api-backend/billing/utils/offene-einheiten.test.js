import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offeneEinheiten, offeneJeVerordnung, pruefeBestaetigung, offeneEinheitenAntwort, protokollZeilen }
  from './offene-einheiten.js';

const vords = [
  { id: 'a', anzahl_einheiten: 6 },
  { id: 'b', anzahl_einheiten: 3 },
  { id: 'c', anzahl_einheiten: null },
];
const behs = [{ verordnung_id: 'a' }, { verordnung_id: 'a' }, { verordnung_id: 'b' }, { verordnung_id: 'b' }, { verordnung_id: 'b' }];

test('offeneEinheiten', () => {
  assert.equal(offeneEinheiten(6, 2), 4);
  assert.equal(offeneEinheiten(3, 5), 0);
  assert.equal(offeneEinheiten(undefined, 1), 0);
});

test('offeneJeVerordnung: nur offen > 0', () => {
  assert.deepEqual(offeneJeVerordnung(vords, behs), [{ id: 'a', verordnet: 6, erbracht: 2, offen: 4 }]);
});

test('pruefeBestaetigung: Ids, true, nichts', () => {
  const o = offeneJeVerordnung(vords, behs);
  assert.equal(pruefeBestaetigung(o, []).fehlt.length, 1);
  assert.equal(pruefeBestaetigung(o, undefined).fehlt.length, 1);
  assert.equal(pruefeBestaetigung(o, ['a']).fehlt.length, 0);
  assert.equal(pruefeBestaetigung(o, ['x']).fehlt.length, 1);
  assert.equal(pruefeBestaetigung(o, true).fehlt.length, 0);
});

test('428-Antwort trägt Code und Liste', () => {
  const r = offeneEinheitenAntwort([{ id: 'a', offen: 4, verordnet: 6, erbracht: 2 }]);
  assert.equal(r.status, 428);
  assert.equal(r.body.code, 'OFFENE_EINHEITEN');
  assert.deepEqual(r.body.offene, [{ id: 'a', offen: 4 }]);
});

test('protokollZeilen: Muster abrechnung-freigabe', () => {
  const z = protokollZeilen([{ id: 'a', verordnet: 6, erbracht: 2, offen: 4 }], { abrechnungId: 'ab1', userId: 'u1' });
  assert.equal(z[0].engine, 'abrechnung-freigabe');
  assert.equal(z[0].proceeded_anyway, true);
  assert.deepEqual(z[0].overridden_rules, ['OFFENE_EINHEITEN']);
  assert.deepEqual(z[0].input_snapshot, { verordnet: 6, erbracht: 2, offen: 4 });
  assert.deepEqual(z[0].result, { abrechnung_id: 'ab1' });
  const b = protokollZeilen([{ id: 'a', verordnet: 6, erbracht: 2, offen: 4 }], { aktion: 'bereit', userId: 'u1' });
  assert.deepEqual(b[0].result, { aktion: 'bereit' });
});

test('ohne Feld anzahl_einheiten (z. B. Frontend-Wortschatz) -> nichts offen, kein Absturz', () => {
  assert.deepEqual(offeneJeVerordnung([{ id: 'a', behandlungseinheiten: 6 }], []), []);
});

import { bestaetigungNochGueltig, gueltigBestaetigteIds } from './offene-einheiten.js';

test('bestaetigungNochGueltig: gleiche offen-Zahl, keine künftigen Termine', () => {
  assert.equal(bestaetigungNochGueltig({ offenJetzt: 3, snapshotOffen: 3, kuenftigeTermine: 0 }), true);
  assert.equal(bestaetigungNochGueltig({ offenJetzt: 3, snapshotOffen: 4, kuenftigeTermine: 0 }), false);
  assert.equal(bestaetigungNochGueltig({ offenJetzt: 3, snapshotOffen: 3, kuenftigeTermine: 1 }), false);
  assert.equal(bestaetigungNochGueltig({ offenJetzt: 3, snapshotOffen: null, kuenftigeTermine: 0 }), false);
  assert.equal(bestaetigungNochGueltig({ offenJetzt: 3, snapshotOffen: 3 }), false);
  assert.equal(bestaetigungNochGueltig({ offenJetzt: 0, snapshotOffen: 0, kuenftigeTermine: 0 }), false);
  assert.equal(bestaetigungNochGueltig(), false);
});

test('gueltigBestaetigteIds: neueste Zeile zählt, Termine und Änderung entwerten', () => {
  const offene = [{ id: 'a', offen: 2 }, { id: 'b', offen: 2 }, { id: 'c', offen: 2 }, { id: 'd', offen: 2 }];
  const zeilen = [
    { prescription_id: 'a', input_snapshot: { offen: 2 }, created_at: '2026-09-01' },
    { prescription_id: 'b', input_snapshot: { offen: 2 }, created_at: '2026-09-01' },
    { prescription_id: 'c', input_snapshot: { offen: 5 }, created_at: '2026-08-01' },
    { prescription_id: 'c', input_snapshot: { offen: 2 }, created_at: '2026-09-02' },
  ];
  const ids = gueltigBestaetigteIds(offene, zeilen, [{ verordnung_id: 'b' }]);
  assert.deepEqual([...ids].sort(), ['a', 'c']);
  assert.equal(gueltigBestaetigteIds([], zeilen, []).size, 0);
  assert.equal(gueltigBestaetigteIds(offene, null, null).size, 0);
});
