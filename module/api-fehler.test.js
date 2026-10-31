import test from 'node:test';
import assert from 'node:assert/strict';
import { fehlerTextAusAntwort, apiFehlerText } from './api-fehler.js';

test('JSON-Fehler wird zur Meldung, nicht zum Rohtext', () => {
  assert.equal(fehlerTextAusAntwort('{"error":"Kein Zugriff."}'), 'Kein Zugriff.');
  assert.equal(fehlerTextAusAntwort('{"error":{"message":"Abgelaufen"}}'), 'Abgelaufen');
  assert.equal(fehlerTextAusAntwort('{"message":"Fehlt"}'), 'Fehlt');
});

test('Leere, unbrauchbare und HTML-Antworten ergeben den Ersatztext', () => {
  assert.equal(fehlerTextAusAntwort('', 'Ersatz'), 'Ersatz');
  assert.equal(fehlerTextAusAntwort('{"status":500}', 'Ersatz'), 'Ersatz');
  assert.equal(fehlerTextAusAntwort('<html>502</html>', 'Ersatz'), 'Ersatz');
});

test('Klartext bleibt lesbar stehen', () => {
  assert.equal(fehlerTextAusAntwort('Dienst nicht erreichbar'), 'Dienst nicht erreichbar');
});

test('Nicht lesbarer Antwortkörper bricht den Fehlerpfad nicht', async () => {
  assert.equal(await apiFehlerText({ text: async () => { throw new Error('verbraucht'); } }, 'Ersatz'), 'Ersatz');
  assert.equal(await apiFehlerText({ text: async () => '{"error":"Nein"}' }), 'Nein');
});
