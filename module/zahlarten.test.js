import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ZAHLARTEN, zahlartLabel } from './zahlarten.js';

// Regressionstest für die Drift zwischen den drei Zahlarten-Listen im Projekt
// (Ops-Meldung, 10.09.2026): dashboard.js kannte 'paypal' nicht, obwohl Backend
// und HTML-Filter es schon hatten.

test('fünf Zahlarten, jede mit eindeutigem key', () => {
  assert.equal(ZAHLARTEN.length, 5);
  assert.equal(new Set(ZAHLARTEN.map(z => z.key)).size, 5);
});

test('paypal ist dabei', () => {
  assert.ok(ZAHLARTEN.some(z => z.key === 'paypal'));
});

test('zahlartLabel übersetzt über die übergebene t()-Funktion', () => {
  const t = (key) => ({ kass_bar: 'Bar', kass_paypal: 'PayPal' }[key] || key);
  assert.equal(zahlartLabel('bar', t), 'Bar');
  assert.equal(zahlartLabel('paypal', t), 'PayPal');
});

test('unbekannter key fällt auf sich selbst zurück, nicht auf ein Rätsel', () => {
  const t = (key) => key;
  assert.equal(zahlartLabel('bitcoin', t), 'bitcoin');
  assert.equal(zahlartLabel(null, t), '—');
});
