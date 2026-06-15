// PHI encryption helpers — AES-256-GCM, application-layer.
//
// Key: DATA_ENCRYPTION_KEY env var, 64 hex chars (32 bytes).
// Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Stored format in BYTEA columns: [12B IV][16B authTag][N B ciphertext]
// Supabase JS client sends Buffer values as binary to PostgREST BYTEA columns.
//
// Usage:
//   import { encryptPHI, decryptPHI } from '../lib/phi-encrypt.js';
//   const enc = encryptPHI('M54.5');          // → Buffer
//   const plain = decryptPHI(enc);            // → 'M54.5'
//   // Pass enc directly to .insert({ icd10_enc: enc })

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_LEN  = 12;   // GCM nonce length (recommended)
const TAG_LEN = 16;   // GCM auth-tag length

let _key = null;

function getKey() {
  if (_key) return _key;
  const hex = process.env.DATA_ENCRYPTION_KEY;
  if (!hex) throw new Error('DATA_ENCRYPTION_KEY not set — PHI encryption unavailable');
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  _key = buf;
  return _key;
}

export function encryptionAvailable() {
  return !!process.env.DATA_ENCRYPTION_KEY;
}

/**
 * Encrypt a PHI string. Returns null when input is null/undefined.
 * @param {string|null} plaintext
 * @returns {Buffer|null}
 */
export function encryptPHI(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const key    = getKey();
  const iv     = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body   = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, body]);
}

/**
 * Decrypt a PHI Buffer produced by encryptPHI. Returns null on empty input.
 * Accepts Buffer, Uint8Array, or a hex string (Supabase PostgREST returns BYTEA as hex).
 * @param {Buffer|Uint8Array|string|null} raw
 * @returns {string|null}
 */
export function decryptPHI(raw) {
  if (!raw) return null;
  let buf;
  if (typeof raw === 'string') {
    // PostgREST returns BYTEA as \xHEXHEX — strip the \x prefix
    buf = Buffer.from(raw.startsWith('\\x') ? raw.slice(2) : raw, 'hex');
  } else {
    buf = Buffer.from(raw);
  }
  if (buf.length < IV_LEN + TAG_LEN) return null;
  const iv  = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct  = buf.subarray(IV_LEN + TAG_LEN);
  try {
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return decipher.update(ct).toString('utf8') + decipher.final('utf8');
  } catch {
    return null;  // tampered or wrong key — surface as null, let app handle
  }
}
