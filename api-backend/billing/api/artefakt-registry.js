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

// Only exact protocol exceptions may cross the API boundary. PostgreSQL details,
// hints and arbitrary exception text can contain patient data and stay private.
const PHYSIO_RPC_FEHLER = new Map([
  ...['PHYSIO_OWNER_UNAVAILABLE', 'PHYSIO_LINE_RPC_REQUIRED', 'PHYSIO_RPC_REQUIRED',
    'PHYSIO_BUSINESS_SCOPE', 'PHYSIO_ARTIFACT_SCOPE', 'PHYSIO_HEADER_SCOPE']
    .map(code => [`42501:${code}`, [403, code, 'Zugriff auf diesen Abrechnungsvorgang nicht erlaubt.']]),
  ...['PHYSIO_KEY_PAYLOAD_CONFLICT', 'PHYSIO_INPUT_CHANGED', 'PHYSIO_SOURCE_SCOPE_OR_CLAIM',
    'PHYSIO_READBACK_INVALID', 'PHYSIO_BINDING_CONFLICT', 'PHYSIO_GENERATION_OR_CAS_CONFLICT']
    .map(code => [`40001:${code}`, [409, code, 'Abrechnungsstand oder Ausführungsauftrag hat sich geändert.']]),
  ...['PHYSIO_REQUEST_INVALID', 'PHYSIO_MANIFEST_OR_PACKAGE_INVALID']
    .map(code => [`22023:${code}`, [422, code, 'Abrechnungsauftrag oder Dateipaket ist ungültig.']]),
  ['23505:PHYSIO_SESSION_CLAIM_CONFLICT', [409, 'PHYSIO_SESSION_CLAIM_CONFLICT', 'Eine Sitzung wurde bereits beansprucht.']],
]);

// Separate from the legacy rpc(): existing registry callers keep their contract.
async function physioRpc(db, name, args, pruefe) {
  const unavailable = () => fehler(503, 'PHYSIO_PUBLIKATION_NICHT_VERFUEGBAR',
    'Publikationsdienst nicht verfügbar. Ausgang des Auftrags vor Wiederholung prüfen.');
  if (typeof db?.rpc !== 'function') throw unavailable();
  let result;
  try { result = await db.rpc(name, args); } catch { throw unavailable(); }
  if (!result || result.status === 0) throw unavailable();
  if (result.error) {
    const e = result.error;
    const bekannt = PHYSIO_RPC_FEHLER.get(`${e.code}:${e.message}`);
    if (bekannt) throw fehler(...bekannt);
    if (['42883', '42703', '42P01', 'PGRST202', 'PGRST204'].includes(e.code)) throw unavailable();
    throw fehler(500, 'PHYSIO_PUBLIKATION_FEHLER', 'Abrechnungsvorgang konnte nicht abgeschlossen werden.');
  }
  if (!pruefe(result.data)) throw unavailable();
  return result.data;
}

/** Local protocol adapter; route activation still requires schema AND Storage gates. */
export async function reservierePhysioPublikation({ db, ownerId, key, payload, expectedInput = null }) {
  return physioRpc(db, 'abrechnung_idempotency_reserve', {
    p_owner: ownerId, p_key: key, p_payload: payload, p_expected_input: expectedInput,
  }, data => data && typeof data.abrechnungId === 'string' && data.abrechnungId.trim() !== '' && (
    (data.state === 'published' && data.ok === true)
    || data.state === 'aborted'
    || (data.state === 'preparing' && typeof data.worker_granted === 'boolean'
      && Number.isSafeInteger(data.generation) && data.generation > 0
      && (!data.worker_granted || (typeof data.input_sha256 === 'string'
        && /^[0-9a-f]{64}$/.test(data.input_sha256)
        && typeof data.updated_at === 'string' && data.updated_at.trim() !== '')))));
}

/** PostgreSQL owns jsonb canonicalization; JSON.stringify is not this hash contract. */
export async function berechnePhysioPaketHash({ db, paket }) {
  return physioRpc(db, 'physio_v1_hash', { p_value: paket },
    data => typeof data === 'string' && /^[0-9a-f]{64}$/.test(data));
}

/** Receipt only after immutable upload, successful readback/hash and format validation. */
export async function quittierePhysioReadback({ db, ownerId, registryId, generation, sha256, bytes, packageSha256 }) {
  return physioRpc(db, 'physio_artefakt_readback', {
    p_owner: ownerId, p_id: registryId, p_generation: generation, p_sha256: sha256,
    p_bytes: bytes, p_package_sha256: packageSha256,
  }, data => data === true);
}

/** A timeout is an unknown commit outcome, never evidence that a new bill is needed. */
export async function finalisierePhysioPublikation({ db, ownerId, abrechnungId, key,
  payloadSha256, inputSha256, generation, expectedUpdatedAt, paket, manifest }) {
  return physioRpc(db, 'abrechnung_physio_finalize', {
    p_owner: ownerId, p_abrechnung: abrechnungId, p_key: key, p_payload_sha256: payloadSha256,
    p_input_sha256: inputSha256, p_generation: generation, p_expected_updated_at: expectedUpdatedAt,
    p_package: paket, p_manifest: manifest,
  }, data => data?.ok === true && data.state === 'published'
    && typeof abrechnungId === 'string' && abrechnungId.trim() !== '' && data.abrechnungId === abrechnungId);
}

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
 * @param {{generation:number,packageSha256:string}} [p.physio]  Unpublished Physio receipt, never single-file publish
 * @param {(bytes:Buffer)=>Promise<void>|void} [p.pruefeReadback]  Fachpruefung auf den zurueckgelesenen Bytes
 * @returns {Promise<{ registryId: string, sha256: string }>}
 */
export async function reserviereUndLadeHoch({ db, ownerId, abrechnungId, pfad, kind, role, bytes, contentType, pruefeReadback, physio }) {
  if (physio !== undefined && (!physio || !Number.isSafeInteger(physio.generation) || physio.generation <= 0
    || typeof physio.packageSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(physio.packageSha256)
    || kind !== 'unsigned' || !['dta', 'auftrag', 'begleit'].includes(role)
    || typeof pruefeReadback !== 'function')) {
    throw fehler(422, 'PHYSIO_READBACK_AUFTRAG_UNGUELTIG', 'Physio-Readback benötigt Generation, Pakethash und Dateiprüfung.');
  }
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

  if (physio !== undefined) {
    await quittierePhysioReadback({ db, ownerId, registryId, generation: physio.generation,
      sha256: sha, bytes: zurueck.length, packageSha256: physio.packageSha256 });
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
