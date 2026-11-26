// Synchroner RSASSA-PSS CMS SignedData Generator ausschließlich für Backend-Unit-Tests.
// Erzeugt SECON-konforme CMS-Signaturen (OID 1.2.840.113549.1.1.10, SHA-256, MGF1-SHA256, saltLength 32).
import crypto from 'node:crypto';
import forge from 'node-forge';
import {
  derTag,
  derSeq,
  derSet,
  derCtx,
  derOid,
  derNull,
  derInt,
  derOctetString,
  derUtcTime,
  extrahiereIssuerUndSerial,
  baueRsassaPssAlgorithmIdentifier,
  OID_SIGNED_DATA,
  OID_ID_DATA,
  OID_SHA256,
  OID_ATTR_CONTENT_TYPE,
  OID_ATTR_MESSAGE_DIGEST,
  OID_ATTR_SIGNING_TIME,
} from '../../../module/dta-signatur.js';

/**
 * @param {{
 *   payload: Buffer,
 *   privateKey: any,
 *   cert: any,
 *   detached?: boolean,
 *   signers?: number,
 *   contentType?: string,
 * }} opts
 * @returns {Buffer}
 */
export function createPssSignedCmsSync({
  payload,
  privateKey,
  cert,
  detached = false,
  signers = 1,
  contentType = OID_ID_DATA,
}) {
  const certDerBuf = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary');
  const certDer = new Uint8Array(certDerBuf);
  const { issuerRaw, serialRaw } = extrahiereIssuerUndSerial(certDer);

  const privPem = /** @type {any} */ (forge.pki).privateKeyToPem(privateKey);
  const msgDigest = new Uint8Array(crypto.createHash('sha256').update(payload).digest());

  const attrContentType = derSeq(derOid(OID_ATTR_CONTENT_TYPE), derSet(derOid(contentType)));
  const attrMessageDigest = derSeq(derOid(OID_ATTR_MESSAGE_DIGEST), derSet(derOctetString(msgDigest)));
  const attrSigningTime = derSeq(derOid(OID_ATTR_SIGNING_TIME), derSet(derUtcTime(new Date())));

  const cmp = (/** @type {Uint8Array} */ a, /** @type {Uint8Array} */ b) => {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  };
  const sortedAttrs = [attrContentType, attrMessageDigest, attrSigningTime].sort(cmp);
  const signedAttrsForSigning = derTag(0x31, Buffer.concat(sortedAttrs.map(a => Buffer.from(a))));

  const sha256AlgId = derSeq(derOid(OID_SHA256), derNull());
  const pssAlgId = baueRsassaPssAlgorithmIdentifier();

  const signerInfos = [];
  for (let i = 0; i < signers; i++) {
    const sigBuf = crypto.sign('sha256', Buffer.from(signedAttrsForSigning), {
      key: privPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: 32,
    });
    signerInfos.push(
      derSeq(
        derInt(1),
        derSeq(issuerRaw, serialRaw),
        sha256AlgId,
        derCtx(0, true, ...sortedAttrs),
        pssAlgId,
        derOctetString(new Uint8Array(sigBuf))
      )
    );
  }

  const encapContentInfo = detached
    ? derSeq(derOid(contentType))
    : derSeq(derOid(contentType), derCtx(0, true, derOctetString(new Uint8Array(payload))));

  const signedData = derSeq(
    derInt(1),
    derSet(sha256AlgId),
    encapContentInfo,
    derCtx(0, true, certDer),
    derSet(...signerInfos)
  );

  return Buffer.from(derSeq(derOid(OID_SIGNED_DATA), derCtx(0, true, signedData)));
}
