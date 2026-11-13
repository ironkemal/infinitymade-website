import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDokumentSuche, dokumenteErlaubt, dokumentLabel, dokumentHinweis, dokumentScopeKey, mitFehlerMelder } from './kopf-dokumente.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const BIZ = '22222222-2222-4222-8222-222222222222';
const P1 = '33333333-3333-4333-8333-333333333333';
const P2 = '44444444-4444-4444-8444-444444444444';
const id = n => `5555555${n}-5555-4555-8555-555555555555`;
const basis = (x = {}) => ({ supabase: {}, rolle: 'owner', uid: OWNER, ownerId: OWNER, businessId: null, patientsGemeinsam: false, financeGemeinsam: false,
  design: 'neu', verordnungenErlaubt: true, rechnungenErlaubt: true, ...x });

function suche({ k = basis(), vo = [], rg = [], scope = { umfang: 'mandant', ownerId: OWNER }, oeffneVerordnung, oeffneRechnung } = {}) {
  const calls = { vo: 0, rg: 0, scope: 0, oeffneVo: [], oeffneRg: [] };
  let kontext = k;
  const s = createDokumentSuche({
    kontext: () => kontext,
    scopeLader: async () => { calls.scope++; return scope; },
    ladeVerordnungen: async () => { calls.vo++; return typeof vo === 'function' ? vo() : vo; },
    ladeRechnungen: async () => { calls.rg++; return typeof rg === 'function' ? rg() : rg; },
    oeffneVerordnung: oeffneVerordnung || (async (q, i) => { calls.oeffneVo.push([q, i]); }),
    oeffneRechnung: oeffneRechnung || (async i => { calls.oeffneRg.push(i); }),
  });
  return { s, calls, setze: neu => { kontext = neu; } };
}

test('dokumenteErlaubt: nur Inhaberin, neues Design, Leisteneintrag', () => {
  assert.equal(dokumenteErlaubt(basis(), 'verordnung'), true);
  assert.equal(dokumenteErlaubt(basis(), 'rechnung'), true);
  assert.equal(dokumenteErlaubt(basis({ rolle: 'employee' }), 'verordnung'), false);
  assert.equal(dokumenteErlaubt(basis({ uid: P1 }), 'rechnung'), false, 'uid ≠ ownerId');
  assert.equal(dokumenteErlaubt(basis({ design: 'alt' }), 'rechnung'), false);
  assert.equal(dokumenteErlaubt(basis({ rechnungenErlaubt: false }), 'rechnung'), false);
  assert.equal(dokumenteErlaubt(basis({ financeGemeinsam: undefined }), 'rechnung'), false, 'Freigabe unbekannt');
  assert.equal(dokumenteErlaubt(basis({ businessId: 'kaputt' }), 'verordnung'), false);
  assert.equal(dokumenteErlaubt(basis(), 'patient'), false);
});

test('Mitarbeiterin: kein Read, Status unbekannt', async () => {
  const { s, calls } = suche({ k: basis({ rolle: 'employee', uid: P1 }) });
  for (const art of ['verordnung', 'rechnung']) assert.deepEqual((await s.laden(art)).status, 'unbekannt');
  assert.deepEqual([calls.vo, calls.rg, calls.scope], [0, 0, 0]);
});

test('Verordnungen: Label ohne Betrag, typisierte IDs, Standortgrenze', async () => {
  const vo = [
    { id: id(1), quelle: 'physio', nummerText: '1007-3', vorname: 'Erika', nachname: 'Muster', datum: '2026-10-01', leadId: P1, betrag: 123.45 },
    { id: id(2), quelle: 'podologie', nummerText: '1008-1', vorname: 'Hans', nachname: 'Beispiel', datum: '2026-10-02', leadId: P2 },
    { id: id(3), quelle: 'podologie', nummerText: '', vorname: '', nachname: '', datum: null, leadId: null },
  ];
  const mandant = await suche({ vo }).s.laden('verordnung');
  assert.equal(mandant.status, 'ok'); assert.equal(mandant.zeilen.length, 3); assert.equal(mandant.teilbestand, false);
  assert.equal(mandant.zeilen[0].id, `verordnung:${id(1)}`); assert.equal(mandant.zeilen[0].quelle, 'physio');
  assert.match(mandant.zeilen[0].label, /^1007-3 · Erika Muster · 1\.10\.2026$/);
  assert.ok(!/123/.test(JSON.stringify(mandant.zeilen)), 'kein Betrag, auch nicht versteckt');
  assert.equal(mandant.zeilen[2].label, 'Verordnung ohne Nummer · ohne Patient');
  const patienten = await suche({ vo, k: basis({ businessId: BIZ }), scope: { umfang: 'patienten', ownerId: OWNER, patientIds: [P1] } }).s.laden('verordnung');
  assert.deepEqual(patienten.zeilen.map(z => z.originalId), [id(1)], 'fremder Standort und ohne Akte fallen heraus');
});

