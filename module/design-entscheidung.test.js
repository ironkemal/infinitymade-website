import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { entscheideDesign, frageServer, setzeDesign } from './design-entscheidung.js';

const antwort = (neu, ok = true) => async () => ({ ok, json: async () => ({ neu }) });
const wurzel = () => { const a = new Map(); return { setAttribute: (k, v) => a.set(k, v), removeAttribute: (k) => a.delete(k), get: (k) => a.get(k) }; };
const basis = { apiBase: '/api', token: async () => 't', aktuell: () => 'u1' };

test('rein: Wunsch allein schaltet nie frei, Alt gewinnt, Vorschau nur lokal', () => {
  assert.equal(entscheideDesign({ wunsch: 'neu', vorschau: false, serverNeu: false }), 'alt');
  assert.equal(entscheideDesign({ wunsch: 'neu', vorschau: true, serverNeu: false }), 'neu');
  assert.equal(entscheideDesign({ wunsch: 'alt', vorschau: true, serverNeu: true }), 'alt');
  assert.equal(entscheideDesign({ wunsch: null, vorschau: false, serverNeu: true }), 'neu');
  assert.equal(entscheideDesign({ wunsch: null, vorschau: undefined, serverNeu: 'ja' }), 'alt');
});

test('Server: nur echtes true; 401/500/JSON/Netz/Timeout/ohne Token → false', async () => {
  assert.equal(await frageServer({ ...basis, fetchFn: antwort(true) }), true);
  assert.equal(await frageServer({ ...basis, fetchFn: antwort(true, false) }), false);
  assert.equal(await frageServer({ ...basis, fetchFn: antwort('true') }), false);
  assert.equal(await frageServer({ ...basis, fetchFn: async () => { throw new Error('netz'); } }), false);
  assert.equal(await frageServer({ ...basis, fetchFn: async () => ({ ok: true, json: async () => { throw new Error('json'); } }) }), false);
  assert.equal(await frageServer({ ...basis, token: async () => null, fetchFn: antwort(true) }), false);
  assert.equal(await frageServer({ ...basis, timeoutMs: 20, fetchFn: (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('abort')))) }), false);
});

test('Server-Anfrage: Bearer, no-store, kein Mandant im Request', async () => {
  let gesehen;
  await frageServer({ ...basis, fetchFn: async (u, o) => { gesehen = { u, o }; return { ok: true, json: async () => ({ neu: false }) }; } });
  assert.equal(gesehen.u, '/api/design/entscheidung');
  assert.equal(gesehen.o.headers.Authorization, 'Bearer t');
  assert.equal(gesehen.o.cache, 'no-store');
});

test('setzeDesign: Attribut folgt Entscheidung, Vorschau fragt Server nicht, Fehler = Alt', async () => {
  let w = wurzel(); w.setAttribute('data-design', 'neu');
  assert.equal(await setzeDesign({ ...basis, wunsch: 'neu', fetchFn: antwort(false), wurzel: w }), 'alt');
  assert.equal(w.get('data-design'), undefined);
  w = wurzel();
  let gefragt = 0;
  assert.equal(await setzeDesign({ ...basis, wunsch: 'neu', vorschau: true, fetchFn: async () => { gefragt++; return antwort(false)(); }, wurzel: w }), 'neu');
  assert.equal(gefragt, 0); assert.equal(w.get('data-design'), 'neu');
  w = wurzel();
  assert.equal(await setzeDesign({ ...basis, wunsch: 'alt', vorschau: true, fetchFn: antwort(true), wurzel: w }), 'alt');
  assert.equal(await setzeDesign({ ...basis, wunsch: null, fetchFn: antwort(true), wurzel: w }), 'neu');
  assert.equal(w.get('data-design'), 'neu');
});

test('A07: Antwort für Nutzer A nach Wechsel auf B wird verworfen', async () => {
  let uid = 'A'; const w = wurzel();
  const r = await setzeDesign({ ...basis, aktuell: () => uid, wunsch: null, wurzel: w,
    fetchFn: async () => { uid = 'B'; return { ok: true, json: async () => ({ neu: true }) }; } });
  assert.equal(r, 'alt'); assert.equal(w.get('data-design'), undefined);
});

test('Quellwache: dashboard.js verdrahtet Entscheidung und alle drei Neu-Adapter (Regression: Shell-Aufruf war einmal versehentlich gelöscht)', async () => {
  const quelle = await readFile(new URL('../dashboard.js', import.meta.url), 'utf8');
  for (const muster of ['design-entscheidung.js', 'setzeDesign(', 'montiereStartansicht(', 'montiereAnamneseAbschnitte(', 'montiereShellansicht(']) {
    assert.ok(quelle.includes(muster), 'fehlt in dashboard.js: ' + muster);
  }
  assert.doesNotMatch(quelle, /try \{\s*\} catch \(e\) \{ console\.error\('\[init\] shell'/, 'leerer Shell-try');
  const html = await readFile(new URL('../dashboard.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /setAttribute\('data-design','neu'\)/, 'Head-Skript darf data-design nicht mehr selbst setzen');
});
