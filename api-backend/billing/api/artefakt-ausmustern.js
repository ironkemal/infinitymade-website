// M1.16(a): unsignierte DTA nach erfolgreicher, veroeffentlichter Signatur ausmustern.
//
// Rechtsentscheidung compliance/LEGAL_DECISIONS.md „2026-10-02" §3: imzasiz .dta wird nach
// erfolgreicher Signatur entfernt, SHA-256 bleibt in `abrechnung`; der Inhalt steckt eingebettet
// in der .p7m (Wiedersignieren/Originaldownload ueber ladeDtaOriginalbytes-Fallback).
//
// Sicherheitsleitplanken (alle fail-closed, alles andere bleibt unangetastet):
//  - nur Header-Status erstellt/heruntergeladen, nie nach Versand
//  - nur wenn die zu entfernende DTA UND die signierte Datei in der Registry als `published`
//    stehen und der Header genau diese Signatur referenziert (kein Raten, kein Bucket-Listing)
//  - Reihenfolge: Header-Referenz per CAS loesen -> Claim (dauerhaft, wiederholbar) -> exakt EIN
//    Storage-Objekt entfernen -> Abschluss quittieren. Scheitert das Entfernen, bleibt die Zeile
//    retire_pending mit Fehlertext; musterAus() ist beliebig wiederholbar.
//  - Auftragsdatei, Begleitzettel, signierte und verschluesselte Dateien werden NIE angefasst.
import { aktualisiereArtefaktVersion } from './artefakt-version.js';

const ERLAUBTE_STATUS = ['erstellt', 'heruntergeladen'];

async function rpcSicher(db, name, args) {
  try {
    const r = await db.rpc(name, args);
    if (!r || r.error) return { ok: false, fehler: r?.error?.message || 'RPC fehlgeschlagen' };
    return { ok: true, data: r.data };
  } catch (e) {
    return { ok: false, fehler: e?.message || 'RPC fehlgeschlagen' };
  }
}

/** Claim -> Storage-Remove -> Abschluss. Wiederholbar (Claim liefert dasselbe Token). */
export async function musterAus({ db, ownerId, registryId, pfad }) {
  const claim = await rpcSicher(db, 'artefakt_retire_claim', { p_owner: ownerId, p_id: registryId });
  if (!claim.ok) return { ok: false, grund: 'claim', fehler: claim.fehler };
  if (claim.data === null) return { ok: true, bereitsAusgemustert: true };
  const token = claim.data;
  let remove;
  try {
    remove = await db.storage.from('abrechnungen').remove([pfad]);
  } catch (e) {
    remove = { error: { message: e?.message || 'remove fehlgeschlagen' } };
  }
  if (!remove || remove.error) {
    await rpcSicher(db, 'artefakt_retire_done', { p_owner: ownerId, p_id: registryId, p_token: token, p_error: remove?.error?.message || 'remove fehlgeschlagen' });
    return { ok: false, grund: 'remove', fehler: remove?.error?.message || 'remove fehlgeschlagen' };
  }
  const done = await rpcSicher(db, 'artefakt_retire_done', { p_owner: ownerId, p_id: registryId, p_token: token });
  if (!done.ok || done.data !== true) return { ok: false, grund: 'done', fehler: done.fehler || 'Abschluss nicht quittiert' };
  return { ok: true };
}

async function einzeln(query) {
  const r = await query;
  if (!r || r.error) return { fehler: true, data: null };
  return { fehler: false, data: r.data };
}

/**
 * @returns {Promise<{entfernt:boolean, grund?:string}>}  wirft nie
 */
export async function entferneUnsignierteDta({ db, ownerId, abrechnungId, ladeHeader }) {
  try {
    const hdr = await ladeHeader();
    if (!hdr || hdr.owner_id !== ownerId || hdr.id !== abrechnungId) return { entfernt: false, grund: 'header' };
    if (!ERLAUBTE_STATUS.includes(hdr.status)) return { entfernt: false, grund: 'status' };
    if (!hdr.storage_path || !hdr.signed_storage_path || !hdr.signed_sha256 || !hdr.dta_sha256) return { entfernt: false, grund: 'unvollstaendig' };

    const dta = await einzeln(db.from('abrechnung_artefakt_version').select('id,state').eq('owner_id', ownerId)
      .eq('abrechnung_id', abrechnungId).eq('storage_path', hdr.storage_path).eq('role', 'dta').maybeSingle());
    if (dta.fehler || !dta.data || dta.data.state !== 'published') return { entfernt: false, grund: 'dta_nicht_registriert' };
    const sig = await einzeln(db.from('abrechnung_artefakt_version').select('id,state').eq('owner_id', ownerId)
      .eq('abrechnung_id', abrechnungId).eq('storage_path', hdr.signed_storage_path).eq('role', 'signed').maybeSingle());
    if (sig.fehler || !sig.data || sig.data.state !== 'published') return { entfernt: false, grund: 'signatur_nicht_veroeffentlicht' };

    const dtaPfad = hdr.storage_path;
    // Referenz im Header loesen (CAS); danach ist die Datei unreferenziert und claimbar.
    await aktualisiereArtefaktVersion({ db, vorher: hdr, patch: { storage_path: null } });

    const erg = await musterAus({ db, ownerId, registryId: dta.data.id, pfad: dtaPfad });
    return erg.ok ? { entfernt: true } : { entfernt: false, grund: erg.grund, wiederholbar: true };
  } catch (e) {
    return { entfernt: false, grund: e?.status === 409 ? 'konflikt' : 'fehler' };
  }
}

/**
 * Wiederholt eine gescheiterte Ausmusterung. NUR fuer bereits beanspruchte (retire_pending) unsignierte
 * DTA-Versionen derselben Abrechnung — es wird nie eine neue Ausmusterung ausgeloest.
 * @returns {Promise<{ok:boolean, grund?:string}>}  wirft nie
 */
export async function wiederholeAusmusterung({ db, ownerId, abrechnungId, versionId }) {
  try {
    const r = await einzeln(db.from('abrechnung_artefakt_version').select('id,state,role,storage_path')
      .eq('id', versionId).eq('owner_id', ownerId).eq('abrechnung_id', abrechnungId).maybeSingle());
    if (r.fehler || !r.data) return { ok: false, grund: 'nicht_gefunden' };
    if (r.data.role !== 'dta' || r.data.state !== 'retire_pending') return { ok: false, grund: 'nicht_wiederholbar' };
    const erg = await musterAus({ db, ownerId, registryId: r.data.id, pfad: r.data.storage_path });
    return erg.ok ? { ok: true } : { ok: false, grund: erg.grund || 'fehler' };
  } catch {
    return { ok: false, grund: 'fehler' };
  }
}
