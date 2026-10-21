import test from 'node:test';
import assert from 'node:assert/strict';
import { initAnamnese, bindAnamneseEvents } from './anamnese.js';
import { mountEinwilligung, renderEinwilligungListe, openEinwilligungFlow } from './patienten-einwilligung.js';

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function element() {
  return { value: '', checked: false, disabled: false, hidden: false, textContent: '', innerHTML: '',
    style: {}, dataset: {}, querySelectorAll: () => [], addEventListener() {} };
}

function anamneseFixture({ read, insert, aerzte = [{}], loadAerzte } = {}) {
  const nodes = new Map();
  for (const id of ['anamPatientSelect', 'anamAufnahme', 'anamSaveBtn', 'anamPrintBtn',
    'anamBeschwerdeSeit', 'anamSchmerzSkala', 'anamSkalaVal', 'anamRaucher', 'anamArztName',
    'anamArztNummer', 'anamRezeptSitzungen', 'anamHausbesuch', 'anamWuensche', 'anamNotizen',
    'anamSchmerzArtOther', 'anamHauptbeschwerde', 'anamVorerkrankungen', 'anamOperationen',
    'anamMedikamente', 'anamAllergien', 'anamBeruf', 'anamSport', 'anamDiagnose']) nodes.set(id, element());
  globalThis.document = { getElementById: id => nodes.get(id) || null, querySelector: () => null,
    querySelectorAll: () => [], addEventListener() {} };
  const headCallbacks = {};
  const head = element(); head.querySelector = selector => ({ addEventListener(event, fn) { headCallbacks[selector] = fn; } });
  nodes.set('anamKopfBox', head);
  const inserted = [];
  const toasts = [];
  let completed = 0;
  const sb = { from() {
    let id;
    const q = { select: () => q, eq(k, v) { if (k === 'patient_id') id = v; return q; },
      order: () => q, limit: () => q,
      insert(payload) { inserted.push(payload); return q; },
      single: () => insert ? insert() : Promise.resolve({ data: { id: 'saved' }, error: null }),
      maybeSingle: () => read(id) };
    return q;
  } };
  initAnamnese({ supabase: sb, getOwnerId: () => 'QA-owner', getUserId: () => 'QA-user',
    getSector: () => 'physiotherapie', getAerzte: () => aerzte, loadAerzte,
    showToast: m => toasts.push(m), nachSpeichern: () => { completed++; } });
  bindAnamneseEvents();
  return { nodes, inserted, toasts, headCallbacks, completed: () => completed,
    select(id) { const sel = nodes.get('anamPatientSelect'); sel.value = id; return sel.onchange({ target: sel }); },
    save: () => nodes.get('anamSaveBtn').onclick() };
}

const anamRow = id => ({ data: { id: 'anam-' + id, patient_id: id, notizen: id + ' ONLY' }, error: null });

test('Anamnese: Wechsel sperrt Save sofort und leert alte Antworten bis Laden abgeschlossen', async () => {
  const pending = deferred();
  const f = anamneseFixture({ read: id => id === 'QA-B' ? pending.promise : Promise.resolve(anamRow(id)) });
  await f.select('QA-A');
  assert.equal(f.nodes.get('anamNotizen').value, 'QA-A ONLY');
  const loading = f.select('QA-B');
  assert.equal(f.nodes.get('anamSaveBtn').disabled, true);
  assert.equal(f.nodes.get('anamNotizen').value, '');
  await f.save();
  assert.equal(f.inserted.length, 0);
  pending.resolve(anamRow('QA-B')); await loading;
  assert.equal(f.nodes.get('anamSaveBtn').disabled, false);
  await f.save();
  assert.equal(f.inserted[0].patient_id, 'QA-B');
  assert.equal(f.inserted[0].notizen, 'QA-B ONLY');
});

test('Anamnese: Arzt-Vorladen und Lesefehler geben alten Patientenkontext nicht frei', async () => {
  const doctors = deferred();
  const f = anamneseFixture({ aerzte: [], loadAerzte: () => doctors.promise,
    read: () => Promise.resolve({ data: null, error: { message: 'QA read failure' } }) });
  const loading = f.select('QA-A');
  await f.save();
  assert.equal(f.inserted.length, 0);
  doctors.resolve(); await loading; await f.save();
  assert.equal(f.nodes.get('anamSaveBtn').disabled, true);
  assert.equal(f.inserted.length, 0);
  assert.match(f.toasts.at(-1), /nicht geladen/);
});

