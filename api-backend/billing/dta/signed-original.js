import { webcrypto, createHash } from 'node:crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

const MAX_DTA_BYTES = 20 * 1024 * 1024; // 20 MiB
const SHA256_HEX_REGEX = /^[0-9a-fA-F]{64}$/;
const BUCKET_NAME = 'abrechnungen';

const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';
const OID_ID_DATA = '1.2.840.113549.1.7.1';

/**
 * Fehlerklasse für Validierungs- und Verarbeitungsfehler im DTA-Signaturprozess.
 * Führt standardisierte HTTP-Statuscodes und maschinenlesbare Fehlercodes mit.
 */
export class DtaVerificationError extends Error {
  constructor(message, status = 500, code = 'DTA_VERIFICATION_ERROR') {
    super(message);
    this.name = 'DtaVerificationError';
    this.status = status;
    this.statusCode = status;
    this.code = code;
  }
}

/**
 * Validiert strikt, ob ein gegebener Hash genau 64 Hexadezimalzeichen umfasst.
 */
function validateSha256Hex(hash, fieldName) {
  if (typeof hash !== 'string' || !SHA256_HEX_REGEX.test(hash)) {
    const isDta = fieldName === 'dta_sha256' || fieldName.toLowerCase().includes('dta');
    const code = isDta ? 'DTA_HASH_REQUIRED' : 'SIGNED_HASH_REQUIRED';
    throw new DtaVerificationError(
      `Ungültiger SHA-256-Hashwert für ${fieldName}`,
      422,
      code
    );
  }
}

/**
 * Validiert den Speicherpfad gegen Mandanten-Isolation und Path-Traversal-Muster.
 */
function validateTenantStoragePath(path, ownerId) {
  if (typeof path !== 'string' || path.length === 0) {
    throw new DtaVerificationError('Speicherpfad fehlt oder ist leer', 422, 'INVALID_PATH');
  }
  if (ownerId === undefined || ownerId === null || String(ownerId).trim() === '') {
    throw new DtaVerificationError('Fehlende oder ungültige Mandanten-Identifikation', 422, 'INVALID_OWNER_ID');
  }

  const expectedPrefix = `${String(ownerId)}/`;
  if (!path.startsWith(expectedPrefix)) {
    throw new DtaVerificationError('Speicherpfad gehört nicht zum Mandanten', 409, 'PATH_OWNER_MISMATCH');
  }
  if (path.startsWith('/')) {
    throw new DtaVerificationError('Speicherpfad darf nicht mit einem Schrägstrich beginnen', 422, 'INVALID_PATH_FORMAT');
  }
  if (path.includes('\\')) {
    throw new DtaVerificationError('Speicherpfad enthält unzulässige Backslash-Zeichen', 422, 'INVALID_PATH_FORMAT');
  }
  if (path.includes('%')) {
    throw new DtaVerificationError('Speicherpfad enthält unzulässige Prozent-Kodierung', 422, 'INVALID_PATH_FORMAT');
  }

  const segments = path.split('/');
  for (const segment of segments) {
    if (segment === '') {
      throw new DtaVerificationError('Speicherpfad enthält leere Pfadsegmente', 422, 'INVALID_PATH_FORMAT');
    }
    if (segment === '.' || segment === '..') {
      throw new DtaVerificationError('Speicherpfad enthält unzulässige Traversierungssegmente', 422, 'PATH_TRAVERSAL_DETECTED');
    }
  }
}

/**
 * Wandelt Datenobjekte aus dem Speicher zuverlässig in einen Node.js Buffer um.
 */
async function toBuffer(data) {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  if (data && typeof data.arrayBuffer === 'function') {
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  }
  throw new DtaVerificationError('Unerwartetes Datenformat aus dem Speicher', 500, 'STORAGE_DATA_FORMAT_ERROR');
}

/**
 * Prüft, ob ein Fehler der Speicherkomponente einem exakten HTTP 404 Not Found entspricht.
 */
function isExact404(error) {
  if (!error) return false;
  const status = error.status ?? error.statusCode;
  return status === 404 || status === '404';
}

/**
 * Lädt ein Objekt aus dem Speicher herunter und kapselt Provider-Ausnahmen ab.
 */
