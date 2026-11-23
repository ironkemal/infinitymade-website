// Local Owner Opt-In Store (M4.1 / K4 / Konsey 08.10.2026 Option A).
//
// Manages local owner opt-in decision per tenant without remote DB migration.
// Stored as atomic JSON files (0600) under /var/lib/praxura/ki-freigaben.
//
// Guarantees:
// - Role & identity check: only owner with userId === tenantId can set decision.
// - Bound to box identity (boxId). Foreign or missing box identity => inactive.
// - Fresh file read per request (protects against two PM2 workers, no stale mtime cache).
// - Atomic rename with random temporary file, no symlinks followed.
// - Clean metadata only: boxId, tenantId, actorId, enabled, informationVersion, decidedAt, version.
// - Zero secrets, zero tokens, zero PHI.
// - Operator readiness (AI_ACTIVATION_READY=1) remains separate gate and cannot be set via API.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { istKutu } from '../lib/dagitim.js';

/**
 * @typedef {Error & { code?: string, status?: number }} EinwilligungError
 * @typedef {{
 *   enabled: boolean,
 *   active: boolean,
 *   status?: string,
 *   informationVersion?: string,
 *   decidedAt?: string,
 *   boxId?: string,
 *   tenantId?: string,
 *   actorId?: string,
 *   version?: string,
 *   reason?: string
 * }} OwnerDecisionReadResult
 * @typedef {{
 *   ok: boolean,
 *   enabled: boolean,
 *   informationVersion: string,
 *   decidedAt: string,
 *   boxId: string,
 *   tenantId: string,
 *   actorId: string,
 *   version: string
 * }} OwnerDecisionWriteResult
 * @typedef {{
 *   read: (tenantId: string) => Promise<OwnerDecisionReadResult>,
 *   set: (auth: { role: string, userId: string, tenantId: string }, options?: { enabled?: boolean, informationVersion?: string }) => Promise<OwnerDecisionWriteResult>,
 *   directory?: string
 * }} OwnerDecisionStore
 */

/**
 * @param {string} message
 * @param {string} code
 * @param {number} status
 * @returns {EinwilligungError}
 */
