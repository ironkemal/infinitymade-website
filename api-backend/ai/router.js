// Unified AI gateway — POST /api/ai/:task & /_config & /_health
//
// M4 Task/Router Integration:
// - Authenticated GET /_health try-safe
// - Private owner-only GET/PATCH /_config for versioned opt-in from gateway store
// - Effective state includes mode, operator ready, owner active, mailReady, clear German disabled reason
// - PATCH accepts only exact local opt-in fields (enabled, informationVersion)
// - Revocation invalidates in-memory token if supported
// - HTTP task errors return fixed safe German messages via safeAiError
// - KI_RUECKFRAGE exposes bounded local challenge/candidates only
// - Unknown task returns fixed German 404 without reflecting parameters
// - Zero raw exception echoing or prompt logging

import express from 'express';
import { requireAuth } from './auth.js';
import { logCall, hashRequest, getAiSupabaseClient } from './audit.js';
import { safeAiError } from './ki-privacy.js';
import { createAiConfig, healthSummary } from './ki-config.js';
import { CURRENT_EINWILLIGUNG_VERSION } from './ki-einwilligung.js';
import { getOwnerDecisionStore, invalidateTenantJeton } from './ki-gateway.js';

import { run as b2cDraft } from './tasks/b2c-draft.js';
import { run as b2bDraft } from './tasks/b2b-draft.js';
import { run as appointmentConfirmDraft } from './tasks/appointment-confirm-draft.js';
import { run as seriesScheduler } from './tasks/series-scheduler.js';
import { run as rezeptNormalize } from './tasks/rezept-normalize.js';
import { run as rezeptOcr } from './tasks/rezept-ocr.js';
import { run as rezeptValidate } from './tasks/rezept-validate.js';

export const TASKS = Object.freeze({
  'b2c-draft': b2cDraft,
  'b2b-draft': b2bDraft,
  'appointment-confirm-draft': appointmentConfirmDraft,
  'series-scheduler': seriesScheduler,
  'rezept-normalize': rezeptNormalize,
  'rezept-ocr': rezeptOcr,
  'rezept-validate': rezeptValidate
});

const CHALLENGE_TYPES = new Set(['NAME','UNKNOWN','ANREDE_REST','ZIFFERNFOLGE','EMAIL_REST','PLZ_REST','QUASI_REIDENTIFIKATION','FUZZY_NAME_REST']);
function validChallenge(err) {
  const now = Date.now();
  if (typeof err.challengeId !== 'string' || !/^[0-9a-f]{64}\.\d{13}$/.test(err.challengeId)) return false;
  if (!Number.isSafeInteger(err.expiresAt) || err.expiresAt <= now || err.expiresAt > now + 300000) return false;
  if (Number(err.challengeId.split('.')[1]) !== err.expiresAt) return false;
  if (!Array.isArray(err.candidates) || err.candidates.length < 1 || err.candidates.length > 5) return false;
  const ids = new Set();
  return err.candidates.every(c => c && typeof c.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(c.id) && !ids.has(c.id) && (ids.add(c.id), true) && typeof c.text === 'string' && c.text.length > 0 && c.text.length <= 200 && CHALLENGE_TYPES.has(c.type));
}

/**
 * Creates the AI router instance with dependency injection for testing.
 *
 * @param {Object} [options]
 * @param {Object} [options.store] owner decision store
 * @param {Object} [options.jetonClient] jeton client for token invalidation on revocation
 * @param {Function} [options.configProvider] returns AiConfig object
 * @param {Object} [options.tasks] task handlers map
 * @param {Function} [options.summaryProvider] returns summary metadata
 * @returns {express.Router}
 */
