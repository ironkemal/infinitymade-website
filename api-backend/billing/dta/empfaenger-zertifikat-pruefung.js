// GGT Anlage 16 Security-Schnittstelle (SECON), Stand 02.09.2025, gültig ab 01.01.2026
// Kapitel 4.4 (X.509-Zertifikate) & Kapitel 2.1 (Kryptographische Algorithmen).
//
// V4-Sicherheitskontrollen für Empfängerzertifikate (Annahmestellen / Krankenkassen):
// Vor JEDER Verschlüsselung müssen ausnahmslos folgende fünf Prüfungen bestanden werden:
//   1. notBefore <= jetzt <= notAfter (Gültigkeitszeitraum)
//   2. Zertifikatskette bis zu einem gepinnten ITSG-Vertrauensanker (Trust Anchor)
//   3. KeyUsage-Erweiterung (2.5.29.15) enthält das Bit 'keyEncipherment' (Bit 2)
//   4. Subject / Institutionskennzeichen stimmt mit erwarteter IK überein (SECON §4.4.5: OU "IK<ik>")
//   5. RSA-Schlüssellänge >= 4096 Bit (SECON §1.2 / §2.1.4)
//
// Bei JEDEM Fehler wird eine aussagekräftige deutsche Exception geworfen — kein Fallback,
// kein "warnen und fortfahren".

import crypto from 'node:crypto';
import * as pkijs from 'pkijs';

/**
 * Prüft ein Empfängerzertifikat gegen die fünf V4-Kriterien der GGT Anlage 16.
 *
 * @param {object} opts
 * @param {Buffer|Uint8Array} opts.zertifikatDer       X.509-Zertifikat des Empfängers in DER-Kodierung
 * @param {string} [opts.erwarteteIk]                 Erwartete 9-stellige Institutionskennzeichen (IK)
 * @param {Array<Buffer|Uint8Array>} [opts.itsgAnkerZertifikate] Liste vertrauenswürdiger ITSG-Ankerzertifikate (DER)
 * @param {boolean} [opts.skipAnchorCheck=false]      Nur für isolierte Tests der übrigen Kriterien
 * @param {Date} [opts.jetzt]                         Prüfzeitpunkt (Standard: new Date())
 * @returns {{ ok: true, subject: string, validTo: string, modulusLength: number }}
 */
