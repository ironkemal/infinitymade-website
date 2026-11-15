// V7.03p (Melih 15.11.2026): „Zuzahlung kassieren (x €)" als dritter Knopf der Folgetermin-Frage.
// Synthetische Daten, kein Netz, keine Schreibzugriffe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ladeKassierstand, ladeZahlerLead, verdrahteGeldzeile, bildeGeldstand } from './rezeptinfo-geld.js';
import { kassierAngebot, FOLGE_FRAGE } from './podo-tag-zusatz.js';
import { zeigeBestaetigungsDialog } from './bestaetigungs-dialog.js';

const TAG = '2026-11-03';
const KARTE = new Map([['78010', { preis: 36.1, zuzahlung: 3.61 }]]);   // 3,61 + 10,00 Pauschale = 13,61
const rxBasis = (extra = {}) => ({ id: 'rx-synth', patient_id: 'lead-synth', rezeptart: 'kassen', therapie_bereich: 'podo',
  heilmittel_position: '78010', anzahl_einheiten: 3, ausstellungsdatum: TAG, ...extra });

/** Nur-Lese-Fake: jede Tabelle wird protokolliert; Schreibmethoden gibt es nicht (Versuch wirft). */
function fakeSb({ behs = [{ behandlungsdatum: TAG, hpnr_codes: ['78010'], storniert_am: null }], belege = [], wirft = false } = {}) {
  const log = [];
  const sb = { from(table) {
    if (wirft) throw new Error('synthetischer Ausfall');
    log.push(table);
    const q = { select() { return q; }, eq() { return q; }, is() { return q; }, in() { return q; }, order() { return q; },
      limit() { return q; }, neq() { return q; }, maybeSingle: async () => ({ data: null, error: null }),
      then(res, rej) {
        const data = table === 'podologie_behandlungen' ? behs : table === 'belegliste' ? belege : [];
        return Promise.resolve({ data, error: null }).then(res, rej);
      } };
    return q;
  } };
  return { sb, log };
}
const lade = (sb, rx, extra = {}) => ladeKassierstand({ sb, ownerId: 'owner-synth', rx, lead: null, katalog: [],
  ladePodoPositionen: async () => KARTE, sector: 'podologie', ...extra });

test('ladeKassierstand: GKV offen → kassieren mit Betrag aus euroZustand, nur GKV-Tabellen', async () => {
  const { sb, log } = fakeSb();
  const { stand, zustand } = await lade(sb, rxBasis());
  assert.equal(zustand.aktion, 'kassieren');
  assert.equal(stand.gesamt, 13.61);
  assert.match(zustand.text, /13,61/);
  assert.deepEqual([...new Set(log)], ['podologie_behandlungen'], 'keine Privatsumme/Rechnung geladen');
  const a = kassierAngebot({ stand, zustand, darf: true });
  assert.equal(a.betrag, 13.61); assert.equal(a.rest, false);
  assert.equal(a.text, `Zuzahlung kassieren (${zustand.text})`);
});

test('ladeKassierstand: Rest nach Teilkassierung → kassieren mit Rest (rest: true)', async () => {
  const { sb, log } = fakeSb({ belege: [{ amount_eur: 10 }] });
  const { stand, zustand } = await lade(sb, rxBasis({ zuzahlung_kassiert_am: '2026-11-01T09:00:00Z' }));
  assert.ok(log.includes('belegliste'), 'Kassenbuch-Saldo gelesen');
  assert.equal(zustand.aktion, 'kassieren'); assert.equal(zustand.betrag, 3.61);
  const a = kassierAngebot({ stand, zustand, darf: true });
  assert.deepEqual({ betrag: a.betrag, rest: a.rest }, { betrag: 3.61, rest: true });
  assert.match(a.text, /^Zuzahlung kassieren \(Rest 3,61\s€\)$/);
});

