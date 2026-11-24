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
import rateLimit from 'express-rate-limit';
import { requireAuth } from './auth.js';
import { logCall, hashRequest, getAiSupabaseClient } from './audit.js';
import { safeAiError } from './ki-privacy.js';
import { createAiConfig, healthSummary, EU_DATA_BOUNDARY_REGIONS, VERIFIED_AZURE_HOSTS } from './ki-config.js';
import { chat as azureChat } from './azureClient.js';
import { CURRENT_EINWILLIGUNG_VERSION } from './ki-einwilligung.js';
import { getOwnerDecisionStore, invalidateTenantJeton } from './ki-gateway.js';
import { getAufgabenSperreStore, aufgabenListe } from './ki-aufgaben-sperre.js';


import { run as b2cDraft } from './tasks/b2c-draft.js';
import { run as b2bDraft } from './tasks/b2b-draft.js';
import { run as appointmentConfirmDraft } from './tasks/appointment-confirm-draft.js';
import { run as seriesScheduler } from './tasks/series-scheduler.js';
import { run as rezeptNormalize } from './tasks/rezept-normalize.js';
import { run as rezeptOcr } from './tasks/rezept-ocr.js';
import { run as rezeptValidate } from './tasks/rezept-validate.js';
import { run as transkribieren } from './tasks/transkribieren.js';

/**
 * Anbieter/Region für die Einstellungen (nur lesend). Bewusst ohne Endpunkt-Host oder Deployment-Namen.
 * @param {any} cfg
 * @returns {{ name: string, region: string|null, euRegion: boolean } | null}
 */
export function anbieterAnzeige(cfg) {
  if (!cfg || !['direkt', 'jeton'].includes(cfg.mode)) return null;
  /** @type {Record<string, string>} */
  const NAMEN = { azure: 'Microsoft Azure OpenAI' };
  const region = typeof cfg.region === 'string' && /^[a-z0-9-]{2,40}$/.test(cfg.region) ? cfg.region : null;
  // Eigener Azure-Zugang der Praxis (Konsey 24.11.2026, Option D): Host nicht in der festen Praxura-Liste.
  let eigener = false;
  try { eigener = cfg.mode === 'direkt' && !!cfg.endpoint && !VERIFIED_AZURE_HOSTS.includes(new URL(String(cfg.endpoint)).hostname.toLowerCase()); } catch { eigener = false; }
  const name = eigener ? 'Eigener Azure-Zugang (Admin-Konfiguration)' : (NAMEN[String(cfg.provider || 'azure')] || 'Unbekannter Anbieter');
  return { name, region, euRegion: !!region && EU_DATA_BOUNDARY_REGIONS.includes(region), ...(eigener ? { eigener: true } : {}) };
}

export const TASKS = Object.freeze({
  'b2c-draft': b2cDraft,
  'b2b-draft': b2bDraft,
  'appointment-confirm-draft': appointmentConfirmDraft,
  'series-scheduler': seriesScheduler,
  'rezept-normalize': rezeptNormalize,
  'rezept-ocr': rezeptOcr,
  'rezept-validate': rezeptValidate,
  'transkribieren': transkribieren
});

const CHALLENGE_TYPES = new Set(['NAME','UNKNOWN','ANREDE_REST','ZIFFERNFOLGE','EMAIL_REST','PLZ_REST','QUASI_REIDENTIFIKATION','FUZZY_NAME_REST']);
/**
 * @param {unknown} err
 * @returns {boolean}
 */
