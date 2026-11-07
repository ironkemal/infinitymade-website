import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { physioPublikationAktiv, fuehrePhysioPublikationAus } from './physio-publikation-ablauf.js';

const KEY = 'k'.repeat(24);
const H = 'c'.repeat(64);
const mkDatei = (role, extra = {}) => ({ role, name: `x.${role}`, bytes: Buffer.from(role), contentType: 'text/plain', pruefeReadback: () => {}, ...extra });

function baue({ reserve, upload, finalize, kopf, dateien } = {}) {
  const calls = [];
  const deps = {
    reservierePhysioPublikation: async () => { calls.push('reserve'); return reserve ?? { state: 'preparing', worker_granted: true, abrechnungId: 'ab1', generation: 2, input_sha256: 'a'.repeat(64) }; },
    berechnePhysioPaketHash: async () => { calls.push('hash'); return H; },
    reserviereUndLadeHoch: async (a) => {
      calls.push('upload:' + a.role);
      assert.equal(a.physio.generation, 2); assert.equal(a.physio.packageSha256, H);
      assert.ok(a.pfad.startsWith('o1/ab1/physio-v1/2/'));
      if (upload) await upload(a);
      return { registryId: 'r-' + a.role, sha256: 's'.repeat(64) };
    },
    finalisierePhysioPublikation: async (a) => {
      calls.push('finalize');
      if (finalize) return finalize(a);
      assert.equal(a.expectedUpdatedAt, '2026-11-07 12:00:00.123456+00');
      assert.deepEqual(a.manifest.map(m => m.role), ['dta', 'auftrag', 'begleit']);
      return { ok: true, state: 'published', abrechnungId: 'ab1' };
    },
  };
  const erzeuge = async () => { calls.push('erzeuge'); return { paket: { lines: [] }, dateien: dateien ?? [mkDatei('dta'), mkDatei('auftrag'), mkDatei('begleit')] }; };
  const ladeKopfStand = async () => kopf ?? { updated_at: '2026-11-07 12:00:00.123456+00', publication_generation: 2, publication_package_sha256: H };
  const lauf = () => fuehrePhysioPublikationAus({ db: {}, ownerId: 'o1', key: KEY, payload: { a: 1 }, erzeuge, ladeKopfStand, deps });
  return { calls, lauf };
}

test('Flag default OFF; nur "1" schaltet ein', () => {
  assert.equal(physioPublikationAktiv({}), false);
  for (const v of ['0', 'true', '', 'yes', ' 1']) assert.equal(physioPublikationAktiv({ PHYSIO_PUBLIKATION_V1: v }), false);
  assert.equal(physioPublikationAktiv({ PHYSIO_PUBLIKATION_V1: '1' }), true);
});