test('ladeKassierstand: befreit oder voll kassiert → kein Angebot', async () => {
  const befreit = await lade(fakeSb().sb, rxBasis({ zuzahlung_befreit: true }));
  assert.equal(befreit.zustand.aktion, 'beleg');
  assert.equal(kassierAngebot({ ...befreit, darf: true }), null);
  const voll = await lade(fakeSb({ belege: [{ amount_eur: 13.61 }] }).sb, rxBasis({ zuzahlung_kassiert_am: '2026-11-01T09:00:00Z' }));
  assert.equal(voll.zustand.aktion, 'beleg');
  assert.equal(kassierAngebot({ ...voll, darf: true }), null);
});

test('ladeKassierstand: Ladefehler (Katalog, Lader wirft, DB wirft) → kein Angebot', async () => {
  const fehlerKarte = Object.assign(new Map(), { ladefehler: { status: 503, message: 'Dienst nicht verfügbar' } });
  const a = await lade(fakeSb().sb, rxBasis(), { ladePodoPositionen: async () => fehlerKarte });
  assert.ok(a.stand.ladefehler); assert.notEqual(a.zustand.aktion, 'kassieren');
  assert.equal(kassierAngebot({ ...a, darf: true }), null);
  const b = await lade(fakeSb().sb, rxBasis(), { ladePodoPositionen: async () => { throw new Error('weg'); } });
  assert.equal(kassierAngebot({ ...b, darf: true }), null);
  const warn = console.warn; console.warn = () => {};
  try {
    const c = await lade(fakeSb({ wirft: true }).sb, rxBasis({ zuzahlung_kassiert_am: '2026-11-01T09:00:00Z' }));
    assert.deepEqual(c, { stand: null, zustand: null });
    assert.equal(kassierAngebot({ ...c, darf: true }), null);
  } finally { console.warn = warn; }
});

test('ladeKassierstand: ohne dokumentierte Behandlung nur Schätzung → kein Angebot', async () => {
  const r = await lade(fakeSb({ behs: [] }).sb, rxBasis(), { katalog: [{ code: '78010', price: 36.1 }] });
  assert.equal(r.stand.geschaetzt, true);
  assert.equal(kassierAngebot({ ...r, darf: true }), null);
});

test('ladeKassierstand: Zahler unbekannt → fragen, nichts geladen; privat → Rechnung, kein Angebot', async () => {
  const { sb, log } = fakeSb();
  const u = await lade(sb, rxBasis({ rezeptart: null }));
  assert.equal(u.zustand.aktion, 'fragen'); assert.equal(log.length, 0);
  assert.equal(kassierAngebot({ ...u, darf: true }), null);
  const p = await lade(sb, rxBasis({ rezeptart: null }), { lead: { insurance_type: 'privat' } });
  assert.notEqual(p.zustand.aktion, 'kassieren');
  assert.equal(kassierAngebot({ ...p, darf: true }), null);
  // Lead entscheidet, wenn die Verordnung schweigt.
  const g = await lade(fakeSb().sb, rxBasis({ rezeptart: null }), { lead: { insurance_type: 'gkv' } });
  assert.equal(g.zustand.aktion, 'kassieren');
});

test('kassierAngebot: ohne Recht kein Knopf, mit Recht Knopf', async () => {
  const r = await lade(fakeSb().sb, rxBasis());
  assert.equal(kassierAngebot({ ...r, darf: false }), null);
  assert.equal(kassierAngebot({ ...r }), null, 'Recht fehlt = kein Knopf');
  assert.ok(kassierAngebot({ ...r, darf: true }));
  assert.equal(kassierAngebot(), null);
});

