import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vorgeschichteFormHtml, montiereVorgeschichte } from './podo-vorgeschichte-form.js';

test('Nagelfelder nur bei bekanntem Nagel, gespeicherte Werte vorbelegt', () => {
  const lead = { podo_vorgeschichte_78040_am: '2025-03-01', podo_vorgeschichte_naegel: { 'U1 links': { erstbefundung: { code: '78110', am: '2026-02-10' } } } };
  const mit = vorgeschichteFormHtml(lead, 'U1 links');
  assert.match(mit, /podVgNagelCode/);
  assert.match(mit, /value="2025-03-01"/);
  assert.match(mit, /<option value="78110" selected>/);
  assert.doesNotMatch(vorgeschichteFormHtml(lead, ''), /podVgNagelCode/);
});

// podoloji 21.10.2026 (PE-009): auch bei NEUER VO sichtbar, wenn der Patient aus dem Altsystem kommt.
test('montiereVorgeschichte: sichtbar bei Altsystem-VO oder -Patient, sonst leer', async () => {
  const sbMit = (lead) => ({ from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: lead }) }; return q; } });
  const wrap = () => ({ innerHTML: 'x', querySelector: () => null });
  const fall = async (lead, immer) => { const w = wrap(); await montiereVorgeschichte({ sb: sbMit(lead), ownerId: 'o', leadId: 'l', nagel: '', wrap: w, immer }); return w.innerHTML; };
  assert.equal(await fall({}, false), '');
  assert.match(await fall({}, true), /podVgBlock/);
  assert.match(await fall({ metadata: { import_batch: 'b1' } }, false), /podVgBlock/);
  assert.match(await fall({ podo_vorgeschichte_erfasst_am: '2026-10-21T10:00:00Z' }, false), /podVgBlock/);
});