test('Anamnese: spätes Save-Ergebnis verändert neuen Patientenkontext nicht', async () => {
  const pending = deferred();
  const reads = [];
  const f = anamneseFixture({ read: id => { reads.push(id); return Promise.resolve(anamRow(id)); },
    insert: () => pending.promise });
  await f.select('QA-A');
  f.nodes.get('anamNotizen').value = 'QA-A snapshot';
  const saving = f.save();
  await f.select('QA-B');
  pending.resolve({ data: { id: 'saved-A' }, error: null }); await saving;
  assert.equal(f.inserted[0].patient_id, 'QA-A');
  assert.equal(f.inserted[0].notizen, 'QA-A snapshot');
  assert.equal(f.nodes.get('anamNotizen').value, 'QA-B ONLY');
  assert.deepEqual(reads, ['QA-A', 'QA-B']);
  assert.equal(f.completed(), 0);
});

test('Anamnese: spätes Nachladen nach Save setzt neuen Kontext nicht zurück', async () => {
  const reload = deferred(); let aReads = 0;
  const f = anamneseFixture({ read: id => id === 'QA-A' && ++aReads > 1 ? reload.promise : Promise.resolve(anamRow(id)) });
  await f.select('QA-A');
  const saving = f.save();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  await f.select('QA-B');
  reload.resolve(anamRow('QA-A')); await saving;
  assert.equal(f.nodes.get('anamNotizen').value, 'QA-B ONLY');
  assert.equal(f.nodes.get('anamSaveBtn').disabled, false);
  assert.equal(f.completed(), 0);
});

function consentFixture({ detail, update, patient } = {}) {
  globalThis.document = { getElementById: () => null, createElement: element, body: { contains: () => true, appendChild() {} } };
  const queue = new Map(); const writes = []; const queries = []; const toasts = [];
  const list = element(); const host = element(); const controls = new Map(); let callbacks = {};
  for (const id of ['#ewSuche', '#ewTypFilter', '#ewNeuBtn']) {
    const control = element(); control.addEventListener = (event, fn) => { control[event] = fn; }; controls.set(id, control);
  }
  list.querySelector = sel => sel === '#ewListe' ? host : controls.get(sel);
  host.querySelectorAll = selector => {
    const css = selector.slice(1);
    const ids = [...host.innerHTML.matchAll(new RegExp('class="btn-ghost ' + css + '" data-id="([^"]+)"', 'g'))];
    return ids.map(m => ({ dataset: { id: m[1] }, addEventListener(event, fn) { callbacks[css] = fn; } }));
  };
  mountEinwilligung({ showToast: m => toasts.push(m), isKiActive: async () => false,
    supabase: { from(table) {
      let id; let patch;
      const q = { select: () => q, update(v) { patch = v; return q; },
        eq(k, v) { id = v; if (patch) { writes.push({ id, patch }); return update ? update() : Promise.resolve({ error: null }); } return q; },
        order() { if (!queue.has(id)) queue.set(id, deferred()); return queue.get(id).promise; },
        maybeSingle() { queries.push({ table, id }); return table === 'leads' ? patient() : detail(); } };
      return q;
    } } });
  return { list, host, queue, writes, queries, toasts, controls,
    render(id) { callbacks = {}; return renderEinwilligungListe(list, id); },
    callbacks: () => ({ ...callbacks }) };
}
const consentRow = id => ({ id: 'consent-' + id, consent_type: 'datenschutz', text_version: 'QA-v1',
  text_sha256: 'a'.repeat(64), consented_at: '2026-10-16T09:00:00Z', signed_name: id });

test('Einwilligung: verspätete Antworten und Fehler überschreiben neuen Patienten nicht', async () => {
  for (const failed of [false, true]) {
    const f = consentFixture();
    const a = f.render('QA-A'); const b = f.render('QA-B');
    f.queue.get('QA-B').resolve({ data: [consentRow('QA-B')], error: null }); await b;
    f.queue.get('QA-A').resolve(failed ? { data: null, error: { message: 'QA failure' } } : { data: [consentRow('QA-A')], error: null }); await a;
    assert.match(f.host.innerHTML, /consent-QA-B/);
    assert.doesNotMatch(f.host.innerHTML, /consent-QA-A/);
    assert.doesNotMatch(f.list.innerHTML, /QA failure/);
  }
});

test('Einwilligung: alte Widerruf-, PDF- und Neu-Callbacks bleiben nach Wechsel wirkungslos', async () => {
  const f = consentFixture(); const a = f.render('QA-A');
  f.queue.get('QA-A').resolve({ data: [consentRow('QA-A')], error: null }); await a;
  const old = f.callbacks(); const oldNew = f.controls.get('#ewNeuBtn').click;
  const b = f.render('QA-B');
  await old['ew-widerruf'](); await old['ew-pdf'](); await oldNew();
  assert.equal(f.writes.length, 0); assert.equal(f.queries.length, 0);
  f.queue.get('QA-B').resolve({ data: [], error: null }); await b;
});