function createEinwilligungError(message, code, status) {
  /** @type {EinwilligungError} */
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

export const CURRENT_EINWILLIGUNG_VERSION = '2026-10-30-v1';
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getDefaultDirectory() {
  return process.env.KI_EINWILLIGUNG_DIR || '/var/lib/praxura/ki-freigaben';
}

// SaaS-VPS hat keine Box-Kimlik: dort gilt eine feste Kennung, sonst liesse sich die
// Inhaber-Freigabe im SaaS nie speichern (31.10.2026). Box = SUPABASE_PUBLIC_URL (lib/dagitim.js).
export const SAAS_BOX_ID = 'saas';

/** @returns {Promise<string | null>} */
async function defaultBoxIdProvider() {
  if (!istKutu()) return SAAS_BOX_ID;
  try {
    const { ladeKimlik } = await import('../merkez-istemci/kimlik.js');
    const k = ladeKimlik();
    return k?.boxId || null;
  } catch (e) {
    return null;
  }
}

/**
 * Creates the local owner decision store.
 *
 * @param {{
 *   directory?: string,
 *   boxIdProvider?: () => (string | null | Promise<string | null>),
 *   now?: () => number
 * }} [options={}]
 * @returns {OwnerDecisionStore & { directory: string }}
 */
export function createOwnerDecisionStore({
  directory,
  boxIdProvider = defaultBoxIdProvider,
  now = Date.now
} = {}) {
  const targetDir = directory || getDefaultDirectory();

  async function resolveBoxId() {
    if (typeof boxIdProvider === 'function') {
      return await boxIdProvider();
    }
    return null;
  }

  /** @param {string} tenantId @returns {string | null} */
  function getFilePath(tenantId) {
    if (!tenantId || typeof tenantId !== 'string' || !RE_UUID.test(tenantId)) {
      return null;
    }
    return path.join(targetDir, `${tenantId.toLowerCase()}.json`);
  }

  /**
   * Reads decision for tenantId fresh from disk.
   *
   * @param {string} tenantId
   */
  async function read(tenantId) {


    const currentBoxId = await resolveBoxId();
    if (!currentBoxId) {
      return {
        enabled: false,
        active: false,
        reason: 'BOX_IDENTITY_MISSING'
      };
    }

    const filePath = getFilePath(tenantId);
    if (!filePath) {
      return {
        enabled: false,
        active: false,
        reason: 'INVALID_TENANT_ID'
      };
    }

    try {
      if (!fs.existsSync(filePath)) {
        return {
          enabled: false,
          active: false,
          status: 'not_set'
        };
      }

      const stat = fs.lstatSync(filePath);
      // Check file type and mode
      if (!stat.isFile()) return { enabled: false, active: false, reason: 'NOT_REGULAR_FILE' };
      if ((stat.mode & 0o777) !== 0o600) return { enabled: false, active: false, reason: 'INVALID_PERMISSIONS' };

      const parentStat = fs.lstatSync(targetDir);
      if (parentStat.isSymbolicLink() || (parentStat.mode & 0o777) !== 0o700) {
        return { enabled: false, active: false, reason: 'INVALID_PARENT_DIR' };
      }

      // Fresh read
      if (stat.size > 2048) return { enabled: false, active: false, reason: 'RECORD_TOO_LARGE' };
      let fd;
      let raw;
      try { fd = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); const opened = fs.fstatSync(fd); if (!opened.isFile() || opened.size > 2048 || (opened.mode & 0o777) !== 0o600) throw new Error('Invalid record'); raw = fs.readFileSync(fd, 'utf8'); } finally { if (fd !== undefined) fs.closeSync(fd); }
      const data = JSON.parse(raw);

      const allowedKeys = new Set(['boxId', 'tenantId', 'actorId', 'enabled', 'informationVersion', 'decidedAt', 'version']);
      for (const k of Object.keys(data)) {
        if (!allowedKeys.has(k)) return { enabled: false, active: false, reason: 'UNKNOWN_KEY' };
      }

      const timestamp = Date.parse(data.decidedAt);
      if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== data.decidedAt || timestamp > now()) return { enabled: false, active: false, reason: 'INVALID_DECISION_TIME' };
      if (!RE_UUID.test(data.actorId) || !RE_UUID.test(data.tenantId)) return { enabled: false, active: false, reason: 'INVALID_ACTOR' };
      if (typeof data.enabled !== 'boolean') return { enabled: false, active: false, reason: 'CORRUPT_ENABLED_FIELD' };
      if (data.version !== CURRENT_EINWILLIGUNG_VERSION) return { enabled: false, active: false, reason: 'INVALID_VERSION' };
      if (data.informationVersion !== CURRENT_EINWILLIGUNG_VERSION) return { enabled: false, active: false, reason: 'INVALID_INFO_VERSION' };
      if (data.boxId !== currentBoxId) return { enabled: false, active: false, reason: 'FOREIGN_BOX_ID' };
      if (data.tenantId?.toLowerCase() !== tenantId.toLowerCase()) return { enabled: false, active: false, reason: 'TENANT_MISMATCH' };
      if (data.actorId?.toLowerCase() !== tenantId.toLowerCase()) return { enabled: false, active: false, reason: 'ACTOR_MISMATCH' };

      return {
        enabled: data.enabled,
        active: data.enabled,
        informationVersion: data.informationVersion,
        decidedAt: data.decidedAt,
        boxId: data.boxId,
        tenantId: data.tenantId,
        actorId: data.actorId,
        version: data.version
      };
    } catch (e) {
      // Fail closed on any disk or parse error
      return {
        enabled: false,
        active: false,
        reason: 'READ_ERROR'
      };
    }
  }

  /**
   * Sets decision for tenant. Must be called by owner (userId === tenantId).
   *
   * @param {{ role: string, userId: string, tenantId: string }} auth
   * @param {{ enabled?: boolean, informationVersion?: string }} [options={}]
   */
  async function set(auth, { enabled, informationVersion } = {}) {
    if (!auth || typeof auth !== 'object') {
      throw createEinwilligungError('Auth-Kontext fehlt', 'KI_AUTH_REQUIRED', 401);
    }

    if (auth.role !== 'owner' || auth.userId !== auth.tenantId) {
      throw createEinwilligungError('Nur der Praxisinhaber darf die KI-Freischaltung verwalten', 'KI_OWNER_REQUIRED', 403);
    }

    if (typeof enabled !== 'boolean') {
      throw createEinwilligungError('enabled muss ein boolescher Wert sein (true oder false)', 'KI_EINWILLIGUNG_INVALID', 400);
    }

    const currentBoxId = await resolveBoxId();
    if (!currentBoxId) {
      throw createEinwilligungError('Box-Identität ist nicht konfiguriert oder fehlt', 'BOX_IDENTITY_MISSING', 503);
    }

    const filePath = getFilePath(auth.tenantId);
    if (!filePath) {
      throw createEinwilligungError('Ungültige Mandanten-ID (UUID erforderlich)', 'KI_INVALID_TENANT_ID', 400);
    }

    if (informationVersion !== undefined && informationVersion !== CURRENT_EINWILLIGUNG_VERSION) {
      throw createEinwilligungError('Informationsversion ungültig', 'KI_EINWILLIGUNG_INVALID', 400);
    }

    // Ensure target directory exists with 0700 permissions
    fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
    const parent = fs.lstatSync(targetDir);
    if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o777) !== 0o700) throw new Error('Unsicheres Freigabeverzeichnis');
    if (fs.existsSync(filePath) || (() => { try { return fs.lstatSync(filePath).isSymbolicLink(); } catch { return false; } })()) { const existing = fs.lstatSync(filePath); if (!existing.isFile() || existing.isSymbolicLink() || (existing.mode & 0o777) !== 0o600) throw new Error('Unsichere Freigabedatei'); }

    const record = {
      boxId: currentBoxId,
      tenantId: auth.tenantId,
      actorId: auth.userId,
      enabled,
      informationVersion: String(informationVersion || CURRENT_EINWILLIGUNG_VERSION),
      decidedAt: new Date(now()).toISOString(),
      version: CURRENT_EINWILLIGUNG_VERSION
    };

    // Atomic write via random temp file (mode 0600)
    const tmpFile = path.join(targetDir, `.${auth.tenantId}.${crypto.randomBytes(6).toString('hex')}.tmp`);
    let fd;
    try {
      fd = fs.openSync(tmpFile, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      fs.writeSync(fd, JSON.stringify(record, null, 2));
      fs.closeSync(fd); fd = undefined;
      fs.renameSync(tmpFile, filePath);
      fs.chmodSync(filePath, 0o600);
    } catch (e) {
      try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (e) {}
      throw e;
    } finally { if (fd !== undefined) fs.closeSync(fd); }

    return {
      ok: true,
      enabled: record.enabled,
      informationVersion: record.informationVersion,
      decidedAt: record.decidedAt,
      boxId: record.boxId,
      tenantId: record.tenantId,
      actorId: record.actorId,
      version: record.version
    };
  }

  return {
    read,
    set,
    directory: targetDir
  };
}

