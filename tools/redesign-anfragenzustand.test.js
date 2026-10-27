import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { zuErledigen } from '../module/startseite-rechnen.js';

const source = readFileSync(new URL('../module/startseite-neu.js', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
const take = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)));
function render({ status, count = '0', vo = ['0', '0'], voStatus = 'ok', anfragen = true, verordnungen = true } = {}) {
  const elements = {
    anfragenNavBadge: { dataset: { pxStatus: status, pxCount: count }, style: { display: 'none' }, textContent: '' },
    physioRezKpi: { dataset: { pxStatus: voStatus }, style: {}, hidden: false },
    rezKpiOverdue: { style: {}, textContent: vo[0] }, rezKpiSoon: { style: {}, textContent: vo[1] },
  };
  const c = vm.createContext({ document: { getElementById: id => elements[id] },
    inLeiste: id => id === 'anfragen' ? anfragen : id === 'verordnungen' ? verordnungen : false,
    zuErledigen, esc: String, TODO_ICON: {}, ICON: {} });
  vm.runInContext(take(source, 'const zahlAus =', 'const istOwner =') + take(source, 'function todoHtml()', '\nfunction listeHtml'), c);
  return c.todoHtml();
}
for (const status of [undefined, 'loading', 'error']) test(`VO0 + Anfrage ${status}: keine Entwarnung`, () => {
  assert.doesNotMatch(render({ status }), /Nichts offen/);
});
test('Alle berechtigten Quellen erfolgreich0: Entwarnung trotz verstecktem Anfragebadge', () => {
  assert.match(render({ status: 'ok' }), /Nichts offen/);
});
test('Nicht berechtigter Anfragenbereich zählt nicht als Unknown', () => {
  assert.match(render({ anfragen: false }), /Nichts offen/);
});
test('Positive bekannte Teilmenge neben Unknown sichtbar und gekennzeichnet', () => {
  const html = render({ status: 'error', vo: ['2', '0'] });
  assert.match(html, /Verordnung überfällig/); assert.match(html, /nicht vollständig/); assert.doesNotMatch(html, /Nichts offen/);
});
test('Anfragen0 + fehlende berechtigte VO-Zahl: keine Entwarnung', () => {
  assert.doesNotMatch(render({ status: 'ok', vo: ['', '0'] }), /Nichts offen/);
});
test('Keine berechtigten Quellen: keine pauschale Entwarnung', () => {
  assert.doesNotMatch(render({ anfragen: false, verordnungen: false }), /Nichts offen/);
});
for (const voStatus of ['loading', 'error']) test(`Alte sichtbare VO0 bei ${voStatus}: keine Entwarnung`, () => {
  assert.doesNotMatch(render({ status: 'ok', voStatus }), /Nichts offen/);
});
for (const count of ['', '-1', 'NaN', '0abc']) test(`Ungültiger Anfragecount ${count}: unbekannt`, () => {
  assert.doesNotMatch(render({ status: 'ok', count }), /Nichts offen/);
});

function loader() {
  const badge = { dataset: {}, style: {}, textContent: '' }, list = { innerHTML: '' }, calls = [];
  const c = vm.createContext({ document: { getElementById: id => id === 'anfragenNavBadge' ? badge : list },
    currentProfile: { id: 'synthetic-owner' }, anfragenCurrentStatus: 'pending', anfragenCurrentRequests: [], API: '/api',
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic' } } }) } },
    fetch: url => new Promise(resolve => calls.push({ url, resolve })), renderAnfragenList() {}, console: { error() {} } });
  vm.runInContext(take(dashboard, 'async function loadAnfragen(status)', '\nfunction renderAnfragenList') + take(dashboard, 'function updateAnfragenBadge(count)', '\nfunction showAnfrageDetail'), c);
  return { c, badge, calls, run: status => c.loadAnfragen(status), flush: async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); } };
}
test('Echter Loader: pending→erfolgreiche0 explizit bekannt', async () => {
  const s = loader(), p = s.run('pending'); await s.flush(); assert.equal(s.badge.dataset.pxStatus, 'loading');
  s.calls[0].resolve({ ok: true, json: async () => ({ requests: [] }) }); await p;
  assert.equal(s.badge.dataset.pxStatus, 'ok'); assert.equal(s.badge.dataset.pxCount, '0'); assert.equal(s.badge.style.display, 'none');
});
for (const response of [{ ok: false, json: async () => ({ requests: [] }) }, { ok: true, json: async () => ({}) }]) test('HTTP-/Shapefehler niemals bekannte0', async () => {
  const s = loader(), p = s.run('pending'); await s.flush(); s.calls[0].resolve(response); await p;
  assert.equal(s.badge.dataset.pxStatus, 'error');
});
test('Tabwechsel und ältere Pending-Antwort überschreiben jüngste Quelle nicht', async () => {
  const s = loader(), old = s.run('pending'); await s.flush();
  const approved = s.run('approved'); await s.flush(); const latest = s.run('pending'); await s.flush();
  s.calls[2].resolve({ ok: true, json: async () => ({ requests: [{ status: 'pending' }] }) }); await latest;
  s.calls[1].resolve({ ok: true, json: async () => ({ requests: [] }) }); await approved;
  s.calls[0].resolve({ ok: true, json: async () => ({ requests: [] }) }); await old;
  assert.equal(s.badge.dataset.pxStatus, 'ok'); assert.equal(s.badge.dataset.pxCount, '1');
});
