/**
 * Tests fuer die Sidebar-Registry.
 *
 * Warum diese Datei in `module/` liegt, obwohl `nav-registry.js` in der Wurzel
 * steht: `npm test` sucht nach `module/ * * / *.test.js`. Die Registry selbst
 * bleibt, wo sie ist — dashboard.js, admin.js, kalender und komponenten.html
 * importieren sie von dort.
 *
 * Warum es sie ueberhaupt gibt: „Leistungen" wurde am 25.08.2026 von der
 * Gruppe `team` nach `abrechnung` verschoben (Meeting 30.08.2026,
 * „Menuestruktur und Leistungsverwaltung entwirren"). Das ist eine Aenderung,
 * die man in vier Profilen einzeln nachziehen muss — genau die Sorte, bei der
 * eines vergessen wird. Ein Bildschirmfoto beweist es einmal, dieser Test
 * jedes Mal.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NAV_REGISTRY, SECTOR_ALIASES, resolveSector } from '../nav-registry.js';
import * as registry from '../nav-registry.js';

const PROFILE = ['default', 'physiotherapy', 'podologie', 'praxis'];

const eintrag = (profil, id) => NAV_REGISTRY[profil].find(e => e.id === id);

test('es gibt genau vier Profile', () => {
  assert.deepEqual(Object.keys(NAV_REGISTRY).sort(), [...PROFILE].sort());
});

test('Leistungen steht in JEDEM Profil unter abrechnung', () => {
  for (const profil of PROFILE) {
    const e = eintrag(profil, 'services');
    assert.ok(e, `${profil}: Eintrag "services" fehlt ganz`);
    assert.equal(e.group, 'abrechnung', `${profil}: Leistungen steht unter "${e.group}"`);
  }
});

test('Leistungen steht in keinem Profil mehr unter team', () => {
  for (const profil of PROFILE) {
    assert.notEqual(eintrag(profil, 'services').group, 'team', profil);
  }
});

test('der Umzug hat die Rechte nicht angefasst', () => {
  // Sichtbarkeit haengt an `roles` und `module_visibility`, nie an `group`
  // (dashboard.js, renderSidebar). Aendert jemand hier die Rollen mit, faellt
  // es auf.
  for (const profil of PROFILE) {
    assert.deepEqual(eintrag(profil, 'services').roles, ['owner', 'employee'], profil);
  }
});

test('Leistungen und die §302-Abrechnung sind zwei verschiedene Eintraege', () => {
  // Wichtig, weil dashboard.js die Plan-Sperre an `item.id === 'abrechnung'`
  // haengt. Bekaeme "Leistungen" jemals diese id, waere es fuer jede Praxis
  // ohne §302-Zugang unsichtbar.
  const mit302 = ['physiotherapy', 'praxis'];
  for (const profil of mit302) {
    assert.notEqual(eintrag(profil, 'services').id, eintrag(profil, 'abrechnung').id);
  }
});

test('Team und Verfuegbarkeit bleiben unter team', () => {
  // Gegenprobe: es sollte nur "Leistungen" umgezogen sein, nicht die Gruppe.
  for (const profil of PROFILE) {
    assert.equal(eintrag(profil, 'team').group, 'team', profil);
    assert.equal(eintrag(profil, 'hours').group, 'team', profil);
  }
});

test('Logopaedie und Ergotherapie erben von physiotherapy', () => {
  // Vier Profile decken sechs Fachbereiche ab — deshalb reichen vier.
  assert.equal(SECTOR_ALIASES.logopaedie, 'physiotherapy');
  assert.equal(SECTOR_ALIASES.ergotherapie, 'physiotherapy');
  assert.equal(resolveSector('logopaedie'), 'physiotherapy');
  assert.equal(resolveSector('ergotherapie'), 'physiotherapy');
  assert.equal(resolveSector('irgendwas'), 'default');
});

test('jeder Eintrag traegt eine Gruppe, die es auch gibt', () => {
  // Ein Tippfehler in `group` laesst den Eintrag lautlos aus der Sidebar
  // verschwinden — renderSidebar zeichnet nur bekannte Gruppen.
  const GRUPPEN = ['uebersicht', 'termine', 'patienten', 'rezepte', 'abrechnung', 'team', 'einstellungen'];
  for (const profil of PROFILE) {
    for (const e of NAV_REGISTRY[profil]) {
      assert.ok(GRUPPEN.includes(e.group), `${profil}/${e.id}: unbekannte Gruppe "${e.group}"`);
    }
  }
});

test('REGISTRY_VERSION ist weg und kommt nicht zurueck', () => {
  // Sie wurde bei jeder Aenderung hochgezaehlt und von niemandem gelesen.
  // Cache-Busting laeuft ueber `?v=` im Import-Pfad — eine Konstante IN der
  // Datei kann das strukturell nicht leisten. Siehe Kopf von nav-registry.js.
  assert.equal(registry.REGISTRY_VERSION, undefined);
});