test('Verordnungen: unbekannter Scope → keine Quelle', async () => {
  const { s, calls } = suche({ scope: null });
  assert.equal((await s.laden('verordnung')).status, 'unbekannt'); assert.equal(calls.vo, 0);
});

test('Verordnungen: Teilbestand ab 200 je Topf', async () => {
  const vo = Array.from({ length: 200 }, (_, i) => ({ id: `${String(i).padStart(8, '0')}-5555-4555-8555-555555555555`, quelle: 'physio', leadId: P1 }));
  const r = await suche({ vo }).s.laden('verordnung');
  assert.equal(r.teilbestand, true); assert.match(dokumentHinweis('verordnung', r), /Teilbestand/);
});

test('Rechnungen: Fehler = nicht verfügbar, fremde Zeilen = Fehler, Finance-Standort', async () => {
  assert.equal((await suche({ rg: null }).s.laden('rechnung')).status, 'fehler');
  assert.equal((await suche({ rg: [{ id: id(1), owner_id: P1 }] }).s.laden('rechnung')).status, 'fehler');
  const k = basis({ businessId: BIZ });
  const fremd = await suche({ k, rg: [{ id: id(1), owner_id: OWNER, business_id: '66666666-6666-4666-8666-666666666666' }] }).s.laden('rechnung');
  assert.equal(fremd.status, 'fehler');
  const ok = await suche({ k, rg: [{ id: id(1), owner_id: OWNER, business_id: BIZ, invoice_number: 'RE-2026-0042', patient_name: 'Erika Muster', issued_at: '2026-11-02', total: 99.5 },
    { id: id(2), owner_id: OWNER, business_id: null, invoice_number: null, patient_name: 'Hans Beispiel', issued_at: null, created_at: '2026-11-03T10:00:00Z' }] }).s.laden('rechnung');
  assert.equal(ok.status, 'ok');
  assert.equal(ok.zeilen[0].label, 'RE-2026-0042 · Erika Muster · 2.11.2026');
  assert.equal(ok.zeilen[1].label, 'Rechnung ohne Nummer · Hans Beispiel · 3.11.2026');
  assert.ok(!/99/.test(JSON.stringify(ok.zeilen)));
});

test('Kontextwechsel während des Ladens verwirft das Ergebnis', async () => {
  let freigeben; const warte = new Promise(r => { freigeben = r; });
  const t = suche({ rg: async () => { await warte; return [{ id: id(1), owner_id: OWNER }]; } });
  const lauf = t.s.laden('rechnung');
  t.setze(basis({ businessId: BIZ }));
  freigeben();
  assert.equal((await lauf).status, 'veraltet');
});

test('Neue Suche entwertet die alte', async () => {
  let freigeben; const warte = new Promise(r => { freigeben = r; });
  const t = suche({ rg: async () => { await warte; return [{ id: id(1), owner_id: OWNER }]; } });
  const alt = t.s.laden('rechnung'); const neu = t.s.laden('rechnung');
  freigeben();
  assert.equal((await alt).status, 'veraltet'); assert.equal((await neu).status, 'ok');
});

test('Öffnen: erneute Prüfung, veraltete Treffer abgelehnt, false vom Öffner durchgereicht', async () => {
  const t = suche({ rg: [{ id: id(1), owner_id: OWNER }], vo: [{ id: id(2), quelle: 'podologie', leadId: P1 }] });
  const rg = (await t.s.laden('rechnung')).zeilen[0];
  assert.equal(await t.s.oeffnen(rg), true); assert.deepEqual(t.calls.oeffneRg, [id(1)]);
  const vo = (await t.s.laden('verordnung')).zeilen[0];
  assert.equal(await t.s.oeffnen(vo), true); assert.deepEqual(t.calls.oeffneVo, [['podologie', id(2)]]);
  t.setze(basis({ financeGemeinsam: true }));
  assert.equal(await t.s.oeffnen(rg), false, 'Scope geändert'); assert.equal(t.calls.oeffneRg.length, 1);
  t.setze(basis({ rolle: 'employee' }));
  assert.equal(await t.s.oeffnen({ ...vo, scopeKey: dokumentScopeKey(basis({ rolle: 'employee' })) }), false, 'Mitarbeiterin');
  const nein = suche({ vo: [{ id: id(2), quelle: 'physio', leadId: P1 }], oeffneVerordnung: async () => false });
  const z = (await nein.s.laden('verordnung')).zeilen[0];
  assert.equal(await nein.s.oeffnen(z), false);
});