async function downloadBlob(db, path) {
  let response;
  try {
    response = await db.storage.from(BUCKET_NAME).download(path);
  } catch (err) {
    return { data: null, error: err };
  }
  if (!response || typeof response !== 'object' || (!('data' in response) && !('error' in response))) {
    throw new DtaVerificationError('Fehler beim Speicherzugriff', 500, 'STORAGE_DOWNLOAD_FAILED');
  }
  return { data: response.data, error: response.error };
}

/**
 * Verifiziert eine signierte DTA-Datei (PKCS#7 / CMS SignedData) kryptografisch und extrahiert
 * die eingebetteten Originaldaten nach striktem SHA-256-Abgleich.
 */
export async function pruefeSignedDta({ signedBytes, expectedDtaSha256, expectedSignedSha256 }) {
  const buf = Buffer.isBuffer(signedBytes)
    ? signedBytes
    : (signedBytes instanceof Uint8Array
      ? Buffer.from(signedBytes.buffer, signedBytes.byteOffset, signedBytes.byteLength)
      : null);

  if (!buf) {
    throw new DtaVerificationError('Eingabedaten müssen als Buffer oder Uint8Array vorliegen', 422, 'INVALID_INPUT_TYPE');
  }

  if (buf.length === 0) {
    throw new DtaVerificationError('Signierte DTA-Datei ist leer', 422, 'EMPTY_FILE');
  }

  if (buf.length > MAX_DTA_BYTES) {
    throw new DtaVerificationError('Signierte DTA-Datei überschreitet die Maximalgröße von 20 MiB', 422, 'OVERSIZED_FILE');
  }

  validateSha256Hex(expectedDtaSha256, 'expectedDtaSha256');

  if (expectedSignedSha256 !== undefined) {
    validateSha256Hex(expectedSignedSha256, 'expectedSignedSha256');
    const actualSignedSha = createHash('sha256').update(buf).digest('hex');
    if (actualSignedSha.toLowerCase() !== expectedSignedSha256.toLowerCase()) {
      throw new DtaVerificationError('Prüfsumme der signierten Datei stimmt nicht überein', 409, 'SIGNED_HASH_MISMATCH');
    }
  }

  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  let ber;
  try {
    ber = asn1js.fromBER(arrayBuffer);
  } catch {
    throw new DtaVerificationError('ASN.1-Dekodierung fehlgeschlagen', 422, 'ASN1_PARSE_ERROR');
  }

  if (!ber || ber.offset === -1 || !ber.result) {
    throw new DtaVerificationError('ASN.1-Struktur ist fehlerhaft', 422, 'ASN1_PARSE_ERROR');
  }

  if (ber.offset !== arrayBuffer.byteLength) {
    throw new DtaVerificationError('Unerwartete nachfolgende Daten in ASN.1-Struktur', 422, 'ASN1_TRAILING_DATA');
  }

  let contentInfo;
  try {
    contentInfo = new pkijs.ContentInfo({ schema: ber.result });
  } catch {
    throw new DtaVerificationError('Fehlerhafte ContentInfo-Struktur', 422, 'INVALID_CONTENT_INFO');
  }

  if (contentInfo.contentType !== OID_SIGNED_DATA) {
    throw new DtaVerificationError('Inhaltstyp ist nicht SignedData (1.2.840.113549.1.7.2)', 422, 'INVALID_CONTENT_TYPE');
  }

  let signedData;
  try {
    signedData = new pkijs.SignedData({ schema: contentInfo.content });
  } catch {
    throw new DtaVerificationError('Fehlerhafte SignedData-Struktur', 422, 'INVALID_SIGNED_DATA');
  }

  if (!signedData.encapContentInfo) {
    throw new DtaVerificationError('Fehlende encapContentInfo in SignedData', 422, 'MISSING_ENCAP_CONTENT_INFO');
  }

  if (signedData.encapContentInfo.eContentType !== OID_ID_DATA) {
    throw new DtaVerificationError('Ungültiger eContentType (erwartet 1.2.840.113549.1.7.1)', 422, 'INVALID_E_CONTENT_TYPE');
  }

  const eContent = signedData.encapContentInfo.eContent;
  if (!eContent) {
    throw new DtaVerificationError('Eingebetteter Inhalt fehlt (abgetrennte Signaturen sind nicht zulässig)', 422, 'DETACHED_CONTENT_NOT_ALLOWED');
  }

  if (!(eContent instanceof asn1js.OctetString)) {
    throw new DtaVerificationError('Eingebetteter Inhalt ist kein ASN.1 OctetString', 422, 'INVALID_E_CONTENT_TYPE');
  }

  let rawOriginalBytes;
  try {
    rawOriginalBytes = eContent.getValue();
  } catch {
    throw new DtaVerificationError('Fehler beim Extrahieren der Originaldaten aus ASN.1', 422, 'ASN1_PARSE_ERROR');
  }
  if (!rawOriginalBytes || rawOriginalBytes.byteLength === 0) {
    throw new DtaVerificationError('Eingebetteter Originalinhalt ist leer', 422, 'EMPTY_ORIGINAL_CONTENT');
  }

  if (!signedData.signerInfos || signedData.signerInfos.length !== 1) {
    throw new DtaVerificationError('Signatur muss genau einen Unterzeichner besitzen', 422, 'INVALID_SIGNER_COUNT');
  }

  const signer = signedData.signerInfos[0];
  if (signer.signedAttrs) {
    const attrs = signer.signedAttrs.attributes || [];
    const ctAttrs = attrs.filter((a) => a.type === '1.2.840.113549.1.9.3');
    if (ctAttrs.length !== 1) {
      throw new DtaVerificationError('Signatur muss genau ein Content-Type-Attribut enthalten', 422, 'INVALID_SIGNED_ATTRIBUTES');
    }
    const ctValues = ctAttrs[0].values;
    if (!Array.isArray(ctValues) || ctValues.length !== 1 || !(ctValues[0] instanceof asn1js.ObjectIdentifier) || ctValues[0].getValue() !== OID_ID_DATA) {
      throw new DtaVerificationError('Content-Type-Attribut stimmt nicht mit eContentType überein', 422, 'INVALID_SIGNED_ATTRIBUTES');
    }
    const mdAttrs = attrs.filter((a) => a.type === '1.2.840.113549.1.9.4');
    if (mdAttrs.length !== 1) {
      throw new DtaVerificationError('Signatur muss genau ein Message-Digest-Attribut enthalten', 422, 'INVALID_SIGNED_ATTRIBUTES');
    }
    const mdValues = mdAttrs[0].values;
    if (!Array.isArray(mdValues) || mdValues.length !== 1 || !(mdValues[0] instanceof asn1js.OctetString)) {
      throw new DtaVerificationError('Ungültiges Message-Digest-Attribut in Signatur', 422, 'INVALID_SIGNED_ATTRIBUTES');
    }
  }

  const cryptoEngine = new pkijs.CryptoEngine({
    name: 'node',
    crypto: webcrypto,
    subtle: webcrypto.subtle,
  });

  /**
   * KRYPTOGRAFISCHE INTEGRITÄTSPRÜFUNG:
   * checkChain: false verifiziert ausschließlich die mathematische Integrität der CMS-Signatur.
   * Dies begründet KEIN Vertrauen in eine Zertifikatskette (CA-Trust), KEINE Inhaberbindung,
   * KEINE regulatorische Gültigkeit des Zertifikats und KEINE SECON-Konformität.
   * Eine Validierung gegen Date.now() erfolgt bewusst nicht, da die formale Gültigkeit des Zertifikats
   * allein keine Urheberberechtigung begründet.
   */
  let verifyResult;
  try {
    verifyResult = await signedData.verify(
      {
        signer: 0,
        checkChain: false,
        extendedMode: true,
      },
      cryptoEngine
    );
  } catch {
    throw new DtaVerificationError('Kryptografische Signaturprüfung fehlgeschlagen', 422, 'CRYPTO_VERIFY_FAILED');
  }

  if (!verifyResult || verifyResult.signatureVerified !== true) {
    throw new DtaVerificationError('Kryptografische Signatur ist ungültig', 422, 'INVALID_SIGNATURE');
  }

  const originalDtaBuffer = Buffer.from(rawOriginalBytes);
  const actualDtaSha = createHash('sha256').update(originalDtaBuffer).digest('hex');
  if (actualDtaSha.toLowerCase() !== expectedDtaSha256.toLowerCase()) {
    throw new DtaVerificationError('Prüfsumme der extrahierten Original-DTA stimmt nicht überein', 422, 'DTA_HASH_MISMATCH');
  }

  return originalDtaBuffer;
}

