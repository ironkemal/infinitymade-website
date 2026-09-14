import { test } from 'node:test';
import assert from 'node:assert/strict';

import { terminFarben, mitDeckkraft, LEISTUNG_FARBEN, STATUS_FARBEN } from './kalender-farben.js';

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

test('no_show uebersteuert die Leistungsfarbe — Flaeche UND Rand', () => {
  // Ops-Karte a8186cb8: der ausgefallene Termin sah aus wie ein stattgefundener.
  // Auch der Rand, sonst liest sich der Block in Woche/Monat als „teilweise".
  const f = terminFarben(
    { user_id: 'b', status: 'no_show', services: { color: '#ff0000' } },
    { teamMembers: TEAM, empFarben: FARBEN },
  );
  assert.equal(f.flaeche, STATUS_FARBEN.no_show);
  assert.equal(f.rand, STATUS_FARBEN.no_show);
  assert.equal(f.quelle, 'status');
});

test('no_show faerbt auch ohne Leistung und ohne bekannten Mitarbeiter', () => {
  const f = terminFarben({ status: 'no_show' }, { teamMembers: TEAM, empFarben: FARBEN });
  assert.equal(f.flaeche, STATUS_FARBEN.no_show);
});

test('andere Status faerben nicht um', () => {
  // completed/confirmed sind der Normalfall — nur der Ausfall ist die Ausnahme.
  for (const status of ['completed', 'confirmed', 'pending', undefined]) {
    const f = terminFarben(
      { user_id: 'a', status, services: { color: '#00ff00' } },
      { teamMembers: TEAM, empFarben: FARBEN },
    );
    assert.equal(f.flaeche, '#00ff00', `Status ${status}`);
    assert.equal(f.quelle, 'leistung');
  }
});

test('die Statusfarbe ist ein sechsstelliger Hexwert', () => {
  // mitDeckkraft() haengt ein Alpha-Suffix an — bei einer Kurzform oder einer
  // CSS-Variablen ginge der Block den color-mix-Weg statt des schnellen.
  assert.match(STATUS_FARBEN.no_show, /^#[0-9a-f]{6}$/i);
  assert.equal(mitDeckkraft(STATUS_FARBEN.no_show, '25', '15%'), STATUS_FARBEN.no_show + '25');
});

test('die Vorschlagsfarben sind eindeutig und gueltige Hexwerte', () => {
  assert.equal(new Set(LEISTUNG_FARBEN).size, LEISTUNG_FARBEN.length);
  for (const f of LEISTUNG_FARBEN) assert.match(f, /^#[0-9a-f]{6}$/i);
});