test('Art-Wechsel: späte Antwort der alten Art wird verworfen', async () => {
  let freigeben; const warte = new Promise(r => { freigeben = r; });
  const t = suche({ rg: async () => { await warte; return [{ id: id(1), owner_id: OWNER }]; }, vo: [{ id: id(2), quelle: 'physio', leadId: P1 }] });
  const alt = t.s.laden('rechnung');
  const neu = await t.s.laden('verordnung');
  freigeben();
  assert.equal((await alt).status, 'veraltet'); assert.equal(neu.status, 'ok'); assert.equal(neu.zeilen[0].art, 'verordnung');
});

test('Timeout: hängender Lader beendet die Suche mit Fehler, nächste Suche geht wieder', async () => {
  let n = 0;
  const s = createDokumentSuche({ kontext: () => basis(), timeoutMs: 30,
    ladeRechnungen: async () => (++n === 1 ? new Promise(() => {}) : [{ id: id(1), owner_id: OWNER }]),
    ladeVerordnungen: async () => [], oeffneRechnung: async () => {}, oeffneVerordnung: async () => {} });
  const erst = await s.laden('rechnung');
  assert.equal(erst.status, 'fehler'); assert.match(dokumentHinweis('rechnung', erst), /nicht geladen/);
  assert.equal((await s.laden('rechnung')).status, 'ok');
});

test('mitFehlerMelder: Fehlerantwort und Wurf werden gemeldet, Erfolg nicht', async () => {
  const kette = antwort => { const b = { select() { return b; }, eq() { return b; }, then: (ok, nein) => antwort().then(ok, nein) }; return b; };
  const sb = { from: t => kette(async () => (t === 'kaputt' ? { data: null, error: { message: 'x' } } : { data: [1], error: null })), rpc: () => 'rpc-ok' };
  const gut = mitFehlerMelder(sb);
  assert.deepEqual((await gut.client.from('a').select('*').eq('x', 1)).data, [1]); assert.equal(gut.fehler(), false);
  assert.equal(gut.client.rpc(), 'rpc-ok', 'andere Funktionen unverändert');
  const schlecht = mitFehlerMelder(sb);
  await schlecht.client.from('a').select('*'); await schlecht.client.from('kaputt').select('*');
  assert.equal(schlecht.fehler(), true);
  // supabase-js: from() liefert einen Query-Builder ohne then, erst select() einen thenable Filter-Builder.
  const echt = mitFehlerMelder({ from: () => ({ select: () => kette(async () => ({ data: null, error: { message: 'y' } })) }) });
  assert.equal(echt.client.from('a').then, undefined, 'Query-Builder bleibt ohne then');
  await echt.client.from('a').select('*'); assert.equal(echt.fehler(), true, 'Fehler im Filter-Builder gezählt');
  const wurf = mitFehlerMelder({ from: () => kette(async () => { throw new Error('netz'); }) });
  await assert.rejects(Promise.resolve().then(() => wurf.client.from('a').select('*'))); assert.equal(wurf.fehler(), true);
});

test('dokumentLabel/Hinweis: nie eine Vollständigkeitsaussage', () => {
  for (const art of ['verordnung', 'rechnung']) for (const status of ['ok', 'unbekannt', 'fehler', 'veraltet']) {
    const text = dokumentHinweis(art, { status, teilbestand: status === 'ok', zeilen: [] });
    assert.ok(!/keine (Verordnung|Rechnung)/i.test(text), text);
  }
  assert.equal(dokumentHinweis('rechnung', { status: 'ok', teilbestand: false }), '');
  assert.equal(dokumentLabel('rechnung', { patient_name: 'A' }), 'Rechnung ohne Nummer · A');
});
