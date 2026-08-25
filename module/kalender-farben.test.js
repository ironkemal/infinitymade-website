import { test } from 'node:test';
import assert from 'node:assert/strict';

import { terminFarben, mitDeckkraft, LEISTUNG_FARBEN } from './kalender-farben.js';

const TEAM = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const FARBEN = ['#111111', '#222222', '#333333'];

test('Flaeche kommt von der Leistung, Rand vom Mitarbeiter', () => {
  const f = terminFarben(
    { user_id: 'b', services: { color: '#ff0000' } },
    { teamMembers: TEAM, empFarben: FARBEN },
  );
  assert.equal(f.flaeche, '#ff0000');
  assert.equal(f.rand, '#222222');
  assert.equal(f.quelle, 'leistung');
});

test('ohne Leistungsfarbe faellt die Flaeche auf den Mitarbeiter zurueck', () => {
  // Sonst waeren Termine ohne gepflegte Farbe unsichtbar statt bloss unbunt.
  const f = terminFarben({ user_id: 'c' }, { teamMembers: TEAM, empFarben: FARBEN });
  assert.equal(f.flaeche, '#333333');
  assert.equal(f.rand, '#333333');
  assert.equal(f.quelle, 'mitarbeiter');
});

test('unbekannter Mitarbeiter ergibt eine gueltige Farbe, keinen Fehlgriff', () => {
  // findIndex liefert -1. Frueher wurde daraus EMP_COLORS[-1] === undefined und
  // am Ende ein Block ohne Flaeche.
  const f = terminFarben({ user_id: 'weg' }, { teamMembers: TEAM, empFarben: FARBEN });
  assert.equal(f.rand, 'var(--primary)');
  assert.equal(f.flaeche, 'var(--primary)');
});

test('mehr Mitarbeiter als Farben — die Palette wiederholt sich', () => {
  const team = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const f = terminFarben({ user_id: 'd' }, { teamMembers: team, empFarben: FARBEN });
  assert.equal(f.rand, '#111111');
});

test('Leistungsfarbe darf auch aus einer Nachschlagetabelle kommen', () => {
  // Fuer Ansichten, die services(color) nicht mitladen.
  const f = terminFarben(
    { user_id: 'a', service_id: 's1' },
    { teamMembers: TEAM, empFarben: FARBEN, leistungFarben: new Map([['s1', '#00ff00']]) },
  );
  assert.equal(f.flaeche, '#00ff00');
  assert.equal(f.quelle, 'leistung');
});

test('leerer Aufruf stuerzt nicht ab', () => {
  const f = terminFarben(null);
  assert.equal(f.flaeche, 'var(--primary)');
});

test('mitDeckkraft: Hexfarbe bekommt das Alpha-Suffix', () => {
  assert.equal(mitDeckkraft('#22c55e'), '#22c55e22');
  assert.equal(mitDeckkraft('#22c55e', '25'), '#22c55e25');
});

test('mitDeckkraft: CSS-Variable wird nicht verstuemmelt', () => {
  assert.equal(mitDeckkraft('var(--primary)'), 'color-mix(in srgb, var(--primary) 13%, transparent)');
});

test('mitDeckkraft: dreistellige Kurzform waere sonst eine andere Farbe', () => {
  // '#abc' + '22' ergaebe '#abc22'.
  assert.equal(mitDeckkraft('#abc'), 'color-mix(in srgb, #abc 13%, transparent)');
});

test('die Vorschlagsfarben sind eindeutig und gueltige Hexwerte', () => {
  assert.equal(new Set(LEISTUNG_FARBEN).size, LEISTUNG_FARBEN.length);
  for (const f of LEISTUNG_FARBEN) assert.match(f, /^#[0-9a-f]{6}$/i);
});
