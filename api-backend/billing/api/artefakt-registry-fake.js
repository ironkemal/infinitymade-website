// Test-Hilfe: In-Memory-Nachbau der Registry-RPCs (Migration 0060) fuer Route-Tests.
// Bildet reserve/upload_done/publish samt updated_at-CAS und Rollen-Pfad-Bindung nach;
// die echte SQL-Logik ist separat gegen Postgres geprueft (siehe Migration 0060).
import { createHash } from 'node:crypto';

const ROLLE_PFAD = { dta: ['storage_path', 'dta_sha256'], auftrag: ['auftragsdatei_path', 'auftragsdatei_sha256'],
  begleit: ['begleitzettel_path', null], signed: ['signed_storage_path', 'signed_sha256'],
  encrypted: ['encrypted_storage_path', 'encrypted_sha256'] };

export function erzeugeRegistryFake({ getRow, setRow, bumpUpdatedAt, hooks = {} }) {
  const zeilen = new Map();
  const log = [];
  let n = 0;
  return {
    zeilen, log,
    async rpc(name, a) {
      log.push(name);
      if (hooks.failRpc?.(name, a)) return { data: null, error: { message: 'rpc ' + name + ' fehlgeschlagen' } };
      if (name === 'artefakt_reserve') {
        const row = getRow();
        if (!row && hooks.lenient) { /* Mock ohne Headerzeile */ } else if (!row || row.owner_id !== a.p_owner || row.id !== a.p_abrechnung) return { data: null, error: { message: 'Abrechnung gehoert nicht zum Owner' } };
        if (!a.p_path.startsWith(a.p_owner + '/')) return { data: null, error: { message: 'pfad' } };
        for (const z of zeilen.values()) if (z.storage_path === a.p_path) return { data: null, error: { message: 'duplicate' } };
        const id = 'reg-' + (++n);
        zeilen.set(id, { id, storage_path: a.p_path, kind: a.p_kind, role: a.p_role, sha256: a.p_sha256, state: 'reserved', upload_state: 'pending' });
        return { data: id, error: null };
      }
      if (name === 'artefakt_upload_done') {
        const z = zeilen.get(a.p_id);
        if (!z || z.state !== 'reserved' || z.upload_state !== 'pending') return { data: false, error: null };
        z.upload_state = a.p_ok ? 'uploaded' : 'upload_failed';
        return { data: true, error: null };
      }
      if (name === 'artefakt_publish') {
        const z = zeilen.get(a.p_id);
        const row = getRow();
        if (!z || z.state !== 'reserved' || z.upload_state !== 'uploaded' || (!row && !hooks.lenient)) return { data: null, error: { message: 'nicht publizierbar' } };
        if (hooks.failPublish) return { data: null, error: { message: 'DB persist failure' } };
        if (row && row.updated_at !== a.p_expected_updated_at) return { data: false, error: null };
        const [pf, hf] = ROLLE_PFAD[z.role];
        if (a.p_patch[pf] !== z.storage_path) return { data: null, error: { message: 'Patch zeigt nicht auf die Registry-Version' } };
        if (hf && a.p_patch[hf] !== z.sha256) return { data: null, error: { message: 'Hash passt nicht' } };
        setRow({ ...(row || {}), ...a.p_patch, updated_at: bumpUpdatedAt() });
        z.state = 'published';
        return { data: true, error: null };
      }
      return { data: null, error: { message: 'unbekannte RPC ' + name } };
    },
  };
}

export function blobAusUploads(uploads) {
  return {
    async download(pfad) {
      const u = [...uploads].reverse().find(x => x.path === pfad);
      if (!u) return { data: null, error: { message: 'nicht gefunden' } };
      return { data: { async arrayBuffer() { const b = Buffer.from(u.bytes); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } }, error: null };
    },
  };
}

export const sha = (b) => createHash('sha256').update(b).digest('hex');
