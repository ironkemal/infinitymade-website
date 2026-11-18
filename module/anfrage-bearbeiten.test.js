import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { zeitwunschAus, ladeAnfragenDaten } from './anfrage-bearbeiten.js';

test('Zeitwunsch: nur Zeit-, Dringlichkeits- und Erreichbarkeitszeilen, kein Freitext', () => {
  const notiz = 'Anliegen: Nagelspange — Hausbesuch\nZeit: Mo, Mi · Vormittag (8–12)\nWie bald: In 2 bis 3 Wochen\nSchon da gewesen: ja\nMitteilung: großer Zeh\nErreichbarkeit: ab 16 Uhr';
  assert.equal(zeitwunschAus(notiz), 'Zeit: Mo, Mi · Vormittag (8–12)\nWie bald: In 2 bis 3 Wochen\nErreichbarkeit: ab 16 Uhr');
});

test('Zeitwunsch: leer bei klassischer Anfrage mit Datum und freier Notiz', () => {
  assert.equal(zeitwunschAus('Bitte Hintereingang'), '');
  assert.equal(zeitwunschAus(null), '');
});

const session = token => ({ data: { session: token ? { access_token: token } : null }, error: null });
const auth = (token, refreshed) => ({ getSession: async () => session(token), refreshSession: async () => session(refreshed) });
for (const status of ['pending', 'confirmed', 'declined']) {
  test(`Anfragen ${status}: 401 erneuert Token genau einmal`, async () => {
    const headers = [];
    const rows = await ladeAnfragenDaten({ auth: auth('alt', 'neu'), api: '/api', ownerId: 'owner', status, fetchFn: async (url, opts) => {
      assert.ok(url.endsWith(`status=${status}`)); headers.push(opts.headers.Authorization);
      return headers.length === 1 ? { status: 401, ok: false } : { status: 200, ok: true, json: async () => ({ requests: [] }) };
    }});
    assert.deepEqual(rows, []); assert.deepEqual(headers, ['Bearer alt', 'Bearer neu']);
  });
}
test('Anfragen: fehlende Session sendet keinen Request und zeigt Anmeldehinweis', async () => {
  await assert.rejects(ladeAnfragenDaten({ auth: auth(null, null), fetchFn: () => assert.fail('kein Fetch') }), /Nicht angemeldet/);
});
test('Anfragen: dauerhafter 401 ohne Endlosschleife', async () => {
  let calls = 0;
  await assert.rejects(ladeAnfragenDaten({ auth: auth('alt', 'neu'), fetchFn: async () => { calls++; return { status: 401 }; } }), /nicht angenommen/);
  assert.equal(calls, 2);
});
test('Anfragen: "Anmeldung beendet" nur, wenn Supabase die Sitzung ablehnt (18.11.2026)', async () => {
  let refresh = 0;
  const beendet = { ...auth('alt', 'neu'), refreshSession: async () => { refresh++; return session('neu'); }, getUser: async () => ({ data: { user: null }, error: { status: 403, code: 'session_not_found' } }) };
  await assert.rejects(ladeAnfragenDaten({ auth: beendet, fetchFn: async () => ({ status: 401 }) }), /Anmeldung wurde beendet/);
  assert.equal(refresh, 0, 'beendete Sitzung wird nicht erneuert');
  const gueltig = { ...auth('alt', null), getUser: async () => ({ data: { user: { id: 'u' } }, error: null }) };
  await assert.rejects(ladeAnfragenDaten({ auth: gueltig, fetchFn: async () => ({ status: 401 }) }), (e) => !/Sitzung abgelaufen/.test(e.message));
});
test('Anfragen: Netzwerkfehler und Serverfehler unterscheidbar', async () => {
  await assert.rejects(ladeAnfragenDaten({ auth: auth('ok'), fetchFn: async () => { throw new TypeError('offline'); } }), /Netzwerkfehler/);
  await assert.rejects(ladeAnfragenDaten({ auth: auth('ok'), fetchFn: async () => ({ status: 500, ok: false }) }), /Serverfehler/);
});

 test('Anfragen: Mitarbeiter lädt mit Praxis-Owner statt eigener Profil-ID', async () => {
  const s=readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
  const code=s.slice(s.indexOf('async function loadAnfragen(status)'),s.indexOf('function renderAnfragenList'));
  let gelesen; const c=vm.createContext({currentProfile:{id:'employee',owner_id:'owner'},getOwnerId:()=> 'owner',anfragenCurrentStatus:'pending',anfragenCurrentRequests:[],document:{getElementById:()=>({innerHTML:''})},updateAnfragenBadge(){},supabase:{auth:{}},API:'/api',ladeAnfragenDaten:async q=>{gelesen=q;return [];},renderAnfragenList(){},escapeHtml:String,console});
  vm.runInContext(code,c);await vm.runInContext('loadAnfragen()',c);assert.equal(gelesen.ownerId,'owner');
 });
