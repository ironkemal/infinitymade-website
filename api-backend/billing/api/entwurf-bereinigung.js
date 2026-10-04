import {
  pruefeEntwurfsVersion,
  aktualisiereArtefaktVersion,
} from './artefakt-version.js';

/**
 * Liste aller Artefakt- und Signatur-Felder, die bei einem unveröffentlichten
 * und unsignierten Entwurf zwingend null sein müssen.
 */
const UNVEROEFFENTLICHT_NULL_FELDER = [
  'storage_path',
  'dta_sha256',
  'auftragsdatei_path',
  'begleitzettel_path',
  'signed_storage_path',
  'signed_sha256',
  'signed_at',
  'signed_by_cert_thumbprint',
  'encrypted_storage_path',
  'encrypted_sha256',
  'verschluesselt_am',
  'verschluesselt_fuer_fingerprint',
];

/**
 * Erzeugt einen generischen 409-Bereinigungskonflikt-Fehler ohne Rohwerte oder PHI.
 */
function createBereinigungKonfliktError() {
  const error = new Error('Konflikt bei der Bereinigung des Entwurfs.');
  error.status = 409;
  error.statusCode = 409;
  error.code = 'ENTWURF_BEREINIGUNG_KONFLIKT';
  return error;
}

/**
 * Bereinigt einen fehlgeschlagenen, unveröffentlichten und unsignierten Entwurfsversuch.
 *
 * Einschränkungen & Sicherheitsgrenzen (Scope-Ausschluss):
 * - Task 3 ist strikt auf den eigenen, fehlgeschlagenen, UNVERÖFFENTLICHTEN und UNSIGNIERTEN
 *   Versuch des Aufrufers beschränkt.
 * - Historische Dateien, bereits publizierte Abrechnungen sowie signierte oder verschlüsselte
 *   Artefakte (.p7m) sind explizit vom Bereinigungsumfang ausgeschlossen und dürfen unter
 *   keinen Umständen gelöscht werden.
 * - Es werden keine Pfade automatisiert aus bestehenden Referenzen oder durch Bucket-Listings
 *   ermittelt; der Aufrufer muss die von ihm frisch erzeugten Pfade explizit übergeben.
 * - pfade=[] ist zulässig, damit ein initialer Header auch bei Upload-Fehlschlägen per CAS
 *   verworfen werden kann.
 *
 * @param {object} params
 * @param {object} params.db - Datenbank- und Storage-Client
 * @param {object} params.vorher - Vollständiger Abrechnungs-Snapshot vor der Änderung
 * @param {string[]} params.pfade - Array der maximal 3 zu bereinigenden Dateipfade
 * @param {string} params.verzeichnis - Verzeichnis der aktuellen Versuchsdateien
 * @param {string} [params.grund='ERSTELLUNG_KONFLIKT'] - Sicherer Whitelist-Code für Verwerfung
 * @returns {Promise<{verworfen: boolean, bereinigt: boolean}>}
 */
