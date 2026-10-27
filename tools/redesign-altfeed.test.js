import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
const start = source.indexOf('async function loadActivityFeed() {');
const end = source.indexOf('\n// Inhalt eines Terminblocks', start);
assert.ok(start >= 0 && end > start);
const original = source.slice(start, end);

function setup({ role = 'owner', design = 'alt', pending = false, containerExists = true } = {}) {
  const reads = [], scope = [], container = { innerHTML: 'ALTER PRIVATER STAND', replaceChildren() { this.innerHTML = ''; } };
  let release;
  const wait = pending ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  const context = vm.createContext({
    currentProfile: role === null ? null : { role }, tenant: 'owner-a',
    document: { documentElement: { dataset: { design } }, getElementById: () => containerExists ? container : null },
    getOwnerId: () => { scope.push(context.tenant); return context.tenant; },
    bizScope: q => q, escapeHtml: s => String(s).replace(/</g, '&lt;'), formatActivityTimestamp: () => 'Zeit',
    console: { error() { throw new Error('Unerwarteter Produktfehler'); } },
    supabase: { from(table) {
      const record = { table, selects: [], filters: [] }; reads.push(record);
      const q = { select(s) { record.selects.push(s); return q; }, eq(k, v) { record.filters.push([k, v]); return q; },
        neq() { return q; }, order() { return q; }, limit() { return q; },
        then(ok, fail) { return wait.then(() => ({ data: table === 'invoices' ? [{ id: 'synthetic', status: 'paid', invoice_number: 'TEST-1', total_patient: 42, patient_name: '<Test>', created_at: '2026-10-23T08:00:00Z' }] : [] })).then(ok, fail); } };
      return q;
    } },
  });
  vm.runInContext(original, context);
  return { context, reads, scope, container, release, run: () => context.loadActivityFeed() };
}

for (const role of ['employee', 'admin', 'unbekannt', null]) test(`Legacy-Feed ${role}: vor sämtlichen Datenreads verweigert und Altstand entfernt`, async () => {
  const s = setup({ role }); await s.run();
  assert.equal(s.reads.length, 0); assert.equal(s.scope.length, 0); assert.equal(s.container.innerHTML, '');
});
test('Neu-Design: entfallener Altfeed lädt auch für Owner keine Daten', async () => {
  const s = setup({ design: 'neu' }); await s.run(); assert.equal(s.reads.length, 0); assert.equal(s.scope.length, 0); assert.equal(s.container.innerHTML, '');
});
test('Owner-Alt: vorhandene fünf mandantenbezogene Quellen und Rechnungsanzeige bleiben', async () => {
  const s = setup(); await s.run();
  assert.deepEqual(s.reads.map(r => r.table), ['patient_notes', 'invoices', 'fahrten', 'bookings', 'leads']);
  assert.ok(s.reads.every(r => r.filters.some(([k, v]) => k === 'owner_id' && v === 'owner-a')));
  assert.match(s.container.innerHTML, /TEST-1/); assert.match(s.container.innerHTML, /42,00/); assert.match(s.container.innerHTML, /&lt;Test>/);
});
for (const change of ['employee', 'tenant', 'neu']) test(`Verspätete Feedantwort nach ${change}-Wechsel entfernt privaten Altstand`, async () => {
  const s = setup({ pending: true }); const request = s.run();
  if (change === 'employee') s.context.currentProfile = { role: 'employee' };
  else if (change === 'tenant') s.context.tenant = 'owner-b';
  else s.context.document.documentElement.dataset.design = 'neu';
  s.release(); await request; assert.equal(s.container.innerHTML, '');
});
test('Fehlender Feedcontainer: keine Datenreads', async () => {
  const s = setup({ containerExists: false }); await s.run(); assert.equal(s.reads.length, 0);
});
