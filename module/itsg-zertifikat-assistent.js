// F4 — ITSG-Zertifikatsantrag ohne dakota.le (.p10 erzeugen, .p7c + Schlüssel → .p12).
// Spezifikation: GGT Anlage 16 (SECON, Stand 02.09.2025, §2.1.1, §2.1.2, §4.4.4, §4.4.5, §5.8, §5.9).
//
// ⛔ K2-Datenschutzregel: Privater Schlüssel, Passwort und .p12 verlassen NIEMALS den Browser.
import {
  derTag,
  derSeq,
  derSet,
  derCtx,
  derOid,
  derInt,
  baueRsassaPssAlgorithmIdentifier,
  binStrToUint8,
  uint8ToBinStr,
} from './dta-signatur.js?v=20261126f1';

export const ITSG_TRUST_ORG = 'ITSG TrustCenter fuer sonstige Leistungserbringer';
export const ITSG_UPLOAD_URL = 'https://www.itsg-trust.de/zap/upload-request';

const OID_C = '2.5.4.6';
const OID_O = '2.5.4.10';
const OID_OU = '2.5.4.11';
const OID_CN = '2.5.4.3';

// ── SECON §4.4.4 PrintableString Transliteration ────────────────────────────

/**
 * Transliteriert deutsche Umlaute und entfernt unzulässige Zeichen gemäß
 * SECON §4.4.4 (Z. 1631–1635): nur A–Z, a–z, 0–9, '/', ' ', '-', '.', '(', ')'.
 * @param {string} wert
 * @param {number} [maxLen=64]
 */
export function bereinigePrintableString(wert, maxLen = 64) {
  const roh = String(wert || '')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9/ .()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return roh.slice(0, maxLen).trim();
}

/** @param {string} str */
function derPrintableString(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0x7f;
  return derTag(0x13, bytes);
}

/** @param {Uint8Array} bytes */
function derBitString(bytes) {
  const out = new Uint8Array(bytes.length + 1);
  out[0] = 0x00; // 0 unused bits
  out.set(bytes, 1);
  return derTag(0x03, out);
}

/**
 * Baut den verbindlichen SECON-Subject-DN in exakter Reihenfolge (§4.4.5 Pos. 1→5):
 * C=DE, O=ITSG TrustCenter fuer sonstige Leistungserbringer, OU=<Praxis>, OU=IK<9 Stellen>, CN=<Inhaber>.
 *
 * @param {{ praxisName: string, ik: string, ansprechpartner: string }} opts
 */
export function baueItsgSubjectDn({ praxisName, ik, ansprechpartner }) {
  const ikClean = String(ik || '').replace(/\D/g, '');
  if (!/^\d{9}$/.test(ikClean)) {
    throw new Error('Bitte eine gültige 9-stellige IK-Nummer angeben.');
  }
  const praxis = bereinigePrintableString(praxisName, 64);
  if (praxis.length < 2) {
    throw new Error('Bitte einen gültigen Praxis-/Institutionsnamen angeben.');
  }
  const cn = bereinigePrintableString(ansprechpartner, 128);
  if (cn.length < 3) {
    throw new Error('Bitte den Namen einer natürlichen Person als Ansprechpartner (CN) angeben.');
  }

  const rdn = (/** @type {string} */ oid, /** @type {string} */ val) =>
    derSet(derSeq(derOid(oid), derPrintableString(val)));

  const dnDer = derSeq(
    rdn(OID_C, 'DE'),
    rdn(OID_O, ITSG_TRUST_ORG),
    rdn(OID_OU, praxis),
    rdn(OID_OU, `IK${ikClean}`),
    rdn(OID_CN, cn)
  );

  return {
    dnDer,
    subjectText: `C=DE, O=${ITSG_TRUST_ORG}, OU=${praxis}, OU=IK${ikClean}, CN=${cn}`,
    ik: ikClean,
    praxis,
    ansprechpartner: cn,
  };
}

// ── SECON §2.1.1 SHA-256 Fingerprint über BITSTRING subjectPublicKey ────────

