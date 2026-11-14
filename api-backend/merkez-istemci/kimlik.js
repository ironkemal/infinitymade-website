// Kutu-Identität (K2b.17, O-161): ein Ed25519-Schlüsselpaar pro Box. Der geheime Teil
// bleibt in einer eigenen Datei (0600) im Volume `kimlik`, nie in .env/DB/Backup/
// Diagnosepaket. Merkez kennt nur den öffentlichen Schlüssel.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { boxIdAusPublicKey, publicKeyAlsBase64url } from './signatur.js';

/**
 * @typedef {object} KutuKimlik
 * @property {string} boxId
 * @property {string | null} ad
 * @property {string | null} fqdn
 * @property {crypto.KeyObject} privateKey
 * @property {crypto.KeyObject} publicKey
 * @property {string} publicKeyBase64url
 * @property {string} dir
 * @property {boolean} neu
 */

export function kimlikVerzeichnis() {
  return process.env.KIMLIK_DIR || '/var/lib/praxura/kimlik';
}

/**
 * @template T
 * @param {string} dir
 * @param {() => T} fn
 * @returns {T}
 */
function wrapFsFehler(dir, fn) {
  try {
    return fn();
  } catch (e) {
    if ((/** @type {any} */ (e)).code === 'EACCES' || (/** @type {any} */ (e)).code === 'EPERM') {
      throw new Error(`Keine Schreibrechte in ${dir} (${(/** @type {any} */ (e)).code}). Volumes vorbereiten: install.sh erneut ausführen.`);
    }
    throw e;
  }
}

/**
 * @param {string} dir
 * @param {string} endung
 * @param {crypto.KeyObject} privateKey
 * @param {crypto.KeyObject} publicKey
 */
function schreibeNeu(dir, endung, privateKey, publicKey) {
  const boxId = boxIdAusPublicKey(publicKey);
  wrapFsFehler(dir, () => {
    // Flag 'wx': scheitert, wenn die Datei schon da ist (kein Prüfen-dann-Schreiben-Rennen, keine stille Überschreibung)
    fs.writeFileSync(path.join(dir, 'box.key' + endung), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
    fs.chmodSync(path.join(dir, 'box.key' + endung), 0o600);
    fs.writeFileSync(path.join(dir, 'box.pub' + endung), publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o644, flag: 'wx' });
    fs.writeFileSync(path.join(dir, 'box.json' + endung), JSON.stringify({ box_id: boxId, ad: null, fqdn: null }, null, 2), { mode: 0o600, flag: 'wx' });
  });
}

/**
 * Neues Schlüsselpaar erzeugen und speichern: box.key (0600), box.pub, box.json {box_id, ad}.
 * `ad` ist der von Merkez zugeteilte Name — bis zur Registrierung null.
 *
 * Eine vorhandene Identität wird nie angetastet: `ersetzen: true` schreibt NUR nach *.neu
 * (die alte Identität bleibt gültig, bis `uebernehmeNeueKimlik` nach erfolgreicher Registrierung läuft).
 * Liegt schon ein *.neu vor (früherer Versuch/Absturz), wird DIESES wiederverwendet statt neu gewürfelt —
 * so lässt sich ein abgebrochener Wechsel mit einem frischen Wiederverbindungs-Code fortsetzen.
 * Rückgabe enthält `neu: true`, wenn es das .neu-Paar ist.
 * @param {{ dir?: string, ersetzen?: boolean }} [opts]
 * @returns {KutuKimlik}
 */
export function erzeugeKimlik({ dir = kimlikVerzeichnis(), ersetzen = false } = {}) {
  wrapFsFehler(dir, () => fs.mkdirSync(dir, { recursive: true, mode: 0o700 }));
  if (ersetzen) {
    if (fs.existsSync(path.join(dir, 'box.key.neu'))) return /** @type {KutuKimlik} */ (ladeKimlik({ dir, endung: '.neu' }));
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    schreibeNeu(dir, '.neu', privateKey, publicKey);
    return /** @type {KutuKimlik} */ (ladeKimlik({ dir, endung: '.neu' }));
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  try {
    schreibeNeu(dir, '', privateKey, publicKey);
  } catch (e) {
    if ((/** @type {any} */ (e)).code === 'EEXIST') throw new Error('Kimlik existiert bereits in ' + dir);
    throw e;
  }
  return /** @type {KutuKimlik} */ (ladeKimlik({ dir }));
}

/**
 * *.neu → aktiv (erst NACH erfolgreicher Registrierung). Schlüssel zuletzt, damit box.json nie vor dem Schlüssel wechselt.
 * @param {{ dir?: string }} [opts]
 */
export function uebernehmeNeueKimlik({ dir = kimlikVerzeichnis() } = {}) {
  wrapFsFehler(dir, () => {
    for (const f of ['box.pub', 'box.json', 'box.key']) {
      if (fs.existsSync(path.join(dir, f + '.neu'))) fs.renameSync(path.join(dir, f + '.neu'), path.join(dir, f));
    }
  });
}

/**
 * Identität laden. null, wenn keine vorhanden.
 * @param {{ dir?: string, endung?: string }} [opts]
 * @returns {KutuKimlik | null}
 */
export function ladeKimlik({ dir = kimlikVerzeichnis(), endung = '' } = {}) {
  const keyPfad = path.join(dir, 'box.key' + endung);
  if (!fs.existsSync(keyPfad)) return null;
  const privateKey = crypto.createPrivateKey(fs.readFileSync(keyPfad));
  const publicKey = crypto.createPublicKey(privateKey);
  const boxId = boxIdAusPublicKey(publicKey);
  /** @type {{ ad?: string | null, fqdn?: string | null }} */
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(path.join(dir, 'box.json' + endung), 'utf8')); } catch { /* fehlt → ad unbekannt */ }
  return {
    boxId,
    ad: meta.ad ?? null,
    fqdn: meta.fqdn ?? null,
    privateKey,
    publicKey,
    publicKeyBase64url: publicKeyAlsBase64url(publicKey),
    dir,
    neu: endung === '.neu',
  };
}

/**
 * Zugeteilten Namen festhalten (nach erfolgreicher Registrierung).
 * @param {{ dir?: string, ad: string, fqdn?: string | null }} opts
 */
export function speichereAd({ dir = kimlikVerzeichnis(), ad, fqdn = null }) {
  const pfad = path.join(dir, 'box.json');
  const boxId = ladeKimlik({ dir })?.boxId;
  if (!boxId) throw new Error('Keine Kimlik in ' + dir);
  wrapFsFehler(dir, () => {
    fs.writeFileSync(pfad, JSON.stringify({ box_id: boxId, ad, fqdn: fqdn ?? null }, null, 2), { mode: 0o600 });
  });
}