function validChallenge(err) {
  if (!err || typeof err !== 'object') return false;
  const e = /** @type {{ challengeId?: unknown, expiresAt?: unknown, candidates?: unknown }} */ (err);
  const now = Date.now();
  if (typeof e.challengeId !== 'string' || !/^[0-9a-f]{64}\.\d{13}$/.test(e.challengeId)) return false;
  if (typeof e.expiresAt !== 'number' || !Number.isSafeInteger(e.expiresAt) || e.expiresAt <= now || e.expiresAt > now + 300000) return false;
  if (Number(e.challengeId.split('.')[1]) !== e.expiresAt) return false;
  if (!Array.isArray(e.candidates) || e.candidates.length < 1 || e.candidates.length > 5) return false;
  const ids = new Set();
  return e.candidates.every((/** @type {unknown} */ c) => {
    if (!c || typeof c !== 'object') return false;
    const cand = /** @type {{ id?: unknown, text?: unknown, type?: unknown }} */ (c);
    return typeof cand.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(cand.id) && !ids.has(cand.id) && (ids.add(cand.id), true) && typeof cand.text === 'string' && cand.text.length > 0 && cand.text.length <= 200 && typeof cand.type === 'string' && CHALLENGE_TYPES.has(cand.type);
  });
}

/**
 * @typedef {import('./ki-einwilligung.js').OwnerDecisionStore} RouterOwnerDecisionStore
 * @typedef {(payload: any, context?: any) => Promise<Record<string, any>>} RouterTaskHandler
 */

/**
 * Creates the AI router instance with dependency injection for testing.
 *
 * @param {Object} [options]
 * @param {RouterOwnerDecisionStore} [options.store] owner decision store
 * @param {Record<string, unknown>} [options.jetonClient] jeton client for token invalidation on revocation
 * @param {() => Record<string, any>} [options.configProvider] returns AiConfig object
 * @param {Record<string, RouterTaskHandler>} [options.tasks] task handlers map
 * @param {() => Record<string, unknown>} [options.summaryProvider] returns summary metadata
 * @param {import('express').RequestHandler} [options.authMiddleware] auth middleware
 * @param {import('@supabase/supabase-js').SupabaseClient | null} [options.supabase] supabase client
 * @param {(tenantId: string) => void} [options.invalidateJeton] jeton invalidator
 * @param {import('express').RequestHandler | null} [options.rateLimiter] optional rate limiter
 * @param {ReturnType<typeof import('./ki-aufgaben-sperre.js').createAufgabenSperreStore>} [options.aufgabenStore] KI-Aufgaben-Sperre (Phase 7b)
 * @param {import('express').RequestHandler | null} [options.einstellungLimiter] Limit für PATCH /_config und /_aufgaben
 * @param {(opts: Record<string, unknown>) => Promise<unknown>} [options.pingTransport] Transport für POST /_verbindungstest (Tests)
 * @returns {ReturnType<typeof express.Router>}
 */
