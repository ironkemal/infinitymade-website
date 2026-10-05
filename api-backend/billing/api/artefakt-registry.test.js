import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reserviereUndLadeHoch, veroeffentliche } from './artefakt-registry.js';
import { erzeugeRegistryFake, blobAusUploads } from './artefakt-registry-fake.js';

function baue({ hooks = {}, row, korruptDownload = false, uploadError = null } = {}) {
  let current = row || { id: 'ab1', owner_id: 'o1', updated_at: 'T1' };
  const uploads = [];
  const removes = [];
  const reg = erzeugeRegistryFake({ getRow: () => current, setRow: r => { current = r; }, bumpUpdatedAt: () => 'T2', hooks });
  const dl = blobAusUploads(uploads);
  const db = {
    rpc: (n, a) => reg.rpc(n, a),
    storage: { from: () => ({
      async upload(path, bytes, options) { if (uploadError) return { error: { message: uploadError } }; uploads.push({ path, bytes, options }); return { data: { path }, error: null }; },
      async download(p) { if (korruptDownload) return { data: { async arrayBuffer() { return Buffer.from('anders').buffer; } }, error: null }; return dl.download(p); },
      async remove(p) { removes.push(p); return { error: null }; },
    }) },
  };
  return { db, reg, uploads, removes, getRow: () => current };
}
const args = (db, extra = {}) => ({ db, ownerId: 'o1', abrechnungId: 'ab1', pfad: 'o1/ab1/versuche/x/payload.p7m', kind: 'signed', role: 'signed', bytes: Buffer.from('inhalt'), contentType: 'application/pkcs7-mime', ...extra });

test('Registry-Ausfall vor dem Upload: 503, KEIN Upload', async () => {
  const t = baue({ hooks: { failRpc: n => n === 'artefakt_reserve' } });
  await assert.rejects(reserviereUndLadeHoch(args(t.db)), e => e.status === 503);
  assert.equal(t.uploads.length, 0);
});

test('Upload-Fehler: upload_failed quittiert, kein Loeschen', async () => {
  const t = baue({ uploadError: 'boom' });
  await assert.rejects(reserviereUndLadeHoch(args(t.db)), e => e.status === 500);
  assert.equal([...t.reg.zeilen.values()][0].upload_state, 'upload_failed');
  assert.equal(t.removes.length, 0);
});

test('Readback-Hashabweichung: Fehler, kein Publish, Datei bleibt (nie loeschen)', async () => {
  const t = baue({ korruptDownload: true });
  await assert.rejects(reserviereUndLadeHoch(args(t.db)), e => e.code === 'ARTEFAKT_HASH_ABWEICHUNG');
  assert.ok(!t.reg.log.includes('artefakt_publish'));
  assert.equal(t.removes.length, 0);
  assert.equal([...t.reg.zeilen.values()][0].state, 'reserved');
});

test('Fachpruefung auf Readback-Bytes schlaegt fehl: Fehler propagiert, kein Publish', async () => {
  const t = baue();
  await assert.rejects(reserviereUndLadeHoch(args(t.db, { pruefeReadback: () => { throw Object.assign(new Error('CMS ungueltig'), { status: 422 }); } })), e => e.status === 422);
  assert.ok(!t.reg.log.includes('artefakt_publish'));
});

test('Erfolg: reserve -> upload(upsert:false) -> upload_done -> publish, Header zeigt auf Registry-Pfad', async () => {
  const t = baue();
  const { registryId, sha256 } = await reserviereUndLadeHoch(args(t.db));
  assert.equal(t.uploads[0].options.upsert, false);
  await veroeffentliche({ db: t.db, ownerId: 'o1', registryId, vorher: t.getRow(), patch: { signed_storage_path: 'o1/ab1/versuche/x/payload.p7m', signed_sha256: sha256 } });
  assert.equal(t.getRow().signed_storage_path, 'o1/ab1/versuche/x/payload.p7m');
  assert.deepEqual(t.reg.log, ['artefakt_reserve', 'artefakt_upload_done', 'artefakt_publish']);
});

test('veraltete Ansicht: Publish 409, Datei bleibt registriert, nichts geloescht', async () => {
  const t = baue();
  const { registryId, sha256 } = await reserviereUndLadeHoch(args(t.db));
  const stale = { ...t.getRow(), updated_at: 'ALT' };
  await assert.rejects(veroeffentliche({ db: t.db, ownerId: 'o1', registryId, vorher: stale, patch: { signed_storage_path: 'o1/ab1/versuche/x/payload.p7m', signed_sha256: sha256 } }), e => e.status === 409);
  assert.equal(t.removes.length, 0);
  assert.equal(t.getRow().signed_storage_path, undefined);
});

test('Fremd-Owner: reserve verweigert, kein Upload', async () => {
  const t = baue();
  await assert.rejects(reserviereUndLadeHoch(args(t.db, { ownerId: 'o2', pfad: 'o2/ab1/versuche/x/p' })), e => e.status === 503);
  assert.equal(t.uploads.length, 0);
});

test('ohne rpc-Client: fail-closed 503', async () => {
  await assert.rejects(reserviereUndLadeHoch(args({ storage: {} })), e => e.status === 503);
});

import { registriereVeroeffentlicht } from './artefakt-registry.js';

test('Nachregistrierung: leere/fehlende Pfade werden ignoriert, kein RPC ohne Dateien', async () => {
  const calls = [];
  const db = { rpc: async (n, a) => { calls.push([n, a]); return { data: 2, error: null }; } };
  const r0 = await registriereVeroeffentlicht({ db, ownerId: 'o1', abrechnungId: 'ab1', dateien: [{ pfad: null, role: 'auftrag', sha256: 'x' }] });
  assert.deepEqual(r0, { ok: true, angelegt: 0 });
  assert.equal(calls.length, 0);
  const r = await registriereVeroeffentlicht({ db, ownerId: 'o1', abrechnungId: 'ab1', dateien: [
    { pfad: 'o1/a/d.dta', role: 'dta', sha256: 'aa' }, { pfad: '', role: 'auftrag', sha256: 'bb' }, { pfad: 'o1/a/b.html', role: 'begleit', sha256: 'cc' }] });
  assert.equal(r.ok, true);
  assert.equal(calls[0][0], 'artefakt_registriere_veroeffentlicht');
  assert.deepEqual(calls[0][1].p_items.map(i => i.role), ['dta', 'begleit']);
  assert.equal(calls[0][1].p_legacy, false);
  assert.ok(calls[0][1].p_items.every(i => i.kind === 'unsigned'));
});

test('Nachregistrierung wirft NIE: RPC-Fehler und fehlender Client geben ok:false', async () => {
  const dateien = [{ pfad: 'o1/a/d.dta', role: 'dta', sha256: 'aa' }];
  assert.deepEqual(await registriereVeroeffentlicht({ db: { rpc: async () => ({ data: null, error: { message: 'x' } }) }, ownerId: 'o1', abrechnungId: 'a', dateien }), { ok: false });
  assert.deepEqual(await registriereVeroeffentlicht({ db: {}, ownerId: 'o1', abrechnungId: 'a', dateien }), { ok: false });
  assert.deepEqual(await registriereVeroeffentlicht({ db: { rpc: async () => { throw new Error('netz'); } }, ownerId: 'o1', abrechnungId: 'a', dateien }), { ok: false });
});