/**
 * Extrahiert die Rohbytes des `subjectPublicKey` aus einer DER-kodierten SubjectPublicKeyInfo
 * (SEQUENCE { AlgorithmIdentifier, BIT STRING }) und berechnet deren SHA-256-Hash (SECON §2.1.1).
 *
 * @param {Uint8Array} spkiDer
 * @param {SubtleCrypto} [subtle]
 */
export async function berechneSubjectPublicKeySha256(spkiDer, subtle = globalThis.crypto?.subtle) {
  if (!subtle) throw new Error('WebCrypto nicht verfügbar.');
  // SPKI: SEQUENCE { algId SEQUENCE, subjectPublicKey BIT STRING }
  const readTlv = (/** @type {Uint8Array} */ buf, /** @type {number} */ off) => {
    const tag = buf[off];
    let p = off + 1;
    const f = buf[p++];
    let len = f;
    if (f >= 0x80) {
      const cnt = f & 0x7f;
      len = 0;
      for (let i = 0; i < cnt; i++) len = (len << 8) | buf[p++];
    }
    return { tag, valueStart: p, valueEnd: p + len, totalEnd: p + len };
  };
  const seq = readTlv(spkiDer, 0);
  if (seq.tag !== 0x30) throw new Error('Ungültige SubjectPublicKeyInfo (keine SEQUENCE)');
  const alg = readTlv(spkiDer, seq.valueStart);
  const bitStr = readTlv(spkiDer, alg.totalEnd);
  if (bitStr.tag !== 0x03) throw new Error('subjectPublicKey BIT STRING nicht gefunden');
  // Erstes Byte des BIT STRING ist unusedBits (0x00) — der eigentliche Schlüssel beginnt danach
  const pubKeyBytes = spkiDer.subarray(bitStr.valueStart + 1, bitStr.valueEnd);
  const hashBuf = await subtle.digest('SHA-256', /** @type {BufferSource} */ (pubKeyBytes));
  const hex = Array.from(new Uint8Array(hashBuf), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const formatiert = hex.match(/.{1,2}/g)?.join(':') || hex;
  return { hex, formatiert };
}

// ── Schritt 1: 4096-Bit-Schlüsselpaar + PKCS#10 (.p10) mit RSASSA-PSS ───────

/**
 * Erzeugt lokal im Browser ein RSA-Schlüsselpaar (Default 4096 Bit, e=65537),
 * eine SECON-konforme PKCS#10-Zertifikatsanforderung (.p10, DER, RSASSA-PSS),
 * den SHA-256-Fingerprint des Public Keys sowie den passwortgeschützten privaten Schlüssel (PEM).
 *
 * @param {{
 *   praxisName: string,
 *   ik: string,
 *   ansprechpartner: string,
 *   keyPasswort: string,
 *   forge: any,
 *   modulusLength?: number,
 *   subtle?: SubtleCrypto,
 * }} opts
 */
export async function erzeugeItsgAntragP10({
  praxisName,
  ik,
  ansprechpartner,
  keyPasswort,
  forge,
  modulusLength = 4096,
  subtle = globalThis.crypto?.subtle,
}) {
  if (!subtle) throw new Error('WebCrypto (crypto.subtle) ist in diesem Browser nicht verfügbar.');
  if (!keyPasswort || String(keyPasswort).length < 8) {
    throw new Error('Bitte ein Schlüssel-Passwort mit mindestens 8 Zeichen wählen.');
  }
  if (modulusLength !== 4096 && modulusLength !== 2048) {
    throw new Error('Schlüssellänge muss 4096 Bit (SECON) betragen.');
  }

  const dn = baueItsgSubjectDn({ praxisName, ik, ansprechpartner });

  const keyPair = await subtle.generateKey(
    {
      name: 'RSA-PSS',
      modulusLength,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  const spkiDer = new Uint8Array(await subtle.exportKey('spki', keyPair.publicKey));
  const pkcs8Der = new Uint8Array(await subtle.exportKey('pkcs8', keyPair.privateKey));

  // CertificationRequestInfo ::= SEQUENCE { version(0), subject, subjectPKInfo, attributes [0] IMPLICIT {} }
  const certReqInfo = derSeq(
    derInt(0),
    dn.dnDer,
    spkiDer,
    derCtx(0, true) // leere Attributes (SECON §5.8.3.5: keine ExtensionReq)
  );

  const sigBuf = await subtle.sign(
    { name: 'RSA-PSS', saltLength: 32 },
    keyPair.privateKey,
    /** @type {BufferSource} */ (certReqInfo)
  );

  const p10Der = derSeq(
    certReqInfo,
    baueRsassaPssAlgorithmIdentifier(),
    derBitString(new Uint8Array(sigBuf))
  );

  const fingerprint = await berechneSubjectPublicKeySha256(spkiDer, subtle);

  // Privaten Schlüssel mit node-forge passwortgeschützt als Encrypted Private Key PEM verpacken
  const pkcs8Asn1 = forge.asn1.fromDer(uint8ToBinStr(pkcs8Der));
  const encAsn1 = forge.pki.encryptPrivateKeyInfo(pkcs8Asn1, keyPasswort, {
    algorithm: 'aes256',
  });
  const encryptedPrivateKeyPem = forge.pki.encryptedPrivateKeyToPem(encAsn1);

  return {
    p10Bytes: p10Der,
    p10Dateiname: `${dn.ik}.p10`,
    encryptedPrivateKeyPem,
    keyDateiname: `${dn.ik}.key.pem`,
    subjectText: dn.subjectText,
    ik: dn.ik,
    sha256Hex: fingerprint.hex,
    sha256Formatiert: fingerprint.formatiert,
  };
}

// ── Schritt 2: .p7c (ITSG-Antwort) + privater Schlüssel → .p12 ──────────────

/**
 * Bündelt die von der ITSG gelieferte .p7c-Zertifikatskette (degeneriertes CMS SignedData, DER)
 * mit dem lokal gesicherten privaten Schlüssel (.key.pem) zu einer fertigen .p12-Datei.
 *
 * @param {{
 *   p7cBytes: Uint8Array,
 *   encryptedPrivateKeyPem: string,
 *   keyPasswort: string,
 *   p12Pin: string,
 *   forge: any,
 * }} opts
 */
export function buendleP7cZuP12({
  p7cBytes,
  encryptedPrivateKeyPem,
  keyPasswort,
  p12Pin,
  forge,
}) {
  if (!(p7cBytes instanceof Uint8Array) || p7cBytes.length < 32) {
    throw new Error('Bitte eine gültige .p7c-Datei der ITSG auswählen.');
  }
  if (!encryptedPrivateKeyPem || !encryptedPrivateKeyPem.includes('PRIVATE KEY')) {
    throw new Error('Bitte die zuvor gespeicherte Schlüsseldatei (.key.pem) auswählen.');
  }
  if (!keyPasswort) throw new Error('Bitte das Passwort der Schlüsseldatei eingeben.');
  if (!p12Pin || String(p12Pin).length < 6) {
    throw new Error('Bitte eine neue .p12-PIN mit mindestens 6 Zeichen wählen.');
  }

  let privateKey;
  try {
    privateKey = forge.pki.decryptRsaPrivateKey(encryptedPrivateKeyPem, keyPasswort);
  } catch {
    privateKey = null;
  }
  if (!privateKey) {
    throw new Error('Schlüsseldatei konnte nicht entschlüsselt werden — bitte Schlüsseldatei und Passwort prüfen.');
  }

  let certs = [];
  try {
    const p7cBin = uint8ToBinStr(p7cBytes);
    const asn1 = forge.asn1.fromDer(p7cBin);
    const p7 = forge.pkcs7.messageFromAsn1(asn1);
    certs = Array.isArray(p7?.certificates) ? p7.certificates : [];
  } catch {
    throw new Error('Die .p7c-Datei konnte nicht als gültige PKCS#7-Zertifikatskette gelesen werden.');
  }

  if (certs.length === 0) {
    throw new Error('Die .p7c-Datei enthält keine Zertifikate.');
  }

  // Passendes End-Entity-Zertifikat zum privaten Schlüssel über RSA-Modulus n finden
  const privModHex = privateKey.n?.toString(16);
  const matchIdx = certs.findIndex((/** @type {any} */ c) => c?.publicKey?.n?.toString(16) === privModHex);
  if (matchIdx === -1) {
    throw new Error(
      'Keines der Zertifikate in der .p7c-Datei passt zu diesem privaten Schlüssel. Bitte prüfen, ob die richtige .key.pem-Datei gewählt wurde.'
    );
  }

  const orderedCerts = [
    certs[matchIdx],
    ...certs.filter((/** @type {any} */ _, /** @type {number} */ idx) => idx !== matchIdx),
  ];

  const leafCert = orderedCerts[0];
  const subjectText = (leafCert.subject?.attributes || [])
    .map((/** @type {any} */ a) => `${a.shortName || a.name}=${a.value}`)
    .join(', ');
  const ikMatch = subjectText.match(/OU=IK(\d{9})/i);
  const dateiPrefix = ikMatch ? ikMatch[1] : 'itsg-zertifikat';

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, orderedCerts, p12Pin, {
    algorithm: '3des',
    friendlyName: `ITSG ${dateiPrefix}`,
  });
  const p12Bin = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Bytes = binStrToUint8(p12Bin);

  return {
    p12Bytes,
    p12Dateiname: `${dateiPrefix}.p12`,
    certCount: orderedCerts.length,
    subjectText,
    validTo: leafCert.validity?.notAfter ? new Date(leafCert.validity.notAfter).toISOString() : null,
  };
}

// ── Browser-UI (eingehängt in Abrechnungs-Einstellungen) ────────────────────

/**
 * @param {Blob} blob
 * @param {string} filename
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1500);
}

/**
 * Rendert und verdrahtet den 2-Schritte-ITSG-Assistenten (F4) im angegebenen Container.
 *
 * @param {HTMLElement} container
 * @param {{
 *   defaultPraxisName?: string,
 *   defaultIk?: string,
 *   defaultAnsprechpartner?: string,
 *   loadForge: () => Promise<any>,
 *   showToast?: (msg: string, type?: string) => void,
 * }} opts
 */
export function mountItsgZertifikatAssistent(container, {
  defaultPraxisName = '',
  defaultIk = '',
  defaultAnsprechpartner = '',
  loadForge,
  showToast = () => {},
}) {
  if (!container || container.dataset.itsgMounted === '1') return;
  container.dataset.itsgMounted = '1';

  const esc = (/** @type {string} */ s) => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  container.innerHTML = `
    <details id="itsgAssistentDetails" style="margin-top:14px;border:1px solid var(--border-subtle, #e2e8f0);border-radius:10px;padding:12px 14px;background:var(--bg-card-solid, #fff);">
      <summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--text-main, #0f172a);">
        ITSG-Zertifikat ohne dakota.le beantragen &amp; als .p12 erstellen
      </summary>
      <div style="margin-top:10px;font-size:12.5px;color:var(--text-muted, #475569);line-height:1.5;">
        Alle Schlüssel werden ausschließlich lokal in Ihrem Browser erzeugt und verlassen Ihren Rechner nie.
        Kosten bei der ITSG: 79 € im ersten Jahr, 49 €/Jahr bei Verlängerung.
      </div>

      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border-subtle, #e2e8f0);">
        <div style="font-weight:600;font-size:13px;margin-bottom:8px;">Schritt 1: Zertifikatsantrag (.p10) &amp; privaten Schlüssel erzeugen</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;">
          <label style="font-size:12px;">Praxisname (OU)<input id="itsgPraxisName" class="form-input" value="${esc(defaultPraxisName)}" placeholder="z. B. Podologie Muster" style="margin-top:4px;width:100%;"></label>
          <label style="font-size:12px;">IK-Nummer (9-stellig)<input id="itsgIk" class="form-input" value="${esc(defaultIk)}" maxlength="9" placeholder="z. B. 590537440" style="margin-top:4px;width:100%;"></label>
          <label style="font-size:12px;">Ansprechpartner / Inhaber (CN)<input id="itsgCn" class="form-input" value="${esc(defaultAnsprechpartner)}" placeholder="Vorname Nachname" style="margin-top:4px;width:100%;"></label>
          <label style="font-size:12px;">Passwort für Schlüsseldatei (min. 8 Zeichen)<input id="itsgKeyPw" type="password" class="form-input" placeholder="Sicheres Passwort" style="margin-top:4px;width:100%;"></label>
        </div>
        <div style="margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <button type="button" id="itsgGenP10Btn" class="btn btn-primary btn-sm">4096-Bit-Schlüssel &amp; .p10 erzeugen</button>
          <a href="${ITSG_UPLOAD_URL}" target="_blank" rel="noopener noreferrer" style="font-size:12px;">ITSG Upload-Portal öffnen ↗</a>
        </div>
        <div id="itsgP10Result" style="margin-top:8px;font-size:12px;"></div>
      </div>

      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-subtle, #e2e8f0);">
        <div style="font-weight:600;font-size:13px;margin-bottom:8px;">Schritt 2: ITSG-Antwort (.p7c) mit Schlüsseldatei zu .p12 verbinden</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;">
          <label style="font-size:12px;">ITSG-Zertifikat (.p7c)<input id="itsgP7cFile" type="file" accept=".p7c,.p7b" class="form-input" style="margin-top:4px;width:100%;"></label>
          <label style="font-size:12px;">Gesicherte Schlüsseldatei (.key.pem)<input id="itsgKeyFile" type="file" accept=".pem,.key" class="form-input" style="margin-top:4px;width:100%;"></label>
          <label style="font-size:12px;">Passwort der Schlüsseldatei<input id="itsgKeyPw2" type="password" class="form-input" style="margin-top:4px;width:100%;"></label>
          <label style="font-size:12px;">Neue PIN für .p12-Datei (min. 6 Zeichen)<input id="itsgP12Pin" type="password" class="form-input" style="margin-top:4px;width:100%;"></label>
        </div>
        <div style="margin-top:10px;">
          <button type="button" id="itsgMakeP12Btn" class="btn btn-secondary btn-sm">Fertige .p12-Datei erstellen</button>
        </div>
        <div id="itsgP12Result" style="margin-top:8px;font-size:12px;"></div>
      </div>
    </details>
  `;

  const genBtn = container.querySelector('#itsgGenP10Btn');
  const p10Res = container.querySelector('#itsgP10Result');
  genBtn?.addEventListener('click', async () => {
    const praxisName = /** @type {HTMLInputElement|null} */ (container.querySelector('#itsgPraxisName'))?.value || '';
    const ik = /** @type {HTMLInputElement|null} */ (container.querySelector('#itsgIk'))?.value || '';
    const ansprechpartner = /** @type {HTMLInputElement|null} */ (container.querySelector('#itsgCn'))?.value || '';
    const keyPasswort = /** @type {HTMLInputElement|null} */ (container.querySelector('#itsgKeyPw'))?.value || '';
    if (p10Res) p10Res.textContent = 'Erzeuge 4096-Bit-RSA-Schlüsselpaar lokal im Browser (kann einige Sekunden dauern)…';
    if (genBtn instanceof HTMLButtonElement) genBtn.disabled = true;
    try {
      const forge = await loadForge();
      const res = await erzeugeItsgAntragP10({ praxisName, ik, ansprechpartner, keyPasswort, forge, modulusLength: 4096 });
      triggerDownload(new Blob([/** @type {BlobPart} */ (res.p10Bytes)], { type: 'application/pkcs10' }), res.p10Dateiname);
      triggerDownload(new Blob([res.encryptedPrivateKeyPem], { type: 'application/x-pem-file' }), res.keyDateiname);
      if (p10Res) {
        p10Res.innerHTML = `
          <div style="padding:10px;border-radius:8px;background:var(--bg-subtle, #f8fafc);border:1px solid var(--border-subtle, #e2e8f0);">
            <div style="font-weight:600;color:var(--success, #15803d);">✓ ${esc(res.p10Dateiname)} und ${esc(res.keyDateiname)} wurden heruntergeladen.</div>
            <div style="margin-top:6px;color:var(--danger, #b91c1c);font-weight:600;">
              Wichtig: Bewahren Sie ${esc(res.keyDateiname)} und das Passwort sicher auf — ohne diese Datei ist das spätere ITSG-Zertifikat wertlos!
            </div>
            <div style="margin-top:6px;"><strong>Subject-DN:</strong> <code>${esc(res.subjectText)}</code></div>
            <div style="margin-top:4px;"><strong>SHA-256-Hash (Public Key für Begleitantrag):</strong><br><code style="word-break:break-all;">${esc(res.sha256Formatiert)}</code></div>
            <div style="margin-top:6px;">Nächster Schritt: <code>${esc(res.p10Dateiname)}</code> im ITSG-Portal hochladen, Begleitantrag mit diesem Hash per POSTIDENT absenden (Bearbeitung ca. 1–2 Wochen).</div>
          </div>
        `;
      }
      showToast('ITSG-Antrag (.p10) und verschlüsselte Schlüsseldatei erzeugt.', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (p10Res) p10Res.innerHTML = `<span style="color:var(--danger, #b91c1c);">${esc(msg)}</span>`;
    } finally {
      if (genBtn instanceof HTMLButtonElement) genBtn.disabled = false;
    }
  });

  const p12Btn = container.querySelector('#itsgMakeP12Btn');
  const p12Res = container.querySelector('#itsgP12Result');
  p12Btn?.addEventListener('click', async () => {
    const p7cFile = /** @type {HTMLInputElement|null} */ (container.querySelector('#itsgP7cFile'))?.files?.[0];
    const keyFile = /** @type {HTMLInputElement|null} */ (container.querySelector('#itsgKeyFile'))?.files?.[0];
    const keyPasswort = /** @type {HTMLInputElement|null} */ (container.querySelector('#itsgKeyPw2'))?.value || '';
    const p12Pin = /** @type {HTMLInputElement|null} */ (container.querySelector('#itsgP12Pin'))?.value || '';
    if (!p7cFile) { if (p12Res) p12Res.innerHTML = '<span style="color:var(--danger, #b91c1c);">Bitte .p7c-Datei auswählen.</span>'; return; }
    if (!keyFile) { if (p12Res) p12Res.innerHTML = '<span style="color:var(--danger, #b91c1c);">Bitte Schlüsseldatei (.key.pem) auswählen.</span>'; return; }
    if (p12Btn instanceof HTMLButtonElement) p12Btn.disabled = true;
    try {
      const forge = await loadForge();
      const [p7cAb, keyPem] = await Promise.all([p7cFile.arrayBuffer(), keyFile.text()]);
      const res = buendleP7cZuP12({
        p7cBytes: new Uint8Array(p7cAb),
        encryptedPrivateKeyPem: keyPem,
        keyPasswort,
        p12Pin,
        forge,
      });
      triggerDownload(new Blob([/** @type {BlobPart} */ (res.p12Bytes)], { type: 'application/x-pkcs12' }), res.p12Dateiname);
      if (p12Res) {
        p12Res.innerHTML = `<span style="color:var(--success, #15803d);font-weight:600;">✓ ${esc(res.p12Dateiname)} (${res.certCount} Zertifikat(e)) erstellt und heruntergeladen. Sie können diese Datei jetzt direkt beim Signieren Ihrer Abrechnung verwenden.</span>`;
      }
      showToast(`${res.p12Dateiname} erfolgreich erstellt.`, 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (p12Res) p12Res.innerHTML = `<span style="color:var(--danger, #b91c1c);">${esc(msg)}</span>`;
    } finally {
      if (p12Btn instanceof HTMLButtonElement) p12Btn.disabled = false;
    }
  });
}
