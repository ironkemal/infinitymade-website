// GGT Anlage 16 — Security-Schnittstelle (SECON)
// ITSG Trust Anchor Modul: Laden, Parsen, Schreiben und Frische-Prüfung
// der Vertrauensanker-Zertifikate für § 302 SGB V Datenübermittlung.
//
// Referenzen:
//   - Ops-Register: onprem/REGISTER.md Eintrag O-116 (Muster B, lokale Frische-Prüfung)
//   - Quellenangabe: onprem/NOTICE-QUELLEN.txt Abschnitt 6
//   - V4-Prüfung: api-backend/billing/dta/empfaenger-zertifikat-pruefung.js

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_TRUST_ANCHORS_DIR = path.join(__dirname, 'trust-anchors');

/**
 * Hilfsfunktion: Extrahiert standardisierte Metadaten aus einem X.509-DER-Buffer.
 * @param {Buffer} derBuf
 * @returns {{ der: Buffer, sha256: string, subject: string, issuer: string, notBefore: Date, notAfter: Date }}
 */
function extrahiereZertifikatMeta(derBuf) {
  const x509 = new crypto.X509Certificate(derBuf);
  const sha256 = crypto.createHash('sha256').update(derBuf).digest('hex').toLowerCase();
  return {
    der: derBuf,
    sha256,
    subject: x509.subject,
    issuer: x509.issuer,
    notBefore: new Date(x509.validFrom),
    notAfter: new Date(x509.validTo)
  };
}

/**
 * Parst eine PKCS#7-"certs-only" SignedData-Datei oder eine Zertifikatsliste im ITSG-Annahmeliste-Format
 * (z. B. annahme-rsa4096.key) und gibt jedes enthaltene X.509-Zertifikat einzeln zurück.
 *
 * Unterstützte Formate:
 *   1. PKCS#7 / CMS SignedData (DER / BER, z. B. openssl crl2pkcs7 Bündel)
 *   2. PKCS#7 PEM (-----BEGIN PKCS7-----)
 *   3. Konkatenierte PEM-Zertifikate (-----BEGIN CERTIFICATE-----)
 *   4. Konkatenierte Base64-Zertifikatsblöcke (ITSG annahme-rsa4096.key Format)
 *   5. Einzelne oder konkatenierte DER-kodierte X.509-Zertifikate
 *
 * @param {Buffer|Uint8Array} pkcs7Bytes  Rohe Bytes der Annahmeliste
 * @returns {Array<{ der: Buffer, sha256: string, subject: string, issuer: string, notBefore: Date, notAfter: Date }>}
 * @throws {Error} wenn keine gültigen Zertifikate enthalten sind
 */