/**
 * Creates an in-memory decision store for testing.
 *
 * @param {{
 *   defaultEnabled?: boolean,
 *   boxId?: string,
 *   now?: () => number
 * }} [options={}]
 * @returns {OwnerDecisionStore}
 */
export function createFakeOwnerDecisionStore({
  defaultEnabled = false,
  boxId = 'test-box-id',
  now = Date.now
} = {}) {
  /** @type {Map<string, { boxId: string, tenantId: string, actorId: string, enabled: boolean, informationVersion: string, decidedAt: string, version: string }>} */
  const store = new Map();

  return {
    /** @param {string} tenantId */
    async read(tenantId) {
      if (!tenantId || !RE_UUID.test(tenantId)) {
        return { enabled: false, active: false, reason: 'INVALID_TENANT_ID' };
      }
      if (!boxId) {
        return { enabled: false, active: false, reason: 'BOX_IDENTITY_MISSING' };
      }
      const existing = store.get(tenantId.toLowerCase());
      if (!existing) {
        return {
          enabled: defaultEnabled,
          active: defaultEnabled,
          status: 'default'
        };
      }
      return { ...existing, active: existing.enabled };
    },

    /**
     * @param {{ role: string, userId: string, tenantId: string }} auth
     * @param {{ enabled?: boolean, informationVersion?: string }} [options={}]
     */
    async set(auth, { enabled, informationVersion } = {}) {
      if (!auth || auth.role !== 'owner' || auth.userId !== auth.tenantId) {
        throw createEinwilligungError('Nur der Praxisinhaber darf die KI-Freischaltung verwalten', 'KI_OWNER_REQUIRED', 403);
      }
      if (typeof enabled !== 'boolean') {
        throw createEinwilligungError('enabled muss boolesch sein', 'KI_EINWILLIGUNG_INVALID', 400);
      }
      if (!boxId) {
        throw createEinwilligungError('Box-Identität fehlt', 'BOX_IDENTITY_MISSING', 503);
      }

      const record = {
        boxId,
        tenantId: auth.tenantId,
        actorId: auth.userId,
        enabled,
        informationVersion: String(informationVersion || CURRENT_EINWILLIGUNG_VERSION),
        decidedAt: new Date(now()).toISOString(),
        version: CURRENT_EINWILLIGUNG_VERSION
      };
      store.set(auth.tenantId.toLowerCase(), record);
      return { ok: true, ...record };
    }
  };
}

/**
 * Returns safe opt-in metadata for frontend GET endpoint.
 *
 * @param {OwnerDecisionStore} store owner decision store
 * @param {string} tenantId
 * @param {{ activationReady?: boolean, valid?: boolean, mode?: string } | null} config AI config object
 */
export async function getBrowserOptInStatus(store, tenantId, config) {
  const decision = await store.read(tenantId);
  const operatorLawReady = config?.activationReady === true;
  const isConfigValid = config?.valid === true;
  const hasValidMode = config?.mode === 'direkt' || config?.mode === 'jeton';

  return {
    enabled: decision.enabled === true,
    active: Boolean(decision.enabled && operatorLawReady && isConfigValid && hasValidMode),
    informationVersion: decision.informationVersion || null,
    decidedAt: decision.decidedAt || null
  };
}
