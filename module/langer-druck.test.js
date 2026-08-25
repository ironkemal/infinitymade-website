import { test } from 'node:test';
import assert from 'node:assert/strict';

import { aufLangenDruck } from './langer-druck.js';

/**
 * Kleinster Ersatz für ein DOM-Element: merkt sich Zuhörer und liefert sie
 * auf Zuruf aus. Reicht, weil das Modul nur addEventListener, contains und
 * closest benutzt.
 */
function machBehaelter() {
  const zuhoerer = new Map();
  return {
    zuhoerer,
    addEventListener(typ, fn, capture) {
      const schluessel = typ + (capture ? ':capture' : '');
      if (!zuhoerer.has(schluessel)) zuhoerer.set(schluessel, []);
      zuhoerer.get(schluessel).push(fn);
    },
    removeEventListener(typ, fn, capture) {
      const schluessel = typ + (capture ? ':capture' : '');
      const liste = zuhoerer.get(schluessel) || [];
      const i = liste.indexOf(fn);
      if (i !== -1) liste.splice(i, 1);
    },
    contains: () => true,
    feuere(typ, ereignis, capture = false) {
      const liste = zuhoerer.get(typ + (capture ? ':capture' : '')) || [];
      liste.forEach(fn => fn(ereignis));
    },
  };
}

const machZiel = (datum) => ({ dataset: { datum }, closest: function () { return this; } });

function druck(ziel, { x = 0, y = 0, pointerType = 'touch' } = {}) {
  return { target: ziel, clientX: x, clientY: y, pointerType };
}

const warte = (ms) => new Promise(r => setTimeout(r, ms));

test('langes Druecken loest aus', async () => {
  const behaelter = machBehaelter();
  const treffer = [];
  aufLangenDruck(behaelter, '.zelle', (el) => treffer.push(el.dataset.datum), { ms: 20 });

  behaelter.feuere('pointerdown', druck(machZiel('2026-08-22')));
  await warte(40);

  assert.deepEqual(treffer, ['2026-08-22']);
});

test('kurzes Tippen loest nicht aus', async () => {
  const behaelter = machBehaelter();
  const treffer = [];
  aufLangenDruck(behaelter, '.zelle', () => treffer.push(1), { ms: 40 });

  behaelter.feuere('pointerdown', druck(machZiel('x')));
  behaelter.feuere('pointerup', {});
  await warte(60);

  assert.equal(treffer.length, 0);
});

test('Wischen bricht ab — sonst legt Scrollen Termine an', async () => {
  const behaelter = machBehaelter();
  const treffer = [];
  aufLangenDruck(behaelter, '.zelle', () => treffer.push(1), { ms: 30, toleranzPx: 8 });

  const ziel = machZiel('x');
  behaelter.feuere('pointerdown', druck(ziel, { x: 100, y: 100 }));
  behaelter.feuere('pointermove', { clientX: 100, clientY: 140 });
  await warte(50);

  assert.equal(treffer.length, 0);
});

test('Wackeln innerhalb der Toleranz bricht nicht ab', async () => {
  const behaelter = machBehaelter();
  const treffer = [];
  aufLangenDruck(behaelter, '.zelle', () => treffer.push(1), { ms: 20, toleranzPx: 8 });

  behaelter.feuere('pointerdown', druck(machZiel('x'), { x: 100, y: 100 }));
  behaelter.feuere('pointermove', { clientX: 103, clientY: 104 });
  await warte(40);

  assert.equal(treffer.length, 1);
});

test('Maus wird ausgelassen — sie hat den Doppelklick', async () => {
  const behaelter = machBehaelter();
  const treffer = [];
  aufLangenDruck(behaelter, '.zelle', () => treffer.push(1), { ms: 20 });

  behaelter.feuere('pointerdown', druck(machZiel('x'), { pointerType: 'mouse' }));
  await warte(40);

  assert.equal(treffer.length, 0);
});

test('der Klick nach dem langen Druecken wird geschluckt', async () => {
  const behaelter = machBehaelter();
  aufLangenDruck(behaelter, '.zelle', () => {}, { ms: 20 });

  behaelter.feuere('pointerdown', druck(machZiel('x')));
  await warte(40);

  let gestoppt = false;
  let verhindert = false;
  behaelter.feuere('click', {
    stopPropagation: () => { gestoppt = true; },
    preventDefault: () => { verhindert = true; },
  }, true);

  assert.equal(gestoppt, true, 'sonst springt die Monatsansicht zusaetzlich in den Tag');
  assert.equal(verhindert, true);
});

test('ohne langes Druecken bleibt der Klick unangetastet', () => {
  const behaelter = machBehaelter();
  aufLangenDruck(behaelter, '.zelle', () => {}, { ms: 20 });

  let gestoppt = false;
  behaelter.feuere('click', { stopPropagation: () => { gestoppt = true; }, preventDefault: () => {} }, true);

  assert.equal(gestoppt, false);
});

test('Abmelden entfernt alle Zuhoerer', () => {
  const behaelter = machBehaelter();
  const ab = aufLangenDruck(behaelter, '.zelle', () => {}, { ms: 20 });
  ab();
  const offen = [...behaelter.zuhoerer.values()].reduce((n, l) => n + l.length, 0);
  assert.equal(offen, 0);
});
