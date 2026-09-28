import { test } from 'node:test';
import assert from 'node:assert/strict';
import { podBehandlungsdatumVorschlag } from './podo-behandlungsdatum-vorwahl.js';

test('keine Vorwahl -> heute', () => {
  assert.deepEqual(podBehandlungsdatumVorschlag(null, '2026-09-28'), { datum: '2026-09-28', istZukunft: false });
  assert.deepEqual(podBehandlungsdatumVorschlag(undefined, '2026-09-28'), { datum: '2026-09-28', istZukunft: false });
  assert.deepEqual(podBehandlungsdatumVorschlag('', '2026-09-28'), { datum: '2026-09-28', istZukunft: false });
});

test('Vorwahl in der Vergangenheit -> übernommen, keine Warnung', () => {
  assert.deepEqual(podBehandlungsdatumVorschlag('2026-09-25', '2026-09-28'), { datum: '2026-09-25', istZukunft: false });
});

test('Vorwahl = heute -> übernommen, keine Warnung', () => {
  assert.deepEqual(podBehandlungsdatumVorschlag('2026-09-28', '2026-09-28'), { datum: '2026-09-28', istZukunft: false });
});

test('Vorwahl in der Zukunft -> übernommen, mit Warnung', () => {
  assert.deepEqual(podBehandlungsdatumVorschlag('2026-10-05', '2026-09-28'), { datum: '2026-10-05', istZukunft: true });
});
