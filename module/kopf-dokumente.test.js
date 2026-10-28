import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDokumentSuche, dokumenteErlaubt } from './kopf-dokumente.js';

const owner = '10000000-0000-4000-8000-000000000001';
const patient = '20000000-0000-4000-8000-000000000001';
const id = '50000000-0000-4000-8000-000000000001';
const business = '10000000-0000-4000-8000-000000000003';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const basis = () => ({ rolle: 'owner', uid: owner, ownerId: owner, businessId: business,
  bereit: true, financeBereit: true, patientsGemeinsam: false, financeGemeinsam: false,
  verordnungenErlaubt: true, rechnungenErlaubt: true });
const vo = () => ({ id, leadId: patient, quelle: 'physio', nummerText: 'VO-123', vorname: 'Test', nachname: 'Probe', titel: 'KG' });
const inv = () => ({ id, owner_id: owner, business_id: null, invoice_number: 'RE-123', patient_name: 'Probe' });

test('Employee, falscher Owner, unbekannter Scope und fehlender Einstieg: null Fachreads', async () => {
  for (const patch of [{ rolle: 'employee' }, { uid: patient }, { bereit: false }, { businessId: undefined }, { patientsGemeinsam: null }]) {
    const k = { ...basis(), ...patch }; let reads = 0;
    const s = createDokumentSuche({ kontext: () => k, scopeLader: () => { reads++; }, voLader: () => { reads++; } });
    for (const art of ['verordnung', 'rechnung']) assert.equal((await s.laden(art)).status, 'unbekannt');
    assert.equal(reads, 0);
  }
  assert.equal(dokumenteErlaubt({ ...basis(), financeBereit: false }, 'rechnung'), false);
  assert.equal(dokumenteErlaubt({ ...basis(), rechnungenErlaubt: false }, 'rechnung'), false);
  assert.equal(dokumenteErlaubt({ ...basis(), verordnungenErlaubt: false }, 'verordnung'), false);
});

test('VO-Lader erhält belegten Patientenscope vor Read; leere erlaubte Menge verursacht keinen Dokumentread', async () => {
  let ids = [patient], reads = 0;
  const s = createDokumentSuche({ kontext: basis, scopeLader: async () => ({ umfang: 'patienten', patientIds: ids }),
    voLader: async (_, opts) => { reads++; assert.deepEqual(opts.suchPatientIds, [patient]); assert.equal(opts.nurSuchdaten, true); assert.equal(opts.ownerId, owner); return [vo()]; } });
  assert.equal((await s.laden('verordnung')).zeilen[0].id, 'verordnung:' + id);
  ids = []; assert.deepEqual((await s.laden('verordnung')).zeilen, []); assert.equal(reads, 1);
});

test('Unbekannter Patientenscope sperrt VO; Quelle und scopewidrige Antwort werden Fehler', async () => {
  const scopeLader = async () => ({ umfang: 'patienten', patientIds: [patient] });
  for (const voLader of [async () => { throw Error('ROHFEHLER'); }, async () => [{ ...vo(), leadId: owner }]]) {
    const r = await createDokumentSuche({ kontext: basis, scopeLader, voLader }).laden('verordnung');
    assert.deepEqual(r, { status: 'fehler', zeilen: [] }); assert.equal(JSON.stringify(r).includes('ROHFEHLER'), false);
  }
  let reads = 0;
  assert.equal((await createDokumentSuche({ kontext: basis, scopeLader: async () => null, voLader: () => { reads++; } }).laden('verordnung')).status, 'unbekannt');
  assert.equal(reads, 0);
});

test('Scope-/Rollenwechsel während Scope-Read startet keinen Dokumentread', async () => {
  for (const patch of [{ rolle: 'employee' }, { businessId: patient }, { uid: patient }, { patientsGemeinsam: true }, { bereit: false }]) {
    let k = basis(), reads = 0; const d = deferred();
    const s = createDokumentSuche({ kontext: () => k, scopeLader: () => d.promise, voLader: () => { reads++; } });
    const p = s.laden('verordnung'); k = { ...k, ...patch }; d.resolve({ umfang: 'mandant' });
    assert.equal((await p).status, 'veraltet'); assert.equal(reads, 0);
  }
});

test('Überholte Suchantwort verdrängt neue Antwort nicht; expliziter Abbruch verwirft Treffer', async () => {
  const a = deferred(), b = deferred(); let n = 0;
  const s = createDokumentSuche({ kontext: basis, scopeLader: async () => ({ umfang: 'mandant' }), voLader: () => (++n === 1 ? a.promise : b.promise) });
  const p = s.laden('verordnung'); await Promise.resolve();
  const q = s.laden('verordnung'); await Promise.resolve(); b.resolve([vo()]);
  assert.equal((await q).zeilen.length, 1); a.resolve([vo()]); assert.equal((await p).status, 'veraltet');
});

