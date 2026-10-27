import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { holeGeld, geldKarteHtml } from '../module/startseite-geld.js';

const source = readFileSync(new URL('../module/startseite-neu.js', import.meta.url), 'utf8');
const start = source.indexOf('async function ladeGeldKarte(');
const end = source.indexOf('\nexport async function aktualisieren', start);
assert.ok(start >= 0 && end > start);
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const daten = {
  geld: { monat: '2026-10', kassiert: { patient: { bekanntCent: 12345, gesamtCent: 12345, unbekanntAnzahl: 0 } } },
  mahnungen: { stufen: [1, 2, 3].map(stufe => ({ stufe, anzahl: 0, bekanntAnzahl: 0, rest: { bekanntCent: 0, gesamtCent: 0, unbekanntAnzahl: 0 } })) },
};
function setup(loader) {
  const renders = [], calls = [];
  const context = vm.createContext({
    kontext: () => ({ supabase: {} }), istOwner: () => true, API_BASE: '/api', Date,
    geldLaedt: false, geld: { laden: false, daten: null, stand: 0 }, mahnungen: { laden: false, daten: null }, abrechnung: { laden: false, daten: null },
    holeGeld: o => { calls.push(o.blockName); return loader(o.blockName); },
    console: { warn() {} },
    zeichne: () => renders.push(geldKarteHtml(context.geld, context.mahnungen, context.abrechnung)),
  });
  vm.runInContext(source.slice(start, end), context);
  return { context, renders, calls, run: o => context.ladeGeldKarte(o) };
}

test('Hängender Abrechnungsblock hält fertiges Geld/Mahnungen nicht zurück; Forcedoppelaufruf gesperrt', async () => {
  let reject;
  const hanging = new Promise((_ok, bad) => { reject = bad; });
  const s = setup(block => block === 'abrechnung' ? hanging : Promise.resolve(daten[block]));
  const request = s.run(); let second;
  try {
    await flush(); second = s.run({ erzwingen: true }); await flush();
    assert.equal(s.calls.length, 3);
    assert.equal(s.context.geld.laden, false); assert.equal(s.context.mahnungen.laden, false);
    assert.equal(s.context.abrechnung.laden, true);
    assert.match(s.renders.at(-1), /123,45/); assert.match(s.renders.at(-1), /Abrechnungsstand wird geladen/);
  } finally { reject(new Error('synthetisch')); await Promise.all([request, second]); }
  assert.equal(s.context.geld.fehler, false); assert.equal(s.context.mahnungen.fehler, false);
  assert.equal(s.context.abrechnung.fehler, true); assert.equal(s.context.abrechnung.laden, false);
});

test('Nur fehlgeschlagener Geldblock behält und kennzeichnet alten Stand', async () => {
  const s = setup(block => block === 'geld' ? Promise.reject(new Error('synthetisch')) : Promise.resolve(daten[block] || {}));
  s.context.geld = { daten: daten.geld, laden: false, stand: 0 };
  await s.run();
  assert.equal(s.context.geld.daten, daten.geld); assert.equal(s.context.geld.fehler, true);
  assert.equal(s.context.mahnungen.fehler, false); assert.equal(s.context.abrechnung.fehler, false);
  assert.match(s.renders.at(-1), /123,45/); assert.match(s.renders.at(-1), /Aktualisierung fehlgeschlagen\. Zuletzt geladener Stand\./);
});

test('Originalcontroller + echter holeGeld: fertige Blöcke vor Timeout sichtbar, danach nur Abrechnung Fehler', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetisch' } } }) } };
  let signal;
  const s = setup(blockName => holeGeld({ supabase, apiBase: '/api', blockName, fetchFn: async (_url, options) => {
    if (blockName !== 'abrechnung') return { ok: true, json: async () => ({ bloecke: { [blockName]: { status: 'ok', daten: daten[blockName] } } }) };
    signal = options.signal; assert.ok(signal, 'Abbruchsignal fehlt');
    return new Promise((_ok, bad) => signal.addEventListener('abort', () => bad(new Error('ABBRUCH')), { once: true }));
  } }));
  const request = s.run(); await flush();
  assert.equal(s.context.geld.laden, false); assert.equal(s.context.mahnungen.laden, false);
  assert.equal(s.context.abrechnung.laden, true); assert.match(s.renders.at(-1), /123,45/);
  t.mock.timers.tick(29999); await flush(); assert.equal(signal.aborted, false);
  t.mock.timers.tick(1); await request;
  assert.equal(signal.aborted, true); assert.equal(s.context.abrechnung.fehler, true);
  assert.equal(s.context.geld.fehler, false); assert.equal(s.context.mahnungen.fehler, false);
});
