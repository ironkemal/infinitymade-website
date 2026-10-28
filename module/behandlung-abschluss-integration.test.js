import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { zeigeBehandlungsabschluss } from './behandlung-abschluss.js';
import { FOLGE_FRAGE, folgeAusgangstermin, frageFolgetermin, ladeTagesTermin } from './podo-tag-zusatz.js';

const source = readFileSync(new URL('./podologie-abrechnung.js', import.meta.url), 'utf8');
const frag = source.slice(source.indexOf('async function fragFolgetermin('), source.indexOf('// Wagner-Rozet im Kopf'));
const fahrt = source.slice(source.indexOf('async function fahrtBeendenKlick('), source.indexOf('// ── Öffentliche Schnittstelle'));
const start = source.indexOf('    const bookingIdVorLaden =');
const nachSpeichern = source.slice(start, source.indexOf('\n  });', start));
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function fixture({ antwort = false, booking, error = null, read, neu = true } = {}) {
  const buchung = booking === undefined ? { id: 'B', owner_id: 'O', lead_id: 'P', verordnung_id: 'R',
    start_time: '2026-10-28T09:00:00Z', status: 'completed' } : booking;
  const reads = [], fragen = [], geld = [], folge = [], meldungen = [], fahrtDialoge = [];
  let scope = 'OWNER:UID:BUSINESS:SHARING', erlaubt = true;
  const supabase = { from(t) {
    const filters = []; reads.push({ t, filters }); const result = single => read ? read(single) : Promise.resolve({ data: single ? buchung : buchung ? [buchung] : [], error });
    const q = { select: () => q, eq(k, v) { filters.push([k, v]); return q; }, neq: () => q, gte: () => q, lt: () => q, order: () => q,
      maybeSingle: () => result(true), then(ok, fail) { return result(false).then(ok, fail); } }; return q;
  } };
  const ctx = { supabase, folge: {}, getOwnerId: () => 'O', abschlussNeu: () => neu, abschlussKontext: () => scope,
    darfZahlungPruefen: () => erlaubt, showConfirmModal: async options => { fragen.push(options); return typeof antwort === 'function' ? antwort() : antwort; },
    oeffneZahlungspruefung: async args => geld.push(args), showToast: (...args) => meldungen.push(args), openFahrtEndModal: args => fahrtDialoge.push(args) };
  const vord = { id: 'R', lead_id: 'P', status: 'aktiv' }, state = { selectedVordId: 'R', fahrtBookingId: 'B', folgeOffen: null };
  const c = vm.createContext({ ctx, _podState: state, zeigeBehandlungsabschluss, FOLGE_FRAGE, folgeAusgangstermin, frageFolgetermin, ladeTagesTermin,
    patientAnzeigename: () => 'Synthetisch', oeffneFolgetermin: async booking => folge.push(booking), console,
    document: { getElementById: () => ({ remove() {} }) }, vord, datum: '2026-10-28', frischRx: { abrechnung_status: null },
    altsystem: false, alleVerbraucht: false, loadPodologieBilling: async () => {}, zeigeFahrtHinweis: async () => false });
  vm.runInContext(frag + '\n' + fahrt, c);
  const args = { vord, datum: '2026-10-28', bookingId: 'B', neu, scope, auswahl: 'R', kontext: ctx, folgeMoeglich: true };
  return { c, ctx, state, args, reads, fragen, geld, folge, meldungen, fahrtDialoge,
    scope: v => { scope = v; }, recht: v => { erlaubt = v; }, design: v => { neu = v; },
    run: overrides => c.fragFolgetermin({ ...args, ...overrides }), save: () => vm.runInContext(`(async()=>{${nachSpeichern}\n})()`, c) };
}

