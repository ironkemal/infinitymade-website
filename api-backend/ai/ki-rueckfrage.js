import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_TTL_MS = 300_000;
const MAX_CANDIDATES = 5;
const MAX_SEEN_FILES = 1000; // Cap file count

export function computePayloadFingerprint(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const clone = { ...payload };
  delete clone.ki_confirmation;

  function sortKeys(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);
    const sorted = {};
    for (const k of Object.keys(obj).sort()) {
      sorted[k] = sortKeys(obj[k]);
    }
    return sorted;
  }

  const canonicalJson = JSON.stringify(sortKeys(clone));
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}

export function createConfirmationService({
  secret, // derived from boxIdentity
  directory, // injected temp directory for tests
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now
} = {}) {
  if (!secret || !Buffer.isBuffer(secret) || secret.length < 32) throw new Error('Rückfrage-Schlüssel fehlt');
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > DEFAULT_TTL_MS) throw new Error('Rückfrage-TTL ungültig');
  const hmacSecret = secret;

  function getMetadataDir() {
    return directory || process.env.KI_EINWILLIGUNG_DIR || '/var/lib/praxura/ki-freigaben';
  }

  function makeHmac(data) {
    return crypto.createHmac('sha256', hmacSecret).update(data).digest('hex');
  }

  function getMarkerPath(sig) {
    return path.join(getMetadataDir(), `.challenge-${sig}.consumed`);
  }

  function enforceMarkerCap() {
    const dir = getMetadataDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

    const dirStat = fs.lstatSync(dir);
    if (!dirStat.isDirectory() || dirStat.isSymbolicLink() || (dirStat.mode & 0o777) !== 0o700) {
      throw new Error('Ungültiges Replay-Verzeichnis');
    }

    const files = fs.readdirSync(dir).filter(f => /^\.challenge-[a-f0-9]{64}\.consumed$/.test(f));
    if (files.length > MAX_SEEN_FILES + 100) throw new Error('Replay-Verzeichnis zu groß');
    const currentTime = now();
    let activeMarkers = 0;

    for (const f of files) {
      const fp = path.join(dir, f);
      try {
        const stat = fs.lstatSync(fp);
        if (!stat.isFile() || stat.size > 128 || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600) {
          activeMarkers++; // Treat unsafe as active/corrupt to fail closed
          continue;
        }

        let markerFd; let content;
        try { markerFd = fs.openSync(fp, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); const opened = fs.fstatSync(markerFd); if (!opened.isFile() || opened.size > 128 || (opened.mode & 0o777) !== 0o600) throw new Error('Invalid marker'); content = fs.readFileSync(markerFd, 'utf8'); } finally { if (markerFd !== undefined) fs.closeSync(markerFd); }
        const meta = JSON.parse(content);
        if (Object.keys(meta).length === 1 && Number.isSafeInteger(meta.expiresAt) && meta.expiresAt > 0 && currentTime >= meta.expiresAt) {
          fs.unlinkSync(fp); // Expiry cleanup only for valid expired
        } else {
          activeMarkers++;
        }
      } catch {
        activeMarkers++; // Corrupt marker cannot delete and make valid replay accept; fail closed
      }
    }

    if (activeMarkers >= MAX_SEEN_FILES) {
      throw new Error('Too many active challenges (bound overflow)');
    }
  }

  function validateCandidates(candidates) {
    const ids = new Set();
    if (!Array.isArray(candidates) || !candidates.length || candidates.length > MAX_CANDIDATES) throw new Error('Kandidaten ungültig');
    for (const c of candidates) { if (typeof c.id !== 'string' || c.id.length > 100 || ids.has(c.id) || typeof c.text !== 'string' || !c.text.length || c.text.length > 200 || typeof c.type !== 'string' || c.type.length > 50) throw new Error('Kandidaten ungültig'); ids.add(c.id); }
  }

  function createChallenge({ task, userId, tenantId, payload, candidates = [] }) {
    if (candidates.length > MAX_CANDIDATES) {
      throw new Error('Zu viele unmaskierte Freitext-Kandidaten');
    }
    enforceMarkerCap();

    const expiresAt = now() + ttlMs;
    const fingerprint = computePayloadFingerprint(payload);

    const boundedCandidates = candidates.map((c, i) => ({
      id: c.id || `c_${i + 1}`,
      text: c.text || c.ausschnitt || '',
      type: c.type || c.art || 'UNKNOWN'
    }));

    validateCandidates(boundedCandidates);
    const signaturePayload = JSON.stringify([task, userId, tenantId, fingerprint, expiresAt, boundedCandidates]);
    const sig = makeHmac(signaturePayload);

    return {
      challengeId: `${sig}.${expiresAt}`,
      expiresAt,
      candidates: boundedCandidates
    };
  }

  function verifyConfirmation({ task, userId, tenantId, payload, kiConfirmation, currentCandidates = [] }) {
    if (!kiConfirmation || typeof kiConfirmation !== 'object') {
      return { valid: false, code: 'KI_CONFIRMATION_MISSING', reason: 'Bestätigungs-Payload fehlt' };
    }

    const { challengeId, choices } = kiConfirmation;
    if (!challengeId || typeof challengeId !== 'string') {
      return { valid: false, code: 'KI_CHALLENGE_INVALID', reason: 'Challenge-ID fehlt' };
    }

    if (!/^[a-f0-9]{64}\.[1-9][0-9]{0,15}$/.test(challengeId)) return { valid: false, code: 'KI_CHALLENGE_MALFORMED' };
    const parts = challengeId.split('.');
    if (parts.length !== 2) return { valid: false, code: 'KI_CHALLENGE_MALFORMED', reason: 'Challenge-ID hat ungültiges Format' };

    const [sig, expStr] = parts;
    const expiresAt = Number(expStr);
    if (!Number.isSafeInteger(expiresAt) || expiresAt > now() + ttlMs) return { valid: false, code: 'KI_CHALLENGE_MALFORMED', reason: 'Ungültige Ablaufzeit' };
    if (now() >= expiresAt) return { valid: false, code: 'KI_CHALLENGE_EXPIRED', reason: 'Challenge ist abgelaufen' };

    if (currentCandidates.length > MAX_CANDIDATES) {
      return { valid: false, code: 'KI_CHALLENGE_OVERFLOW', reason: 'Zu viele Kandidaten' };
    }

    const normalizedCurrent = currentCandidates.map((c, i) => ({
      id: c.id || `c_${i + 1}`,
      text: c.text || c.ausschnitt || '',
      type: c.type || c.art || 'UNKNOWN'
    }));

    try { validateCandidates(normalizedCurrent); } catch { return { valid: false, code: 'KI_CHOICES_INVALID' }; }
    const signaturePayload = JSON.stringify([task, userId, tenantId, computePayloadFingerprint(payload), expiresAt, normalizedCurrent]);
    const expectedSig = makeHmac(signaturePayload);

    let match = (sig.length === expectedSig.length);
    if (match) {
      let diff = 0;
      for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
      match = (diff === 0);
    }
    if (!match) return { valid: false, code: 'KI_CHALLENGE_TAMPERED', reason: 'Challenge-Signatur ungültig' };

    if (!Array.isArray(choices) || choices.length !== normalizedCurrent.length) {
      return { valid: false, code: 'KI_CHOICES_INVALID', reason: 'Entscheidungen (choices) müssen exakt alle Kandidaten abdecken' };
    }

    const choiceIds = new Set();
    for (const ch of choices) {
      if (!ch || Object.keys(ch).some(k => !['id', 'action'].includes(k)) || typeof ch.id !== 'string' || choiceIds.has(ch.id) || !normalizedCurrent.some(c => c.id === ch.id) || !['maskieren', 'kein_name'].includes(ch.action)) {
        return { valid: false, code: 'KI_CHOICES_INVALID', reason: 'Ungültige Auswahl' };
      }
      choiceIds.add(ch.id);
    }

    for (const c of normalizedCurrent) {
      if (!choiceIds.has(c.id)) return { valid: false, code: 'KI_CHOICES_INVALID', reason: 'Fehlende Entscheidung' };
    }

    try {
      enforceMarkerCap();
    } catch (e) {
      return { valid: false, code: 'KI_CHALLENGE_CAPACITY', reason: 'Zulässige Anzahl von Challenges überschritten' };
    }

    const markerPath = getMarkerPath(sig);
    const dir = getMetadataDir();
    let fd = null;
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fd = fs.openSync(markerPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      fs.writeSync(fd, JSON.stringify({ expiresAt }));
    } catch (e) {
      if (e.code === 'EEXIST') {
        return { valid: false, code: 'KI_CHALLENGE_REPLAY', reason: 'Challenge-ID wurde bereits verwendet' };
      }
      return { valid: false, code: 'KI_CHALLENGE_TAMPERED', reason: 'Interner Fehler bei Replay-Prüfung' };
    } finally {
      if (fd !== null) {
        try { fs.closeSync(fd); } catch (e) {}
      }
    }

    return { valid: true, choices };
  }

  return { createChallenge, verifyConfirmation, computePayloadFingerprint };
}