export function parseAnnahmeliste(pkcs7Bytes) {
  if (!pkcs7Bytes || !(Buffer.isBuffer(pkcs7Bytes) || pkcs7Bytes instanceof Uint8Array) || pkcs7Bytes.length === 0) {
    throw new Error('Annahmeliste-Daten fehlen oder sind leer.');
  }

  const rawBuf = Buffer.isBuffer(pkcs7Bytes) ? pkcs7Bytes : Buffer.from(pkcs7Bytes);
  const certDers = [];

  // Strategie 1: PKCS#7 / CMS SignedData in binärer DER-Kodierung (Tag 0x30 = SEQUENCE)
  if (rawBuf[0] === 0x30) {
    try {
      const ab = rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength);
      const asn1 = asn1js.fromBER(ab);
      if (asn1.offset > 0 && !asn1.result.error) {
        const contentInfo = new pkijs.ContentInfo({ schema: asn1.result });
        if (contentInfo.contentType === '1.2.840.113549.1.7.2') {
          const signedData = new pkijs.SignedData({ schema: contentInfo.content });
          if (signedData.certificates && signedData.certificates.length > 0) {
            for (const c of signedData.certificates) {
              const der = Buffer.from(c.toSchema().toBER(false));
              certDers.push(der);
            }
          }
        }
      }
    } catch {
      // Kein PKCS#7 SignedData oder Parsing-Fehler — weiter zu Textformaten
    }
  }

  // Strategie 2: Textbasierte Formate (PEM, PKCS#7 PEM, Base64-Blöcke)
  if (certDers.length === 0) {
    const text = rawBuf.toString('utf8');

    // 2a: PKCS#7 in PEM-Format
    if (text.includes('-----BEGIN PKCS7-----')) {
      const m = text.match(/-----BEGIN PKCS7-----([\s\S]*?)-----END PKCS7-----/);
      if (m) {
        const der = Buffer.from(m[1].replace(/\s+/g, ''), 'base64');
        return parseAnnahmeliste(der);
      }
    }

    // 2b: Mehrere PEM-Zertifikate mit Kopfzeilen
    if (text.includes('-----BEGIN CERTIFICATE-----')) {
      const re = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g;
      let match;
      while ((match = re.exec(text)) !== null) {
        const der = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
        try {
          new crypto.X509Certificate(der);
          certDers.push(der);
        } catch {
          // Überspringe beschädigte Blöcke
        }
      }
    }

    // 2c: ITSG-Format — durch Leerzeilen getrennte Base64-Blöcke ohne PEM-Kopfzeilen
    if (certDers.length === 0) {
      const blocks = text.split(/(?:\r?\n){2,}/).map(b => b.trim()).filter(Boolean);
      for (const block of blocks) {
        const cleaned = block.replace(/\s+/g, '');
        if (/^[A-Za-z0-9+/=]+$/.test(cleaned) && cleaned.length >= 64) {
          try {
            const der = Buffer.from(cleaned, 'base64');
            new crypto.X509Certificate(der);
            certDers.push(der);
          } catch {
            // Nicht-Zertifikatsblock ignorieren
          }
        }
      }
    }
  }

  // Strategie 3: Einzelnes oder konkatenierte DER-Zertifikate
  if (certDers.length === 0 && rawBuf[0] === 0x30) {
    try {
      new crypto.X509Certificate(rawBuf);
      certDers.push(rawBuf);
    } catch {
      // ASN.1 Längen-Schleife für hintereinanderhängende DER-Sequenzen
      let offset = 0;
      while (offset < rawBuf.length) {
        if (rawBuf[offset] !== 0x30) break;
        let len = 0;
        let headerLen = 0;
        const lenByte = rawBuf[offset + 1];
        if ((lenByte & 0x80) === 0) {
          len = lenByte;
          headerLen = 2;
        } else {
          const numBytes = lenByte & 0x7F;
          headerLen = 2 + numBytes;
          for (let i = 0; i < numBytes; i++) {
            len = (len << 8) | rawBuf[offset + 2 + i];
          }
        }
        const slice = rawBuf.slice(offset, offset + headerLen + len);
        try {
          new crypto.X509Certificate(slice);
          certDers.push(slice);
          offset += headerLen + len;
        } catch {
          break;
        }
      }
    }
  }

  if (certDers.length === 0) {
    throw new Error('Annahmeliste enthält keine gültigen X.509-Zertifikate (Format unbekannt oder Datei leer/beschädigt).');
  }

  return certDers.map(extrahiereZertifikatMeta);
}

/**
 * Schreibt eine Menge von Ankerzertifikaten + Metadaten als Datei-Artefakt auf die
 * Festplatte — Ausgabeformat, das sowohl vom CI-Job als auch vom manuellen Loader
 * erzeugt UND von ladeItsgTrustAnchors() gelesen wird.
 *
 * @param {object} opts
 * @param {Array<{der: Buffer, sha256: string, subject: string, issuer: string, notBefore: Date|string, notAfter: Date|string}>} opts.certs
 * @param {string} [opts.verzeichnis]  Zielordner, Default: DEFAULT_TRUST_ANCHORS_DIR
 * @param {string} [opts.quelle]       Herkunftsnachweis-Text
 * @param {string} [opts.quelleDatum]  ISO-Datum des Abrufs (YYYY-MM-DD)
 * @param {string} [opts.onaylayan]    Kürzel/Rolle des Prüfenden (NIEMALS Klarname, z. B. 'CI-Bot' oder 'Admin')
 * @returns {object} Das geschriebene Metadaten-Objekt
 */
export function schreibeItsgTrustAnchors({
  certs,
  verzeichnis = DEFAULT_TRUST_ANCHORS_DIR,
  quelle = 'https://trustcenter-data.itsg.de/dale/annahme-rsa4096.key',
  quelleDatum = new Date().toISOString().split('T')[0],
  onaylayan = 'CI-Bot'
}) {
  if (!certs || !Array.isArray(certs) || certs.length === 0) {
    throw new Error('Keine Zertifikate zum Schreiben übergeben.');
  }
  if (!verzeichnis) {
    throw new Error('Zielverzeichnis fehlt.');
  }

  fs.mkdirSync(verzeichnis, { recursive: true });

  const zertifikateMeta = [];

  for (const cert of certs) {
    if (!cert.der || !cert.sha256) {
      throw new Error('Ungültiges Zertifikatsobjekt: der oder sha256 fehlt.');
    }
    const prefix = cert.sha256.slice(0, 8);
    const dateiName = `anchor-${prefix}.der`;
    const dateiPfad = path.join(verzeichnis, dateiName);

    fs.writeFileSync(dateiPfad, cert.der);

    zertifikateMeta.push({
      datei: dateiName,
      sha256: cert.sha256,
      subject: cert.subject,
      issuer: cert.issuer,
      notBefore: cert.notBefore instanceof Date ? cert.notBefore.toISOString() : String(cert.notBefore),
      notAfter: cert.notAfter instanceof Date ? cert.notAfter.toISOString() : String(cert.notAfter)
    });
  }

  const meta = {
    quelle: String(quelle || '').trim(),
    quelleDatum: String(quelleDatum || '').trim(),
    onaylayan: String(onaylayan || '').trim(),
    geschriebenAm: new Date().toISOString(),
    ankerAnzahl: zertifikateMeta.length,
    zertifikate: zertifikateMeta
  };

  const metaPfad = path.join(verzeichnis, 'meta.json');
  fs.writeFileSync(metaPfad, JSON.stringify(meta, null, 2) + '\n', 'utf8');

  return meta;
}

