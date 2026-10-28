import test from 'node:test';
import assert from 'node:assert/strict';
import { montiereAkteAktionen } from './akte-aktionen.js';

function fixture({ design = 'neu', role = 'owner', sector = 'podologie' } = {}) {
  const alle = [], aufrufe = [], fehler = [];
  function node() {
    const n = { children: [], isConnected: true, listeners: {},
      append(c) { this.children.push(c); c.parent = this; },
      prepend(c) { this.children.unshift(c); c.parent = this; },
      addEventListener(e, cb) { this.listeners[e] = cb; },
      remove() { this.isConnected = false; for (const c of this.children) c.isConnected = false;
        if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); },
      click() { return this.listeners.click?.(); },
    }; alle.push(n); return n;
  }
  const panels = Object.fromEntries(['pdPanelAnamnese', 'pdPanelNotes', 'pdPanelFussbefund'].map(id => [id, node()]));
  const doc = { documentElement: { dataset: { design } }, createElement: node,
    getElementById: id => panels[id], querySelectorAll: () => alle.filter(n => n.className === 'px-akte-aktionen' && n.isConnected) };
  const kontext = { role, uid: 'U', ownerId: 'O', leadId: 'P', businessId: 'B', sharing: false, sector };
  const rechte = new Set(['anamnese', 'notes', 'abrechnung']);
  const deps = { kontext: () => ({ ...kontext }), darf: r => rechte.has(r),
    oeffnen: async (...args) => aufrufe.push(args), fehler: () => fehler.push(true) };
  const knopf = id => panels[id].children[0]?.children[0];
  return { doc, deps, kontext, rechte, panels, knopf, aufrufe, fehler, mount: () => montiereAkteAktionen(deps, doc) };
}

test('Neu: drei vorhandene Öffner bekommen ausschließlich aktuellen Aktepatienten', async () => {
  const f = fixture(); f.mount();
  for (const id of Object.keys(f.panels)) await f.knopf(id).click();
  assert.deepEqual(f.aufrufe, [['anamnese', 'P'], ['notizen', 'P'], ['fussbefund', 'P']]);
});
test('Alt enthält keine neuen Aktionen; Designwechsel entfernt alte Zeilen', () => {
  const f = fixture({ design: 'alt' }); f.mount(); assert.equal(f.doc.querySelectorAll().length, 0);
  f.doc.documentElement.dataset.design = 'neu'; f.mount();
  f.doc.documentElement.dataset.design = 'alt'; f.mount(); assert.equal(f.doc.querySelectorAll().length, 0);
});
for (const role of ['employee', 'owner']) test(`${role}: fehlende Rechte erzeugen keine Aktionen`, () => {
  const f = fixture({ role }); f.rechte.clear(); f.mount(); assert.equal(f.doc.querySelectorAll().length, 0);
});
for (const sector of ['physiotherapie', 'ergotherapie', 'logopaedie']) test(`${sector}: kein Fußbefundöffner`, () => {
  const f = fixture({ sector }); f.mount(); assert.equal(f.knopf('pdPanelFussbefund'), undefined);
  assert.ok(f.knopf('pdPanelNotes')); assert.ok(f.knopf('pdPanelAnamnese'));
});
for (const feld of ['role', 'uid', 'ownerId', 'leadId', 'businessId', 'sharing', 'sector']) test(`Klick nach ${feld}-Wechsel bleibt ohne Öffnung`, async () => {
  const f = fixture(); f.mount(); f.kontext[feld] = feld === 'sharing' ? true : 'ANDERS';
  await f.knopf('pdPanelAnamnese').click(); assert.deepEqual(f.aufrufe, []);
});
test('Rechteentzug oder Altwechsel nach Render sperrt vor Öffner', async () => {
  const f = fixture(); f.mount(); f.rechte.delete('anamnese'); await f.knopf('pdPanelAnamnese').click();
  f.doc.documentElement.dataset.design = 'alt'; await f.knopf('pdPanelNotes').click(); assert.deepEqual(f.aufrufe, []);
});
test('Unbekannte Rolle/fehlender Patient/Sitzung erzeugt keine Aktionen', () => {
  for (const feld of ['role', 'uid', 'ownerId', 'leadId']) {
    const f = fixture(); f.kontext[feld] = null; f.mount(); assert.equal(f.doc.querySelectorAll().length, 0);
  }
});
test('Aktenwechsel ersetzt Listener; abgehängter alter Knopf öffnet nicht', async () => {
  const f = fixture(); f.mount(); const alt = f.knopf('pdPanelNotes');
  f.kontext.leadId = 'NEU'; f.mount(); f.mount(); await alt.click(); await f.knopf('pdPanelNotes').click();
  assert.deepEqual(f.aufrufe, [['notizen', 'NEU']]); assert.equal(f.doc.querySelectorAll().length, 3);
});
test('Doppelklick und parallele Aktionen führen zu genau einem Öffner', async () => {
  const f = fixture(); let fertig; f.deps.oeffnen = (...args) => { f.aufrufe.push(args); return new Promise(r => { fertig = r; }); };
  f.mount(); const k = f.knopf('pdPanelAnamnese'); const lauf = k.click();
  assert.equal(k.disabled, true); await k.click(); await f.knopf('pdPanelNotes').click();
  assert.equal(f.aufrufe.length, 1); fertig(); await lauf; assert.equal(k.disabled, false);
});
test('Öffnerfehler bleibt fester Hinweis, Knopf wieder verfügbar', async () => {
  const f = fixture(); f.deps.oeffnen = async () => { throw new Error('synthetischer Fehler'); };
  f.mount(); const k = f.knopf('pdPanelNotes'); await k.click(); assert.equal(k.disabled, false); assert.equal(f.fehler.length, 1);
});
test('Defekte Kontext-/Rechtequelle verweigert ohne Öffner', async () => {
  const f = fixture(); f.deps.darf = () => { throw new Error('synthetisch'); }; f.mount(); assert.equal(f.doc.querySelectorAll().length, 0);
  f.deps.kontext = () => { throw new Error('synthetisch'); }; f.mount(); assert.equal(f.doc.querySelectorAll().length, 0);
});
