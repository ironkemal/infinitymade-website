// GGT Anlage 16 — Security-Schnittstelle (SECON)
// Stand 02.09.2025, gültig ab 01.01.2026.
//
// Fundstellen in wissensbank/gemeinsam/302-tp5/GGT_Anlage_16_Security_Schnittstelle_SECON.txt:
//   • Zeilen 155–190: Übersicht & kryptographische Grundlagen (RSA >= 4096 Bit,
//     AES-256-CBC, SHA-256, X.509 v3 nach Common PKI 2.0).
//   • Zeilen 528–654: Verschlüsselungsalgorithmen:
//       - Content Encryption: id-aes256-CBC (OID 2.16.840.1.101.3.4.1.42) mit zufälligem 16-Byte-IV.
//       - Key Encryption: id-RSAES-OAEP (OID 1.2.840.113549.1.1.7) mit SHA-256 als Hash- und MGF1-Algorithmus.
//         Explizite Kodierung aller drei OAEP-Parameter (kein Vertrauen auf SHA-1-Defaults):
//         * hashAlgorithm [0] AlgorithmIdentifier{id-sha256 (2.16.840.1.101.3.4.2.1), NULL}
//         * maskGenAlgorithm [1] AlgorithmIdentifier{id-mgf1 (1.2.840.113549.1.1.8),
//                                params = AlgorithmIdentifier{id-sha256, NULL}}
//         * pSourceAlgorithm [2] AlgorithmIdentifier{id-pSpecified (1.2.840.113549.1.1.9),
//                                params = OCTET STRING leer (0 Byte)}
//   • Zeilen 1032–1240: ASN.1-Struktur EnvelopedData (RFC 5652 §6.1 / Common PKI 2.0):
//       EnvelopedData ::= SEQUENCE {
//         version              CMSVersion (0),
//         -- originatorInfo    ENTFÄLLT (SECON §3.2.2.2: "muss ... entfallen")
//         recipientInfos       RecipientInfos (SET OF genau ein KeyTransRecipientInfo),
//         encryptedContentInfo EncryptedContentInfo
//         -- unprotectedAttrs  ENTFÄLLT (SECON §3.2.2.5: "entfällt!")
//       }
//       KeyTransRecipientInfo ::= SEQUENCE {
//         version                CMSVersion (0),
//         rid                    RecipientIdentifier (nur Variante issuerAndSerialNumber,
//                                SECON §3.2.2.3.2: "darf nur die Variante issuerAndSerialNumber gewählt werden"),
//         keyEncryptionAlgorithm AlgorithmIdentifier (id-RSAES-OAEP mit obigen expliziten Parametern),
//         encryptedKey           OCTET STRING (512 Byte für RSA-4096)
//       }
//       EncryptedContentInfo ::= SEQUENCE {
//         contentType                id-data (OID 1.2.840.113549.1.7.1),
//         contentEncryptionAlgorithm id-aes256-CBC (OID 2.16.840.1.101.3.4.1.42) mit IV (16 Byte),
//         encryptedContent           [0] IMPLICIT OCTET STRING (AES-256-CBC verschlüsselte SignedData-Bytes)
//       }
//       Äußeres ContentInfo (RFC 5652 §3):
//       ContentInfo ::= SEQUENCE {
//         contentType id-envelopedData (OID 1.2.840.113549.1.7.3),
//         content     [0] EXPLICIT EnvelopedData
//       }
//   • IssuerAndSerialNumber: issuer wird als unverändertes Roh-DER aus dem TBSCertificate
//     des Empfängerzertifikats entnommen (kein String-Re-Encoding, um Byte-Integrität zu wahren).
//
// Reihenfolge im §302 DTA-Ablauf (SECON §5.1):
//   1. Absender signiert Nutzdaten mit eigenem privaten Schlüssel -> PKCS#7 SignedData (.p7m)
//   2. signedBytes werden mit dem öffentlichen Schlüssel des Empfängers als EnvelopedData verschlüsselt (.dta.p7m)

import crypto from 'node:crypto';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import { pruefeEmpfaengerZertifikat } from './empfaenger-zertifikat-pruefung.js';

// Konstante OIDs gemäß SECON
const OID_ENVELOPED_DATA = '1.2.840.113549.1.7.3';
const OID_DATA           = '1.2.840.113549.1.7.1';
const OID_RSAES_OAEP     = '1.2.840.113549.1.1.7';
const OID_SHA256         = '2.16.840.1.101.3.4.2.1';
const OID_MGF1           = '1.2.840.113549.1.1.8';
const OID_P_SPECIFIED    = '1.2.840.113549.1.1.9';
const OID_AES256_CBC     = '2.16.840.1.101.3.4.1.42';

