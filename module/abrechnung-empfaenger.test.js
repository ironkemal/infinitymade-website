import { test } from 'node:test';
import assert from 'node:assert/strict';
import { empfaengerFehlerText, pruefeAntwort, empfaengerVorabPruefen, meldungsText } from './abrechnung-empfaenger.js';

test('empfaengerFehlerText: 409 Empfänger ohne Hinweis bekommt Neu-erzeugen-Satz', () => {
  const t = empfaengerFehlerText({ error: 'Papierannahmestelle geändert.', code: 'PAPIERANNAHMESTELLE_GEAENDERT' }, 409);
  assert.match(t, /neu erzeugen/);
});

test('empfaengerFehlerText: Backendtext mit Hinweis wird nicht doppelt ergänzt', () => {
  const t = empfaengerFehlerText({ error: 'X geändert. Bitte die Abrechnung neu erzeugen.', code: 'EMPFAENGER_GEAENDERT' }, 409);
  assert.equal(t.match(/neu erzeugen/g).length, 1);
});

test('empfaengerFehlerText: anderer Fehler bleibt unverändert', () => {
  assert.equal(empfaengerFehlerText({ error: 'Kein DTA-Inhalt vorhanden' }, 409), 'Kein DTA-Inhalt vorhanden');
  assert.equal(empfaengerFehlerText({}, 500), 'HTTP 500');
});

test('pruefeAntwort: stichtagWarnung → Warn-Toast, kein Wurf', () => {
  const toasts = [];
  const j = pruefeAntwort({ ok: true }, { ok: true, stichtagWarnung: [{ code: 'QUARTALSWECHSEL', stufe: 'warnung', text: 'Quartal prüfen.' }] },
    (m, t) => toasts.push([m, t]));
  assert.equal(j.ok, true);
  assert.deepEqual(toasts, [['Hinweis: Quartal prüfen.', 'warning']]);
});

test('pruefeAntwort: !ok wirft', () => {
  assert.throws(() => pruefeAntwort({ ok: false, status: 409 }, { error: 'E', code: 'EMPFAENGER_GEAENDERT' }), /neu erzeugen/);
});

test('empfaengerVorabPruefen: Block wirft, Warnung toastet, Ausfall blockiert nicht', async () => {
  const antwort = body => async () => ({ ok: true, json: async () => body });
  await assert.rejects(empfaengerVorabPruefen({ apiBase: 'x', token: 't', abrechnungId: '1',
    fetchFn: antwort({ blockiert: true, meldungen: [{ code: 'KEINE_DATENANNAHMESTELLE', stufe: 'block', text: 'Keine Stelle.' }] }) }), /Keine Stelle\. .*neu erzeugen/);
  const toasts = [];
  await empfaengerVorabPruefen({ apiBase: 'x', token: 't', abrechnungId: '1', showToast: m => toasts.push(m),
    fetchFn: antwort({ blockiert: false, meldungen: [{ code: 'QUARTALSWECHSEL', stufe: 'warnung', text: 'Q prüfen.' }] }) });
  assert.deepEqual(toasts, ['Hinweis: Q prüfen.']);
  assert.equal(await empfaengerVorabPruefen({ apiBase: 'x', token: 't', abrechnungId: '1', fetchFn: async () => { throw new Error('net'); } }), null);
  assert.equal(await empfaengerVorabPruefen({ apiBase: 'x', token: 't', abrechnungId: '1', fetchFn: async () => ({ ok: false }) }), null);
});

test('meldungsText filtert nach Stufe', () => {
  assert.equal(meldungsText([{ stufe: 'block', text: 'a' }, { stufe: 'warnung', text: 'b' }], 'warnung'), 'b');
  assert.equal(meldungsText(null), '');
});