export function createAiRouter({
  store = getOwnerDecisionStore(),
  configProvider = () => createAiConfig(),
  tasks = TASKS,
  summaryProvider = healthSummary,
  authMiddleware = /** @type {import('express').RequestHandler} */ (/** @type {unknown} */ (requireAuth)),
  supabase = null,
  invalidateJeton = invalidateTenantJeton,
  rateLimiter = null,
  aufgabenStore = getAufgabenSperreStore(),
  einstellungLimiter = null,
  pingTransport = azureChat
} = {}) {
  const router = express.Router();
  // Gemeinsames Limit für die Einstellungs-Routen PATCH /_config und /_aufgaben (guvenlik 23.11.2026: /_config hatte keins)
  const einstLimiter = einstellungLimiter || rateLimit({
    windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { success: false, code: 'AI_RATE_LIMIT_EXCEEDED', error: 'Zu viele Änderungen. Bitte warten Sie eine Minute.' }
  });
  const rawAudioParser = express.raw({
    type: ['audio/webm', 'audio/ogg', 'audio/mp4'],
    limit: '10mb'
  });

  // GET /_health: try-safe, requires auth, returns task list and whitelisted config summary
  router.get('/_health', authMiddleware, (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
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
  router.get('/_healthstate', authMiddleware, async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
    try {
      const decision = await store.read(/** @type {string} */ (req.auth?.tenantId));
      const cfg = typeof configProvider === 'function' ? configProvider() : createAiConfig();

      const operatorReady = cfg.activationReady === true;
      const ownerActive = decision.enabled === true;
      const effectiveActive = cfg.valid === true && ['direkt','jeton'].includes(cfg.mode) && operatorReady && ownerActive;
      const transcribeConfigured = cfg.mode === 'direkt' ? Boolean(cfg.transcribeDeployment) : true;
      const diktatVerfuegbar = effectiveActive && cfg.mailReady === true && transcribeConfigured;

      res.json({
        ok: true,
        active: effectiveActive,
        mode: ['aus','direkt','jeton'].includes(cfg.mode) ? cfg.mode : 'aus',
        diktat_verfuegbar: diktatVerfuegbar,
        capabilities: {
          freeText: effectiveActive && cfg.allowFreeText === true,
          mailDraft: effectiveActive && cfg.mailReady === true && cfg.allowFreeText === true,
          appointmentDraft: effectiveActive && cfg.mailReady === true
        }
      });
    } catch {
      res.json({ ok: false, active: false, mode: 'aus' });
    }
  });

  // GET /_config: private owner-only, returns effective state without calling external provider or dictionary
  router.get('/_config', authMiddleware, async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
    if (req.auth?.role !== 'owner' || req.auth?.userId !== req.auth?.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Nur der Praxisinhaber darf die KI-Konfiguration einsehen'
      });
    }

    try {
      const decision = await store.read(/** @type {string} */ (req.auth.tenantId));
      const cfg = typeof configProvider === 'function' ? configProvider() : createAiConfig();

      const operatorReady = cfg.activationReady === true;
      const mailReady = cfg.mailReady === true;
      const ownerActive = decision.enabled === true;
      const effectiveActive = cfg.valid === true && ['direkt','jeton'].includes(cfg.mode) && operatorReady && ownerActive;
      const transcribeConfigured = cfg.mode === 'direkt' ? Boolean(cfg.transcribeDeployment) : true;
      const diktatVerfuegbar = effectiveActive && mailReady && transcribeConfigured;

      let disabledReason = null;
      if (cfg.valid !== true || !['direkt','jeton'].includes(cfg.mode)) {
        disabledReason = 'KI-Dienst ist im System deaktiviert oder ungültig konfiguriert';
      } else if (!operatorReady) {
        disabledReason = 'Betreiberfreigabe fehlt';
      } else if (!ownerActive) {
        disabledReason = 'Freischaltung durch den Praxisinhaber fehlt';
      }

      const capabilities = {
        freeText: effectiveActive && cfg.allowFreeText === true,
        mailDraft: effectiveActive && mailReady && cfg.allowFreeText === true,
        appointmentDraft: effectiveActive && mailReady
      };

      res.json({
        success: true,
        mode: ['aus','direkt','jeton'].includes(cfg.mode) ? cfg.mode : 'aus',
        operatorReady,
        ownerActive,
        mailReady,
        active: effectiveActive,
        diktat_verfuegbar: diktatVerfuegbar,
        capabilities,
        disabledReason,
        // Phase 7b KI-Stufe 1: nur lesende Anzeige von Anbieter + Region (kein Host, kein Schlüssel; guvenlik/legal-de 23.11.2026)
        anbieter: anbieterAnzeige(cfg),
        // Aufgaben einzeln an/aus (ki-aufgaben-sperre.js): Sperre frisch gelesen, kaputt = alles gesperrt
        aufgaben: aufgabenListe(await aufgabenStore.read(/** @type {string} */ (req.auth.tenantId))),
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
  router.patch('/_config', authMiddleware, einstLimiter, async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
    if (req.auth?.role !== 'owner' || req.auth?.userId !== req.auth?.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Nur der Praxisinhaber darf die KI-Freischaltung ändern'
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
      const result = await store.set(/** @type {Parameters<RouterOwnerDecisionStore['set']>[0]} */ (/** @type {unknown} */ (req.auth)), {
        enabled: body.enabled,
        informationVersion: body.informationVersion
      });

      // Revocation invalidates in-memory token if transport/jeton client supports it
      if (body.enabled === false && req.auth?.tenantId) {
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

  // PATCH /_aufgaben: Inhaber schaltet KI-Aufgaben ein/aus — Body exakt { gesperrt: string[] } (feste Gruppen).
  // Kein logCall (verfälscht Nutzungszahlen, guvenlik); Datei hält actorId + geaendertAm.
  router.patch('/_aufgaben', authMiddleware, einstLimiter, async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
    if (req.auth?.role !== 'owner' || req.auth?.userId !== req.auth?.tenantId) {
      return res.status(403).json({ success: false, error: 'Nur der Praxisinhaber darf KI-Aufgaben ein- oder ausschalten' });
    }
    const body = req.body || {};
    if (Object.keys(body).some((k) => k !== 'gesperrt') || !Array.isArray(body.gesperrt)) {
      return res.status(400).json({ success: false, error: 'Erwartet wird genau { gesperrt: [...] }' });
    }
    try {
      const ergebnis = await aufgabenStore.set(/** @type {any} */ (req.auth), { gesperrt: body.gesperrt });
      return res.json({ success: true, gesperrt: ergebnis.gesperrt, geaendertAm: ergebnis.geaendertAm, aufgaben: aufgabenListe({ alleGesperrt: false, gesperrt: ergebnis.gesperrt }) });
    } catch (err) {
      const e = /** @type {any} */ (err);
      if (e?.status === 400 || e?.status === 403) return res.status(e.status).json({ success: false, error: e.message });
      console.error('[ki-aufgaben] Speichern fehlgeschlagen', e?.code || 'unbekannt');
      return res.status(500).json({ success: false, error: 'KI-Aufgaben konnten nicht gespeichert werden' });
    }
  });

  // POST /_verbindungstest (Konsey 24.11.2026, Option D): prüft den eingestellten Zugang im Modus direkt mit einer
  // festen synthetischen Mini-Nachricht — nie Praxisdaten, nie Antworttext/Fehlertext des Anbieters zurück (kein
  // SSRF-Orakel), eigenes enges Limit, kein logCall (keine Nutzung). Neuer Außenruf-Auslöser: onprem/REGISTER.md.
  const testLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { success: false, code: 'AI_RATE_LIMIT_EXCEEDED', error: 'Zu viele Verbindungstests. Bitte warten Sie eine Minute.' } });
  router.post('/_verbindungstest', authMiddleware, testLimiter, async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
    if (req.auth?.role !== 'owner' || req.auth?.userId !== req.auth?.tenantId) {
      return res.status(403).json({ success: false, error: 'Nur der Praxisinhaber darf die Verbindung testen' });
    }
    let cfg;
    try { cfg = configProvider(); } catch { return res.json({ success: true, ok: false, code: 'AI_CONFIG_FEHLER' }); }
    if (!cfg || cfg.mode !== 'direkt') return res.json({ success: true, ok: false, code: cfg?.mode === 'aus' ? 'AI_MODE_AUS' : 'NUR_DIREKT' });
    if (cfg.valid !== true) return res.json({ success: true, ok: false, code: typeof cfg.code === 'string' && /^[A-Z][A-Z0-9_]{2,60}$/.test(cfg.code) ? cfg.code : 'AI_CONFIG_UNGUELTIG' });
    try {
      await pingTransport({ messages: [{ role: 'system', content: 'Antworte nur mit OK.' }, { role: 'user', content: 'OK?' }], maxTokens: 5, temperature: 0, config: cfg, timeoutMs: 15000 });
      return res.json({ success: true, ok: true });
    } catch (err) {
      const code = /** @type {any} */ (err)?.code;
      return res.json({ success: true, ok: false, code: typeof code === 'string' && /^[A-Z][A-Z0-9_]{2,60}$/.test(code) ? code : 'AI_VERBINDUNG_FEHLGESCHLAGEN' });
    }
  });

  const defaultLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, code: 'AI_RATE_LIMIT_EXCEEDED', error: 'Zu viele Anfragen. Bitte warten Sie eine Minute.' }
  });
  const transcribeLimiter = rateLimiter || defaultLimiter;

  // POST /transkribieren: audio speech-to-text with raw body parser
  router.post('/transkribieren', authMiddleware, transcribeLimiter, (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res, /** @type {import('express').NextFunction} */ next) => {
    rawAudioParser(req, res, (/** @type {unknown} */ err) => {
      if (err) {
        const parseErr = /** @type {{ type?: string, status?: number }} */ (err);
        if (parseErr.type === 'entity.too.large' || parseErr.status === 413) {
          return res.status(413).json({ success: false, code: 'AI_PAYLOAD_TOO_LARGE', error: 'Datenmenge zu groß' });
        }
        return res.status(400).json({ success: false, code: 'KI_SCHEMA', error: 'Ungültiges Audioformat' });
      }
      next();
    });
  }, async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
    const t0 = Date.now();
    let status = 'ok';
    let errorMsg = null;
    /** @type {{ model?: string | null, deployment?: string | null, usage?: Record<string, unknown>, dry_run?: boolean, latency_ms?: number }} */
    let meta = {};

    const context = {
      req,
      auth: req.auth,
      tenantId: req.auth?.tenantId,
      userId: req.auth?.userId,
      role: req.auth?.role,
      dependencies: { supabase: supabase || getAiSupabaseClient(), configProvider }
    };

    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({
          success: false,
          code: 'KI_SCHEMA',
          error: 'Ungültiges Audioformat. Erlaubt: audio/webm, audio/ogg, audio/mp4'
        });
      }

      if (req.body.length > 10 * 1024 * 1024) {
        return res.status(413).json({
          success: false,
          code: 'AI_PAYLOAD_TOO_LARGE',
          error: 'Audiodatei überschreitet das Limit von 10 MB'
        });
      }

      const duration = Number(req.headers['x-audio-duration'] || req.query?.duration);
      if (Number.isFinite(duration) && duration > 180) {
        return res.status(413).json({
          success: false,
          code: 'AI_PAYLOAD_TOO_LARGE',
          error: 'Audiodauer überschreitet das Limit von 3 Minuten'
        });
      }

      const handler = Object.hasOwn(tasks, 'transkribieren') ? tasks['transkribieren'] : transkribieren;
      const rawContentType = req.headers['content-type'];
      const result = await handler({
        audioBuffer: req.body,
        mimeType: Array.isArray(rawContentType) ? rawContentType[0] : rawContentType,
        duration
      }, context);

      if (!result || typeof result !== 'object') throw new Error('Invalid task result');
      meta = result._meta || {};
      delete result._meta;

      res.json({ success: true, text: result.text || '' });
    } catch (err) {
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
        task: 'transkribieren',
        model: meta.model,
        deployment: meta.deployment,
        usage: meta.usage || {},
        latencyMs: meta.latency_ms ?? (Date.now() - t0),
        status,
        error: errorMsg,
        dryRun: !!meta.dry_run,
        requestHash: null
      }, supabase);
    }
  });

  // POST /:task: dispatch to task with server-auth context
  router.post('/:task', authMiddleware, async (/** @type {import('express').Request} */ req, /** @type {import('express').Response} */ res) => {
    const task = String(req.params.task);
    const handler = Object.hasOwn(tasks, task) ? tasks[task] : null;
    if (!handler) {
      // Fixed German 404 with no reflected parameter
      return res.status(404).json({ success: false, error: 'Unbekannter KI-Task' });
    }

    const t0 = Date.now();
    const requestHash = hashRequest(req.body);
    let status = 'ok';
    let errorMsg = null;
    /** @type {{ model?: string | null, deployment?: string | null, usage?: Record<string, unknown>, dry_run?: boolean, latency_ms?: number }} */
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
      const errObj = /** @type {{ code?: string, challengeId?: unknown, expiresAt?: unknown, candidates?: Array<{ id?: unknown, text?: unknown, type?: unknown }> }} */ (
        err && typeof err === 'object' ? err : {}
      );
      if (errObj.code === 'KI_RUECKFRAGE' && validChallenge(err)) {
        status = 'rueckfrage';
        errorMsg = 'KI_RUECKFRAGE';
        return res.status(409).json({
          success: false,
          code: 'KI_RUECKFRAGE',
          error: 'Rückfrage zu unmaskiertem Freitext erforderlich',
          challengeId: errObj.challengeId,
          expiresAt: errObj.expiresAt,
          candidates: Array.isArray(errObj.candidates) ? errObj.candidates.slice(0, 5).map(c => ({
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
