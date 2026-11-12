import test from 'node:test';
import assert from 'node:assert/strict';
import { ZIEL_GRUPPE, zielGruppe, ankerNach, planeUmzug } from './leiste-zuordnung.js';

const e = (panel, gruppe) => ({ panel, gruppe });
const grundlage = () => [e('overview', 'uebersicht'), e('calendar', 'termine'), e('kunden', 'patienten'), e('verordnungen', 'abrechnung'),
  e('podologie-billing', 'abrechnung'), e('abrechnung', 'abrechnung'), e('services', 'einstellungen'), e('b2c', 'einstellungen'), e('team', 'team'), e('settings', 'einstellungen')];

function anwenden(liste, plan) {
  let l = liste.map(x => ({ ...x }));
  for (const p of plan) {
    const eintrag = { panel: p.panel, gruppe: p.nach };
    l = l.filter(x => x.panel !== p.panel);
    let idx;
    if (p.hinter) idx = l.findIndex(x => x.panel === p.hinter) + 1;
    else { const last = l.map(x => x.gruppe).lastIndexOf(p.nach); idx = last + 1; }
    l.splice(idx, 0, eintrag);
  }
  return l;
}

test('Zuordnung je Eintrag', () => {
  assert.deepEqual({ ...ZIEL_GRUPPE }, { 'podologie-billing': 'uebersicht', verordnungen: 'patienten', services: 'team', fahrtenbuch: 'team', b2b: 'team', doctors: 'team', b2c: 'team' });
  for (const [p, g] of Object.entries(ZIEL_GRUPPE)) assert.equal(zielGruppe(p), g);
});
test('unbekanntes Panel → null', () => {
  assert.equal(zielGruppe('kalender-xyz'), null);
  assert.equal(zielGruppe('toString'), null);
  assert.equal(ankerNach('services'), null);
  assert.equal(ankerNach('constructor'), null);
});
test('Anker', () => {
  assert.equal(ankerNach('podologie-billing'), 'overview');
  assert.equal(ankerNach('verordnungen'), 'kunden');
});
test('Plan und Reihenfolge', () => {
  const plan = planeUmzug(grundlage());
  assert.deepEqual(plan.map(p => p.panel), ['podologie-billing', 'verordnungen', 'services', 'b2c']);
  assert.deepEqual(plan[0], { panel: 'podologie-billing', von: 'abrechnung', nach: 'uebersicht', hinter: 'overview' });
  assert.deepEqual(plan[1], { panel: 'verordnungen', von: 'abrechnung', nach: 'patienten', hinter: 'kunden' });
  assert.equal(plan[2].hinter, null);
  const neu = anwenden(grundlage(), plan).map(x => x.panel);
  assert.equal(neu[neu.indexOf('overview') + 1], 'podologie-billing');
  assert.equal(neu[neu.indexOf('kunden') + 1], 'verordnungen');
});
test('schon richtige Gruppe → kein Umzug', () => {
  assert.deepEqual(planeUmzug([e('overview', 'uebersicht'), e('podologie-billing', 'uebersicht'), e('team', 'team'), e('services', 'team')]), []);
});
test('fehlende Zielgruppe → kein Umzug', () => {
  assert.deepEqual(planeUmzug([e('overview', 'uebersicht'), e('services', 'einstellungen'), e('verordnungen', 'abrechnung')]), []);
});
test('fehlender Anker → ans Ende', () => {
  const plan = planeUmzug([e('x', 'patienten'), e('verordnungen', 'abrechnung')]);
  assert.deepEqual(plan, [{ panel: 'verordnungen', von: 'abrechnung', nach: 'patienten', hinter: null }]);
});
test('Idempotenz', () => {
  const plan = planeUmzug(grundlage());
  assert.deepEqual(planeUmzug(anwenden(grundlage(), plan)), []);
});
test('Map ist eingefroren', () => {
  assert.ok(Object.isFrozen(ZIEL_GRUPPE));
  assert.throws(() => { 'use strict'; ZIEL_GRUPPE.services = 'x'; }, TypeError);
});
