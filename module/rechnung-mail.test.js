import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ergebnisText } from './rechnung-mail.js';

test('ergebnisText: gesendet nennt Empfänger und Gmail-Weg', () => {
  const e = ergebnisText({ gesendet: true, empfaenger: 'a@b.de', weg: 'gmail' });
  assert.equal(e.ok, true);
  assert.match(e.text, /a@b\.de/);
  assert.match(e.text, /Gmail/);
});

test('ergebnisText: ohne Versand immer mit Hinweis auf PDF zum selbst Senden', () => {
  for (const code of ['KEINE_EMAIL', 'VERSAND_NICHT_EINGERICHTET', 'GMAIL_NICHT_VERBUNDEN', 'gmail_reauth_required', 'x']) {
    const e = ergebnisText({ gesendet: false, code });
    assert.equal(e.ok, false);
    assert.match(e.text, /PDF herunterladen/);
  }
});

test('ergebnisText: fehlendes/abgelaufenes Postfach zeigt den Weg zur Einstellung', () => {
  for (const code of ['VERSAND_NICHT_EINGERICHTET', 'GMAIL_NICHT_VERBUNDEN', 'gmail_reauth_required']) {
    assert.equal(ergebnisText({ gesendet: false, code }).einrichten, true, code);
  }
  assert.equal(ergebnisText({ gesendet: false, code: 'KEINE_EMAIL' }).einrichten, false);
});
