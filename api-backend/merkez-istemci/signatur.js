// Anfrage-Signatur der Kutu-Identität (K2b.17, guvenlik S-46). Protokoll "praxura-v1".
//
// REIN node:crypto — keine weiteren Importe, keine api-backend-Abhängigkeit.
// Diese Datei wird von der Box (signiereAnfrage) UND von merkez/ (pruefeSignatur)
// verwendet; merkez/ importiert sie per Relativpfad. Nicht kopieren.
//
// Signierter String (Zeilenumbruch "\n"):
//   praxura-v1 \n METHODE \n HOST \n rawPfad?rawQuery \n box_id \n zeit \n nonce \n hex(sha256(body))
// Leerer Body = sha256(""). Pfad/Query ROH, keine Normalisierung. Host so, wie er
// im Host-Header steht (klein, Standardport weggelassen).
import crypto from 'node:crypto';

export const PROTOKOLL = 'praxura-v1';
export const FENSTER_SEKUNDEN = 300;      // ±300 s
export const NONCE_GUELTIG_SEKUNDEN = 600; // Nonce wird 600 s gemerkt (> 2 × Fenster)

const RE_BOX = /^[0-9a-f]{32}$/;
const RE_ZEIT = /^[0-9]{1,12}$/;
const RE_NONCE = /^[A-Za-z0-9_-]{22}$/;   // 128 Bit base64url
const RE_SIGNATUR = /^[A-Za-z0-9_-]{86}$/; // Ed25519 = 64 Byte base64url

