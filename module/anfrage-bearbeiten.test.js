import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zeitwunschAus } from './anfrage-bearbeiten.js';

test('Zeitwunsch: nur Zeit-, Dringlichkeits- und Erreichbarkeitszeilen, kein Freitext', () => {
  const notiz = 'Anliegen: Nagelspange — Hausbesuch\nZeit: Mo, Mi · Vormittag (8–12)\nWie bald: In 2 bis 3 Wochen\nSchon da gewesen: ja\nMitteilung: großer Zeh\nErreichbarkeit: ab 16 Uhr';
  assert.equal(zeitwunschAus(notiz), 'Zeit: Mo, Mi · Vormittag (8–12)\nWie bald: In 2 bis 3 Wochen\nErreichbarkeit: ab 16 Uhr');
});

test('Zeitwunsch: leer bei klassischer Anfrage mit Datum und freier Notiz', () => {
  assert.equal(zeitwunschAus('Bitte Hintereingang'), '');
  assert.equal(zeitwunschAus(null), '');
});
