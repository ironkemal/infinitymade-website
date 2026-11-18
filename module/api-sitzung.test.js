import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sitzungBeendet, fehlertextAus, apiFehlertext, sitzungsWaechterInstallieren, MELDUNG_SITZUNG_BEENDET } from './api-sitzung.js';

const authMit = (antwort) => ({ getUser: async () => antwort });

test('sitzungBeendet: nur eindeutige Ablehnung durch Supabase zählt', async () => {
  assert.equal(await sitzungBeendet(authMit({ data: { user: { id: 'u' } }, error: null })), false);
  assert.equal(await sitzungBeendet(authMit({ data: { user: null }, error: { status: 403, code: 'session_not_found' } })), true);
  assert.equal(await sitzungBeendet(authMit({ data: { user: null }, error: { name: 'AuthSessionMissingError' } })), true);
  assert.equal(await sitzungBeendet(authMit({ data: null, error: { name: 'AuthRetryableFetchError', status: 0 } })), false, 'offline ist nicht beendet');
  assert.equal(await sitzungBeendet(authMit({ data: null, error: { status: 500 } })), false);
  assert.equal(await sitzungBeendet({ getUser: async () => { throw new TypeError('offline'); } }), false);
  assert.equal(await sitzungBeendet({}), false, 'ohne getUser keine Behauptung');
});

test('fehlertextAus: nie rohes JSON, bekannte Texte deutsch', () => {
  assert.doesNotMatch(fehlertextAus(401, '{"error":"Invalid token"}'), /[{}]|Invalid/);
  assert.match(fehlertextAus(401, { error: 'Invalid token' }), /Anmeldung/);
  assert.match(fehlertextAus(503, { error: 'x', code: 'AUTH_UNAVAILABLE' }), /vorübergehend/);
  assert.match(fehlertextAus(500, '<!DOCTYPE html><pre>Cannot GET</pre>'), /Serverfehler/);
  assert.equal(fehlertextAus(400, { error: 'date_from und date_to sind erforderlich' }), 'date_from und date_to sind erforderlich');
  assert.equal(fehlertextAus(400, '{"foo":1}', 'Fallback'), 'Fallback');
  assert.match(fehlertextAus(403, { error: 'Forbidden' }), /Berechtigung/);
});

test('apiFehlertext: liest per clone, Aufrufer kann weiter lesen', async () => {
  const res = new Response('{"error":"Invalid token"}', { status: 401 });
  assert.match(await apiFehlertext(res), /Anmeldung/);
  assert.equal(await res.text(), '{"error":"Invalid token"}');
});

test('Wächter: 401 vom Backend + beendete Sitzung → beiBeendet genau einmal, Response unverändert', async () => {
  let gerufen = 0, getUser = 0;
  const ziel = { fetch: async () => new Response('{"error":"Invalid token"}', { status: 401 }) };
  const auth = { getUser: async () => { getUser++; return { data: { user: null }, error: { status: 403, code: 'session_not_found' } }; } };
  const weg = sitzungsWaechterInstallieren({ auth, apiBase: 'https://api.example/api', beiBeendet: () => { gerufen++; }, ziel, origin: 'https://app.example' });
  const [a, b] = await Promise.all([ziel.fetch('https://api.example/api/team'), ziel.fetch('https://api.example/api/billing/belegliste')]);
  assert.equal(a.status, 401); assert.equal(b.status, 401);
  await ziel.fetch('https://api.example/api/team');
  assert.equal(gerufen, 1);
  assert.ok(getUser <= 2, 'parallele 401 teilen sich eine Prüfung');
  weg();
});

test('Wächter: gültige Sitzung, fremde URL oder 200 → keine Abmeldung', async () => {
  let gerufen = 0, getUser = 0;
  const ziel = { fetch: async (/** @type {string} */ url) => new Response('{}', { status: url.includes('ok') ? 200 : 401 }) };
  const auth = { getUser: async () => { getUser++; return { data: { user: { id: 'u' } }, error: null }; } };
  sitzungsWaechterInstallieren({ auth, apiBase: '/api', beiBeendet: () => { gerufen++; }, ziel, origin: 'https://box.local' });
  await ziel.fetch('/api/ok');
  await ziel.fetch('https://db.example/rest/v1/x');
  await ziel.fetch('/api-andere/x');
  assert.equal(getUser, 0, 'nur Backend-401 löst Prüfung aus');
  await ziel.fetch('/api/team');
  assert.equal(getUser, 1); assert.equal(gerufen, 0, 'Supabase sagt gültig → bleibt angemeldet');
});

test('Meldung nennt die Ursache und den Ausweg', () => {
  assert.match(MELDUNG_SITZUNG_BEENDET, /anderen Gerät/);
  assert.match(MELDUNG_SITZUNG_BEENDET, /neu an/);
});
