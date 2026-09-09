import { test } from 'node:test';
import assert from 'node:assert/strict';

import { belegVollstaendig } from './kassenbuch-beleg.js';

// Regressionstest fürs Redesign (Ops-Meldung, 10.09.2026): Zahlart ist jetzt
// Pflicht, ohne Vorauswahl — der Save-Knopf darf ohne sie nicht freigehen.

test('vollständig: Betrag > 0, Referenztext, Zahlart gesetzt', () => {
  assert.equal(belegVollstaendig({ amount: 25, ref: '1x Gutschein', zahlart: 'bar' }), true);
});

test('unvollständig: kein Betrag', () => {
  assert.equal(belegVollstaendig({ amount: 0, ref: '1x Gutschein', zahlart: 'bar' }), false);
});

test('unvollständig: negativer Betrag', () => {
  assert.equal(belegVollstaendig({ amount: -5, ref: '1x Gutschein', zahlart: 'bar' }), false);
});

test('unvollständig: leerer Referenztext', () => {
  assert.equal(belegVollstaendig({ amount: 25, ref: '', zahlart: 'bar' }), false);
});

test('unvollständig: Referenztext nur Leerzeichen', () => {
  assert.equal(belegVollstaendig({ amount: 25, ref: '   ', zahlart: 'bar' }), false);
});

test('unvollständig: keine Zahlart gewählt (kein Default!)', () => {
  assert.equal(belegVollstaendig({ amount: 25, ref: '1x Gutschein', zahlart: null }), false);
});
