import test from 'node:test';
import assert from 'node:assert/strict';
import { urlFuerDb, OWNER_HINWEIS } from './praxis-rechtslinks-einstellungen.js';

test('leer → null (Eintrag löschen), https → unverändert, alles andere → undefined', () => {
  assert.equal(urlFuerDb('  '), null);
  assert.equal(urlFuerDb(' https://praxis.de/impressum '), 'https://praxis.de/impressum');
  assert.equal(urlFuerDb('http://praxis.de'), undefined);
  assert.equal(urlFuerDb('javascript:alert(1)'), undefined);
  assert.equal(urlFuerDb('https://praxis.de/a b'), undefined);
  assert.equal(urlFuerDb('https://' + 'a'.repeat(500)), undefined);
});

test('Owner-Hinweis: Wortlaut legal-de 09.10.2026', () => {
  assert.match(OWNER_HINWEIS, /^Ihre Online-Terminseite betreiben Sie als Praxis selbst/);
  assert.match(OWNER_HINWEIS, /aber kein Impressum, für das Sie bei einer öffentlich erreichbaren Seite selbst verantwortlich sind\.$/);
});
