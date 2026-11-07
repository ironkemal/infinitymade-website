import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePreis } from './resolver.js';

test('Abrechnung taxiert KG aus gültigem Vertrag: 29,63 / 2,96 EUR', () => {
  const r = resolvePreis({ bereich: 'physiotherapie', code: '20501', datum: '2026-08-10', abrechnung: true });
  assert.equal(r.preis_eur, 29.63);
  assert.equal(r.zuzahlung_eur, 2.96);
});

test('Abrechnung sperrt fehlenden/unmöglichen Leistungstag und unbekannte Position', () => {
  for (const datum of [null, '', '2026-02-30']) {
    assert.throws(() => resolvePreis({ code: '20501', datum, abrechnung: true }), { code: 'PREIS_LEISTUNGSDATUM_UNGUELTIG', status: 422 });
  }
  assert.throws(() => resolvePreis({ code: '99999', datum: '2026-08-10', abrechnung: true }), { code: 'PREIS_POSITION_UNBEKANNT', status: 422 });
});

test('Preisvorschau darf historisches Ersatzfenster zeigen, Abrechnung sperrt es', () => {
  const opts = { bereich: 'physiotherapie', code: '20501', datum: '2020-01-01' };
  assert.equal(resolvePreis(opts).ausserhalb_preisfenster, true);
  assert.throws(() => resolvePreis({ ...opts, abrechnung: true }), { code: 'PREIS_FENSTER_FEHLT', status: 422 });
});

test('Numerische Position einer anderen Leistungserbringergruppe wird nicht umtaxiert', () => {
  assert.throws(() => resolvePreis({ code: '10501', abrechnungscode: '22', datum: '2026-08-10', abrechnung: true }),
    { code: 'PREIS_POSITION_FALSCHE_LE_GRUPPE', status: 422 });
});