/**
 * Lädt die Original-DTA-Bytes für eine Abrechnung.
 * Ruft primär storage_path ab und weicht ausschließlich bei exaktem 404
 * (oder fehlendem storage_path) auf den verifizierten signed_storage_path aus.
 */
export async function ladeDtaOriginalbytes({ db, abrechnung }) {
  if (!abrechnung || typeof abrechnung !== 'object') {
    throw new DtaVerificationError('Ungültige Abrechnungsdaten übergeben', 422, 'INVALID_ABRECHNUNG');
  }

  if (!db || !db.storage || typeof db.storage.from !== 'function') {
    throw new DtaVerificationError('Fehler beim Speicherzugriff', 500, 'STORAGE_UNAVAILABLE');
  }

  const { owner_id, storage_path, signed_storage_path, dta_sha256, signed_sha256 } = abrechnung;

  // Original-SHA256 ist verpflichtend und wird zuerst geprüft
  validateSha256Hex(dta_sha256, 'dta_sha256');

  if (storage_path !== undefined && storage_path !== null) {
    if (typeof storage_path !== 'string' || storage_path.trim() === '') {
      throw new DtaVerificationError('Speicherpfad fehlt oder ist leer', 422, 'INVALID_PATH');
    }
    validateTenantStoragePath(storage_path, owner_id);

    const { data, error } = await downloadBlob(db, storage_path);

    if (error) {
      if (!isExact404(error)) {
        // Kein Fallback bei Netzwerkfehlern, 403, 500 oder sonstigen Fehlern
        throw new DtaVerificationError('Fehler beim Abrufen der Datei aus dem Speicher', 500, 'STORAGE_DOWNLOAD_FAILED');
      }
      // Bei exaktem 404 wird der Fallback auf die signierte Datei zugelassen
    } else if (!data) {
      // Kein Fallback bei fehlenden Daten ohne Fehler (Fail Closed)
      throw new DtaVerificationError('Keine Daten für die Datei im Speicher vorhanden', 500, 'STORAGE_NO_DATA');
    } else {
      const originalBuf = await toBuffer(data);
      if (originalBuf.length === 0 || originalBuf.length > MAX_DTA_BYTES) {
        throw new DtaVerificationError('Originale DTA-Datei hat unzulässige Größe', 422, 'INVALID_FILE_SIZE');
      }
      const actualDtaSha = createHash('sha256').update(originalBuf).digest('hex');
      if (actualDtaSha.toLowerCase() !== dta_sha256.toLowerCase()) {
        throw new DtaVerificationError('Prüfsumme der gespeicherten Original-DTA stimmt nicht überein', 422, 'DTA_HASH_MISMATCH');
      }
      return originalBuf;
    }
  }

  // Fallback auf signierte DTA-Datei
  if (typeof signed_storage_path !== 'string' || signed_storage_path.trim() === '') {
    throw new DtaVerificationError('Pfad zur signierten DTA-Datei fehlt für Fallback', 422, 'MISSING_SIGNED_PATH');
  }

  validateSha256Hex(signed_sha256, 'signed_sha256');
  validateTenantStoragePath(signed_storage_path, owner_id);

  const { data: signedDataBlob, error: signedError } = await downloadBlob(db, signed_storage_path);

  if (signedError || !signedDataBlob) {
    throw new DtaVerificationError('Fehler beim Abrufen der signierten Datei aus dem Speicher', 500, 'STORAGE_DOWNLOAD_FAILED');
  }

  const signedBuf = await toBuffer(signedDataBlob);

  const actualSignedSha = createHash('sha256').update(signedBuf).digest('hex');
  if (actualSignedSha.toLowerCase() !== signed_sha256.toLowerCase()) {
    throw new DtaVerificationError('Prüfsumme der signierten Datei stimmt nicht überein', 409, 'SIGNED_HASH_MISMATCH');
  }

  return await pruefeSignedDta({
    signedBytes: signedBuf,
    expectedDtaSha256: dta_sha256,
    expectedSignedSha256: signed_sha256,
  });
}