/**
 * Lädt die committeten Ankerzertifikate + Metadaten von der Festplatte.
 *
 * Wirft NICHT, wenn das Verzeichnis fehlt oder leer ist — gibt { anchors: [], meta: null }
 * zurück. Die aufrufende Stelle (empfaenger-zertifikat-pruefung.js) wirft bereits selbst
 * einen klaren Fehler, wenn itsgAnkerZertifikate leer ankommt.
 *
 * @param {object} [opts]
 * @param {string} [opts.verzeichnis]  Zielordner, Default: DEFAULT_TRUST_ANCHORS_DIR
 * @returns {{ anchors: Buffer[], meta: object|null }}
 */
export function ladeItsgTrustAnchors({ verzeichnis = DEFAULT_TRUST_ANCHORS_DIR } = {}) {
  if (!verzeichnis || !fs.existsSync(verzeichnis)) {
    return { anchors: [], meta: null };
  }

  const metaPfad = path.join(verzeichnis, 'meta.json');
  if (!fs.existsSync(metaPfad)) {
    return { anchors: [], meta: null };
  }

  let meta;
  try {
    const raw = fs.readFileSync(metaPfad, 'utf8');
    meta = JSON.parse(raw);
  } catch {
    return { anchors: [], meta: null };
  }

  const certEntries = meta?.zertifikate;
  if (!Array.isArray(certEntries) || certEntries.length === 0) {
    return { anchors: [], meta };
  }

  const anchors = [];
  for (const entry of certEntries) {
    const dateiPfad = path.join(verzeichnis, entry.datei);
    if (fs.existsSync(dateiPfad)) {
      anchors.push(fs.readFileSync(dateiPfad));
    }
  }

  return { anchors, meta };
}

/**
 * Frische-Prüfung: bestimmt aus den geladenen Metadaten das früheste `notAfter` aller
 * Anker-Zertifikate.
 *
 * Wirft einen klaren deutschen Fehler, wenn `jetzt` bereits danach liegt (harter Stopp —
 * KEINE Verschlüsselung mit abgelaufenem Vertrauensanker).
 * Gibt eine Warnung zurück (kein Fehler), wenn `jetzt` innerhalb von `warnTageVorher` Tagen
 * davor liegt.
 *
 * @param {object} opts
 * @param {object} opts.meta           Geparste Metadaten aus meta.json
 * @param {Date|string} [opts.jetzt]   Prüfzeitpunkt (Standard: new Date())
 * @param {number} [opts.warnTageVorher=60] Vorwarnzeitraum in Tagen
 * @returns {{ ok: true, warnung: string|null, ankerGueltigBis: Date }}
 */
export function pruefeTrustAnchorFrische({ meta, jetzt = new Date(), warnTageVorher = 60 }) {
  if (!meta || !meta.zertifikate || !Array.isArray(meta.zertifikate) || meta.zertifikate.length === 0) {
    throw new Error('ITSG-Trust-Anchor-Metadaten fehlen oder enthalten keine Zertifikate.');
  }

  const pruefzeit = jetzt instanceof Date ? jetzt : new Date(jetzt);
  if (isNaN(pruefzeit.getTime())) {
    throw new Error(`Ungültiger Prüfzeitpunkt: ${jetzt}`);
  }

  const dates = meta.zertifikate.map(c => new Date(c.notAfter));
  const ankerGueltigBis = new Date(Math.min(...dates.map(d => d.getTime())));

  if (pruefzeit > ankerGueltigBis) {
    throw new Error(
      `ITSG-Trust-Anchor ist abgelaufen (Gültig bis: ${ankerGueltigBis.toISOString()}, Prüfzeitpunkt: ${pruefzeit.toISOString()}). Keine Verschlüsselung möglich.`
    );
  }

  const diffMs = ankerGueltigBis.getTime() - pruefzeit.getTime();
  const warnSchwelleMs = warnTageVorher * 24 * 60 * 60 * 1000;

  let warnung = null;
  if (diffMs <= warnSchwelleMs) {
    const verbleibendeTage = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    warnung = `ITSG-Trust-Anchor läuft in ${verbleibendeTage} Tagen ab (am ${ankerGueltigBis.toISOString()}). Bitte rechtzeitig aktualisieren.`;
  }

  return {
    ok: true,
    warnung,
    ankerGueltigBis
  };
}
