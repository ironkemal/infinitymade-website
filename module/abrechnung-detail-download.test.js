// Detail wird nach dem DTA-Download neu geladen (Live-QA 05.10.2026, Schritt 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
const els = {};
const mk = (id) => (els[id] ||= { id, dataset: {}, style: {}, innerHTML: '', textContent: '', querySelectorAll: () => [], addEventListener() {} });
globalThis.document = { getElementById: mk, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
globalThis.window = { open() {}, addEventListener() {} };
let zeilenAufrufe = 0;
globalThis.fetch = async (url) => {
  if (String(url).includes('/zeilen')) { zeilenAufrufe++; return { ok: true, json: async () => ({ abrechnung: { id: 'a1', status: zeilenAufrufe > 1 ? 'heruntergeladen' : 'erstellt', dateiname: 'TSOL1', storage_path: 'o/p', betriebsart: 'test' }, gruppen: [], zeilen: [], geld: {} }) }; }
  return { ok: true, json: async () => ({}) };
};
const m = await import('./abrechnung-detail.js');
test('DTA-Download laedt das offene Detail neu und zeigt Heruntergeladen', async () => {
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'x' }, error: null }) }) },
    from: () => { const b = { update() { return b; }, eq() { return b; }, then(r) { return Promise.resolve({ error: null }).then(r); } }; return b; },
  };
  m.initAbrechnungDetail({ supabase, apiBase: 'http://x', escapeHtml: s => String(s), showToast() {}, nachDownload: async () => {}, aktionen: {} });
  mk('abDetailContent'); mk('abDetailTitel');
  await m.zeigeAbrechnungDetail('a1');
  assert.equal(zeilenAufrufe, 1);
  assert.match(els.abDetailContent.innerHTML, /Erstellt/);
  await m.downloadAbrechnungFile('o/p', 'a1', 'dta');
  assert.equal(zeilenAufrufe, 2, 'Detail muss nach dem Download neu geladen werden');
  assert.match(els.abDetailContent.innerHTML, /Heruntergeladen/);

});
