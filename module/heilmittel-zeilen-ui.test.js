import test from 'node:test';
import assert from 'node:assert/strict';

// Minimale DOM-Attrappe für heilmittel-zeilen-ui.js
class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.style = {};
    this.dataset = {};
    this.classList = {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); },
    };
    this.children = [];
    this.parentNode = null;
    this.checked = false;
    this.value = '';
    this.innerHTML = '';
  }

  closest() {
    return this.parentNode || null;
  }

  querySelectorAll(selector) {
    if (selector === '.m13-hmline-extra') {
      return this.children.filter(c => c.dataset?.zeile);
    }
    return [];
  }

  querySelector(selector) {
    return this.children.find(c => c.id === selector || c.id === selector.replace('#', '')) || null;
  }

  appendChild(el) {
    el.parentNode = this;
    this.children.push(el);
    return el;
  }
}

const elements = new Map();
function getOrCreate(id, tag = 'div') {
  if (!elements.has(id)) {
    const el = new FakeElement(tag);
    el.id = id;
    elements.set(id, el);
  }
  return elements.get(id);
}

globalThis.document = {
  getElementById(id) {
    return elements.get(id) || null;
  },
  createElement(tag) {
    return new FakeElement(tag);
  },
};

const {
  aktualisiereAddBtnSichtbarkeit,
  initialisiereHeilmittelZeilen,
  fuegeHeilmittelZeilenHinzu,
  leseHeilmittelZeilenPayload,
} = await import('./heilmittel-zeilen-ui.js');

test('Doppelbehandlung-Sichtbarkeit und Konsistenz bei Umschalten zwischen 1 und mehreren Zeilen', () => {
  const table = getOrCreate('rzHmTable');
  const btnWrap = getOrCreate('rzHmAddLineWrap');
  const extraWrap = getOrCreate('rzHmExtraLines');
  const d1Wrap = getOrCreate('rzHmRow1DoppelWrap');
  const d1Placeholder = getOrCreate('rzHmRow1DelPlaceholder');
  const d1 = getOrCreate('rzDoppelRow1', 'input');
  d1.checked = false;

  const rzDoppel = getOrCreate('rzDoppel', 'input');
  rzDoppel.checked = false;

  const rzDoppelWrap = getOrCreate('rzDoppelWrap', 'label');
  rzDoppelWrap.appendChild(rzDoppel);

  initialisiereHeilmittelZeilen({
    tableEl: table,
    addBtnEl: btnWrap,
    bereichFn: () => 'physio',
  });

  // 1 Zeile: #rzDoppelWrap sichtbar, d1Wrap unsichtbar
  aktualisiereAddBtnSichtbarkeit();
  assert.equal(rzDoppelWrap.style.display, '');
  assert.equal(d1Wrap.style.display, 'none');

  // Zweite Zeile hinzufügen (Multi-Modus)
  const extraLine = new FakeElement('div');
  extraLine.className = 'm13-hmline-extra';
  extraLine.dataset.zeile = '2';
  extraWrap.appendChild(extraLine);

  d1.checked = true; // Zeile 1 hat Doppelbehandlung
  aktualisiereAddBtnSichtbarkeit();

  // Multi-Modus: globales #rzDoppelWrap ausgeblendet, Zeile 1 D sichtbar
  assert.equal(rzDoppelWrap.style.display, 'none');
  assert.equal(d1Wrap.style.display, 'inline-flex');

  // Zurück zu 1 Zeile (extraWrap geleert)
  extraWrap.children = [];
  aktualisiereAddBtnSichtbarkeit();

  // Single-Modus: #rzDoppelWrap wieder eingeblendet, Wert von Zeile 1 zurückgeschrieben
  assert.equal(rzDoppelWrap.style.display, '');
  assert.equal(d1Wrap.style.display, 'none');
  assert.equal(rzDoppel.checked, true);
});
