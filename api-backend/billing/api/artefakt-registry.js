// Artefakt-Registry-Anbindung (M1.16, Migration 0060).
//
// Jede neue Datei im Bucket `abrechnungen` durchlaeuft:
//   1. artefakt_reserve      — Registry-Zeile VOR dem Storage-Upload (Ausfall => kein Upload)
//   2. Storage-Upload        — upsert:false, eindeutiger Versuchspfad
//   3. artefakt_upload_done  — pending -> uploaded | upload_failed
//   4. Readback              — Datei erneut laden, SHA-256 (und optional Fachpruefung) pruefen
//   5. artefakt_publish      — Registry + Header atomar unter updated_at-CAS
//
// ⛔ Es wird hier NIE eine Datei geloescht. Scheitert ein Schritt nach dem Upload,
// bleibt die Zeile reserved/uploaded (= geschuetzt, nicht ausmusterbar). Laufende
// Reservierungen werden nie per Timeout verworfen.
import { createHash } from 'node:crypto';

function fehler(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.statusCode = status;
  e.code = code;
  return e;
}

export const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function rpc(db, name, args) {
  if (!db || typeof db.rpc !== 'function') {
    throw fehler(503, 'ARTEFAKT_REGISTRY_NICHT_VERFUEGBAR', 'Artefakt-Registry nicht verfügbar.');
  }
  let ergebnis;
  try {
    ergebnis = await db.rpc(name, args);
  } catch {
    throw fehler(503, 'ARTEFAKT_REGISTRY_NICHT_VERFUEGBAR', 'Artefakt-Registry nicht verfügbar.');
  }
  if (!ergebnis || ergebnis.error) {
    throw fehler(503, 'ARTEFAKT_REGISTRY_NICHT_VERFUEGBAR', 'Artefakt-Registry nicht verfügbar.');
  }
  return ergebnis.data;
}

/**
 * Schritte 1-4: reservieren, hochladen, Upload quittieren, Readback pruefen.
 * Wirft bei jedem Fehler; loescht nie.
 *
 * @param {object}   p
 * @param {object}   p.db            supabase-js-Client (service role)
 * @param {string}   p.ownerId
 * @param {string}   p.abrechnungId
 * @param {string}   p.pfad          Versuchspfad (artefaktVersuchPfad), beginnt mit `${ownerId}/`
 * @param {'unsigned'|'signed'|'encrypted'} p.kind
 * @param {'dta'|'auftrag'|'begleit'|'signed'|'encrypted'} p.role
 * @param {Buffer}   p.bytes
 * @param {string}   p.contentType
 * @param {(bytes:Buffer)=>Promise<void>|void} [p.pruefeReadback]  Fachpruefung auf den zurueckgelesenen Bytes
 * @returns {Promise<{ registryId: string, sha256: string }>}
 */
export async function reserviereUndLadeHoch({ db, ownerId, abrechnungId, pfad, kind, role, bytes, contentType, pruefeReadback }) {
  const sha = sha256Hex(bytes);

  const registryId = await rpc(db, 'artefakt_reserve', {
    p_owner: ownerId,
    p_abrechnung: abrechnungId,
    p_path: pfad,
    p_kind: kind,
    p_role: role,
    p_sha256: sha,
  });
  if (typeof registryId !== 'string' || !registryId) {
    throw fehler(503, 'ARTEFAKT_REGISTRY_NICHT_VERFUEGBAR', 'Artefakt-Registry nicht verfügbar.');
  }

  let up;
  try {
    up = await db.storage.from('abrechnungen').upload(pfad, bytes, { contentType, upsert: false });
  } catch (e) {
    up = { error: { message: e?.message || 'Upload fehlgeschlagen' } };
  }
  if (up?.error) {
    // Quittieren, damit die Zeile als gescheitert (und damit ausmusterbar) gilt; Fehler hier sind nicht fatal.
    try { await rpc(db, 'artefakt_upload_done', { p_owner: ownerId, p_id: registryId, p_ok: false }); } catch { /* bleibt pending = geschuetzt */ }
    throw fehler(500, 'ARTEFAKT_UPLOAD_FEHLGESCHLAGEN', 'Upload fehlgeschlagen: ' + up.error.message);
  }

  await rpc(db, 'artefakt_upload_done', { p_owner: ownerId, p_id: registryId, p_ok: true });

  // Readback: gespeicherte Bytes muessen den hochgeladenen entsprechen.
  let zurueck;
  try {
    const dl = await db.storage.from('abrechnungen').download(pfad);
    if (!dl || dl.error || !dl.data) throw new Error('kein Inhalt');
    zurueck = Buffer.from(await dl.data.arrayBuffer());
  } catch {
    throw fehler(500, 'ARTEFAKT_READBACK_FEHLGESCHLAGEN', 'Gespeicherte Datei konnte nicht zur Kontrolle gelesen werden.');
  }
  if (sha256Hex(zurueck) !== sha) {
    throw fehler(500, 'ARTEFAKT_HASH_ABWEICHUNG', 'Gespeicherte Datei weicht vom hochgeladenen Inhalt ab.');
  }
  if (typeof pruefeReadback === 'function') {
    await pruefeReadback(zurueck);
  }

  return { registryId, sha256: sha };
}

/**
 * Schritt 5: Registry-Zeile und Header-Patch atomar veroeffentlichen.
 * `vorher.updated_at` ist die gelesene Header-Version (CAS).
 * Konflikt => 409 und KEINE Loeschung (Zeile bleibt reserved/uploaded).
 */
export async function veroeffentliche({ db, ownerId, registryId, vorher, patch }) {
  const ok = await rpc(db, 'artefakt_publish', {
    p_owner: ownerId,
    p_id: registryId,
    p_expected_updated_at: vorher.updated_at,
    p_patch: patch,
  });
  if (ok !== true) {
    throw fehler(409, 'ABRECHNUNG_VERSION_CONFLICT', 'Konflikt bei der Abrechnungsversion.');
  }
}

/**
 * Meldet bereits veroeffentlichte Erzeugungsdateien (DTA, Auftragsdatei, Begleitzettel) an die Registry
 * (artefakt_registriere_veroeffentlicht, Migration 0063). Wirft NIE: die Abrechnung ist zu diesem
 * Zeitpunkt schon erzeugt und der Header zeigt auf die Dateien; ein Fehler hier darf sie nicht
 * zuruecknehmen — die Dateien bleiben im Bucket erhalten (der Loeschlauf behaelt unbekannte Dateien).
 *
 * @param {Array<{pfad:string, role:'dta'|'auftrag'|'begleit', sha256:string}>} dateien  leere/fehlende Pfade werden ignoriert
 * @returns {Promise<{ok:boolean, angelegt?:number}>}
 */
export async function registriereVeroeffentlicht({ db, ownerId, abrechnungId, dateien }) {
  const items = (dateien || [])
    .filter((d) => d && typeof d.pfad === 'string' && d.pfad)
    .map((d) => ({ path: d.pfad, kind: 'unsigned', role: d.role, sha256: d.sha256 }));
  if (!items.length) return { ok: true, angelegt: 0 };
  try {
    const n = await rpc(db, 'artefakt_registriere_veroeffentlicht', {
      p_owner: ownerId, p_abrechnung: abrechnungId, p_items: items, p_legacy: false,
    });
    return { ok: true, angelegt: typeof n === 'number' ? n : 0 };
  } catch (e) {
    console.error(`[artefakt-registry] Nachregistrierung fehlgeschlagen (Abrechnung ${abrechnungId}):`, e.message);
    return { ok: false };
  }
}
