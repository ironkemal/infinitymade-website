import { randomUUID } from 'node:crypto';

/**
 * Komma-separierte Liste aller versionierten Abrechnungsfelder.
 * Stateless CAS schützt kooperative Schreiber vor Schreibkonflikten.
 * Signed- und Encrypted-Orphan-Retention wird separat behandelt;
 * dieser Helper führt keine Löschvorgänge durch.
 */
export const ABRECHNUNG_VERSION_FELDER =
  'id,owner_id,updated_at,status,storage_path,dta_sha256,signed_storage_path,signed_sha256,signed_at,signed_by_cert_thumbprint,encrypted_storage_path,encrypted_sha256,verschluesselt_am,verschluesselt_fuer_fingerprint,verschluesselung_hinweis,zaa_uploaded_at,paid_at,auftragsdatei_path,begleitzettel_path';

const VERSION_FELDER_LISTE = ABRECHNUNG_VERSION_FELDER.split(',');

const NULLABLE_FELDER = [
  'storage_path',
  'dta_sha256',
  'signed_storage_path',
  'signed_sha256',
  'signed_at',
  'signed_by_cert_thumbprint',
  'encrypted_storage_path',
  'encrypted_sha256',
  'verschluesselt_am',
  'verschluesselt_fuer_fingerprint',
  'verschluesselung_hinweis',
  'auftragsdatei_path',
  'begleitzettel_path',
];

/**
 * Erzeugt einen generischen 409-Versionskonflikt-Fehler ohne Werte.
 */
function createVersionConflictError() {
  const error = new Error('Konflikt bei der Abrechnungsversion.');
  error.status = 409;
  error.statusCode = 409;
  error.code = 'ABRECHNUNG_VERSION_CONFLICT';
  return error;
}

/**
 * Erzeugt einen generischen 500-Persistenzfehler ohne Werte.
 */
function createPersistenceError() {
  const error = new Error('Fehler bei der Persistierung des Artefakts.');
  error.status = 500;
  error.statusCode = 500;
  error.code = 'ARTEFAKT_PERSISTENZ_FEHLER';
  return error;
}

/**
 * Validiert einen Entwurfssnapshot vor dem Überschreiben.
 * Fail-closed: Alle Felder müssen vorhanden sein (undefined verboten).
 */
export function pruefeEntwurfsVersion(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw createVersionConflictError();
  }

  // Alle Versionsfelder müssen im Snapshot existieren (undefined ist unzulässig)
  for (const feld of VERSION_FELDER_LISTE) {
    if (snapshot[feld] === undefined) {
      throw createVersionConflictError();
    }
  }

  // Gültige id- und owner_id-Strings erforderlich
  if (typeof snapshot.id !== 'string' || snapshot.id.trim() === '') {
    throw createVersionConflictError();
  }
  if (typeof snapshot.owner_id !== 'string' || snapshot.owner_id.trim() === '') {
    throw createVersionConflictError();
  }

  // updated_at muss ein nicht-leerer String sein (niemals Date-Konvertierung wegen Mikrosekunden)
  if (typeof snapshot.updated_at !== 'string' || snapshot.updated_at.trim() === '') {
    throw createVersionConflictError();
  }

  // Status darf nur 'erstellt' oder 'heruntergeladen' sein
  if (snapshot.status !== 'erstellt' && snapshot.status !== 'heruntergeladen') {
    throw createVersionConflictError();
  }

  // Entwürfe dürfen weder hochgeladen noch bezahlt sein
  if (snapshot.zaa_uploaded_at !== null || snapshot.paid_at !== null) {
    throw createVersionConflictError();
  }

  // storage_path darf null sein mit existierendem dta_sha256
  if (snapshot.storage_path !== null && typeof snapshot.storage_path !== 'string') {
    throw createVersionConflictError();
  }
  if (snapshot.dta_sha256 !== null && typeof snapshot.dta_sha256 !== 'string') {
    throw createVersionConflictError();
  }

  // Kohärenz signierte Gruppe: Entweder beide null oder beide nicht-leere Strings
  const signedPath = snapshot.signed_storage_path;
  const signedHash = snapshot.signed_sha256;
  const signedBothNull = signedPath === null && signedHash === null;
  const signedBothNonEmpty =
    typeof signedPath === 'string' &&
    signedPath.trim() !== '' &&
    typeof signedHash === 'string' &&
    signedHash.trim() !== '';

  if (!signedBothNull && !signedBothNonEmpty) {
    throw createVersionConflictError();
  }

  // Kohärenz verschlüsselte Gruppe: Entweder beide null oder beide nicht-leere Strings
  const encPath = snapshot.encrypted_storage_path;
  const encHash = snapshot.encrypted_sha256;
  const encBothNull = encPath === null && encHash === null;
  const encBothNonEmpty =
    typeof encPath === 'string' &&
    encPath.trim() !== '' &&
    typeof encHash === 'string' &&
    encHash.trim() !== '';

  if (!encBothNull && !encBothNonEmpty) {
    throw createVersionConflictError();
  }

  // Alle weiteren nullbaren Felder müssen null oder String sein
  for (const feld of NULLABLE_FELDER) {
    const wert = snapshot[feld];
    if (wert !== null && typeof wert !== 'string') {
      throw createVersionConflictError();
    }
  }

  return true;
}

