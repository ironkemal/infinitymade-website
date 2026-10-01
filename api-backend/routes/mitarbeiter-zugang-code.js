import crypto from 'node:crypto';

// 32-Zeichen-Alphabet ohne verwechselbare Zeichen (kein I, O, 0, 1)
export const SETUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Erzeugt einen zufälligen Einrichtungscode mit 10 Zeichen aus dem Alphabet.
 * Da das Alphabet genau 32 (2^5) Zeichen lang ist, gibt byte % 32 keinen Modulo-Bias.
 *
 * @param {number} [length=10]
 * @returns {string} 10-stelliger Code im Rohformat, z. B. 'ABCDE23456'
 */
export function generateSetupCode(length = 10) {
  const bytes = crypto.randomBytes(length);
  const chars = [];
  const alphabetLen = SETUP_CODE_ALPHABET.length;
  for (let i = 0; i < length; i++) {
    chars.push(SETUP_CODE_ALPHABET[bytes[i] % alphabetLen]);
  }
  return chars.join('');
}

/**
 * Formatiert einen Code in das Anzeigeformat XXXXX-XXXXX.
 *
 * @param {string} code
 * @returns {string} Formatiertes Format oder unformatiert bei unerwarteter Länge
 */
export function formatSetupCode(code) {
  const clean = normalizeCode(code);
  if (clean.length === 10) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return clean;
}

/**
 * Normalisiert eine Eingabe: Leerzeichen und Bindestriche entfernen, Großschreibung.
 *
 * @param {string} code
 * @returns {string}
 */
export function normalizeCode(code) {
  if (typeof code !== 'string') return '';
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Erzeugt den SHA-256 Hex-Hash eines Codes (normalisiert vor dem Hashen).
 *
 * @param {string} code
 * @returns {string} 64 Hex-Zeichen
 */
export function hashCode(code) {
  const clean = normalizeCode(code);
  return crypto.createHash('sha256').update(clean).digest('hex');
}

/**
 * Prüft timing-sicher, ob der eingegebene Code mit dem gespeicherten SHA-256-Hash übereinstimmt.
 *
 * @param {string} inputCode
 * @param {string} storedHash
 * @returns {boolean}
 */
export function verifyCode(inputCode, storedHash) {
  if (typeof inputCode !== 'string' || typeof storedHash !== 'string') return false;
  const inputHash = hashCode(inputCode);
  if (inputHash.length !== storedHash.length) return false;

  const bufInput = Buffer.from(inputHash, 'hex');
  const bufStored = Buffer.from(storedHash, 'hex');
  if (bufInput.length !== bufStored.length) return false;

  return crypto.timingSafeEqual(bufInput, bufStored);
}

/**
 * Prüft, ob ein Gültigkeitsdatum abgelaufen ist.
 *
 * @param {string|Date} gueltigBis
 * @param {Date} [now=new Date()]
 * @returns {boolean} true wenn abgelaufen oder ungültig
 */
export function isCodeExpired(gueltigBis, now = new Date()) {
  if (!gueltigBis) return true;
  const expiry = new Date(gueltigBis);
  if (isNaN(expiry.getTime())) return true;
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return expiry.getTime() <= currentTime;
}

/**
 * Berechnet das Ablaufdatum (Standard: jetzt + 7 Tage).
 *
 * @param {number} [days=7]
 * @param {Date} [fromDate=new Date()]
 * @returns {string} ISO-String
 */
export function calculateExpiryDate(days = 7, fromDate = new Date()) {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const expiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return expiry.toISOString();
}
