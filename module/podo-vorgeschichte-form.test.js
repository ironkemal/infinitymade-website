import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vorgeschichteFormHtml } from './podo-vorgeschichte-form.js';

test('Nagelfelder nur bei bekanntem Nagel, gespeicherte Werte vorbelegt', () => {
  const lead = { podo_vorgeschichte_78040_am: '2025-03-01', podo_vorgeschichte_naegel: { 'U1 links': { erstbefundung: { code: '78110', am: '2026-02-10' } } } };
  const mit = vorgeschichteFormHtml(lead, 'U1 links');
  assert.match(mit, /podVgNagelCode/);
  assert.match(mit, /value="2025-03-01"/);
  assert.match(mit, /<option value="78110" selected>/);
  assert.doesNotMatch(vorgeschichteFormHtml(lead, ''), /podVgNagelCode/);
});