export function createAiRouter({
  store = getOwnerDecisionStore(),
  configProvider = () => createAiConfig(),
  tasks = TASKS,
  summaryProvider = healthSummary,
  authMiddleware = requireAuth,
  supabase = null,
  invalidateJeton = invalidateTenantJeton
} = {}) {
  const router = express.Router();

  // GET /_health: try-safe, requires auth, returns task list and whitelisted config summary
  router.get('/_health', authMiddleware, (req, res) => {
    try {
      const summary = typeof summaryProvider === 'function'
        ? summaryProvider()
        : { available: false, mode: 'aus' };
      res.json({ ok: true, tasks: Object.keys(tasks), azure: summary });
    } catch {
      res.json({
        ok: true,
        tasks: Object.keys(tasks),
        azure: { available: false, mode: 'aus', code: 'HEALTH_SUMMARY_ERROR' }
      });
    }
  });

  // GET /_healthstate: employee-safe read
  router.get('/_healthstate', authMiddleware, async (req, res) => {
    try {
      const decision = await store.read(req.auth.tenantId);
      const cfg = typeof configProvider === 'function' ? configProvider() : createAiConfig();

      const operatorReady = cfg.activationReady === true;
      const ownerActive = decision.enabled === true;
      const effectiveActive = cfg.valid === true && ['direkt','jeton'].includes(cfg.mode) && operatorReady && ownerActive;

      res.json({
        ok: true,
        active: effectiveActive,
        mode: ['aus','direkt','jeton'].includes(cfg.mode) ? cfg.mode : 'aus',
        capabilities: {
          freeText: effectiveActive && cfg.mode === 'direkt' && cfg.allowFreeText === true,
          mailDraft: effectiveActive && cfg.mailReady === true && cfg.mode === 'direkt' && cfg.allowFreeText === true,
          appointmentDraft: effectiveActive && cfg.mailReady === true
        }
      });
    } catch {
      res.json({ ok: false, active: false, mode: 'aus' });
    }
  });

  // GET /_config: private owner-only, returns effective state without calling external provider or dictionary
  router.get('/_config', authMiddleware, async (req, res) => {
    if (req.auth?.role !== 'owner' || req.auth?.userId !== req.auth?.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Nur der Praxisinhaber darf die KI-Konfiguration einsehen'
      });
    }

    try {
      const decision = await store.read(req.auth.tenantId);
      const cfg = typeof configProvider === 'function' ? configProvider() : createAiConfig();

      const operatorReady = cfg.activationReady === true;
      const mailReady = cfg.mailReady === true;
      const ownerActive = decision.enabled === true;
      const effectiveActive = cfg.valid === true && ['direkt','jeton'].includes(cfg.mode) && operatorReady && ownerActive;

      let disabledReason = null;
      if (cfg.valid !== true || !['direkt','jeton'].includes(cfg.mode)) {
        disabledReason = 'KI-Dienst ist im System deaktiviert oder ungültig konfiguriert';
      } else if (!operatorReady) {
        disabledReason = 'Betreiberfreigabe fehlt';
      } else if (!ownerActive) {
        disabledReason = 'Einwilligung des Praxisinhabers fehlt';
      }

      const capabilities = {
        freeText: effectiveActive && cfg.mode === 'direkt' && cfg.allowFreeText === true,
        mailDraft: effectiveActive && mailReady && cfg.mode === 'direkt' && cfg.allowFreeText === true,
        appointmentDraft: effectiveActive && mailReady
      };

      res.json({
        success: true,
        mode: ['aus','direkt','jeton'].includes(cfg.mode) ? cfg.mode : 'aus',
        operatorReady,
        ownerActive,
        mailReady,
        active: effectiveActive,
        capabilities,
        disabledReason,
        optIn: {
          enabled: Boolean(decision.enabled),
          informationVersion: decision.informationVersion || null,
          decidedAt: decision.decidedAt || null,
          version: decision.version || CURRENT_EINWILLIGUNG_VERSION
        }
      });
    } catch {
      res.status(500).json({
        success: false,
        error: 'Konfiguration konnte nicht geladen werden'
      });
    }
  });

  // PATCH /_config: private owner-only, exact local opt-in fields only
  router.patch('/_config', authMiddleware, async (req, res) => {
    if (req.auth?.role !== 'owner' || req.auth?.userId !== req.auth?.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Nur der Praxisinhaber darf die KI-Einwilligung ändern'
      });
    }

    const body = req.body || {};
    const allowedKeys = new Set(['enabled', 'informationVersion']);
    for (const key of Object.keys(body)) {
      if (!allowedKeys.has(key)) {
        return res.status(400).json({
          success: false,
          error: 'Unzulässiges Feld in der Konfigurationsanfrage'
        });
      }
    }

    if (typeof body.enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled muss ein boolescher Wert sein (true oder false)'
      });
    }

    try {
      const result = await store.set(req.auth, {
        enabled: body.enabled,
        informationVersion: body.informationVersion
      });

      // Revocation invalidates in-memory token if transport/jeton client supports it
      if (body.enabled === false) {
        try {
          invalidateJeton(req.auth.tenantId);
        } catch {}
      }

      res.json({
        success: true,
        optIn: {
          enabled: result.enabled,
          informationVersion: result.informationVersion,
          decidedAt: result.decidedAt,
          version: result.version
        }
      });
    } catch (err) {
      const safe = safeAiError(err);
      res.status(safe.status || 500).json({ success: false, error: safe.message });
    }
  });

  // POST /:task: dispatch to task with server-auth context
  router.post('/:task', authMiddleware, async (req, res) => {
    const { task } = req.params;
    const handler = Object.hasOwn(tasks, task) ? tasks[task] : null;
    if (!handler) {
      // Fixed German 404 with no reflected parameter
      return res.status(404).json({ success: false, error: 'Unbekannter KI-Task' });
    }

    const t0 = Date.now();
    const requestHash = hashRequest(req.body);
    let status = 'ok';
    let errorMsg = null;
    let meta = {};

    const context = {
      req,
      auth: req.auth,
      tenantId: req.auth?.tenantId,
      userId: req.auth?.userId,
      role: req.auth?.role,
      dependencies: { supabase: supabase || getAiSupabaseClient() }
    };

    try {
      const result = await handler(req.body || {}, context);
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid task result');
      meta = result._meta || {};
      delete result._meta;

      res.json({ success: true, ...result });
    } catch (err) {
      if (err.code === 'KI_RUECKFRAGE' && validChallenge(err)) {
        status = 'rueckfrage';
        errorMsg = 'KI_RUECKFRAGE';
        return res.status(409).json({
          success: false,
          code: 'KI_RUECKFRAGE',
          error: 'Rückfrage zu unmaskiertem Freitext erforderlich',
          challengeId: err.challengeId,
          expiresAt: err.expiresAt,
          candidates: Array.isArray(err.candidates) ? err.candidates.slice(0, 5).map(c => ({
            id: String(c.id || ''),
            text: String(c.text || ''),
            type: c.type
          })) : []
        });
      }

      status = 'error';
      const safe = safeAiError(err);
      errorMsg = safe.code;
      res.status(safe.status || 500).json({
        success: false,
        code: safe.code,
        error: safe.message
      });
    } finally {
      logCall({
        tenantId: req.auth?.tenantId,
        userId: req.auth?.userId,
        task,
        model: meta.model,
        deployment: meta.deployment,
        usage: meta.usage || {},
        latencyMs: meta.latency_ms ?? (Date.now() - t0),
        status,
        error: errorMsg,
        dryRun: !!meta.dry_run,
        requestHash
      }, supabase);
    }
  });

  return router;
}

const defaultAiRouter = createAiRouter();
export default defaultAiRouter;