test('Route: Flag-Zweig nur hinter physioPublikationAktiv(); Legacy-Block direkt danach unveraendert', () => {
  const src = readFileSync(new URL('./abrechnung.routes.js', import.meta.url), 'utf8');
  assert.equal((src.match(/await physioPublikationV1Create\(/g) || []).length, 1);
  assert.match(src, /if \(physioPublikationAktiv\(\) && \['physiotherapy'[^\n]*\{\n\s+return await physioPublikationV1Create/);
  assert.match(src, /\/\/ ---- numbering ----\n    const now = new Date\(\);\n    const \{ year, week \} = isoWeek\(now\);\n\n    \/\/ Schritt 1\.2: zwei dauerhafte Zaehler/);
  const podo = src.slice(src.indexOf("router.post('/abrechnung/create-podologie'"));
  assert.ok(!podo.includes('physioPublikationV1Create'));
});

test('Ungueltiger Key -> 400 ohne Reserve', async () => {
  const { calls } = baue();
  await assert.rejects(fuehrePhysioPublikationAus({ db: {}, ownerId: 'o1', key: 'kurz', payload: {}, erzeuge() {}, ladeKopfStand() {} ,
    deps: { reservierePhysioPublikation: async () => { calls.push('reserve'); } } }), e => e.status === 400);
  assert.deepEqual(calls, []);
});

test('Erfolg: Reihenfolge reserve, erzeuge, hash, 3 Uploads, hash(payload), finalize', async () => {
  const { calls, lauf } = baue();
  const r = await lauf();
  assert.equal(r.replay, false);
  assert.equal(r.ergebnis.abrechnungId, 'ab1');
  assert.deepEqual(calls, ['reserve', 'erzeuge', 'hash', 'upload:dta', 'upload:auftrag', 'upload:begleit', 'hash', 'finalize']);
});

test('published (Replay) -> gespeichertes Ergebnis, keine Seiteneffekte', async () => {
  const ex = { ok: true, state: 'published', abrechnungId: 'ab9', worker_granted: false };
  const { calls, lauf } = baue({ reserve: ex });
  const r = await lauf();
  assert.equal(r.replay, true); assert.equal(r.ergebnis.abrechnungId, 'ab9');
  assert.deepEqual(calls, ['reserve']);
});

test('aborted -> 409, nichts erzeugt', async () => {
  const { calls, lauf } = baue({ reserve: { state: 'aborted', abrechnungId: 'ab1', worker_granted: false } });
  await assert.rejects(lauf(), e => e.status === 409 && e.code === 'PHYSIO_AUFTRAG_ABGEBROCHEN');
  assert.deepEqual(calls, ['reserve']);
});

test('worker nicht granted (Lease aktiv) -> 409, nichts erzeugt', async () => {
  const { calls, lauf } = baue({ reserve: { state: 'preparing', worker_granted: false, abrechnungId: 'ab1', generation: 2 } });
  await assert.rejects(lauf(), e => e.status === 409 && e.code === 'PHYSIO_AUFTRAG_IN_BEARBEITUNG');
  assert.deepEqual(calls, ['reserve']);
});

test('Readback-Formatfehler -> kein Finalize, weitere Uploads nicht gestartet', async () => {
  const { calls, lauf } = baue({ upload: async (a) => { if (a.role === 'auftrag') throw Object.assign(new Error('fmt'), { status: 422, code: 'PHYSIO_READBACK_FORMAT' }); } });
  await assert.rejects(lauf(), e => e.status === 422 && e.code === 'PHYSIO_READBACK_FORMAT');
  assert.ok(!calls.includes('finalize')); assert.ok(!calls.includes('upload:begleit'));
});

test('Kopfstand mit anderer Generation/Paket-Hash -> 409, kein Finalize', async () => {
  for (const kopf of [{ updated_at: 't', publication_generation: 3, publication_package_sha256: H },
    { updated_at: 't', publication_generation: 2, publication_package_sha256: 'd'.repeat(64) }, null,
    { updated_at: '', publication_generation: 2, publication_package_sha256: H }]) {
    const { calls, lauf } = baue({ kopf });
    if (kopf === null) { /* ?? faellt auf Default zurueck, daher explizit */ }
    const ladeNull = kopf === null;
    const run = ladeNull
      ? fuehrePhysioPublikationAus({ db: {}, ownerId: 'o1', key: KEY, payload: {}, erzeuge: async () => ({ paket: {}, dateien: [] }), ladeKopfStand: async () => null,
        deps: { reservierePhysioPublikation: async () => ({ state: 'preparing', worker_granted: true, abrechnungId: 'ab1', generation: 2, input_sha256: 'a'.repeat(64) }), berechnePhysioPaketHash: async () => H, finalisierePhysioPublikation: async () => { calls.push('finalize'); } } })
      : lauf();
    await assert.rejects(run, e => e.status === 409);
    assert.ok(!calls.includes('finalize'));
  }
});

test('Finalize-Konflikt wird als 409 durchgereicht; nie geloescht', async () => {
  const { lauf } = baue({ finalize: () => { throw Object.assign(new Error('c'), { status: 409, code: 'PHYSIO_GENERATION_OR_CAS_CONFLICT' }); } });
  await assert.rejects(lauf(), e => e.status === 409 && e.code === 'PHYSIO_GENERATION_OR_CAS_CONFLICT');
});

test('Adapter-503 bei Reserve (Schema nicht live) -> 503, nichts erzeugt', async () => {
  const calls = [];
  await assert.rejects(fuehrePhysioPublikationAus({ db: {}, ownerId: 'o1', key: KEY, payload: {},
    erzeuge: async () => { calls.push('erzeuge'); }, ladeKopfStand: async () => null,
    deps: { reservierePhysioPublikation: async () => { throw Object.assign(new Error('n'), { status: 503 }); } } }), e => e.status === 503);
  assert.deepEqual(calls, []);
});