test('Einwilligung: laufender Widerruf lädt nach Patientwechsel keine alte Liste nach', async () => {
  const pending = deferred(); const f = consentFixture({ update: () => pending.promise });
  globalThis.window = { prompt: () => 'QA synthetic revocation' };
  const a = f.render('QA-A'); f.queue.get('QA-A').resolve({ data: [consentRow('QA-A')], error: null }); await a;
  const revoking = f.callbacks()['ew-widerruf']();
  const b = f.render('QA-B'); f.queue.get('QA-B').resolve({ data: [consentRow('QA-B')], error: null }); await b;
  pending.resolve({ error: null }); await revoking;
  assert.equal(f.writes[0].id, 'consent-QA-A');
  assert.match(f.host.innerHTML, /consent-QA-B/);
  assert.equal(f.toasts.length, 0);
});

test('Einwilligung: verspätete PDF- oder Neu-Daten öffnen keinen alten Patientenkontext', async () => {
  for (const action of ['ew-pdf', 'new']) {
    const pending = deferred(); const f = consentFixture({ detail: () => pending.promise, patient: () => pending.promise });
    globalThis.window = { open() { assert.fail('Alten Patientenkontext geöffnet'); } };
    const a = f.render('QA-A'); f.queue.get('QA-A').resolve({ data: [consentRow('QA-A')], error: null }); await a;
    const opening = action === 'new' ? f.controls.get('#ewNeuBtn').click() : f.callbacks()[action]();
    const b = f.render('QA-B'); f.queue.get('QA-B').resolve({ data: [], error: null }); await b;
    pending.resolve({ data: { id: 'QA-A', text_snapshot: 'QA old content' }, error: null }); await opening;
    assert.equal(f.toasts.length, 0);
  }
});


test('Anamnese: verspätete Bestätigung darf laufenden Patientenwechsel nicht invalidieren', async () => {
  const confirmation = deferred(); const bLoad = deferred();
  const f = anamneseFixture({ read: id => id === 'QA-B' ? bLoad.promise : Promise.resolve(anamRow(id)),
    insert: () => confirmation.promise });
  await f.select('QA-A');
  const confirming = f.headCallbacks['[data-anam-aktion="bestaetigen"]']();
  const loading = f.select('QA-B');
  confirmation.resolve({ data: { id: 'confirmed-A' }, error: null }); await confirming;
  bLoad.resolve(anamRow('QA-B')); await loading;
  assert.equal(f.nodes.get('anamNotizen').value, 'QA-B ONLY');
  assert.equal(f.nodes.get('anamSaveBtn').disabled, false);
});

test('Einwilligung: laufender Signatur-Save aktualisiert nach Wechsel keine alte Patientenliste', async () => {
  const pending = deferred(); const reachedUpload = deferred(); const queries = []; const inserted = []; const nodes = new Map();
  const body = { contains: () => true, appendChild() {}, style: {} };
  globalThis.document = { body, getElementById: id => nodes.get(id) || null, createElement: element };
  globalThis.window = { addEventListener() {}, screen: { width: 100, height: 100 } };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#111' });
  for (const id of ['ewVolltext', 'ewCanvas', 'ewHinweis', 'ewLoeschen', 'ewAbbrechen', 'ewWeiter', 'ewFehler']) {
    const el = element(); el.addEventListener = (event, fn) => { el[event] = fn; }; nodes.set(id, el);
  }
  const canvas = nodes.get('ewCanvas');
  canvas.getBoundingClientRect = () => ({ width: 100, height: 50, left: 0, top: 0 });
  canvas.getContext = () => ({ setTransform() {}, beginPath() {}, arc() {}, fill() {} });
  canvas.toBlob = cb => cb(new Blob(['QA synthetic signature']));
  let current = true;
  mountEinwilligung({ getOwnerId: () => 'QA-owner', showToast() {}, supabase: {
    storage: { from: () => ({ upload() { reachedUpload.resolve(); return pending.promise; } }) },
    from(table) { queries.push(table); return { insert(row) { inserted.push(row); return Promise.resolve({ error: null }); } }; }
  } });
  await openEinwilligungFlow({ patientId: 'QA-A', patient: { id: 'QA-A', first_name: 'QA A' },
    kiAktiv: false, types: ['datenschutz'], istAktuell: () => current });
  canvas.pointerdown({ preventDefault() {}, clientX: 1, clientY: 1 });
  const saving = nodes.get('ewWeiter').click();
  // Wait until hashing and PNG conversion have reached the actual deferred storage write.
  await reachedUpload.promise;
  current = false;
  const bList = element(); bList.innerHTML = 'QA-B current'; nodes.set('pdEinwilligungContent', bList);
  pending.resolve({ error: null }); await saving;
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].patient_id, 'QA-A');
  assert.equal(bList.innerHTML, 'QA-B current');
  assert.deepEqual(queries, ['patient_consents']);
});