export function sha256Hex(body) {
  // Nur Buffer/string/null: ein anderer Typ (z. B. {} von express.raw ohne Body) würde still falsch gehasht.
  if (body != null && !Buffer.isBuffer(body) && typeof body !== 'string') throw new TypeError('Body muss Buffer, string oder leer sein');
  const buf = body == null ? Buffer.alloc(0) : (Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8'));
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function neueNonce() {
  return crypto.randomBytes(16).toString('base64url');
}

/**
 * Öffentlichen Ed25519-Schlüssel einlesen: KeyObject, SPKI-PEM oder base64url(SPKI-DER).
 * @returns {crypto.KeyObject}
 */
export function publicKeyLesen(eingabe) {
  let key;
  if (eingabe && typeof eingabe === 'object' && eingabe.type === 'public') {
    key = eingabe;
  } else if (typeof eingabe === 'string' && eingabe.includes('BEGIN PUBLIC KEY')) {
    key = crypto.createPublicKey(eingabe);
  } else if (typeof eingabe === 'string' && /^[A-Za-z0-9_-]+$/.test(eingabe)) {
    key = crypto.createPublicKey({ key: Buffer.from(eingabe, 'base64url'), format: 'der', type: 'spki' });
  } else {
    throw new Error('Öffentlicher Schlüssel nicht lesbar');
  }
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Nur Ed25519 erlaubt');
  return key;
}

export function publicKeyAlsBase64url(key) {
  return publicKeyLesen(key).export({ type: 'spki', format: 'der' }).toString('base64url');
}

/** box_id = erste 128 Bit (32 Hex) von sha256(SPKI-DER) — aus dem Schlüssel ableitbar, nicht frei wählbar. */
export function boxIdAusPublicKey(eingabe) {
  const der = publicKeyLesen(eingabe).export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex').slice(0, 32);
}

export function baueSignaturString({ method, host, pfad, boxId, zeit, nonce, body }) {
  return [PROTOKOLL, String(method).toUpperCase(), host, pfad, boxId, String(zeit), nonce, sha256Hex(body)].join('\n');
}

/**
 * URL ohne Normalisierung zerlegen (new URL() würde Pfade umschreiben).
 * Host klein, Standardport (80/443) weggelassen — so sendet ihn auch fetch.
 */
export function zerlegeUrl(url) {
  const m = /^(https?):\/\/([^/?#]+)([^#]*)$/i.exec(String(url));
  if (!m) throw new Error('Ungültige URL');
  const schema = m[1].toLowerCase();
  let host = m[2].toLowerCase();
  if ((schema === 'https' && host.endsWith(':443')) || (schema === 'http' && host.endsWith(':80'))) {
    host = host.replace(/:\d+$/, '');
  }
  let pfad = m[3] || '/';
  if (pfad.startsWith('?')) pfad = '/' + pfad;
  return { schema, host, pfad };
}

/**
 * Anfrage signieren (Box-Seite).
 * @param {{method:string,url:string,body?:string|Buffer,kimlik:{boxId:string,privateKey:crypto.KeyObject},jetzt?:number,nonce?:string}} p
 *   `body` MUSS exakt dieselben Bytes sein, die gesendet werden.
 * @returns {{headers:Record<string,string>, host:string, pfad:string}}
 */
export function signiereAnfrage({ method, url, body, kimlik, jetzt = Date.now(), nonce = neueNonce() }) {
  const { host, pfad } = zerlegeUrl(url);
  const zeit = Math.floor(jetzt / 1000);
  const s = baueSignaturString({ method, host, pfad, boxId: kimlik.boxId, zeit, nonce, body });
  const sig = crypto.sign(null, Buffer.from(s, 'utf8'), kimlik.privateKey).toString('base64url');
  return {
    headers: {
      'X-Praxura-Box': kimlik.boxId,
      'X-Praxura-Zeit': String(zeit),
      'X-Praxura-Nonce': nonce,
      'X-Praxura-Signatur': sig,
    },
    host,
    pfad,
  };
}

/** Signatur-Kopfzeilen lesen und formal prüfen (Node: Header-Namen klein). null = fehlt/ungültig. */
export function leseSignaturKopf(headers) {
  const h = (n) => (typeof headers?.[n] === 'string' ? headers[n] : null);
  const boxId = h('x-praxura-box');
  const zeit = h('x-praxura-zeit');
  const nonce = h('x-praxura-nonce');
  const signatur = h('x-praxura-signatur');
  if (!boxId || !zeit || !nonce || !signatur) return null;
  if (!RE_BOX.test(boxId) || !RE_ZEIT.test(zeit) || !RE_NONCE.test(nonce) || !RE_SIGNATUR.test(signatur)) return null;
  return { boxId, zeit: Number(zeit), nonce, signatur };
}

/**
 * Signatur prüfen (Merkez-Seite). Reihenfolge: Host → Zeitfenster → Signatur → Nonce.
 * Die Nonce wird erst NACH gültiger Signatur gemerkt (sonst könnte jeder den Speicher füllen).
 *
 * @param {object} p
 * @param {string} p.method      HTTP-Methode der Anfrage
 * @param {string} p.host        Host-Header der Anfrage
 * @param {string} p.pfad        roher Pfad + Query (req.originalUrl)
 * @param {Buffer|string} [p.body] roher Body
 * @param {{boxId,zeit,nonce,signatur}} p.kopf  aus leseSignaturKopf
 * @param {*} p.publicKey        Schlüssel der Box (aus dem Register)
 * @param {number} [p.jetzt]     ms
 * @param {(boxId:string, nonce:string)=>boolean} [p.nonceNeu] true = Nonce war neu (und ist jetzt gemerkt)
 * @param {string} [p.erwarteterHost] wenn gesetzt, muss der Host genau so lauten
 * @returns {{ok:true}|{ok:false, grund:string}}
 */
export function pruefeSignatur({ method, host, pfad, body, kopf, publicKey, jetzt = Date.now(), nonceNeu, erwarteterHost }) {
  if (!kopf) return { ok: false, grund: 'kopf' };
  if (erwarteterHost && host !== erwarteterHost) return { ok: false, grund: 'host' };
  const jetztSek = Math.floor(jetzt / 1000);
  if (Math.abs(jetztSek - kopf.zeit) > FENSTER_SEKUNDEN) return { ok: false, grund: 'zeit' };
  let key;
  try { key = publicKeyLesen(publicKey); } catch { return { ok: false, grund: 'schluessel' }; }
  if (boxIdAusPublicKey(key) !== kopf.boxId) return { ok: false, grund: 'box' };
  const s = baueSignaturString({ method, host, pfad, boxId: kopf.boxId, zeit: kopf.zeit, nonce: kopf.nonce, body });
  let gueltig = false;
  try {
    gueltig = crypto.verify(null, Buffer.from(s, 'utf8'), key, Buffer.from(kopf.signatur, 'base64url'));
  } catch { gueltig = false; }
  if (!gueltig) return { ok: false, grund: 'signatur' };
  if (nonceNeu && !nonceNeu(kopf.boxId, kopf.nonce)) return { ok: false, grund: 'replay' };
  return { ok: true };
}
