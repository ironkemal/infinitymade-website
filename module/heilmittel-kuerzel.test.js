import test from 'node:test';
import assert from 'node:assert/strict';
import { kuerzelAusKatalog, formatMultiHeilmittelTitel } from './heilmittel-kuerzel.js';

const MOCK_KATALOG = {
  physiotherapy: [
    { code: 'X0501', kuerzel: 'KG', title: 'Krankengymnastik Einzel' },
    { code: 'X1201', kuerzel: 'MT', title: 'Manuelle Therapie' },
    { code: 'X0201', kuerzel: 'MLD45', title: 'Manuelle Lymphdrainage 45 min' },
  ],
  podologie: [
    { code: '78010', kuerzel: 'pod. Beh. kl.', title: 'Podologische Behandlung (klein)' },
    { code: '78020', kuerzel: 'pod. Beh. gr.', title: 'Podologische Behandlung (groß)' },
  ],
};

test('kuerzelAusKatalog: liefert Kurzform aus Katalog', () => {
  assert.equal(kuerzelAusKatalog('X0501', MOCK_KATALOG), 'KG');
  assert.equal(kuerzelAusKatalog('x1201', MOCK_KATALOG), 'MT');
  assert.equal(kuerzelAusKatalog('78010', MOCK_KATALOG), 'pod. Beh. kl.');
});

test('kuerzelAusKatalog: Item mit bestehendem kuerzel hat Vorrang', () => {
  assert.equal(kuerzelAusKatalog({ code: 'X0501', kuerzel: 'KG-Spezial' }, MOCK_KATALOG), 'KG-Spezial');
});

test('kuerzelAusKatalog: Item mit bezeichnung mit Trennstrich', () => {
  assert.equal(kuerzelAusKatalog({ bezeichnung: 'MT – Manuelle Therapie' }, MOCK_KATALOG), 'MT');
});

test('kuerzelAusKatalog: unbekannter Code bleibt unverändert', () => {
  assert.equal(kuerzelAusKatalog('X9999', MOCK_KATALOG), 'X9999');
  assert.equal(kuerzelAusKatalog({ code: 'UNKNOWN_CODE' }, MOCK_KATALOG), 'UNKNOWN_CODE');
});

test('formatMultiHeilmittelTitel: formatiert mehrere Heilmittel mit Kurznamen und Einheiten', () => {
  const rxMulti = {
    heilmittel: 'Krankengymnastik',
    heilmittel_items: [
      { code: 'X0501', einheiten: 5 },
      { code: 'X1201', einheiten: 5 },
    ],
  };
  assert.equal(formatMultiHeilmittelTitel(rxMulti, MOCK_KATALOG), 'KG 5 · MT 5');
});

test('formatMultiHeilmittelTitel: einfache Verordnung nutzt regulären Titel', () => {
  const rxSingle = {
    heilmittel: 'Krankengymnastik Einzel',
    heilmittel_position: 'X0501',
  };
  assert.equal(formatMultiHeilmittelTitel(rxSingle, MOCK_KATALOG), 'Krankengymnastik Einzel');
});

test('kuerzelAusKatalog: X0501 – Krankengymnastik liefert KG, nicht den Code vor dem Bindestrich', () => {
  assert.equal(kuerzelAusKatalog({ code: 'X0501', bezeichnung: 'X0501 – Krankengymnastik' }, MOCK_KATALOG), 'KG');
  assert.equal(kuerzelAusKatalog({ bezeichnung: 'X0501 – Krankengymnastik' }, MOCK_KATALOG), 'KG');
  assert.equal(kuerzelAusKatalog('X0501 – Krankengymnastik', MOCK_KATALOG), 'KG');
});

test('kuerzelAusKatalog: synchroner Fallback ohne Katalog-Parameter', () => {
  assert.equal(kuerzelAusKatalog('X0501'), 'KG');
  assert.equal(kuerzelAusKatalog('X1201'), 'MT');
  assert.equal(kuerzelAusKatalog({ code: 'X0501', bezeichnung: 'X0501 – Krankengymnastik' }), 'KG');
});

test('formatMultiHeilmittelTitel: X-Code-Titel wird zum Kurznamen aufgelöst', () => {
  const rxCode = {
    heilmittel: 'X0501 – Krankengymnastik',
    heilmittel_position: 'X0501',
  };
  assert.equal(formatMultiHeilmittelTitel(rxCode, MOCK_KATALOG), 'KG');
});
