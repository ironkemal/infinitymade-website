import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rechnungsModus, zeigeRechnungsModus, renderRezeptBadges, mountRechnungsansicht, renderInvList, openInvView } from './rechnung-ansicht.js';

// Regressionstest für Bug 1 (Ops-Meldung, 09.09.2026): "Rechnung speichern
// schliesst den Editor nicht — es wirkt, als wäre nichts passiert." Die Regel
// muss in JEDEM Modus genau eine der drei Flächen zeigen.

test('rechnungsModus: "liste" zeigt nur die Liste + Neue-Rechnung-Knopf', () => {
  const h = rechnungsModus('liste');
  assert.equal(h.invListWrap, false);
  assert.equal(h.invEditor, true);
  assert.equal(h.invView, true);
  assert.equal(h.invNewBtn, false);
});

test('rechnungsModus: "editor" zeigt nur den Editor', () => {
  const h = rechnungsModus('editor');
  assert.equal(h.invListWrap, true);
  assert.equal(h.invEditor, false);
  assert.equal(h.invView, true);
  assert.equal(h.invNewBtn, true);
});

test('rechnungsModus: "ansicht" zeigt nur die Druckansicht, Neue-Rechnung-Knopf weg', () => {
  const h = rechnungsModus('ansicht');
  assert.equal(h.invListWrap, true);
  assert.equal(h.invEditor, true);
  assert.equal(h.invView, false);
  assert.equal(h.invNewBtn, true);
});

test('in jedem Modus ist genau eine der drei Flächen sichtbar (nicht null, nicht zwei)', () => {
  for (const modus of ['liste', 'editor', 'ansicht']) {
    const h = rechnungsModus(modus);
    const sichtbar = [!h.invListWrap, !h.invEditor, !h.invView].filter(Boolean).length;
    assert.equal(sichtbar, 1, `Modus "${modus}" zeigt ${sichtbar} Flächen statt 1`);
  }
});

test('zeigeRechnungsModus("ansicht") setzt .hidden an allen vier Elementen', () => {
  const gesetzt = {};
  global.document = {
    getElementById: (id) => ({
      set hidden(v) { gesetzt[id] = v; },
      get hidden() { return gesetzt[id]; },
    }),
  };
  zeigeRechnungsModus('ansicht');
  assert.deepEqual(gesetzt, { invListWrap: true, invEditor: true, invView: false, invNewBtn: true });
});

test('zeigeRechnungsModus uebersteht ein fehlendes Element (kein Wurf)', () => {
  global.document = { getElementById: () => null };
  assert.doesNotThrow(() => zeigeRechnungsModus('liste'));
});

test('renderRezeptBadges: kein verknuepftes Rezept -> Platzhalter-Badge', () => {
  mountRechnungsansicht({ escapeHtml: (s) => s });
  const html = renderRezeptBadges({ prescriptions: null });
  assert.match(html, /Kein verknüpftes Rezept/);
});

test('renderRezeptBadges: DMRZ exportiert -> "DMRZ ✓"-Badge', () => {
  mountRechnungsansicht({ escapeHtml: (s) => s });
  const html = renderRezeptBadges({ prescriptions: { rezept_typ: 'blanko', dmrz_exported_at: '2026-09-01T10:00:00Z' } });
  assert.match(html, /DMRZ ✓/);
});

test('renderInvList: blendet fuer ZU den Zahlungsknopf aus', () => {
  let innerHTML = '';
  global.document = {
    getElementById: (id) => {
      if (id === 'invListBody') return { set innerHTML(val) { innerHTML = val; }, get innerHTML() { return innerHTML; }, querySelectorAll: () => [] };
      if (id === 'invListEmpty') return { hidden: true };
      return null;
    }
  };
  mountRechnungsansicht({
    escapeHtml: (s) => s,
    formatEur: (n) => `${n} €`,
    liste: () => [
      { id: 'zu-1', invoice_number: 'ZU-2026-0001', invoice_type: 'zuzahlung', status: 'sent', payment_status: 'pending', total_patient: 10 },
      { id: 'gkv-1', invoice_number: 'INV-2026-0001', invoice_type: 'gkv', status: 'sent', payment_status: 'pending', total_patient: 20 },
    ],
  });
  renderInvList();
  assert.ok(!innerHTML.includes('data-id="zu-1" title="Zahlungseingang verbuchen"'), 'ZU darf keinen Zahlungsknopf haben');
  assert.ok(innerHTML.includes('data-id="gkv-1" title="Zahlungseingang verbuchen"'), 'GKV muss Zahlungsknopf haben');
});


test('P2-1: bezahlter Beleg ohne Frist, Bankblock leer ausgeblendet, IK nur Praxis', async () => {
  const nodes = new Map();
  global.document = { getElementById: id => { if (!nodes.has(id)) nodes.set(id, { textContent:'', innerHTML:'', hidden:false, style:{}, parentElement:{style:{}},removeAttribute(){},addEventListener(){} }); return nodes.get(id); } };
  const inv = { id:'inv', patient_id:'patient', invoice_type:'privat', status:'paid', issued_at:'2026-01-03', empfaenger_snapshot:{art:'patient',name:'Test Person',geburtsdatum:'1950-01-03'}, paid_at:'2026-11-17T16:00:00Z', created_at:'2026-11-17', line_items:[], aussteller_snapshot:{name:'Testpraxis',strasse:'Weg 1',plzOrt:'12345 Ort',ik:'123456789',bank:{}} };
  const q = { select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null}) };
  mountRechnungsansicht({liste:()=>[inv],profile:()=>({}),escapeHtml:s=>s,supabase:{from:()=>q},leistungszeitraum:()=>({}),fuelleBelegPositionen(){},merkeRechnung(){},showToast(){}});
  await openInvView('inv');
  assert.equal(nodes.get('invvDate').textContent,'03.01.2026');
  assert.match(nodes.get('invvPatient').innerHTML,/03.01.1950/);
  assert.equal(nodes.get('invvPaymentTerms').textContent,'Bezahlt am 17.11.2026');
  assert.equal(nodes.get('invvFooterBank').parentElement.style.display,'none');
  assert.doesNotMatch(nodes.get('invvFooterTax').textContent,/IK:/);
  assert.match(nodes.get('invvBizMeta').textContent,/IK: 123456789/);
});