test('Original-Controller: Zuzahlungsprüfung liest erst nach Wahl, filtert und bindet exakt VO/Patient', async () => {
  const f = fixture({ antwort: 'zusatz' }); assert.equal(f.reads.length, 0); await f.run();
  assert.equal(f.geld.length, 1); assert.equal(f.folge.length, 0); assert.equal(f.geld[0].rxId, 'R'); assert.equal(f.geld[0].leadId, 'P');
  assert.deepEqual(f.reads[0].filters, [['owner_id', 'O'], ['id', 'B'], ['lead_id', 'P'], ['verordnung_id', 'R']]);
});
for (const feld of ['owner_id', 'lead_id', 'verordnung_id']) test(`Original-Controller: falsche Antwort-${feld} öffnet keine Zahlung`, async () => {
  const f = fixture({ antwort: 'zusatz', booking: { id: 'B', owner_id: 'O', lead_id: 'P', verordnung_id: 'R', [feld]: 'FREMD' } });
  await f.run(); assert.equal(f.geld.length, 0); assert.match(f.meldungen[0][0], /Kein passender Termin/);
});
test('Original-Controller: fehlender/abgesagter Termin ist kein Zahlungsanker', async () => {
  for (const booking of [null, { id: 'B', owner_id: 'O', lead_id: 'P', verordnung_id: 'R', status: 'cancelled' }]) {
    const f = fixture({ antwort: 'zusatz', booking }); await f.run(); assert.equal(f.geld.length, 0); assert.equal(f.folge.length, 0);
  }
});
test('Original-Controller: Termin am Leistungstag als vorhandener Rückfall, keine Zahlungsplatzhalter', async () => {
  const f = fixture({ antwort: 'zusatz' }); await f.run({ bookingId: null }); assert.equal(f.geld.length, 1);
  const leer = fixture({ antwort: 'zusatz', booking: null }); await leer.run({ bookingId: null }); assert.equal(leer.geld.length, 0);
});
test('Original-Controller: Folge ohne echten Termin darf bestehenden Platzhalter verwenden', async () => {
  const f = fixture({ antwort: true, booking: null }); await f.run(); assert.equal(f.folge.length, 1); assert.equal(f.folge[0].id, null); assert.equal(f.geld.length, 0);
});
for (const antwort of [true, 'zusatz']) test(`Original-Controller: Scopewechsel während Lookup sperrt ${antwort}`, async () => {
  const wait = deferred(), f = fixture({ antwort, read: () => wait.promise }); const run = f.run(); await flush();
  assert.equal(f.reads.length, 1); f.scope('ANDERER_STANDORT'); wait.resolve({ data: { id: 'B', owner_id: 'O', lead_id: 'P', verordnung_id: 'R' }, error: null });
  await run; assert.equal(f.geld.length, 0); assert.equal(f.folge.length, 0); assert.equal(f.reads.length, 1);
});
test('Original-Controller: Rechtentzug während Lookup sperrt Zahlungsöffnung', async () => {
  const wait = deferred(), f = fixture({ antwort: 'zusatz', read: () => wait.promise }); const run = f.run(); await flush(); f.recht(false);
  wait.resolve({ data: { id: 'B', owner_id: 'O', lead_id: 'P', verordnung_id: 'R' }, error: null }); await run; assert.equal(f.geld.length, 0);
});
test('Original-Controller: ungültiger Scope/Auswahlwechsel vor Dialog erzeugt null Reads', async () => {
  for (const wechsel of ['scope', 'auswahl', 'design']) {
    const f = fixture({ antwort: 'zusatz' }); if (wechsel === 'scope') f.scope('ANDERS'); else if (wechsel === 'auswahl') f.state.selectedVordId = 'ANDERS'; else f.design(false);
    await f.run(); assert.equal(f.fragen.length, 0); assert.equal(f.reads.length, 0);
  }
});
test('Original-Controller: Quellenfehler bleibt fester Hinweis ohne Öffner', async () => {
  const f = fixture({ antwort: 'zusatz', error: { message: 'NICHT_AUSGEBEN' } }); await f.run(); assert.equal(f.geld.length, 0);
  assert.match(f.meldungen[0][0], /Abschlussaktion konnte nicht geöffnet werden/); assert.doesNotMatch(f.meldungen[0][0], /NICHT_AUSGEBEN/);
});
test('Original-Speicheranschluss: letzte Einheit Neu zeigt Abschluss ohne Folge, Alt unverändert stumm', async () => {
  const neu = fixture({ antwort: true }); neu.c.alleVerbraucht = true; await neu.save(); assert.equal(neu.fragen.length, 1); assert.equal(neu.fragen[0].confirmText, 'Fertig'); assert.equal(neu.folge.length, 0);
  const alt = fixture({ neu: false, antwort: true }); alt.c.alleVerbraucht = true; await alt.save(); assert.equal(alt.fragen.length, 0);
});
test('Original-Speicheranschluss: Altsystem-Nachtrag zeigt keinen Abschluss', async () => {
  const f = fixture({ antwort: true }); f.c.altsystem = true; await f.save(); assert.equal(f.fragen.length, 0); assert.equal(f.reads.length, 0);
});
test('Original-Speicheranschluss: Hausbesuch wartet bis onFertig und verwirft eingefrorenen alten Scope', async () => {
  for (const stale of [false, true]) {
    const f = fixture({ antwort: false }); f.c.zeigeFahrtHinweis = async () => true; await f.save(); assert.equal(f.fragen.length, 0); assert.ok(f.state.folgeOffen);
    if (stale) f.scope('NEUER_OWNER'); await f.c.fahrtBeendenKlick({ target: { closest: () => ({ disabled: false }) } });
    f.fahrtDialoge[0].onFertig(); await flush(); assert.equal(f.fragen.length, stale ? 0 : 1); assert.equal(f.state.folgeOffen, null);
  }
});
test('Original-Speicheranschluss: Scopewechsel während Neuladen erzeugt keinen Abschluss', async () => {
  const f = fixture(); f.c.loadPodologieBilling = async () => { f.scope('ANDERER_OWNER'); }; await f.save(); assert.equal(f.fragen.length, 0);
});
test('Original-Altanschluss behält FOLGE_FRAGE und booleschen Folgeterminweg', async () => {
  const f = fixture({ neu: false, antwort: true }); await f.save(); assert.deepEqual(JSON.parse(JSON.stringify(f.fragen[0])), { ...FOLGE_FRAGE }); assert.equal(f.folge.length, 1); assert.equal(f.geld.length, 0);
});