/**
 * Führt ein atomares CAS-Update auf die Abrechnung durch.
 * Vergleicht alle Versionsfelder. updated_at wird nie manuell geschrieben (DB-Trigger maßgeblich).
 */
export async function aktualisiereArtefaktVersion({ db, vorher, patch }) {
  // Snapshot vorab validieren
  pruefeEntwurfsVersion(vorher);

  if (!db || typeof db.from !== 'function') {
    throw createPersistenceError();
  }

  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw createPersistenceError();
  }

  // updated_at niemals explizit schreiben; Trigger übernimmt Aktualisierung
  const updatePayload = { ...patch };
  delete updatePayload.updated_at;
  delete updatePayload.id;
  delete updatePayload.owner_id;

  let query = db.from('abrechnung').update(updatePayload);

  query = query.eq('id', vorher.id);
  query = query.eq('owner_id', vorher.owner_id);

  // Alle Versionsfelder (außer id und owner_id) in die WHERE-Bedingung einbinden
  for (const feld of VERSION_FELDER_LISTE) {
    if (feld === 'id' || feld === 'owner_id') {
      continue;
    }
    const wert = vorher[feld];
    if (wert === null) {
      query = query.is(feld, null);
    } else {
      query = query.eq(feld, wert);
    }
  }

  query = query.select(ABRECHNUNG_VERSION_FELDER);

  let ergebnis;
  try {
    ergebnis = await query;
  } catch {
    throw createPersistenceError();
  }

  if (!ergebnis || ergebnis.error) {
    throw createPersistenceError();
  }

  const zeilen = ergebnis.data;
  if (!Array.isArray(zeilen) || zeilen.length !== 1) {
    // 0 oder mehrere Zeilen bedeuten einen Versionskonflikt
    throw createVersionConflictError();
  }

  const zeile = zeilen[0];
  if (!zeile || typeof zeile !== 'object' || Array.isArray(zeile)) {
    throw createPersistenceError();
  }

  // Strukturelle Validierung des Ergebnisses (kein blinder Erfolg)
  for (const feld of VERSION_FELDER_LISTE) {
    if (zeile[feld] === undefined) {
      throw createPersistenceError();
    }
  }

  if (zeile.id !== vorher.id) {
    throw createPersistenceError();
  }
  if (zeile.owner_id !== vorher.owner_id) {
    throw createPersistenceError();
  }
  if (typeof zeile.updated_at !== 'string' || zeile.updated_at.trim() === '') {
    throw createPersistenceError();
  }
  if (typeof zeile.status !== 'string' || zeile.status.trim() === '') {
    throw createPersistenceError();
  }

  for (const feld of NULLABLE_FELDER) {
    const wert = zeile[feld];
    if (wert !== null && typeof wert !== 'string') {
      throw createPersistenceError();
    }
  }

  if (zeile.zaa_uploaded_at !== null && typeof zeile.zaa_uploaded_at !== 'string') {
    throw createPersistenceError();
  }
  if (zeile.paid_at !== null && typeof zeile.paid_at !== 'string') {
    throw createPersistenceError();
  }

  return zeile;
}

/**
 * Erzeugt einen eindeutigen Speicherpfad für einen Artefakt-Versuch.
 * Schreibt nicht ins Dateisystem oder in den Storage.
 */
export function artefaktVersuchPfad({ ownerId, abrechnungId, kind }) {
  if (kind !== 'unsigned' && kind !== 'signed' && kind !== 'encrypted') {
    throw new Error('Ungültiger Artefakt-Typ.');
  }

  const istSicher = (wert) =>
    typeof wert === 'string' &&
    wert.length > 0 && wert !== '.' &&
    !/[\/\\%\s]/.test(wert) &&
    !wert.includes('..');

  if (!istSicher(ownerId) || !istSicher(abrechnungId)) {
    throw new Error('Ungültiger Bezeichner für Artefaktpfad.');
  }

  const dateiname =
    kind === 'signed'
      ? 'payload.p7m'
      : kind === 'encrypted'
        ? 'payload.dta.enc.p7m'
        : 'payload.dta';

  return `${ownerId}/${abrechnungId}/versuche/${randomUUID()}/${dateiname}`;
}