/**
 * Hilfsfunktion: Wandelt einen Buffer in einen eigenständigen ArrayBuffer um (kein Pool-Offset).
 * @param {Buffer|Uint8Array} buf
 * @returns {ArrayBuffer}
 */
function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * Verschlüsselt signierte Daten (SignedData .p7m Bytes) für einen Empfänger (Annahmestelle / Krankenkasse)
 * als CMS EnvelopedData im SECON-Profil (GGT Anlage 16).
 *
 * Vor der Verschlüsselung werden die V4-Kriterien des Empfängerzertifikats über pruefeEmpfaengerZertifikat()
 * zwingend geprüft.
 *
 * @param {object} opts
 * @param {Buffer|Uint8Array} opts.signedBytes               Die zu verschlüsselnden Bytes (fertiges SignedData .p7m)
 * @param {Buffer|Uint8Array} opts.empfaengerZertifikatDer  Das X.509-Zertifikat des Empfängers (DER-Bytes)
 * @param {string} [opts.erwarteteIk]                       Erwartete IK des Empfängers (wird gegen Zertifikat geprüft)
 * @param {Array<Buffer|Uint8Array>} [opts.itsgAnkerZertifikate] Gepinntes ITSG-Vertrauensanker-Set
 * @param {boolean} [opts.skipAnchorCheck=false]            Nur für Tests: Anchor-Prüfung überspringen
 * @returns {Buffer} DER-kodiertes ContentInfo / EnvelopedData
 */
