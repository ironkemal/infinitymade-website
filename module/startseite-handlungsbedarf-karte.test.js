import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeHandlungsbedarfScope, createHandlungsbedarfKarte, handlungsbedarfHtml } from './startseite-handlungsbedarf-karte.js';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const k = extra => ({ rolle: 'owner', uid: id(1), ownerId: id(1), businessId: id(2), patientsGemeinsam: false, bereit: true, ...extra });
const input = () => ({ version: 1, heute: '2026-10-28', verordnungen: { status: 'ok', vollstaendig: true, daten: [] } });
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const pending = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function client(pages) {
  const calls = [];
  return { calls, from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const q = { select(v) { call.projection = v; return q; }, eq(...v) { call.filters.push(['eq', ...v]); return q; },
      or(v) { call.or = v; return q; }, order(...v) { call.order = v; return q; }, limit(v) { call.limit = v; return q; },
      gt(...v) { call.filters.push(['gt', ...v]); return q; }, abortSignal(v) { call.signal = v; return q; },
      then(resolve) { return Promise.resolve(pages.shift()).then(resolve); } };
    return q;
  } };
}
const scope = (kontext, supabase) => ladeHandlungsbedarfScope({ kontext, supabase, signal: new AbortController().signal, istAktuell: () => true });

for (const extra of [{ bereit: false }, { rolle: 'employee' }, { uid: id(3) }, { patientsGemeinsam: null }, { businessId: 'bad' }]) {
  test(`unbelegter Scope: ${JSON.stringify(extra)} erzeugt null Reads`, async () => {
    const db = client([]); assert.equal(await scope(k(extra), db), null); assert.equal(db.calls.length, 0);
  });
}
for (const extra of [{ patientsGemeinsam: true }, { businessId: null }]) {
  test(`bestätigter Mandant: ${JSON.stringify(extra)}`, async () => {
    const db = client([]); const r = await scope(k(extra), db);
    assert.equal(r.umfang, 'mandant'); assert.equal(r.vollstaendig, true); assert.equal(db.calls.length, 0);
  });
}
test('Standort plus NULL: minimale Projektion, Owner und Keyset bis leer', async () => {
  const db = client([{ data: [{ id: id(3), owner_id: id(1), business_id: id(2) }] },
    { data: [{ id: id(4), owner_id: id(1), business_id: null }] }, { data: [] }]);
  assert.deepEqual((await scope(k(), db)).patientIds, [id(3), id(4)]);
  assert.equal(db.calls.length, 3);
  for (const c of db.calls) {
    assert.equal(c.table, 'leads'); assert.equal(c.projection, 'id,owner_id,business_id'); assert.equal(c.limit, 200);
    assert.equal(c.or, `business_id.eq.${id(2)},business_id.is.null`); assert.deepEqual(c.order, ['id', { ascending: true }]);
    assert.ok(c.filters.some(f => f[0] === 'eq' && f[1] === 'owner_id' && f[2] === id(1)));
  }
  assert.ok(db.calls[2].filters.some(f => f[0] === 'gt' && f[2] === id(4)));
});
for (const row of [{ owner_id: id(9) }, { business_id: id(9) }, { id: 'bad' }, { business_id: undefined }]) {
  test(`fremde/ungültige Antwort verwirft Scope: ${JSON.stringify(row)}`, async () => {
    assert.equal(await scope(k(), client([{ data: [{ id: id(3), owner_id: id(1), business_id: null, ...row }] }])), null);
  });
}
test('Folgefehler und duplizierter Cursor erlauben keine Entwarnungsbasis', async () => {
  const row = { id: id(3), owner_id: id(1), business_id: null };
  for (const second of [{ error: { message: 'secret' } }, { data: [row] }, { data: null }]) {
    assert.equal(await scope(k(), client([{ data: [row] }, second])), null);
  }
});
test('Scopewechsel während Lead-Read verwirft Antwort', async () => {
  let aktuell = true; const p = pending();
  const r = ladeHandlungsbedarfScope({ kontext: k(), supabase: client([p.promise]), signal: new AbortController().signal, istAktuell: () => aktuell });
  aktuell = false; p.resolve({ data: [] }); assert.equal(await r, null);
});
test('Kartensteuerung: Reentranz und TTL, Signal an beide Quellen', async () => {
  const p = pending(); let reads = 0, signals = [];
  const c = createHandlungsbedarfKarte({ kontext: () => k(), heute: () => '2026-10-28', zeichne() {},
    scopeLader: async a => { signals.push(a.signal); return {}; }, lader: async a => { reads++; signals.push(a.signal); return p.promise; } });
  const run = c.laden(); await tick(); await c.laden(); assert.equal(reads, 1); assert.equal(c.lesen().laden, true);
  p.resolve(input()); await run; assert.equal(c.lesen().daten.entwarnung, true); assert.equal(signals[0], signals[1]);
  await c.laden(); assert.equal(reads, 1);
});
test('Rollenwechsel entfernt Daten synchron und Employee löst keine Quellen aus', async () => {
  let ctx = k(), reads = 0;
  const c = createHandlungsbedarfKarte({ kontext: () => ctx, heute: () => '2026-10-28', zeichne() {},
    scopeLader: async () => { reads++; return {}; }, lader: async () => input() });
  await c.laden(); assert.ok(c.lesen().daten); ctx = k({ rolle: 'employee' });
  assert.equal(c.lesen().daten, null); await c.laden(); assert.equal(reads, 1);
});
test('späte Antwort alten Standorts überschreibt neuen Stand nicht', async () => {
  let ctx = k(); const p = pending(); let n = 0;
  const c = createHandlungsbedarfKarte({ kontext: () => ctx, heute: () => '2026-10-28', zeichne() {},
    scopeLader: async () => ({}), lader: async () => ++n === 1 ? p.promise : input() });
  const alt = c.laden(); await tick(); ctx = k({ businessId: id(9) });
  assert.equal(c.lesen().daten, null); await c.laden(); p.resolve({}); await alt;
  assert.equal(c.lesen().daten.entwarnung, true);
});
test('30s Timeout begrenzt hängenden Scope und hängenden Fachtransport', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const wo of ['scope', 'lader']) {
    let signal;
    const c = createHandlungsbedarfKarte({ kontext: () => k(), heute: () => '2026-10-28', zeichne() {},
      scopeLader: async a => { signal = a.signal; return wo === 'scope' ? new Promise(() => {}) : {}; },
      lader: async () => new Promise(() => {}) });
    const run = c.laden(); await tick(); t.mock.timers.tick(30000); await run;
    assert.equal(signal.aborted, true); assert.equal(c.lesen().fehler, true); assert.equal(c.lesen().laden, false);
  }
});
test('Änderung während laufendem Read erzwingt neuen Stand statt alter Entwarnung', async () => {
  const alt = pending(); let reads = 0;
  const positiv = input(); positiv.verordnungen.daten = [{ id: 'neu', bereich: 'podologie', ausstellungsdatum: '2026-09-01', dringend: false, behandlungsbeginn: null, restbedarf: true, behandlungen: input().verordnungen, termine: input().verordnungen }];
  const c = createHandlungsbedarfKarte({ kontext: () => k(), heute: () => '2026-10-28', zeichne() {}, scopeLader: async () => ({}),
    lader: async () => ++reads === 1 ? alt.promise : positiv });
  const run = c.laden(); await tick(); await c.laden({ erzwingen: true }); alt.resolve(input()); await run;
  assert.equal(reads, 2); assert.equal(c.lesen().daten.entwarnung, false); assert.equal(c.lesen().daten.kategorien.beginnVerpasst.anzahl, 1);
});
test('alter Timeout kann neuen Lauf nicht abbrechen', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let ctx = k(); const signals = [];
  const c = createHandlungsbedarfKarte({ kontext: () => ctx, heute: () => '2026-10-28', zeichne() {}, scopeLader: async a => { signals.push(a.signal); return new Promise(() => {}); } });
  const alt = c.laden(); t.mock.timers.tick(10000); ctx = k({ businessId: id(9) }); const neu = c.laden();
  await alt; t.mock.timers.tick(20000); assert.equal(signals[1].aborted, false);
  t.mock.timers.tick(10000); await neu; assert.equal(signals[1].aborted, true);
});
test('fehlender Scope erzeugt Unknown, Loader bleibt unberührt', async () => {
  const c = createHandlungsbedarfKarte({ kontext: () => k(), heute: () => '2026-10-28', zeichne() {}, scopeLader: async () => null,
    lader: async () => { assert.fail('kein Fachread'); } });
  await c.laden(); assert.equal(c.lesen().daten.entwarnung, false); assert.equal(c.lesen().daten.kategorien.beginnBald.anzahl, null);
});
const K5 = (o = {}) => ({ beginnVerpasst: { anzahl: 0, bekanntAnzahl: 0 }, pauseDroht: { anzahl: 0, bekanntAnzahl: 0 }, pauseVerpasst: { anzahl: 0, bekanntAnzahl: 0 },
  beginnBald: { anzahl: 0, bekanntAnzahl: 0 }, ohneFolgetermin: { anzahl: 0, bekanntAnzahl: 0 }, ...o });