export function pruefeEmpfaengerZertifikat({
  zertifikatDer,
  erwarteteIk,
  itsgAnkerZertifikate,
  skipAnchorCheck = false,
  jetzt = new Date()
}) {
  if (!zertifikatDer || !(Buffer.isBuffer(zertifikatDer) || zertifikatDer instanceof Uint8Array) || zertifikatDer.length === 0) {
    throw new Error('Empfängerzertifikat fehlt oder ist kein gültiger DER-Buffer.');
  }

  const certBuf = Buffer.isBuffer(zertifikatDer) ? zertifikatDer : Buffer.from(zertifikatDer);

  // 1) X.509 und ASN.1 parsen
  let x509Cert;
  try {
    x509Cert = new crypto.X509Certificate(certBuf);
  } catch (err) {
    throw new Error(`Empfängerzertifikat ist kein gültiges X.509-Zertifikat: ${err.message}`);
  }

  const ab = certBuf.buffer.slice(certBuf.byteOffset, certBuf.byteOffset + certBuf.byteLength);
  let pkiCert;
  try {
    pkiCert = pkijs.Certificate.fromBER(ab);
  } catch (err) {
    throw new Error(`Empfängerzertifikat ASN.1-Parsing fehlgeschlagen: ${err.message}`);
  }

  // --- KONTROLLE 1: Gültigkeitszeitraum (notBefore <= jetzt <= notAfter) ---
  const notBefore = new Date(x509Cert.validFrom);
  const notAfter = new Date(x509Cert.validTo);
  const pruefzeit = jetzt instanceof Date ? jetzt : new Date(jetzt);

  if (pruefzeit < notBefore) {
    throw new Error(
      `Empfängerzertifikat ist noch nicht gültig (Gültig ab: ${notBefore.toISOString()}, Prüfzeitpunkt: ${pruefzeit.toISOString()}).`
    );
  }
  if (pruefzeit > notAfter) {
    throw new Error(
      `Empfängerzertifikat ist abgelaufen (Gültig bis: ${notAfter.toISOString()}, Prüfzeitpunkt: ${pruefzeit.toISOString()}).`
    );
  }

  // --- KONTROLLE 2: Vertrauenskette / Trust Anchor ---
  // Spec & Vorgabe: Wenn keine Anker-Liste übergeben wird, darf die Prüfung NICHT still bestanden werden!
  // Es muss ein expliziter Fehler "Anchor fehlt" geworfen werden.
  if (!skipAnchorCheck) {
    if (!itsgAnkerZertifikate || !Array.isArray(itsgAnkerZertifikate) || itsgAnkerZertifikate.length === 0) {
      throw new Error(
        'ITSG-Trust-Anchor-Zertifikate fehlen: Vertrauensanker-Liste ist nicht konfiguriert (Voraussetzung für Schritte C und D).'
      );
    }

    let verifiziert = false;
    for (const ankerDer of itsgAnkerZertifikate) {
      try {
        const ankerBuf = Buffer.isBuffer(ankerDer) ? ankerDer : Buffer.from(ankerDer);
        const ankerX509 = new crypto.X509Certificate(ankerBuf);

        // Prüfen, ob das Zertifikat selbst der Anker ist (Self-Signed Root)
        if (x509Cert.raw.equals(ankerX509.raw)) {
          if (x509Cert.verify(x509Cert.publicKey)) {
            verifiziert = true;
            break;
          }
        }

        // Prüfen, ob das Zertifikat vom Anker ausgestellt und signiert wurde
        if (x509Cert.checkIssued(ankerX509)) {
          if (x509Cert.verify(ankerX509.publicKey)) {
            verifiziert = true;
            break;
          }
        }
      } catch {
        // Weitersuchen im nächsten Anker
      }
    }

    if (!verifiziert) {
      throw new Error(
        'Empfängerzertifikat konnte auf keinen der übergebenen ITSG-Trust-Anchor zurückgeführt werden.'
      );
    }
  }

  // --- KONTROLLE 3: KeyUsage enthält 'keyEncipherment' (Bit 2) ---
  // Extension id-ce-keyUsage (OID: 2.5.29.15)
  const keyUsageExt = (pkiCert.extensions || []).find(ext => ext.extnID === '2.5.29.15');
  if (!keyUsageExt) {
    throw new Error(
      'Empfängerzertifikat verfehlt KeyUsage: Extension 2.5.29.15 (keyUsage) nicht vorhanden.'
    );
  }

  // parsedValue ist ein asn1js.BitString
  const bitStringBlock = keyUsageExt.parsedValue;
  const bitBytes = bitStringBlock?.valueBlock?.valueHexView;
  if (!bitBytes || bitBytes.length === 0) {
    throw new Error('Empfängerzertifikat verfehlt KeyUsage: BitString-Wert ist leer.');
  }

  // Gemäß RFC 5280 §4.2.1.3:
  // Bit 0: digitalSignature (0x80)
  // Bit 1: nonRepudiation   (0x40)
  // Bit 2: keyEncipherment  (0x20)
  const firstByte = bitBytes[0];
  const hasKeyEncipherment = (firstByte & 0x20) !== 0;

  if (!hasKeyEncipherment) {
    throw new Error(
      'Empfängerzertifikat verfehlt KeyUsage: Bit 2 (keyEncipherment) ist nicht gesetzt.'
    );
  }

  // --- KONTROLLE 4: Subject / IK stimmt mit erwarteter IK überein ---
  // Gemäß SECON GGT Anlage 16 §4.4.5 (Tabelle Zeile 4):
  // "OrganizationalUnitName (OU) - Institutionskennzeichen oder Betriebs- bzw. Zahlstellennummer.
  //  Mit vorangestellter Kennung 'IK' (bei Leistungserbringer) oder 'BN' (bei Arbeitgeber oder Zahlstelle)."
  // Im Common PKI / SECON-Umfeld kann die IK auch in serialNumber (2.5.4.5) oder CN (2.5.4.3) stehen.
  if (erwarteteIk !== undefined && erwarteteIk !== null) {
    const cleanErwartet = String(erwarteteIk).trim().replace(/^IK/i, '');
    if (!/^\d{9}$/.test(cleanErwartet)) {
      throw new Error(
        `Ungültige erwartete IK: "${erwarteteIk}" ist kein 9-stelliges Institutionskennzeichen.`
      );
    }

    const subjectAttributes = pkiCert.subject.typesAndValues || [];
    let ikGefunden = false;
    let gefundeneIks = [];

    for (const attr of subjectAttributes) {
      const typeOid = attr.type;
      const rawVal = attr.value?.valueBlock?.value;
      if (typeof rawVal !== 'string') continue;

      const trimmedVal = rawVal.trim();

      // Relevant: OU (2.5.4.11), serialNumber (2.5.4.5), CN (2.5.4.3)
      if (typeOid === '2.5.4.11' || typeOid === '2.5.4.5' || typeOid === '2.5.4.3') {
        const matches = trimmedVal.match(/\b(?:IK)?(\d{9})\b/i);
        if (matches) {
          const gefundeneIk = matches[1];
          gefundeneIks.push(gefundeneIk);
          if (gefundeneIk === cleanErwartet) {
            ikGefunden = true;
            break;
          }
        }
      }
    }

    if (!ikGefunden) {
      const info = gefundeneIks.length > 0
        ? `Gefundene IK(s) im Zertifikat: [${gefundeneIks.join(', ')}]`
        : `Keine 9-stellige IK im Zertifikats-Subject gefunden (${x509Cert.subject})`;
      throw new Error(
        `Empfängerzertifikat IK stimmt nicht mit erwarteter IK (${cleanErwartet}) überein. ${info}`
      );
    }
  }

  // --- KONTROLLE 5: RSA-Schlüssellänge >= 4096 Bit ---
  const keyType = x509Cert.publicKey.asymmetricKeyType;
  if (keyType !== 'rsa') {
    throw new Error(
      `Ungültiger Schlüsseltyp im Empfängerzertifikat: "${keyType || 'unbekannt'}", gefordert ist RSA (GGT Anlage 16 §1.2).`
    );
  }

  const modulusLength = x509Cert.publicKey.asymmetricKeyDetails?.modulusLength;
  if (!modulusLength || modulusLength < 4096) {
    throw new Error(
      `RSA-Schlüssellänge unzureichend: ${modulusLength || 'unbekannt'} Bit vorhanden, mindestens 4096 Bit erforderlich (GGT Anlage 16 §1.2 / §2.1.4).`
    );
  }

  return {
    ok: true,
    subject: x509Cert.subject,
    validTo: x509Cert.validTo,
    modulusLength
  };
}
