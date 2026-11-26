// CMS SignedData mit RSASSA-PSS (SHA-256, MGF1-SHA256, saltLength 32) gemäß
// GGT Anlage 16 (SECON, Stand 02.09.2025, §1.1, §2.1.2, §3.2.1; gültig ab 01.01.2026).
//
// Läuft rein lokal im Browser (WebCrypto) und in Node.js (globalThis.crypto.subtle).
// Private Schlüssel verlassen niemals das Endgerät der Praxis (K2).

export const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';
export const OID_ID_DATA = '1.2.840.113549.1.7.1';
export const OID_SHA256 = '2.16.840.1.101.3.4.2.1';
export const OID_MGF1 = '1.2.840.113549.1.1.8';
export const OID_RSASSA_PSS = '1.2.840.113549.1.1.10';
export const OID_ATTR_CONTENT_TYPE = '1.2.840.113549.1.9.3';
export const OID_ATTR_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';
export const OID_ATTR_SIGNING_TIME = '1.2.840.113549.1.9.5';

// ── Minimaler DER / ASN.1 Encoder ───────────────────────────────────────────

/** @param {Uint8Array[]} parts */
function concatBytes(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** @param {number} len */
function encodeDerLength(len) {
  if (len < 0x80) return new Uint8Array([len]);
  const bytes = [];
  let v = len;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v >>>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

/**
 * @param {number} tag
 * @param {Uint8Array} content
 */
export function derTag(tag, content) {
  return concatBytes([new Uint8Array([tag]), encodeDerLength(content.length), content]);
}

/** @param {...Uint8Array} items */
export function derSeq(...items) {
  return derTag(0x30, concatBytes(items));
}

/**
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 */
function compareBytesLex(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/** @param {...Uint8Array} items */
export function derSet(...items) {
  const sorted = [...items].sort(compareBytesLex);
  return derTag(0x31, concatBytes(sorted));
}

/**
 * @param {number} num
 * @param {boolean} constructed
 * @param {...Uint8Array} items
 */
export function derCtx(num, constructed, ...items) {
  return derTag(0x80 | (constructed ? 0x20 : 0) | (num & 0x1f), concatBytes(items));
}

/** @param {string} oidStr */
export function derOid(oidStr) {
  const arcs = oidStr.split('.').map(Number);
  if (arcs.length < 2 || arcs.some(n => !Number.isInteger(n) || n < 0)) {
    throw new Error(`Ungültige OID: ${oidStr}`);
  }
  const out = [arcs[0] * 40 + arcs[1]];
  for (let i = 2; i < arcs.length; i++) {
    let v = arcs[i];
    if (v === 0) {
      out.push(0);
      continue;
    }
    const tmp = [];
    while (v > 0) {
      tmp.unshift(v & 0x7f);
      v = Math.floor(v / 128);
    }
    for (let j = 0; j < tmp.length - 1; j++) tmp[j] |= 0x80;
    out.push(...tmp);
  }
  return derTag(0x06, new Uint8Array(out));
}

export function derNull() {
  return new Uint8Array([0x05, 0x00]);
}

/** @param {number} n */
export function derInt(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`derInt erwartet ganze Zahl >= 0, erhalten: ${n}`);
  if (n === 0) return derTag(0x02, new Uint8Array([0]));
  const bytes = [];
  let v = n;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v = Math.floor(v / 256);
  }
  if (bytes[0] & 0x80) bytes.unshift(0x00);
  return derTag(0x02, new Uint8Array(bytes));
}

/** @param {Uint8Array} bytes */
export function derOctetString(bytes) {
  return derTag(0x04, bytes);
}

/** @param {Date} date */
export function derUtcTime(date) {
  const pad = (/** @type {number} */ v) => String(v).padStart(2, '0');
  const yy = pad(date.getUTCFullYear() % 100);
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  const str = `${yy}${mm}${dd}${hh}${mi}${ss}Z`;
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return derTag(0x17, bytes);
}

// ── Minimaler DER-TLV-Reader für X.509 Issuer & SerialNumber ────────────────

/**
 * @param {Uint8Array} buf
 * @param {number} offset
 */
function readDerTlv(buf, offset) {
  if (offset >= buf.length) throw new Error('Unerwartetes Ende in DER-Struktur');
  const tag = buf[offset];
  let pos = offset + 1;
  if (pos >= buf.length) throw new Error('DER-Länge fehlt');
  const firstLen = buf[pos++];
  let length = 0;
  if (firstLen < 0x80) {
    length = firstLen;
  } else {
    const count = firstLen & 0x7f;
    if (count === 0 || count > 4 || pos + count > buf.length) {
      throw new Error('Ungültige DER-Längenkodierung');
    }
    for (let i = 0; i < count; i++) length = (length << 8) | buf[pos++];
  }
  const end = pos + length;
  if (end > buf.length) throw new Error('DER-Element überschreitet Puffergrenze');
  return { tag, headerLen: pos - offset, valueStart: pos, valueEnd: end, totalEnd: end, raw: buf.subarray(offset, end) };
}

/**
 * Extrahiert Issuer (SEQUENCE) und SerialNumber (INTEGER) byte-identisch aus einem X.509-DER-Zertifikat.
 * @param {Uint8Array} certDer
 */
export function extrahiereIssuerUndSerial(certDer) {
  const certSeq = readDerTlv(certDer, 0);
  if (certSeq.tag !== 0x30) throw new Error('X.509-Zertifikat beginnt nicht mit SEQUENCE');
  const tbsSeq = readDerTlv(certDer, certSeq.valueStart);
  if (tbsSeq.tag !== 0x30) throw new Error('TBSCertificate ist keine SEQUENCE');

  let cursor = tbsSeq.valueStart;
  let elem = readDerTlv(certDer, cursor);
  // Optionales [0] EXPLICIT version
  if (elem.tag === 0xa0) {
    cursor = elem.totalEnd;
    elem = readDerTlv(certDer, cursor);
  }
  // serialNumber (INTEGER)
  if (elem.tag !== 0x02) throw new Error('X.509 serialNumber (INTEGER) nicht gefunden');
  const serialRaw = elem.raw;
  cursor = elem.totalEnd;

  // signature (AlgorithmIdentifier SEQUENCE) überspringen
  const sigAlg = readDerTlv(certDer, cursor);
  if (sigAlg.tag !== 0x30) throw new Error('X.509 signature AlgorithmIdentifier nicht gefunden');
  cursor = sigAlg.totalEnd;

  // issuer (Name SEQUENCE)
  const issuer = readDerTlv(certDer, cursor);
  if (issuer.tag !== 0x30) throw new Error('X.509 issuer (SEQUENCE) nicht gefunden');
  return { issuerRaw: issuer.raw, serialRaw };
}

// ── Byte-/Base64-Konvertierung ──────────────────────────────────────────────

/** @param {string} bs */
export function binStrToUint8(bs) {
  const u = new Uint8Array(bs.length);
  for (let i = 0; i < bs.length; i++) u[i] = bs.charCodeAt(i) & 0xff;
  return u;
}

/** @param {Uint8Array} u8 */
export function uint8ToBinStr(u8) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode.apply(null, /** @type {number[]} */ (/** @type {unknown} */ (u8.subarray(i, i + chunk))));
  }
  return s;
}

