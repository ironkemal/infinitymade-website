import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navEintraege, abschnittsNavAufbauen } from './einstellungen-nav.js';

test('navEintraege: Gruppenköpfe nur vor sichtbaren Abschnitten, unsichtbare und titellose fallen weg', () => {
  const z = [
    { gruppe: 'Allgemein', id: 'a', titel: 'Profil', sichtbar: true },
    { gruppe: 'Allgemein', id: 'b', titel: 'Ausfallgebühr', sichtbar: false },
    { gruppe: 'Abrechnung', id: 'c', titel: '', sichtbar: true },
    { gruppe: 'Abrechnung', id: 'd', titel: 'Rechnungsdaten', sichtbar: true },
    { gruppe: 'Leer', id: 'e', titel: 'X', sichtbar: false },
  ];
  assert.deepEqual(navEintraege(z), [
    { art: 'gruppe', titel: 'Allgemein' }, { art: 'abschnitt', id: 'a', titel: 'Profil' },
    { art: 'gruppe', titel: 'Abrechnung' }, { art: 'abschnitt', id: 'd', titel: 'Rechnungsdaten' },
  ]);
  assert.deepEqual(navEintraege(null), []);
});

test('Abschnitts-Neuaufbau erhält Linkfokus, nutzt Ersatz und stiehlt keinen Formularfokus', () => {
  const vorher = { document: globalThis.document, IntersectionObserver: globalThis.IntersectionObserver };
  const body = {};
  let links = [];
  const nav = {
    className: '', setAttribute() {}, addEventListener() {},
    contains: el => links.includes(el), querySelectorAll: () => links,
    set innerHTML(html) {
      if (links.includes(globalThis.document.activeElement)) globalThis.document.activeElement = body;
      links = [...html.matchAll(/data-ziel="([^"]+)"/g)].map(([, id]) => ({
        dataset: { ziel: id }, classList: { toggle() {} }, setAttribute() {}, removeAttribute() {},
        focus() { globalThis.document.activeElement = this; },
      }));
    },
  };
  const panel = { classList: { add() {} }, querySelectorAll: () => [] };
  const inhalt = { before() {}, getClientRects: () => [{}], setAttribute() {}, focus() { globalThis.document.activeElement = this; } };
  let ids = ['a', 'b'];
  const aufbauen = () => abschnittsNavAufbauen({ panel, inhalt, ariaLabel: 'Test', lesen: () => ids.map(id => ({ art: 'abschnitt', id, titel: id })) });
  try {
    globalThis.document = { activeElement: body, createElement: () => nav };
    globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
    aufbauen(); links[1].focus(); aufbauen();
    assert.equal(document.activeElement.dataset.ziel, 'b');
    ids = ['a']; aufbauen();
    assert.equal(document.activeElement.dataset.ziel, 'a');
    const feld = {}; document.activeElement = feld; aufbauen();
    assert.equal(document.activeElement, feld);
    links[0].focus(); ids = []; aufbauen();
    assert.equal(document.activeElement, inhalt);
  } finally {
    for (const [key, value] of Object.entries(vorher)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