export async function bereinigeUnveroeffentlichtenEntwurf({
  db,
  vorher,
  pfade,
  verzeichnis,
  grund = 'ERSTELLUNG_KONFLIKT',
}) {
  // 0. Absicherung gegen Null-Pointer auf oberster Ebene
  if (!db || typeof db !== 'object' || !db.storage || typeof db.storage.from !== 'function') {
    throw createBereinigungKonfliktError();
  }

  // 1. Vorab-Validierung des Entwurfszustands über den Versions-Helper
  pruefeEntwurfsVersion(vorher);

  // 2. Strenges Verbot veröffentlichter, signierter oder verschlüsselter Artefakte
  for (const feld of UNVEROEFFENTLICHT_NULL_FELDER) {
    if (vorher[feld] !== null) {
      throw createBereinigungKonfliktError();
    }
  }

  // 3. Whitelist-Validierung des Verwerfungsgrunds (keine Rohfehler/PHI)
  if (typeof grund !== 'string' || !/^[A-Z0-9_]{1,64}$/.test(grund)) {
    throw createBereinigungKonfliktError();
  }

  // 4. Validierung des Basisverzeichnisses (Präfix des Eigentümers, Abrechnungs-ID, kein Whitespace, kein Traversal)
  if (
    typeof verzeichnis !== 'string' ||
    verzeichnis.trim() === '' ||
    /\s/.test(verzeichnis) ||
    verzeichnis.includes('\\') ||
    verzeichnis.includes('%')
  ) {
    throw createBereinigungKonfliktError();
  }

  const ownerPrefix = `${vorher.owner_id}/`;
  if (!verzeichnis.startsWith(ownerPrefix)) {
    throw createBereinigungKonfliktError();
  }

  const vSegmente = verzeichnis.split('/');
  for (const seg of vSegmente) {
    if (seg === '' || seg === '.' || seg === '..' || seg.includes('..')) {
      throw createBereinigungKonfliktError();
    }
  }

  const abrechnungIndex = vSegmente.indexOf(vorher.id);
  if (abrechnungIndex < 1) {
    throw createBereinigungKonfliktError();
  }

  // 5. Validierung der zu entfernenden Pfade (0 bis maximal 3 Pfade erlaubt)
  if (!Array.isArray(pfade) || pfade.length > 3) {
    throw createBereinigungKonfliktError();
  }

  const pfadeSet = new Set(pfade);
  if (pfadeSet.size !== pfade.length) {
    throw createBereinigungKonfliktError();
  }

  const verzeichnisPrefix = `${verzeichnis}/`;

  for (const pfad of pfade) {
    if (
      typeof pfad !== 'string' ||
      pfad.trim() === '' ||
      /\s/.test(pfad) ||
      pfad.includes('\\') ||
      pfad.includes('%')
    )
    {
      throw createBereinigungKonfliktError();
    }

    if (!pfad.startsWith(verzeichnisPrefix)) {
      throw createBereinigungKonfliktError();
    }

    const dateiname = pfad.slice(verzeichnisPrefix.length);

    if (
      dateiname === '' ||
      dateiname.includes('/') ||
      dateiname === '.' ||
      dateiname === '..' ||
      dateiname.includes('..')
    ) {
      throw createBereinigungKonfliktError();
    }

    // Absoluter Schutz vor Löschung signierter/verschlüsselter Artefakte (.p7m oder .enc überall im Dateinamen/Pfad verboten)
    if (
      dateiname.toLowerCase().includes('.p7m') ||
      pfad.toLowerCase().includes('.p7m') ||
      dateiname.toLowerCase().includes('.enc') ||
      pfad.toLowerCase().includes('.enc')
    ) {
      throw createBereinigungKonfliktError();
    }

    // Zulässig: direkte eigene .dta/.auf/.html-Dateien sowie strikte suffixlose ESOL/TSOL0ddd
    const hatErlaubteEndung = /\.(dta|auf|html)$/i.test(dateiname);
    const istSuffixlessEsolTsol = /^(ESOL|TSOL)0\d{3}$/i.test(dateiname);

    if (!hatErlaubteEndung && !istSuffixlessEsolTsol) {
      throw createBereinigungKonfliktError();
    }
  }

  // 6. Atomares CAS-Update auf die Abrechnung (Status verworfen + sicherer Grund)
  // Header-Zahlen und Audit-Felder bleiben unangetastet; Zeile wird nicht gelöscht
  const patch = {
    status: 'verworfen',
    verwerfungsgrund: grund,
  };

  // Schlägt fehl mit 409 bei Nebenläufigkeit (z. B. zwischenzeitliche Publikation/Signatur)
  await aktualisiereArtefaktVersion({ db, vorher, patch });

  // 7. Erst NACH erfolgreichem CAS-Resultat: Physische Bereinigung im Storage 'abrechnungen'
  // bereinigt=true nur bei leerer Liste (kein Remove) oder response.data Array ohne Fehler; undefined wird abgelehnt
  let bereinigt = false;
  if (pfade.length === 0) {
    bereinigt = true;
  } else {
    try {
      const loeschErgebnis = await db.storage.from('abrechnungen').remove(pfade);
      if (loeschErgebnis && !loeschErgebnis.error && Array.isArray(loeschErgebnis.data)) {
        bereinigt = true;
      }
    } catch {
      bereinigt = false;
    }
  }

  return {
    verworfen: true,
    bereinigt,
  };
}