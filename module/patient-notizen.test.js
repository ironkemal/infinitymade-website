import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { erstelleNotizenController } from './patient-notizen.js';
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function harness() {
  const dom = Object.fromEntries(['notesPatient','notesPatientInput','notesPatientList','notesPatientWrap','notesDoctor','notesTherapist','aiReportBox','notesSaveBtn','aiGenBtn','notesSendBtn','notesForm','notesEmpty'].map(id => [id, { value: '', textContent: '', style: {}, dataset: {}, disabled: false, contains: () => false }]));
  const reads = [], writes = [], toasts = []; let owner = 'owner', writeResult = null;
  const supabase = { from(table) {
    const q = { table, filters: {}, select() { return this; }, eq(k,v) { this.filters[k] = v; return this; },
      maybeSingle() { const d = deferred(); reads.push({ q, ...d }); return d.promise; },
      update(payload) { this.kind = 'update'; this.payload = payload; return this; },
      insert(payload) { this.kind = 'insert'; this.payload = payload; return this; },
      then(resolve) { writes.push(this); resolve(writeResult || { data: [{id: this.filters.id || "new-note"}], error: null }); },
    }; return q;
  } };
  const document = { getElementById: id => dom[id], addEventListener() {} };
  const controller = erstelleNotizenController({ document, supabase, getOwnerId: () => owner, showToast: (...x) => toasts.push(x) });
  const select = async (id, data = {}) => { dom.notesPatient.value = id; const p = controller.load(id); reads.at(-1).resolve({ data, error: null }); await p; };
  return { dom, document, supabase, controller, reads, writes, toasts, select, result: value => { writeResult = value; }, owner: value => { owner = value; } };
}
test('Delayed A cannot overwrite B; save while loading B produces no write', async () => {
  const h = harness(); await h.select('A', { doctor_notes: 'A secrets' });
  h.dom.notesPatient.value = 'A'; const a = h.controller.load('A'); const readA = h.reads.at(-1);
  h.dom.notesPatient.value = 'B'; const b = h.controller.load('B'); const readB = h.reads.at(-1);
  assert.equal(h.dom.notesDoctor.value, ''); assert.equal(h.dom.notesSaveBtn.disabled, true);
  assert.equal(await h.controller.save(), false); assert.equal(h.writes.length, 0);
  readB.resolve({ data: { doctor_notes: 'B notes' } }); await b;
  readA.resolve({ data: { doctor_notes: 'A secrets' } }); await a;
  assert.equal(h.dom.notesDoctor.value, 'B notes'); assert.equal(h.controller.ready('B'), true);
});
test('Typing/navigation invalidates in-flight response', async () => {
  const h = harness(); h.dom.notesPatient.value = 'A'; const p = h.controller.load('A');
  h.controller.invalidate(); h.reads[0].resolve({ data: { therapist_notes: 'old' } }); await p;
  assert.equal(h.dom.notesTherapist.value, ''); assert.equal(h.controller.ready(), false);
});
test('Notes read error stays cleared and disabled; never editable empty-success', async () => {
  const h = harness(); h.dom.notesPatient.value = 'A'; const p = h.controller.load('A');
  h.reads[0].resolve({ error: new Error('sensitive') }); await p;
  assert.equal(await h.controller.save(), false); assert.equal(h.writes.length, 0);
  assert.equal(h.dom.notesSaveBtn.disabled, true); assert.ok(!JSON.stringify(h.toasts).includes('sensitive'));
});
test('Save snapshots A and has single flight despite switching to B', async () => {
  const h = harness(); await h.select('A'); h.dom.notesDoctor.value = 'A saved';
  const first = h.controller.save(); const lookup = h.reads.at(-1);
  assert.equal(await h.controller.save(), false);
  await h.select('B', { doctor_notes: 'B existing' });
  lookup.resolve({ data: { id: 'note-A' } }); assert.equal(await first, true);
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0].payload.lead_id, 'A');
  assert.equal(h.writes[0].payload.doctor_notes, 'A saved');
  assert.deepEqual(h.writes[0].filters, { id: 'note-A', owner_id: 'owner', lead_id: 'A' });
  assert.equal(h.dom.notesDoctor.value, 'B existing');
});
test('Lookup error does not fall back to inserting; safe retry works', async () => {
  const h = harness(); await h.select('A'); const p = h.controller.save();
  h.reads.at(-1).resolve({ error: new Error('db') }); assert.equal(await p, false); assert.equal(h.writes.length, 0);
  const retry = h.controller.save(); h.reads.at(-1).resolve({ data: null }); assert.equal(await retry, true);
  assert.equal(h.writes[0].kind, 'insert');
});
test('Owner change disables old loaded content logically before any mutation', async () => {
  const h = harness(); await h.select('A'); h.owner('other');
  assert.equal(await h.controller.save(), false); assert.equal(h.writes.length, 0);
});
test('Summary cannot use stale fields while next patient loads', async () => {
  const h = harness(); await h.select('A', { therapist_notes: 'old summary' });
  h.dom.notesPatient.value = 'B'; const p = h.controller.load('B');
  assert.equal(await h.controller.save(true), false); assert.equal(h.writes.length, 0);
  h.reads.at(-1).resolve({ data: null }); await p;
});
const source = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
function decl(name) { const start = source.indexOf('async function '+name+'('); const end = source.indexOf('\n}\n', start) + 2; return source.slice(start,end); }
test('Actual dashboard picker clears confirmed state on text edit and owns one outside listener', async () => {
  const h = harness(); let outside = 0;
  h.document.addEventListener = () => { outside++; };
  const q = { select() {return this;}, eq() {return this;}, order() { return Promise.resolve({ data: [{id:'A',title:'A'}] }); } };
  const context = vm.createContext({ document:h.document, notizenController:h.controller, getOwnerId:()=> 'owner', supabase:{from:()=>q}, bizScope:q=>q, prefillNotesPatientId:null, showToast(){}, displayNameWithBirth:l=>l.title, patientMatchesQuery:()=>true });
  vm.runInContext(decl('loadNotizen')+'\nglobalThis.load = loadNotizen;',context);
  await context.load(); await context.load(); assert.equal(outside,1);
  await h.select('A', {doctor_notes:'A'}); h.dom.notesPatientInput.value='B'; h.dom.notesPatientInput.oninput();
  assert.equal(h.dom.notesPatient.value,''); assert.equal(h.controller.ready(),false);
  assert.equal(h.dom.notesDoctor.value,'');
});

test('Zero affected rows and write errors never report saved', async () => {
  for (const result of [{ data: [], error: null }, { data: null, error: new Error('sensitive') }]) {
    const h = harness(); await h.select('A'); h.result(result);
    const p = h.controller.save(); h.reads.at(-1).resolve({ data: { id: 'note-A' } });
    assert.equal(await p, false); assert.ok(!h.toasts.some(t => t[0] === 'Gespeichert'));
    assert.equal(h.dom.notesSaveBtn.disabled, false);
  }
});
