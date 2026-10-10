// O-40 / §6.5 — Bewertungslogik von /api/status, ohne Postgres/Kong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusSammeln, fehlerCode, schemaBewerten, diskBewerten, gesamtStatus } from './status.js';

const still = () => {};
const GB = 1024 ** 3;

const gruen = () => ({
  postgres: async () => ({ buchMax: '0078', belegtBytes: 1 * GB }),
  rest: async () => {},
  auth: async () => {},
  storage: async () => {},
  disk: async () => ({ gesamtBytes: 100 * GB, freiBytes: 50 * GB }),
  dataKey: async () => ({ rundlauf: true, vergleich: 'unbekannt' }),
  realtime: async () => {},
  version: { version: '0.5.2+abc' },
  schema: { imageMax: '0078', wartung: null, zaehler: { status: 'ok' } },
});

test('alles erreichbar → gesamt ok; unbekannt/nicht_implementiert färben nicht', async () => {
  const r = await statusSammeln(gruen(), { log: still });
  assert.equal(r.gesamt, 'ok');
  assert.equal(r.felder.db.status, 'ok');
  assert.equal(r.felder.schema.status, 'ok');
  assert.equal(r.felder.backup.status, 'unbekannt');
  assert.equal(r.felder.license.status, 'nicht_implementiert');
  assert.equal(r.felder.realtime.status, 'ok');
  assert.deepEqual(r.felder.version, { status: 'info', version: '0.5.2+abc', digest: null, schema: '0078' });
});

test('O-190-Fall: postgres grün, rest (Kong/PostgREST) tot → db fehler, gesamt fehler', async () => {
  const p = gruen();
  p.rest = async () => { throw Object.assign(new Error('connect ECONNREFUSED 172.18.0.5:8000'), { code: 'ECONNREFUSED' }); };
  const r = await statusSammeln(p, { log: still });
  assert.equal(r.felder.db.postgres.status, 'ok');
  assert.equal(r.felder.db.rest.status, 'fehler');
  assert.equal(r.felder.db.rest.code, 'refused');
  assert.equal(r.felder.db.status, 'fehler');
  assert.equal(r.gesamt, 'fehler');
});

test('realtime tot (10.10.2026 21:51) → gesamt fehler, auch wenn db grün', async () => {
  const p = gruen();
  p.realtime = async () => { throw Object.assign(new Error('realtime 502'), { status: 502 }); };
  const r = await statusSammeln(p, { log: still });
  assert.equal(r.felder.db.status, 'ok');
  assert.equal(r.felder.realtime.code, 'http_5xx');
  assert.equal(r.gesamt, 'fehler');
});

test('keine Rohfehlermeldung, kein Host:Port, keine Interna in der Antwort (S-60)', async () => {
  const p = gruen();
  p.postgres = async () => { throw new Error('password authentication failed for user "supabase_admin" at db:5432'); };
  p.auth = async () => { throw Object.assign(new Error('auth 503 http://kong:8000/auth/v1/health'), { status: 503 }); };
  const json = JSON.stringify(await statusSammeln(p, { log: still }));
  for (const verboten of ['kong', '5432', 'supabase_admin', 'password', 'message', 'belegtBytes', 'buchMax']) {
    assert.ok(!json.includes(verboten), verboten);
  }
});

test('hängende Prüfung → timeout statt Hänger', async () => {
  const p = gruen();
  p.storage = () => new Promise(() => {});
  const t0 = Date.now();
  const r = await statusSammeln(p, { log: still });
  assert.equal(r.felder.storage.code, 'timeout');
  assert.ok(Date.now() - t0 < 6000);
});

test('langsame DB (> 500 ms) → warnung', async () => {
  const p = gruen();
  p.postgres = () => new Promise((ok) => setTimeout(() => ok({ buchMax: '0078' }), 550));
  const r = await statusSammeln(p, { log: still });
  assert.equal(r.felder.db.postgres.status, 'warnung');
  assert.equal(r.gesamt, 'warnung');
});

test('schemaBewerten: Wartung, Abweichung, Zähler, unbekannt', () => {
  assert.equal(schemaBewerten({ imageMax: '0078', buchMax: '0078', wartung: { art: 'sql', text: 'geheim' } }).status, 'fehler');
  assert.ok(!JSON.stringify(schemaBewerten({ imageMax: '1', buchMax: '1', wartung: { art: 'sql', text: 'geheim' } })).includes('geheim'));
  assert.equal(schemaBewerten({ imageMax: '0079', buchMax: '0078' }).code, 'abweichung');
  assert.equal(schemaBewerten({ imageMax: '0078', buchMax: '0078', zaehler: { status: 'abweichung' } }).status, 'warnung');
  assert.equal(schemaBewerten({ imageMax: '0078', buchMax: null }).status, 'unbekannt');
});

test('diskBewerten: 85 % warnung, 92 % fehler, 2× Belegung, Pfad fehlt', () => {
  assert.equal(diskBewerten({ status: 'ok', gesamtBytes: 100, freiBytes: 50 }, null).status, 'ok');
  assert.equal(diskBewerten({ status: 'ok', gesamtBytes: 100, freiBytes: 12 }, null).status, 'warnung');
  assert.equal(diskBewerten({ status: 'ok', gesamtBytes: 100, freiBytes: 7 }, null).status, 'fehler');
  assert.equal(diskBewerten({ status: 'ok', gesamtBytes: 100, freiBytes: 40 }, 30).code, 'kein_platz_fuer_sicherung');
  assert.equal(diskBewerten({ status: 'unbekannt' }, null).status, 'unbekannt');
});

test('fehlerCode: nur feste Codes', () => {
  assert.equal(fehlerCode(Object.assign(new Error('x'), { code: 'ETIMEOUT' })), 'timeout');
  assert.equal(fehlerCode(Object.assign(new Error('x'), { cause: { code: 'ECONNREFUSED' } })), 'refused');
  assert.equal(fehlerCode(Object.assign(new Error('x'), { status: 401 })), 'auth');
  assert.equal(fehlerCode(Object.assign(new Error('x'), { status: 502 })), 'http_5xx');
  assert.equal(fehlerCode(new Error('irgendwas')), 'unbekannt');
});

test('gesamtStatus: schlechtester gewinnt', () => {
  assert.equal(gesamtStatus({ a: { status: 'ok' }, b: { status: 'warnung' }, c: { status: 'unbekannt' } }), 'warnung');
});

test('standardPruefungen: ohne DATABASE_URL kein postgres, Disk-Pfad fehlt → unbekannt, Schlüssel fehlt → fehler', async () => {
  const { standardPruefungen } = await import('./status.js');
  const supabase = {
    from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }),
    storage: { listBuckets: async () => ({ data: [], error: { message: 'kaputt', status: 503 } }) },
  };
  const p = standardPruefungen({ supabase, env: {}, diskPfad: '/gibt/es/nicht/praxura' });
  assert.equal(p.postgres, null);
  assert.equal(p.auth, null);
  assert.equal(p.realtime, null);
  const r = await statusSammeln({ ...p, version: { version: 'x' }, schema: {} }, { log: still });
  assert.equal(r.felder.db.rest.status, 'ok');
  assert.equal(r.felder.db.postgres.status, 'unbekannt');
  assert.equal(r.felder.storage.code, 'http_5xx');
  assert.equal(r.felder.disk.status, 'unbekannt');
  assert.equal(r.felder.data_key.code, 'fehlt');
  assert.ok(!JSON.stringify(r).includes('kaputt'));
});