test('Hängender Transport endet endlich als Fehler', async () => {
  const r = await createDokumentSuche({ kontext: basis, timeoutMs: 5, scopeLader: () => new Promise(() => {}) }).laden('verordnung');
  assert.deepEqual(r, { status: 'fehler', zeilen: [] });
});

test('Rechnungsloader verwendet Finance-Standort/NULL, Grenze und Abort; Sharing entfernt Standortfilter', async () => {
  for (const geteilt of [false, true]) {
    const k = { ...basis(), financeGemeinsam: geteilt };
    const calls = [], q = { or(s) { calls.push(s); return this; }, limit(n) { assert.equal(n, 200); return this; }, abortSignal(s) { assert.equal(s.aborted, false); return this; } };
    k.ladeRechnungen = async opts => { assert.equal(opts.ownerId, owner); opts.scope(q); return [inv()]; };
    const r = await createDokumentSuche({ kontext: () => k }).laden('rechnung');
    assert.equal(r.zeilen[0].id, 'rechnung:' + id);
    assert.deepEqual(calls, geteilt ? [] : [`business_id.eq.${business},business_id.is.null`]);
  }
});

test('Fremdmandant und Fremdstandort in Rechnungsantwort werden nicht angezeigt', async () => {
  for (const row of [{ ...inv(), owner_id: patient }, { ...inv(), business_id: patient }]) {
    const k = { ...basis(), ladeRechnungen: async () => [row] };
    assert.deepEqual(await createDokumentSuche({ kontext: () => k }).laden('rechnung'), { status: 'fehler', zeilen: [] });
  }
});

test('Alte Auswahl nach Scopewechsel: weder frischer Read noch Navigation/Öffner', async () => {
  let k = basis(), reads = 0, opens = 0;
  const s = createDokumentSuche({ kontext: () => k, scopeLader: async () => { reads++; return { umfang: 'mandant' }; }, voLader: async () => [vo()], voOeffner: () => { opens++; } });
  const row = (await s.laden('verordnung')).zeilen[0]; k = { ...k, businessId: patient };
  assert.equal((await s.oeffnen(row)).status, 'veraltet'); assert.equal(reads, 1); assert.equal(opens, 0);
});

test('VO-Auswahl prüft Scope erneut und verwendet bestehenden Renderer ohne Bearbeitung', async () => {
  const vorher = globalThis.document; globalThis.document = { getElementById: () => ({}) };
  try {
    let panel, opens = 0, scopeReads = 0;
    const k = { ...basis(), switchPanel: async (p, opt) => { assert.equal(opt.istAktuell(), true); panel = p; }, aktivesPanel: () => panel };
    const s = createDokumentSuche({ kontext: () => k, ansicht: () => ({ titel: {}, inhalt: {}, schliessen() {} }), scopeLader: async () => { scopeReads++; return { umfang: 'patienten', patientIds: [patient] }; }, voLader: async () => [vo()], voOeffner: async ctx => {
      opens++; assert.equal(ctx.verordnungId, id); assert.equal(ctx.leadId, patient); assert.equal(ctx.suchOwnerId, owner); assert.equal(ctx.bearbeitbar, false); assert.equal(ctx.istAktuell(), true);
    } });
    assert.equal((await s.oeffnen((await s.laden('verordnung')).zeilen[0])).status, 'ok'); assert.equal(scopeReads, 2); assert.equal(opens, 1);
  } finally { globalThis.document = vorher; }
});

test('Rechnungsauswahl liest Dokument erneut im Finance-Scope; Kontextwechsel verhindert Ansicht', async () => {
  for (const wechseln of [false, true]) {
    let k = basis(), views = 0, opens = 0; const d = deferred(), calls = [];
    const q = new Proxy({}, { get(_, m) { if (m === 'then') return d.promise.then.bind(d.promise); return (...args) => { calls.push([m, ...args]); return q; }; } });
    k = { ...k, supabase: { from: t => { assert.equal(t, 'invoices'); return q; } }, ladeRechnungen: async () => [inv()] };
    const s = createDokumentSuche({ kontext: () => k, ansicht: () => { views++; return { element() {}, schliessen() {} }; },
      rechnungOeffner: async (rxId, ctx) => { opens++; assert.equal(rxId, id); assert.equal(ctx.rechnung.owner_id, owner); assert.equal(ctx.istAktuell(), true); } });
    const row = (await s.laden('rechnung')).zeilen[0], p = s.oeffnen(row);
    if (wechseln) k = { ...k, financeGemeinsam: true };
    d.resolve({ data: inv(), error: null });
    assert.equal((await p).status, wechseln ? 'veraltet' : 'ok'); assert.equal(views, wechseln ? 0 : 1); assert.equal(opens, views);
    assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'owner_id' && c[2] === owner));
    assert.ok(calls.some(c => c[0] === 'or' && c[1] === `business_id.eq.${business},business_id.is.null`));
  }
});