test('Renderer: Unknown als „–“ und Teilmenge statt Fake-Null, keine IDs und keine Gesamtfallzahl', () => {
  const h = handlungsbedarfHtml({ daten: { kategorien: { beginnBald: { anzahl: null, bekanntAnzahl: 2, ids: ['SECRET'] } } } });
  assert.match(h, /Teilmenge 2/); assert.match(h, /<span class="zahl">–<\/span>/); assert.match(h, /Teilweise ungeklärt/);
  assert.doesNotMatch(h, /SECRET|Kein Handlungsbedarf|Gesamt|Alles im Plan|<span class="zahl">0<\/span>/);
  assert.match(handlungsbedarfHtml({}, { eigene: true }), /Eigener Verordnungsumfang noch nicht bestätigt/);
  assert.match(handlungsbedarfHtml({ laden: true }), /wird geladen/);
});
test('Renderer: fünf Kacheln in fester Reihenfolge mit kurzen Etiketten, Null grau, Hinweis bei Beginn verpasst', () => {
  const h = handlungsbedarfHtml({ daten: { kategorien: K5({ beginnVerpasst: { anzahl: 2, bekanntAnzahl: 2 }, pauseVerpasst: { anzahl: 1, bekanntAnzahl: 1 } }) } });
  const lbl = [...h.matchAll(/class="lbl">([^<]+)</g)].map(m => m[1]);
  assert.deepEqual(lbl, ['Beginn verpasst', 'Pause droht', 'Pause überschritten', 'Beginn ohne Termin', 'Ohne Folgetermin']);
  assert.match(h, /px-ton-bad" title="Kein dokumentierter Behandlungsbeginn bis Fristende \(HeilM-RL § 15\) – bitte prüfen"/);
  assert.equal((h.match(/px-mini px-null/g) || []).length, 3); assert.doesNotMatch(h, /Alles im Plan|Teilweise ungeklärt/);
});
test('Renderer: alle fünf bekannt und 0 ergibt „Alles im Plan“ statt Kacheln', () => {
  const h = handlungsbedarfHtml({ daten: { kategorien: K5() } });
  assert.match(h, /Alles im Plan/); assert.doesNotMatch(h, /px-mini/);
});
test('Renderer: Podo-Kacheln nur bei ohnePodo ausgeblendet, außer bei echtem Treffer', () => {
  const daten = { kategorien: K5({ beginnBald: { anzahl: 1, bekanntAnzahl: 1 } }) };
  assert.match(handlungsbedarfHtml({ daten }), /Pause droht/);
  assert.doesNotMatch(handlungsbedarfHtml({ daten }, { ohnePodo: true }), /Pause droht/);
  daten.kategorien.pauseDroht = { anzahl: 1, bekanntAnzahl: 1 };
  const h = handlungsbedarfHtml({ daten }, { ohnePodo: true });
  assert.match(h, /Pause droht/); assert.doesNotMatch(h, /Pause überschritten/);
});