test('kassierAngebot rechnet nicht: Betrag und Text kommen nur aus Zustand/Stand', () => {
  const stand = { zahler: 'gkv', gesamt: 999.99 };
  const a = kassierAngebot({ stand, zustand: { aktion: 'kassieren', text: 'SYNTH-TEXT', betrag: 1.23 }, darf: true });
  assert.deepEqual(a, { betrag: 1.23, rest: true, text: 'Zuzahlung kassieren (SYNTH-TEXT)' });
  const b = kassierAngebot({ stand, zustand: { aktion: 'kassieren', text: 'X' }, darf: true });
  assert.equal(b.betrag, 999.99); assert.equal(b.rest, false);
  for (const s of [{ ...stand, unbekannt: true }, { ...stand, ladefehler: { message: 'x' } }, { ...stand, zahler: 'unbekannt' }, { ...stand, gesamt: 0 }])
    assert.equal(kassierAngebot({ stand: s, zustand: { aktion: 'kassieren', text: 'X' }, darf: true }), null);
  // Statisch: die Dialogseite importiert keine Zuzahlungsrechnung.
  const quelle = readFileSync(new URL('./podo-tag-zusatz.js', import.meta.url), 'utf8')
    + readFileSync(new URL('./podologie-abrechnung.js', import.meta.url), 'utf8');
  assert.doesNotMatch(quelle, /zuzahlung-rechnen\.js|berechneZuzahlung|zuzahlungFuerPodoVerordnung/);
});

test('Geldzeile und Kassierstand nennen denselben Betrag und kassieren gleich (Refactor ohne Kopie)', async () => {
  const { sb } = fakeSb({ belege: [{ amount_eur: 10 }] });
  const rx = rxBasis({ zuzahlung_kassiert_am: '2026-11-01T09:00:00Z' });
  const { stand, zustand } = await lade(sb, rx);
  const angebot = kassierAngebot({ stand, zustand, darf: true });
  const knopf = {}; const el = { isConnected: true, innerHTML: '', querySelector: () => knopf };
  let aufruf = null;
  const wired = verdrahteGeldzeile({ el, rx, erbracht: 1, deps: { sb, ownerId: 'owner-synth', sector: 'podologie', services: [],
    ladePodoPositionen: async () => KARTE, kassieren: async (args) => { aufruf = args; return false; }, nachKassieren: async () => {} } });
  wired.patientGesetzt(null);
  for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r));
  assert.ok(el.innerHTML.includes(zustand.text), 'Geldzeile zeigt denselben Text');
  await knopf.onclick();
  assert.deepEqual({ betrag: aufruf.betragEur, rest: aufruf.rest }, { betrag: angebot.betrag, rest: angebot.rest });
});

test('bildeGeldstand: Ladefehler macht den GKV-Stand unbekannt, Zahler aus Lead', () => {
  const { stand } = bildeGeldstand({ rx: rxBasis({ rezeptart: null }), lead: { insurance_type: 'gkv' }, sector: 'podologie',
    daten: { ladefehler: { message: 'x' } } });
  assert.equal(stand.zahler, 'gkv'); assert.equal(stand.unbekannt, true); assert.equal(stand.geschaetzt, true);
});

test('ladeZahlerLead: liest insurance_type per maybeSingle, wirft nie', async () => {
  const calls = [];
  const sb = (antwort) => ({ from(t) { calls.push(t); const q = { select(s) { calls.push(s); return q; }, eq() { return q; },
    maybeSingle: async () => { if (antwort === 'wirft') throw new Error('x'); return antwort; } }; return q; } });
  assert.deepEqual(await ladeZahlerLead(sb({ data: { id: 'l', insurance_type: 'gkv' }, error: null }), 'l'), { id: 'l', insurance_type: 'gkv' });
  assert.deepEqual(calls.slice(0, 2), ['leads', 'id, insurance_type']);
  assert.equal(await ladeZahlerLead(sb({ data: null, error: { message: 'x' } }), 'l'), null);
  assert.equal(await ladeZahlerLead(sb('wirft'), 'l'), null);
  assert.equal(await ladeZahlerLead(sb({ data: null }), null), null);
});