/** @param {string} b64 */
export function base64ToUint8(b64) {
  if (typeof atob === 'function') return binStrToUint8(atob(b64));
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/** @param {Uint8Array} u8 */
export function uint8ToBase64(u8) {
  if (typeof btoa === 'function') return btoa(uint8ToBinStr(u8));
  return Buffer.from(u8).toString('base64');
}

// ── CMS SignedData mit RSASSA-PSS (SECON §2.1.2 + §3.2.1) ──────────────────

/**
 * Baut den SECON-konformen AlgorithmIdentifier für RSASSA-PSS:
 * hashAlgorithm = SHA-256 (NULL), maskGenAlgorithm = MGF1(SHA-256, NULL), saltLength = 32.
 */
export function baueRsassaPssAlgorithmIdentifier() {
  const sha256AlgId = derSeq(derOid(OID_SHA256), derNull());
  const mgf1Sha256AlgId = derSeq(derOid(OID_MGF1), sha256AlgId);
  const pssParams = derSeq(
    derCtx(0, true, sha256AlgId),
    derCtx(1, true, mgf1Sha256AlgId),
    derCtx(2, true, derInt(32))
  );
  return derSeq(derOid(OID_RSASSA_PSS), pssParams);
}

/**
 * Signiert DTA-Rohbytes als attached CMS SignedData (DER) mit RSASSA-PSS (SHA-256, MGF1-SHA256, saltLength 32).
 *
 * @param {{
 *   dtaBytes: Uint8Array,
 *   privateKeyPkcs8Der: Uint8Array,
 *   certChainDer: Uint8Array[],
 *   signingTime?: Date,
 *   subtle?: SubtleCrypto,
 * }} opts
 * @returns {Promise<Uint8Array>}
 */
export async function signiereDtaMitPss({
  dtaBytes,
  privateKeyPkcs8Der,
  certChainDer,
  signingTime = new Date(),
  subtle = globalThis.crypto?.subtle,
}) {
  if (!(dtaBytes instanceof Uint8Array) || dtaBytes.length === 0) {
    throw new Error('DTA-Daten für die Signatur fehlen oder sind leer.');
  }
  if (!(privateKeyPkcs8Der instanceof Uint8Array) || privateKeyPkcs8Der.length === 0) {
    throw new Error('Privater Schlüssel (PKCS#8 DER) fehlt.');
  }
  if (!Array.isArray(certChainDer) || certChainDer.length === 0) {
    throw new Error('Mindestens ein Signaturzertifikat (DER) erforderlich.');
  }
  if (!subtle) {
    throw new Error('WebCrypto (crypto.subtle) ist in dieser Umgebung nicht verfügbar.');
  }

  const signerCertDer = certChainDer[0];
  const { issuerRaw, serialRaw } = extrahiereIssuerUndSerial(signerCertDer);

  const cryptoKey = await subtle.importKey(
    'pkcs8',
    /** @type {BufferSource} */ (privateKeyPkcs8Der),
    { name: 'RSA-PSS', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const msgDigestBuf = await subtle.digest('SHA-256', /** @type {BufferSource} */ (dtaBytes));
  const msgDigest = new Uint8Array(msgDigestBuf);

  // SignedAttributes gemäß RFC 5652 & SECON §3.2.1
  const attrContentType = derSeq(derOid(OID_ATTR_CONTENT_TYPE), derSet(derOid(OID_ID_DATA)));
  const attrMessageDigest = derSeq(derOid(OID_ATTR_MESSAGE_DIGEST), derSet(derOctetString(msgDigest)));
  const attrSigningTime = derSeq(derOid(OID_ATTR_SIGNING_TIME), derSet(derUtcTime(signingTime)));

  // Für die Signaturberechnung: DER SET OF Attribute (Tag 0x31, lexikografisch sortiert)
  const sortedAttrs = [attrContentType, attrMessageDigest, attrSigningTime].sort(compareBytesLex);
  const signedAttrsForSigning = derTag(0x31, concatBytes(sortedAttrs));

  const sigBuf = await subtle.sign(
    { name: 'RSA-PSS', saltLength: 32 },
    cryptoKey,
    /** @type {BufferSource} */ (signedAttrsForSigning)
  );
  const signatureBytes = new Uint8Array(sigBuf);

  const sha256AlgId = derSeq(derOid(OID_SHA256), derNull());
  const pssAlgId = baueRsassaPssAlgorithmIdentifier();

  const signerInfo = derSeq(
    derInt(1), // version = 1 (IssuerAndSerialNumber)
    derSeq(issuerRaw, serialRaw), // sid
    sha256AlgId, // digestAlgorithm
    derCtx(0, true, ...sortedAttrs), // signedAttrs [0] IMPLICIT
    pssAlgId, // signatureAlgorithm = RSASSA-PSS
    derOctetString(signatureBytes) // signature
  );

  const encapContentInfo = derSeq(
    derOid(OID_ID_DATA),
    derCtx(0, true, derOctetString(dtaBytes))
  );

  const signedData = derSeq(
    derInt(1), // version = 1
    derSet(sha256AlgId), // digestAlgorithms
    encapContentInfo,
    derCtx(0, true, ...[...certChainDer].sort(compareBytesLex)), // certificates [0] IMPLICIT (DER SET OF sortiert)
    derSet(signerInfo) // signerInfos
  );

  return derSeq(
    derOid(OID_SIGNED_DATA),
    derCtx(0, true, signedData)
  );
}

/**
 * Extrahiert die unveränderten Roh-DER-Bytes eines X.509-Zertifikats direkt aus einem
 * node-forge certBag (`bag.asn1`), ohne `forge.pki.certificateToAsn1` (das bei echten
 * ITSG RSASSA-PSS-Zertifikaten `ASN.1 NULL` in `signatureAlgorithm` ergänzt und damit
 * die CA-Signatur zerstört).
 *
 * @param {any} bag
 * @param {any} forge
 * @returns {Uint8Array}
 */
export function extrahiereRohCertDerAusForgeBag(bag, forge) {
  if (bag?.asn1) {
    // Im PKCS#12 certBag speichert node-forge das geparste Zertifikat-ASN.1 (SEQUENCE, Typ 16)
    // direkt auf `bag.asn1`; `asn1.toDer(bag.asn1)` reproduziert die unveränderten Originalbytes.
    const bin = forge.asn1.toDer(bag.asn1).getBytes();
    if (bin && bin.length > 64 && (bin.charCodeAt(0) & 0xff) === 0x30) {
      return binStrToUint8(bin);
    }
  }
  return binStrToUint8(forge.asn1.toDer(forge.pki.certificateToAsn1(bag.cert)).getBytes());
}

/**
 * Entschlüsselt eine .p12-Datei lokal mit node-forge, prüft Ablaufdatum und signiert die DTA-Bytes
 * anschließend per WebCrypto mit RSASSA-PSS (SECON ab 01.01.2026).
 *
 * @param {{
 *   p12Bytes: Uint8Array,
 *   pin: string,
 *   dtaBytes: Uint8Array,
 *   forge: any,
 *   signingTime?: Date,
 *   subtle?: SubtleCrypto,
 * }} opts
 */
export async function entschluesseleP12UndSigniere({
  p12Bytes,
  pin,
  dtaBytes,
  forge,
  signingTime = new Date(),
  subtle = globalThis.crypto?.subtle,
}) {
  const p12BinStr = uint8ToBinStr(p12Bytes);
  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12BinStr), false, pin);
  } catch {
    throw new Error('Ungültige .p12-Datei oder falsche PIN. Bitte Zertifikatsdatei und PIN prüfen.');
  }

  const keyBagSets = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBagSets = p12.getBags({ bagType: forge.pki.oids.certBag });
  const keyBag = keyBagSets[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
  const certBags = (certBagSets[forge.pki.oids.certBag] || []).filter((/** @type {any} */ b) => b?.cert);

  if (!keyBag?.key) throw new Error('Privater Schlüssel im Zertifikat nicht gefunden.');
  if (certBags.length === 0) throw new Error('Zertifikat-Bag nicht gefunden.');

  const privateKey = keyBag.key;

  // Signer-Zertifikat passend zum privaten Schlüssel (Modulus n) nach vorn sortieren,
  // übrige Zertifikate der Kette (PCA/CA) gemäß SECON §3.2.1.4 mit einbetten.
  const privModHex = privateKey.n?.toString(16) || null;
  let signerIdx = 0;
  if (privModHex) {
    const matchIdx = certBags.findIndex((/** @type {any} */ b) => b.cert?.publicKey?.n?.toString(16) === privModHex);
    if (matchIdx === -1) {
      throw new Error('Keines der Zertifikate in der .p12-Datei passt zum privaten Schlüssel.');
    }
    signerIdx = matchIdx;
  }
  const orderedBags = [
    certBags[signerIdx],
    ...certBags.filter((/** @type {any} */ _, /** @type {number} */ idx) => idx !== signerIdx),
  ];

  const cert = orderedBags[0].cert;
  const certChainDer = orderedBags.map((/** @type {any} */ b) => extrahiereRohCertDerAusForgeBag(b, forge));

  const certDerBin = uint8ToBinStr(certChainDer[0]);
  const md = forge.md.sha1.create();
  md.update(certDerBin);
  const certThumbprint = md.digest().toHex();
  const certSubject = (cert.subject?.attributes || [])
    .map((/** @type {any} */ a) => `${a.shortName || a.name}=${a.value}`)
    .join(', ');
  const certValidTo = cert.validity?.notAfter ? new Date(cert.validity.notAfter).toISOString() : null;
  const certSerial = cert.serialNumber || null;

  if (cert.validity?.notAfter && cert.validity.notAfter < new Date()) {
    throw new Error(
      `Zertifikat abgelaufen (${cert.validity.notAfter.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}).`
    );
  }

  const pkcs8Asn1 = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(privateKey));
  const privateKeyPkcs8Der = binStrToUint8(forge.asn1.toDer(pkcs8Asn1).getBytes());

  const signedBytes = await signiereDtaMitPss({
    dtaBytes,
    privateKeyPkcs8Der,
    certChainDer,
    signingTime,
    subtle,
  });

  return {
    signedBytes,
    signedBase64: uint8ToBase64(signedBytes),
    certSubject,
    certValidTo,
    certThumbprint,
    certSerial,
  };
}