const dashboard = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
const property = dashboard.slice(dashboard.indexOf('abschlussNeu: '), dashboard.indexOf('\n', dashboard.indexOf('abschlussNeu: ')));
for (const [role, uid, permission, erlaubt] of [['owner', 'O', true, true], ['employee', 'E', true, false], ['owner', 'FREMD', true, false], ['owner', 'O', false, false]]) {
  test(`Original-Dashboardadapter: ${role}/${uid}/${permission} öffnet ${erlaubt ? 'exakt' : 'nicht'}`, async () => {
    const calls = []; const c = vm.createContext({ document: { documentElement: { dataset: { design: 'neu' } } },
      currentProfile: { role }, currentSession: { user: { id: uid } }, currentBusiness: { id: 'B' }, dataSharing: { patients: false },
      getOwnerId: () => 'O', getSector: () => 'podologie', hasModuleAccess: () => permission,
      openBookingActionModal: (...args) => calls.push(args) });
    const deps = vm.runInContext(`({${property}})`, c);
    assert.equal(deps.darfZahlungPruefen(), erlaubt);
    await deps.oeffneZahlungspruefung({ booking: { id: 'B', owner_id: 'O', lead_id: 'P', verordnung_id: 'R' }, rxId: 'R', leadId: 'P' });
    assert.equal(calls.length, erlaubt ? 1 : 0); if (erlaubt) { assert.equal(calls[0][1].rxId, 'R');assert.equal(calls[0][1].nurLesen, true); }
  });
}

test('Original-Kataloglader: Nur-Lesen lädt Quellen, überspringt Migration und Auto-Seed',async()=>{
  const start=dashboard.indexOf('async function loadServices(');
  const source=dashboard.slice(start,dashboard.indexOf('\n}\n',start)+2);
  for(const nurLesen of [true,false]) {
    const calls=[];
    const q={select(){return this;},or(){return Promise.resolve({data:[{id:'S'}],error:null});}};
    const c=vm.createContext({supabase:{from:()=>q},getOwnerId:()=> 'O',bizScope:q=>q,
      ermittleKostentraegerSpalte:async()=>calls.push('lesen'),getSector:()=> 'praxis',
      migratePodologieLegacyServices:async()=>calls.push('podo'),migrierePhysioAltlast:async()=>calls.push('physio'),
      autoSeedGkvServices:async()=>calls.push('seed'),GKV_LEISTUNGSKATALOG:{physiotherapy:[]},
      renderGkvCatalog(){},renderServices(){},renderSrvEmpCheckboxes(){},servicesCache:[],console});
    vm.runInContext(source,c);await c.loadServices({nurLesen,throwOnError:true});
    assert.deepEqual(calls,nurLesen?['lesen']:['lesen','podo','physio','seed']);
  }
});

test('Original-Katalogwächter reicht Nur-Lesen an bestehenden Lader weiter',async()=>{
  const start=dashboard.indexOf('async function ensureLeistungskatalog(');
  const source=dashboard.slice(start,dashboard.indexOf('\n}\n',start)+2);
  for(const nurLesen of [true,false]) {
    const calls=[];const c=vm.createContext({katalogNachladen:()=>true,servicesCache:[],ownerServices:[],
      GKV_LEISTUNGSKATALOG:{podologie:[{}]},getSector:()=> 'podologie',loadServices:async opts=>calls.push(opts)});
    vm.runInContext(source,c);await c.ensureLeistungskatalog({nurLesen});
    assert.equal(calls[0].nurLesen,nurLesen);assert.equal(calls[0].throwOnError,true);
  }
});
