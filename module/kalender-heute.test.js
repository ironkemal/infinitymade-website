import { test } from 'node:test';
import assert from 'node:assert/strict';

import { verdrahteHeuteButton } from './kalender-heute.js';

/**
 * Kleinster Ersatz für document: liefert bei getElementById ein Element,
 * das sich seinen Klick-Zuhörer merkt.
 */
function machDocument(vorhanden = true) {
  const zuhoerer = [];
  const btn = {
    addEventListener(typ, fn) { if (typ === 'click') zuhoerer.push(fn); },
  };
  return {
    zuhoerer,
    getElementById: (id) => (id === 'calTodayBtn' && vorhanden ? btn : null),
  };
}

test('verdrahteHeuteButton haengt den Klick-Zuhoerer an #calTodayBtn', () => {
  const doc = machDocument();
  global.document = doc;
  let aufgerufen = false;
  verdrahteHeuteButton(() => { aufgerufen = true; });
  assert.equal(doc.zuhoerer.length, 1, 'genau ein Klick-Zuhoerer erwartet');
  doc.zuhoerer[0]();
  assert.equal(aufgerufen, true, 'Callback muss beim Klick laufen');
});

test('verdrahteHeuteButton faengt fehlenden Button ab, ohne zu werfen', () => {
  global.document = machDocument(false);
  assert.doesNotThrow(() => verdrahteHeuteButton(() => {}));
});
