// Physio publication v1: reine Ablaufsteuerung hinter Feature-Flag.
// Reserve -> Dateien erzeugen -> Paket-Hash -> Upload+Readback -> Finalize.
// Kein Loeschen, kein Rollback. DB/Storage/Adapter werden injiziert (Tests).
// Vertrag: db/entwuerfe/physio-publikation-v1.sql, Adapter: artefakt-registry.js.
import {
  reservierePhysioPublikation, berechnePhysioPaketHash, finalisierePhysioPublikation,
  reserviereUndLadeHoch, abbrechePhysioPublikation,
} from './artefakt-registry.js';

/** Flag default OFF; nur der exakte Wert '1' schaltet ein. */
export function physioPublikationAktiv(env = process.env) {
  return env?.PHYSIO_PUBLIKATION_V1 === '1';
}

export const PHYSIO_KEY_MUSTER = /^[A-Za-z0-9_-]{16,128}$/;

function fehler(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

const STANDARD = { reservierePhysioPublikation, berechnePhysioPaketHash, finalisierePhysioPublikation, reserviereUndLadeHoch, abbrechePhysioPublikation };

/**
 * @param {object} p
 * @param {object} p.db
 * @param {string} p.ownerId
 * @param {string} p.key        Idempotency-Key (Client-Retry-Identitaet)
 * @param {object} p.payload    kanonischer Auftrag (prescription_ids, session_ids, ...)
 * @param {(r:object)=>Promise<{paket:object,dateien:Array<{role:'dta'|'auftrag'|'begleit',name:string,bytes:Buffer,contentType:string,pruefeReadback:Function}>,antwort?:object}>} p.erzeuge
 *        Nur bei worker_granted aufgerufen; bekommt die Reservierung (Nummern, Generation).
 * @param {(abrechnungId:string)=>Promise<{updated_at:string,publication_generation:number,publication_package_sha256:string}>} p.ladeKopfStand
 * @param {object} [p.deps]     Adapter-Overrides fuer Tests
 * @returns {Promise<{replay:boolean, ergebnis:object, antwort?:object}>}
 */
export async function fuehrePhysioPublikationAus({ db, ownerId, key, payload, erzeuge, ladeKopfStand, deps = {} }) {
  const d = { ...STANDARD, ...deps };
  if (typeof key !== 'string' || !PHYSIO_KEY_MUSTER.test(key)) {
    throw fehler(400, 'PHYSIO_IDEMPOTENCY_KEY_UNGUELTIG', 'Idempotency-Key fehlt oder ist ungültig.');
  }

  const res = await d.reservierePhysioPublikation({ db, ownerId, key, payload });
  if (res.state === 'published') return { replay: true, ergebnis: res };
  if (res.state === 'aborted') {
    throw fehler(409, 'PHYSIO_AUFTRAG_ABGEBROCHEN', 'Dieser Abrechnungsauftrag wurde abgebrochen. Neuer Schlüssel nötig.');
  }
  if (!res.worker_granted) {
    throw fehler(409, 'PHYSIO_AUFTRAG_IN_BEARBEITUNG', 'Dieser Abrechnungsauftrag wird bereits bearbeitet. Später erneut abfragen.');
  }

  // Abbruch nur bei deterministischen Fehlern VOR Upload (Erzeugung) bzw. bei bewiesenem
  // Kopf-Konflikt VOR Finalize. Upload-/Finalize-Fehler mit unbekanntem Ausgang: nie abbrechen,
  // gleicher Key setzt fort. Abbruch-Fehler verdeckt den Ursprungsfehler nicht.
  const abbrechen = async (grund) => {
    try {
      await d.abbrechePhysioPublikation({ db, ownerId, abrechnungId: res.abrechnungId, key, generation: res.generation, grund });
    } catch { /* Lease laeuft ab; Ursprungsfehler bleibt massgeblich */ }
  };

  let erzeugt;
  try { erzeugt = await erzeuge(res); } catch (e) { await abbrechen('PHYSIO_ERZEUGUNG_FEHLGESCHLAGEN'); throw e; }
  const { paket, dateien, antwort } = erzeugt;
  const paketHash = await d.berechnePhysioPaketHash({ db, paket });

  const manifest = [];
  for (const f of dateien) {
    const pfad = `${ownerId}/${res.abrechnungId}/physio-v1/${res.generation}/${f.name}`;
    const { registryId, sha256 } = await d.reserviereUndLadeHoch({
      db, ownerId, abrechnungId: res.abrechnungId, pfad, kind: 'unsigned', role: f.role,
      bytes: f.bytes, contentType: f.contentType, pruefeReadback: f.pruefeReadback,
      physio: { generation: res.generation, packageSha256: paketHash },
    });
    manifest.push({ id: registryId, role: f.role, path: pfad, sha256, bytes: f.bytes.length });
  }

  // Jede Quittung aendert updated_at: CAS-Stand erst NACH allen Quittungen lesen.
  const kopf = await ladeKopfStand(res.abrechnungId);
  if (!kopf || Number(kopf.publication_generation) !== res.generation
    || kopf.publication_package_sha256 !== paketHash
    || typeof kopf.updated_at !== 'string' || !kopf.updated_at) {
    await abbrechen('PHYSIO_KOPF_KONFLIKT');
    throw fehler(409, 'PHYSIO_GENERATION_OR_CAS_CONFLICT', 'Abrechnungsstand hat sich geändert.');
  }

  const payloadSha256 = await d.berechnePhysioPaketHash({ db, paket: payload });
  const ergebnis = await d.finalisierePhysioPublikation({
    db, ownerId, abrechnungId: res.abrechnungId, key, payloadSha256, inputSha256: res.input_sha256,
    generation: res.generation, expectedUpdatedAt: kopf.updated_at, paket, manifest,
  });
  return { replay: false, ergebnis, antwort };
}