export function verschluesseleFuerEmpfaenger({
  signedBytes,
  empfaengerZertifikatDer,
  erwarteteIk,
  itsgAnkerZertifikate,
  skipAnchorCheck = false
}) {
  if (!signedBytes || !(Buffer.isBuffer(signedBytes) || signedBytes instanceof Uint8Array) || signedBytes.length === 0) {
    throw new Error('signedBytes fehlen oder sind leer.');
  }

  const payloadBuf = Buffer.isBuffer(signedBytes) ? signedBytes : Buffer.from(signedBytes);
  const certBuf = Buffer.isBuffer(empfaengerZertifikatDer)
    ? empfaengerZertifikatDer
    : Buffer.from(empfaengerZertifikatDer || []);

  // 1. V4-Korkenprüfung des Empfängerzertifikats (wirft sofort bei Verfehlung)
  pruefeEmpfaengerZertifikat({
    zertifikatDer: certBuf,
    erwarteteIk,
    itsgAnkerZertifikate,
    skipAnchorCheck
  });

  // 2. Öffentlichen Schlüssel und TBS-Bestandteile (Issuer, SerialNumber) extrahieren
  const x509 = new crypto.X509Certificate(certBuf);
  const certAb = toArrayBuffer(certBuf);
  const pkiCert = pkijs.Certificate.fromBER(certAb);

  // Roh-DER des Issuers aus dem Zertifikat holen
  const issuerRawAb = pkiCert.issuer.valueBeforeDecode;
  if (!issuerRawAb || issuerRawAb.byteLength === 0) {
    throw new Error('TBSCertificate issuer DER konnte nicht extrahiert werden.');
  }
  const issuerAsn1 = asn1js.fromBER(issuerRawAb).result;
  const serialNumberAsn1 = pkiCert.serialNumber;

  // 3. Symmetrischen Sitzungsschlüssel (AES-256) und Initialisierungsvektor (IV) erzeugen
  const aesKey = crypto.randomBytes(32); // 256 Bit
  const iv = crypto.randomBytes(16);     // 128 Bit CBC-IV

  // 4. Nutzdaten mit AES-256-CBC verschlüsseln (PKCS#7-Padding ist Standard in Node)
  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  const encryptedContent = Buffer.concat([cipher.update(payloadBuf), cipher.final()]);

  // 5. Sitzungsschlüssel mit RSAES-OAEP (SHA-256) verschlüsseln
  const encryptedKey = crypto.publicEncrypt({
    key: x509.publicKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, aesKey);

  // 6. ASN.1-Strukturen aufbauen

  // IssuerAndSerialNumber ::= SEQUENCE { issuer Name, serialNumber INTEGER }
  const issuerAndSerialNumber = new asn1js.Sequence({
    value: [
      issuerAsn1,
      serialNumberAsn1
    ]
  });

  // RSAES-OAEP-params explizit:
  // hashAlgorithm [0] EXPLICIT AlgorithmIdentifier{id-sha256, NULL}
  const hashAlg = new asn1js.Constructed({
    idBlock: { tagClass: 3, tagNumber: 0 },
    value: [
      new asn1js.Sequence({
        value: [
          new asn1js.ObjectIdentifier({ value: OID_SHA256 }),
          new asn1js.Null()
        ]
      })
    ]
  });

  // maskGenAlgorithm [1] EXPLICIT AlgorithmIdentifier{id-mgf1, params = AlgorithmIdentifier{id-sha256, NULL}}
  const mgf1Alg = new asn1js.Constructed({
    idBlock: { tagClass: 3, tagNumber: 1 },
    value: [
      new asn1js.Sequence({
        value: [
          new asn1js.ObjectIdentifier({ value: OID_MGF1 }),
          new asn1js.Sequence({
            value: [
              new asn1js.ObjectIdentifier({ value: OID_SHA256 }),
              new asn1js.Null()
            ]
          })
        ]
      })
    ]
  });

  // pSourceAlgorithm [2] EXPLICIT AlgorithmIdentifier{id-pSpecified, params = OCTET STRING (leer)}
  const pSourceAlg = new asn1js.Constructed({
    idBlock: { tagClass: 3, tagNumber: 2 },
    value: [
      new asn1js.Sequence({
        value: [
          new asn1js.ObjectIdentifier({ value: OID_P_SPECIFIED }),
          new asn1js.OctetString({ valueHex: new ArrayBuffer(0) })
        ]
      })
    ]
  });

  const oaepParams = new asn1js.Sequence({
    value: [hashAlg, mgf1Alg, pSourceAlg]
  });

  const keyEncryptionAlgorithm = new asn1js.Sequence({
    value: [
      new asn1js.ObjectIdentifier({ value: OID_RSAES_OAEP }),
      oaepParams
    ]
  });

  const encryptedKeyOctet = new asn1js.OctetString({
    valueHex: toArrayBuffer(encryptedKey)
  });

  // KeyTransRecipientInfo ::= SEQUENCE { version (0), rid, keyEncryptionAlgorithm, encryptedKey }
  const ktri = new asn1js.Sequence({
    value: [
      new asn1js.Integer({ value: 0 }),
      issuerAndSerialNumber,
      keyEncryptionAlgorithm,
      encryptedKeyOctet
    ]
  });

  // RecipientInfos ::= SET OF RecipientInfo (genau ein Eintrag für den Empfänger)
  const recipientInfos = new asn1js.Set({
    value: [ktri]
  });

  // contentEncryptionAlgorithm: id-aes256-CBC mit IV als OCTET STRING
  const contentEncryptionAlgorithm = new asn1js.Sequence({
    value: [
      new asn1js.ObjectIdentifier({ value: OID_AES256_CBC }),
      new asn1js.OctetString({ valueHex: toArrayBuffer(iv) })
    ]
  });

  // encryptedContent [0] IMPLICIT OCTET STRING
  const encryptedContentPrimitive = new asn1js.Primitive({
    idBlock: { tagClass: 3, tagNumber: 0 },
    valueHex: toArrayBuffer(encryptedContent)
  });

  // EncryptedContentInfo ::= SEQUENCE { contentType id-data, contentEncryptionAlgorithm, encryptedContent }
  const encryptedContentInfo = new asn1js.Sequence({
    value: [
      new asn1js.ObjectIdentifier({ value: OID_DATA }),
      contentEncryptionAlgorithm,
      encryptedContentPrimitive
    ]
  });

  // EnvelopedData ::= SEQUENCE { version (0), recipientInfos, encryptedContentInfo }
  // (originatorInfo und unprotectedAttrs entfallen nach SECON-Spezifikation vollständig)
  const envelopedData = new asn1js.Sequence({
    value: [
      new asn1js.Integer({ value: 0 }),
      recipientInfos,
      encryptedContentInfo
    ]
  });

  // ContentInfo ::= SEQUENCE { contentType id-envelopedData, content [0] EXPLICIT EnvelopedData }
  const contentInfo = new asn1js.Sequence({
    value: [
      new asn1js.ObjectIdentifier({ value: OID_ENVELOPED_DATA }),
      new asn1js.Constructed({
        idBlock: { tagClass: 3, tagNumber: 0 },
        value: [envelopedData]
      })
    ]
  });

  return Buffer.from(contentInfo.toBER());
}

// ============================================================================
// ⚠️ ACHTUNG / NUR FÜR TESTS:
// Die folgende Funktion 'entschluessele' wird NIEMALS im Produktionsbetrieb
// aufgerufen! Der private Schlüssel des Empfängers (Krankenkasse/Annahmestelle)
// liegt uns im Produktivbetrieb zu keinem Zeitpunkt vor und darf das System
// niemals erreichen (K2-Sicherheitsregel).
// Diese Funktion dient AUSSCHLIESSLICH dem Round-Trip-Test in der Testsuite
// mit lokal generierten Testschlüsseln.
// ============================================================================

/**
 * Entschlüsselt ein CMS EnvelopedData-Objekt mit dem privaten Test-Schlüssel des Empfängers.
 * NUR FÜR TESTS VERWENDEN!
 *
 * @param {object} opts
 * @param {Buffer|Uint8Array} opts.envelopedBytes          DER-kodierte EnvelopedData / ContentInfo-Bytes
 * @param {string|Buffer} opts.empfaengerPrivateKeyPem     Privater RSA-Schlüssel im PEM-Format
 * @returns {Buffer} Entschlüsselte Original-Bytes
 */
export function entschluessele({ envelopedBytes, empfaengerPrivateKeyPem }) {
  if (!envelopedBytes || envelopedBytes.length === 0) {
    throw new Error('envelopedBytes fehlen oder sind leer.');
  }
  if (!empfaengerPrivateKeyPem) {
    throw new Error('empfaengerPrivateKeyPem fehlt.');
  }

  const envBuf = Buffer.isBuffer(envelopedBytes) ? envelopedBytes : Buffer.from(envelopedBytes);
  const ab = toArrayBuffer(envBuf);
  const root = asn1js.fromBER(ab);
  if (root.offset === -1) {
    throw new Error('Ungültige ASN.1-Struktur in EnvelopedData.');
  }

  const contentInfoSeq = root.result;
  const contentType = contentInfoSeq.valueBlock.value[0].valueBlock.toString();
  if (contentType !== OID_ENVELOPED_DATA) {
    throw new Error(`Erwarteter ContentType ${OID_ENVELOPED_DATA}, erhalten: ${contentType}`);
  }

  // [0] EXPLICIT EnvelopedData
  const envDataConstructed = contentInfoSeq.valueBlock.value[1];
  const envData = envDataConstructed.valueBlock.value[0];
  const envVersion = envData.valueBlock.value[0].valueBlock.valueDec;
  if (envVersion !== 0) {
    throw new Error(`EnvelopedData Version muss 0 sein, erhalten: ${envVersion}`);
  }

  // recipientInfos (SET OF)
  const recipientInfos = envData.valueBlock.value[1];
  const ktri = recipientInfos.valueBlock.value[0];
  const ktriVersion = ktri.valueBlock.value[0].valueBlock.valueDec;
  if (ktriVersion !== 0) {
    throw new Error(`KeyTransRecipientInfo Version muss 0 sein, erhalten: ${ktriVersion}`);
  }

  // KeyEncryptionAlgorithm prüfen
  const keyEncAlgSeq = ktri.valueBlock.value[2];
  const keyEncAlgOid = keyEncAlgSeq.valueBlock.value[0].valueBlock.toString();
  if (keyEncAlgOid !== OID_RSAES_OAEP) {
    throw new Error(`Erwarteter KeyEncryptionAlgorithm ${OID_RSAES_OAEP}, erhalten: ${keyEncAlgOid}`);
  }

  // EncryptedKey (OCTET STRING)
  const encKeyOctet = ktri.valueBlock.value[3];
  const encKeyBuf = Buffer.from(encKeyOctet.valueBlock.valueHexView);

  // AES-Schlüssel mit RSA-OAEP entschlüsseln
  const decryptedAesKey = crypto.privateDecrypt({
    key: empfaengerPrivateKeyPem,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, encKeyBuf);

  // EncryptedContentInfo
  const encContentInfo = envData.valueBlock.value[2];
  const innerContentType = encContentInfo.valueBlock.value[0].valueBlock.toString();
  if (innerContentType !== OID_DATA) {
    throw new Error(`Innerer ContentType muss id-data (${OID_DATA}) sein, erhalten: ${innerContentType}`);
  }

  // ContentEncryptionAlgorithm (AES-256-CBC mit IV)
  const contentEncAlg = encContentInfo.valueBlock.value[1];
  const contentEncOid = contentEncAlg.valueBlock.value[0].valueBlock.toString();
  if (contentEncOid !== OID_AES256_CBC) {
    throw new Error(`ContentEncryptionAlgorithm muss AES-256-CBC (${OID_AES256_CBC}) sein, erhalten: ${contentEncOid}`);
  }

  const ivOctet = contentEncAlg.valueBlock.value[1];
  const ivBuf = Buffer.from(ivOctet.valueBlock.valueHexView);

  // EncryptedContent ([0] IMPLICIT OCTET STRING)
  const encContentPrim = encContentInfo.valueBlock.value[2];
  const encContentBuf = Buffer.from(encContentPrim.valueBlock.valueHexView);

  // Mit AES-256-CBC entschlüsseln
  const decipher = crypto.createDecipheriv('aes-256-cbc', decryptedAesKey, ivBuf);
  return Buffer.concat([decipher.update(encContentBuf), decipher.final()]);
}