// ── Dialog mit optionalem dritten Knopf ─────────────────────────────────────
function dialogFixture({ mitExtra = true } = {}) {
  const subs = new Set();
  let hidden = true;
  const modal = { dataset: {}, get hidden() { return hidden; }, set hidden(v) {
    hidden = v; for (const o of [...subs]) queueMicrotask(() => subs.has(o) && o.cb([{ attributeName: 'hidden', target: modal }]));
  } };
  const knopf = () => ({ onclick: null, textContent: '', innerHTML: '', className: '', hidden: false });
  const els = new Map(['confirmModalTitle', 'confirmModalText', 'confirmModalOk', 'confirmModalCancel'].map(id => [id, knopf()]));
  if (mitExtra) els.set('confirmModalExtra', { ...knopf(), hidden: true, className: 'btn-ghost' });
  els.set('confirmModal', modal);
  const close = { onclick: null };
  class Obs { constructor(cb) { this.cb = cb; } observe() { subs.add(this); } disconnect() { subs.delete(this); } }
  const deps = { document: { getElementById: id => els.get(id), querySelector: () => close }, MutationObserver: Obs,
    openModal: () => { modal.hidden = false; }, closeModal: () => { modal.hidden = true; } };
  return { modal, els, close, deps, show: o => zeigeBestaetigungsDialog(o, deps) };
}

test('Dialog mit extraText: dritter Knopf sichtbar, Klick → "extra", danach wieder versteckt', async () => {
  const f = dialogFixture();
  const p = f.show({ ...FOLGE_FRAGE, extraText: 'Zuzahlung kassieren (13,61 €)' });
  const extra = f.els.get('confirmModalExtra');
  assert.equal(extra.hidden, false); assert.equal(extra.textContent, 'Zuzahlung kassieren (13,61 €)');
  assert.equal(extra.className, 'btn-ghost'); assert.equal(f.modal.dataset.abschluss, 'true');
  assert.equal(f.els.get('confirmModalOk').textContent, 'Folgetermin anlegen');
  assert.equal(f.els.get('confirmModalCancel').textContent, 'Später');
  extra.onclick();
  assert.equal(await p, 'extra');
  assert.equal(extra.hidden, true); assert.equal(extra.onclick, null); assert.equal(f.modal.dataset.abschluss, undefined);
});

test('Dialog mit extraText: OK → true, Später → false, Escape/Schließen → false', async () => {
  for (const [aktion, erwartet] of [['ok', true], ['cancel', false], ['close', false], ['escape', false]]) {
    const f = dialogFixture();
    const p = f.show({ ...FOLGE_FRAGE, extraText: 'Zuzahlung kassieren (1,00 €)' });
    if (aktion === 'ok') f.els.get('confirmModalOk').onclick();
    else if (aktion === 'cancel') f.els.get('confirmModalCancel').onclick();
    else if (aktion === 'close') f.close.onclick();
    else f.deps.closeModal('confirmModal');   // generischer Escape-Weg
    assert.equal(await p, erwartet, aktion);
    assert.equal(f.els.get('confirmModalExtra').hidden, true, `${aktion}: Knopf wieder versteckt`);
  }
});

test('Dialog ohne extraText: Knopf bleibt versteckt, Ergebnis bleibt boolean', async () => {
  const f = dialogFixture();
  const p = f.show({ ...FOLGE_FRAGE });
  const extra = f.els.get('confirmModalExtra');
  assert.equal(extra.hidden, true); assert.equal(extra.onclick, null); assert.equal(f.modal.dataset.abschluss, undefined);
  f.els.get('confirmModalOk').onclick();
  assert.equal(await p, true);
  // Nach einem Drei-Knopf-Dialog kommt der nächste normale Dialog wieder mit zwei Knöpfen.
  const g = dialogFixture();
  const erst = g.show({ extraText: 'X' }); const zweit = g.show({ title: 'Normal' });
  assert.equal(await erst, false);
  assert.equal(g.els.get('confirmModalExtra').hidden, true); assert.equal(g.els.get('confirmModalExtra').onclick, null);
  g.els.get('confirmModalCancel').onclick(); assert.equal(await zweit, false);
});

test('Dialog: extraText ohne Knopf in der Seite → zwei Knöpfe, boolean', async () => {
  const f = dialogFixture({ mitExtra: false });
  const p = f.show({ extraText: 'X' });
  assert.equal(f.modal.dataset.abschluss, undefined);
  f.els.get('confirmModalOk').onclick();
  assert.equal(await p, true);
});
