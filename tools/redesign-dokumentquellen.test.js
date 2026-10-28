import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const owner = '10000000-0000-4000-8000-000000000001', patient = '20000000-0000-4000-8000-000000000001';
function sbDouble(response) {
  const calls = [], reads = [];
  const sb = { from(table) {
    const ops = []; calls.push({ table, ops });
    const q = new Proxy({}, { get(_, method) {
      if (method === 'then') return (ok, fail) => { reads.push(table); return Promise.resolve(response(table, ops)).then(ok, fail); };
      return (...args) => { ops.push([method, ...args]); return q; };
    } }); return q;
  } }; return { sb, calls, reads };
}
function voFixture(response = () => ({ data: [], error: null })) {
  const f = sbDouble(response), c = vm.createContext({ console, belegnummerText: r => r.belegnummer || '' });
  const s = source('module/verordnung-uebersicht.js');
  vm.runInContext(s.slice(s.indexOf('export async function ladeAktiveVerordnungen'), s.indexOf('\nconst BELEG_TITEL')).replace('export ', ''), c);
  return { ...f, lade: opts => c.ladeAktiveVerordnungen(f.sb, { ownerId: owner, nurAktive: false, nurSuchdaten: true, ...opts }) };
}
test('Original-VO-Lader: Owner und Patientenscope in beiden echten Queries, keine Clinical-/Katalogreads', async () => {
  const f = voFixture(); await f.lade({ suchPatientIds: [patient], signal: new AbortController().signal });
  assert.equal(f.calls.length, 2);
  for (const { table, ops } of f.calls) {
    assert.equal(table, 'prescriptions');
    assert.ok(ops.some(o => o[0] === 'eq' && o[1] === 'owner_id' && o[2] === owner));
    assert.ok(ops.some(o => o[0] === 'in' && o[1] === 'patient_id' && o[2][0] === patient));
    assert.ok(ops.some(o => o[0] === 'limit' && o[1] === 200));
    assert.ok(ops.some(o => o[0] === 'abortSignal'));
    assert.doesNotMatch(ops.find(o => o[0] === 'select')[1], /versichertennummer|prescription_sessions|heilmittel_items/);
  }
  assert.ok(f.calls[0].ops.some(o => o[0] === 'or' && o[1] === 'therapie_bereich.is.null,therapie_bereich.neq.podo'));
  assert.ok(f.calls[1].ops.some(o => o[0] === 'eq' && o[1] === 'therapie_bereich' && o[2] === 'podo'));
});
test('Original-VO-Lader: leere erlaubte Menge/Abbruch/veralteter Kontext null Reads', async () => {
  for (const opts of [{ suchPatientIds: [] }, { signal: AbortSignal.abort() }, { istAktuell: () => false }]) {
    const f = voFixture(); await f.lade(opts); assert.deepEqual(f.reads, []);
  }
});
test('Original-VO-Lader: Queryfehler/unerwarteter Owner/Patient werden nie leere Erfolgsliste', async () => {
  for (const response of [() => ({ data: null, error: { message: 'synthetisch' } }),
    () => ({ data: [{ id: 'R', owner_id: patient, patient_id: patient }], error: null }),
    () => ({ data: [{ id: 'R', owner_id: owner, patient_id: owner }], error: null })]) {
    await assert.rejects(voFixture(response).lade({ suchPatientIds: [patient] }));
  }
});

function invoiceFixture(response, suche) {
  const f = sbDouble(response); let renders = 0;
  const c = vm.createContext({ supabase: f.sb, getOwnerId: () => owner, console,
    bizScope(q, cat) { assert.equal(cat, 'finance'); return q.or('BESTEHENDER_SCOPE'); },
    invListCache: ['ALT'], renderInvList() { renders++; } });
  const s = source('dashboard.js'), a = s.indexOf('async function loadRechnungen(');
  vm.runInContext(s.slice(a, s.indexOf('\nfunction printArea', a)), c);
  return { ...f, c, get renders() { return renders; }, lade: () => c.loadRechnungen(suche) };
}
test('Original-Rechnungslader: Suchaufruf liefert Daten ohne globalen Cache/Renderer; Altweg unverändert', async () => {
  const row = { id: 'R' }, f = invoiceFixture(() => ({ data: [row], error: null }), { ownerId: owner, istAktuell: () => true, scope: q => q.limit(200) });
  assert.equal((await f.lade())[0].id, 'R'); assert.deepEqual(f.c.invListCache, ['ALT']); assert.equal(f.renders, 0);
  assert.ok(f.calls[0].ops.some(o => o[0] === 'eq' && o[1] === 'owner_id' && o[2] === owner));
  assert.doesNotMatch(f.calls[0].ops.find(o => o[0] === 'select')[1], /total_patient|line_items|\*/);
  const alt = invoiceFixture(() => ({ data: [row], error: null })); await alt.lade();
  assert.equal(alt.renders, 1); assert.ok(alt.calls[0].ops.some(o => o[0] === 'or' && o[1] === 'BESTEHENDER_SCOPE'));
});
test('Original-Rechnungslader: verspätete Antwort und Fehler schreiben keinen Cache', async () => {
  let aktuell = true, resolve;
  const pending = new Promise(r => { resolve = r; });
  const f = invoiceFixture(() => pending, { ownerId: owner, istAktuell: () => aktuell, scope: q => q });
  const p = f.lade(); aktuell = false; resolve({ data: [{ id: 'ALT' }], error: null }); await p;
  assert.deepEqual(f.c.invListCache, ['ALT']); assert.equal(f.renders, 0);
  const fehler = invoiceFixture(() => ({ data: null, error: { message: 'ROHFEHLER' } }), { ownerId: owner, istAktuell: () => true, scope: q => q });
  await assert.rejects(fehler.lade(), /SUCHE_QUELLE_UNBEKANNT/);
});

test('Tatsächlicher Rechnungsrenderer: Scopewechsel während Zusatzread verhindert sämtliche DOM-Zugriffe', async () => {
  let aktuell = true, resolve, dom = 0;
  const pending = new Promise(r => { resolve = r; });
  const f = sbDouble(() => pending), s = source('module/rechnung-ansicht.js');
  const c = vm.createContext({ d: { liste: () => [], profile: () => ({}), supabase: f.sb },
    document: { getElementById() { dom++; throw Error('ALTER_DOM'); } } });
  const a = s.indexOf('export async function openInvView(');
  vm.runInContext(s.slice(a, s.indexOf('\nexport function closeInvView', a)).replace('export ', ''), c);
  const p = c.openInvView('R', { ownerId: owner, rechnung: { id: 'R', owner_id: owner, patient_id: patient, prescription_id: 'RX' },
    signal: new AbortController().signal, istAktuell: () => aktuell, element() { dom++; } });
  aktuell = false; resolve({ data: [], error: null }); await p; assert.equal(dom, 0);
  for (const call of f.calls.filter(c => c.table !== 'prescription_sessions')) assert.ok(call.ops.some(o => o[0] === 'eq' && o[1] === 'owner_id' && o[2] === owner));
  const sessions = f.calls.find(c => c.table === 'prescription_sessions');
  assert.ok(sessions.ops.some(o => o[0] === 'eq' && o[1] === 'prescriptions.owner_id' && o[2] === owner));
});
