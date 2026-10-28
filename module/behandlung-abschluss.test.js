import test from 'node:test';
import assert from 'node:assert/strict';
import { zeigeBehandlungsabschluss } from './behandlung-abschluss.js';

function fixture(antwort = false) {
  const calls = [], fragen = []; let aktuell = true, geld = true;
  const deps = { istAktuell: () => aktuell, darfZahlungPruefen: () => geld, folgeMoeglich: true,
    frage: async options => { fragen.push(options); return antwort; },
    oeffneZahlungspruefung: async () => calls.push('geld'), oeffneFolgetermin: async () => calls.push('folge') };
  return { deps, calls, fragen, scope: v => { aktuell = v; }, geld: v => { geld = v; }, run: () => zeigeBehandlungsabschluss(deps) };
}
for (const [antwort, erwartet] of [[true, ['folge']], ['zusatz', ['geld']], [false, []], [null, []], ['true', []], ['sonst', []]]) {
  test(`Antwort ${antwort} öffnet ausschließlich zugehörigen bestehenden Weg`, async () => {
    const f = fixture(antwort); await f.run(); assert.deepEqual(f.calls, erwartet);
    assert.match(f.fragen[0].message, /Zuzahlungsstatus ungeklärt/); assert.doesNotMatch(f.fragen[0].message, /kassiert|€|0,00/);
  });
}
test('Letzte Einheit behält Abschluss und Zahlungsprüfung, öffnet keinen Folgetermin', async () => {
  for (const antwort of [true, 'zusatz']) {
    const f = fixture(antwort); f.deps.folgeMoeglich = false; await f.run();
    assert.equal(f.fragen[0].confirmText, 'Fertig'); assert.equal(f.fragen[0].cancelText, null);
    assert.deepEqual(f.calls, antwort === 'zusatz' ? ['geld'] : []);
  }
});
test('Employee/fehlendes Zahlungsrecht: kein Geldstatus/Knopf, manipulierte Antwort wirkungslos', async () => {
  const f = fixture('zusatz'); f.geld(false); await f.run();
  assert.equal(f.fragen[0].zusatzText, null); assert.doesNotMatch(f.fragen[0].message, /Zuzahlung/); assert.deepEqual(f.calls, []);
});
test('Vor Dialog schon veraltet: keine Anzeige/Öffnung', async () => {
  const f = fixture(true); f.scope(false); await f.run(); assert.equal(f.fragen.length, 0); assert.deepEqual(f.calls, []);
});
for (const antwort of [true, 'zusatz']) test(`Scopewechsel während Dialog: ${antwort} verworfen`, async () => {
  const f = fixture(); f.deps.frage = async () => { f.scope(false); return antwort; }; await f.run(); assert.deepEqual(f.calls, []);
});
test('Zahlungsrecht während Dialog entzogen: keine Zahlungsöffnung', async () => {
  const f = fixture(); f.deps.frage = async () => { f.geld(false); return 'zusatz'; }; await f.run(); assert.deepEqual(f.calls, []);
});
test('Während Dialog erteiltes Recht erzeugt keinen zuvor unsichtbaren Geldweg', async () => {
  const f = fixture(); f.geld(false); f.deps.frage = async () => { f.geld(true); return 'zusatz'; };
  await f.run(); assert.deepEqual(f.calls, []);
});
test('Defekte Scope-/Rechtequelle sperrt geschlossen', async () => {
  const f = fixture('zusatz'); f.deps.darfZahlungPruefen = () => { throw Error('synthetisch'); };
  await f.run(); assert.deepEqual(f.calls, []);
  f.deps.istAktuell = () => { throw Error('synthetisch'); }; await f.run(); assert.equal(f.fragen.length, 1);
});
