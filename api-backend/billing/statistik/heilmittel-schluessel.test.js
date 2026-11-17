import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heilmittelSchluessel } from './heilmittel-schluessel.js';

const KG = 'X0501 Allgemeine Krankengymnastik (KG) Einzel';

test('Fund 8: zwei Schreibweisen von X0501 ergeben einen Schlüssel', () => {
  assert.deepEqual(heilmittelSchluessel({ therapie_bereich: 'physio', heilmittel: 'Krankengymnastik Einzel', heilmittel_position: '20501', heilmittel_items: null }), [KG]);
  assert.deepEqual(heilmittelSchluessel({ therapie_bereich: 'physio', heilmittel: 'X0501 – Allgemeine Krankengymnastik (KG) Einzel', heilmittel_position: '20501' }), [KG]);
  assert.deepEqual(heilmittelSchluessel({ therapie_bereich: 'physio', heilmittel_items: [{ code: 'X0501', bezeichnung: 'Krankengymnastik Einzel' }, { code: 'X1201', bezeichnung: 'Manuelle Therapie' }] }),
    [KG, 'X1201 Manuelle Therapie Einzel']);
});

test('Podologie bleibt bei der Bezeichnung, Freitext ohne Code bleibt Freitext', () => {
  assert.deepEqual(heilmittelSchluessel({ therapie_bereich: 'podo', heilmittel_items: [{ code: '78100', bezeichnung: 'Hornhautabtragung' }] }), ['Hornhautabtragung']);
  assert.deepEqual(heilmittelSchluessel({ therapie_bereich: 'ergo', heilmittel: 'Ergotherapie motorisch' }), ['Ergotherapie motorisch']);
});
