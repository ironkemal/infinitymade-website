import test from 'node:test';
import assert from 'node:assert/strict';
import { renderVerlauf } from './patientenkarte.js';

test('Chrome1911 · kommende Termine zuerst aufsteigend, abgeschlossene Historie separat', () => {
  const el = { innerHTML: '', querySelectorAll: () => [] };
  const row = (datum, text) => ({ datum, text, art: 'Termin', ziel: 'kalender', id: text });
  renderVerlauf(el, [row('2099-11-21', 'Spaeter'), row('2099-11-19', 'Zuerst'), row('2000-11-19', 'Frueher')]);
  assert.match(el.innerHTML, /Kommende Termine.*Zuerst.*Spaeter.*Bisheriger Verlauf.*Frueher/s);
});
