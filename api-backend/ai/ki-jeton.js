// KI Jeton Client — provisional token transport from Merkez (M4.11 / K4 safety).
//
// Protocol & Security Guarantees:
// - Signed POST /v1/ki/jeton via merkezFetch (praxura-v1 Ed25519 signature).
// - Token state solely in process RAM closure — zero persistent storage.
// - Strict TTL <= 3600s validation (reject TTL > 3600s, no truncation).
// - Singleflight deduplication for concurrent refresh calls, isolated caller aborts.
// - Revalidates cached target against CURRENT allowlist and dynamic config.
// - Centre failure retains existing valid token ONLY until real expiry.
// - Centre quota (402 + AI_QUOTA_EXCEEDED) locks token issuance until the centre's resetAt
//   (UNIX s), capped at 6 h if missing/invalid; the lock lifts by itself on the next request
//   (M4.11 β). 429/other errors are transient: keep a valid token, never lock (M4.11 α).
//   The quota authority is the centre — this lock only saves requests (RAM, reset on restart).
// - rejectedReportId matching the staged report drops it, so it cannot block forever (M4.11 γ).
// - Constant German error messages and codes — no TTL/region/token/raw error reflection.
// - Aggregate contract: staged cumulative UTC-day window snapshot piggybacked on /v1/ki/jeton.
//   Acknowledged only when response acknowledgedReportId matches exactly.
// - Independent per-process RAM: two PM2 workers have separate token lifecycles.

import { merkezFetch } from '../merkez-istemci/merkez-fetch.js';
import { createAiConfig, validateEndpointUrl, EU_DATA_BOUNDARY_REGIONS, RE_SAFE_SEGMENT } from './ki-config.js';
import { pruefeKiBericht } from '../merkez-istemci/ki-bericht-schema.js';

const MAX_TTL_SECONDS = 3600;
const MIN_TOKEN_LENGTH = 10;
const MAX_TOKEN_LENGTH = 4096;
const DEFAULT_REFRESH_SKEW_MS = 300_000; // 5 minutes before expiry
const MIN_REFRESH_SKEW_MS = 5_000;
const MAX_REFRESH_SKEW_MS = 600_000;
const INTERNAL_CENTRE_TIMEOUT_MS = 15_000;
const TAG_MS = 86_400_000;
/** @param {number} ms */
const utcTagStart = (ms) => Math.floor(ms / TAG_MS) * TAG_MS;

const RE_API_VERSION = /^\d{4}-\d{2}-\d{2}(-preview)?$/;
const RE_CONTROL_CHARS = /[\r\n\x00-\x1f\x7f]/;

// M4.11 β: quota lock bounds. resetAt is the centre's next Berlin month start (≤ 31 days + DST).
const QUOTA_LOCK_FALLBACK_MS = 6 * 3600_000;
const QUOTA_LOCK_MAX_MS = 32 * 86_400_000;

// Gründe aus pruefeKiBericht → feste deutsche Meldungen (keine Eingabe wird gespiegelt).
/** @type {Record<string, string>} */
const BERICHT_FEHLER = Object.freeze({
  form: 'Aggregatdaten ungültig',
  zusatzfeld: 'Aggregatdaten enthalten unzulässige Felder',
  report_id: 'reportId ungültig',
  fenster: 'Zeitfenster muss ein kanonischer UTC-Tag (00:00:00.000Z, 24 Stunden) sein',
  tasks: 'Unbekannter Task in taskTotals',
  metrik: 'Token-Metriken müssen nicht-negative Ganzzahlen sein'
});

/**
 * @typedef {Error & { code?: string, status?: number }} JetonError
 * @typedef {{
 *   token: string,
 *   exp: number,
 *   endpoint: string,
 *   deployment: string,
 *   deploymentTranscribe: string | null,
 *   endpointTranscribe: string | null,
 *   regionTranscribe: string | null,
 *   modelFamily: 'standard' | 'reasoning' | null,
 *   region: string,
 *   apiVersion: string
 * }} JetonToken
 * @typedef {{
 *   reportId: string,
 *   windowStart: string,
 *   windowEnd?: string,
 *   taskTotals?: Record<string, unknown>,
 *   [key: string]: unknown
 * }} JetonBericht
 */

/**
 * @param {string} message
 * @param {string} code
 * @param {number} [status]
 * @returns {JetonError}
 */
function makeJetonError(message, code, status) {
  /** @type {JetonError} */
  const err = new Error(message);
  err.code = code;
  if (status !== undefined) err.status = status;
  return err;
}

/**
 * Ende der Kontingentsperre (ms). resetAt = UNIX-Sekunden vom Zentrum; fehlt er, ist er
 * keine Ganzzahl, liegt er nicht in der Zukunft oder weiter als 32 Tage entfernt → now + 6 h.
 * Rein, ohne Seiteneffekte (M4.11 β).
 *
 * @param {unknown} resetAtSec
 * @param {number} nowMs
 * @returns {number}
 */
export function kilitBitisMs(resetAtSec, nowMs) {
  if (typeof resetAtSec === 'number' && Number.isSafeInteger(resetAtSec)) {
    const bis = resetAtSec * 1000;
    if (bis > nowMs && bis - nowMs <= QUOTA_LOCK_MAX_MS) return bis;
  }
  return nowMs + QUOTA_LOCK_FALLBACK_MS;
}

/**
 * Races a promise against an AbortSignal.
 * Cleans up listeners in finally block.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {AbortSignal | undefined} signal
 * @param {string} [defaultErrMsg]
 * @returns {Promise<T>}
 */
function raceSignal(promise, signal, defaultErrMsg = 'Anfrage vor Jeton-Abruf abgebrochen') {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException(defaultErrMsg, 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (!settled) {
        settled = true;
        reject(new DOMException(defaultErrMsg, 'AbortError'));
      }
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (val) => {
        if (!settled) {
          settled = true;
          signal.removeEventListener('abort', onAbort);
          resolve(val);
        }
      },
      (err) => {
        if (!settled) {
          settled = true;
          signal.removeEventListener('abort', onAbort);
          reject(err);
        }
      }
    );
  });
}

/**
 * Creates an isolated, RAM-only Jeton client.
 *
 * @param {Object} [options]
 * @param {Record<string, any>} [options.config] AI config object
 * @param {() => Record<string, any>} [options.configProvider] Supplier function for AI config
 * @param {(url: string, opts?: Record<string, unknown>) => Promise<Record<string, any>>} [options.merkezFetchImpl] Fetch implementation (defaults to merkezFetch)
 * @param {Record<string, unknown>} [options.merkezOptions] Extra options passed to merkezFetch (e.g. kimlik, baseUrl)
 * @param {() => number} [options.now] Timestamp provider in ms (defaults to Date.now)
 * @param {(closedDayMs?: number) => unknown} [options.aggregateSupplier] Supplier of audit window aggregate metrics
 * @param {number} [options.refreshSkewMs] Lead time for proactive refresh (bounded)
 * @param {number} [options.centreTimeoutMs] Timeout override for centre calls in ms
 * @param {ReadonlyArray<string>} [options.allowedHosts] Host allowlist override
 * @returns {{
 *   getToken: (opts?: {forceRefresh?: boolean, rejectedToken?: string, signal?: AbortSignal}) => Promise<JetonToken>,
 *   invalidate: (rejectedToken?: string) => void,
 *   reportUsage: (report?: Record<string, unknown>) => Promise<{ok: boolean, staged: boolean}>,
 *   getState: () => {hasToken: boolean, tokenDisabled: boolean, disabledUntil: number|null, exp: number|null, disabledReason: string|null, hasPendingReport: boolean, aggregateDiagnostic: string|null}
 * }}
 */
export function createJetonClient(options = {}) {
  const fetchMerkez = /** @type {(url: string, opts?: Record<string, unknown>) => Promise<Record<string, any>>} */ (options.merkezFetchImpl || merkezFetch);
  const nowFn = typeof options.now === 'function' ? options.now : Date.now;
  const rawSkew = Number(options.refreshSkewMs ?? DEFAULT_REFRESH_SKEW_MS);
  const refreshSkewMs = Math.max(MIN_REFRESH_SKEW_MS, Math.min(MAX_REFRESH_SKEW_MS, rawSkew));

  function getConfig() {
    if (typeof options.configProvider === 'function') {
      return options.configProvider();
    }
    return options.config || createAiConfig();
  }

  // RAM-only state closure
  /** @type {JetonToken | null} */
  let currentToken = null;
  /** @type {Promise<JetonToken> | null} */
  let singleflightPromise = null;
  /** @type {number | null} */
  let disabledUntilMs = null; // M4.11 β: quota lock end; checked on each request, no timer
  /** @type {string | null} */
  let disabledReason = null;
  /** @type {JetonBericht | null} */
  let pendingReport = null; // Staged cumulative snapshot
  /** @type {string | null} */
  let aggregateDiagnostic = null;
  // O-186: UTC-Tagesbeginn (ms) des zuletzt quittierten/abgelehnten Berichts. Nur RAM — nach einem
  // Neustart kann der Rest des Vortags fehlen (bekannter Rest, onprem O-186).
  /** @type {number | null} */
  let sonBildirterTagMs = null;
  let abschlussLaeuft = false; // der gestagte Bericht ist ein Abschlussbericht

  /** @param {string} [rejectedToken] */
  function invalidate(rejectedToken) {
    if (!rejectedToken || (currentToken && currentToken.token === rejectedToken)) {
      currentToken = null;
    }
  }

  // Lifts an expired quota lock (checked at request time — no setTimeout).
  function isLocked() {
    if (disabledUntilMs === null) return false;
    if (nowFn() >= disabledUntilMs) {
      disabledUntilMs = null;
      disabledReason = null;
      return false;
    }
    return true;
  }

  function quotaError() {
    return makeJetonError('KI-Jetonkontingent erschöpft (Zentrum)', disabledReason || 'AI_QUOTA_EXCEEDED', 503);
  }

  // Report acknowledgement / permanent rejection from the centre (M4.11 γ). Only the ID is logged.
  /** @param {unknown} json */
  function handleReportOutcome(json) {
    if (!pendingReport || !json || typeof json !== 'object') return;
    const rec = /** @type {Record<string, unknown>} */ (json);
    const quittiert = rec.acknowledgedReportId === pendingReport.reportId;
    const abgelehnt = !quittiert && rec.rejectedReportId === pendingReport.reportId;
    if (!quittiert && !abgelehnt) return;
    if (abgelehnt) console.warn(`[ki-jeton] Aggregatmeldung vom Zentrum abgelehnt und verworfen: ${pendingReport.reportId}`);
    // O-186: Nach einem Abschlussbericht (auch abgelehnt) gilt heute als Ausgangspunkt — kein zweiter Abschluss.
    const tag = abschlussLaeuft ? utcTagStart(nowFn()) : Date.parse(pendingReport.windowStart);
    if (Number.isFinite(tag)) sonBildirterTagMs = utcTagStart(tag);
    abschlussLaeuft = false;
    pendingReport = null;
  }

  /**
   * @param {unknown} payload
   * @param {ReadonlyArray<string> | undefined} allowedHosts
   * @returns {JetonToken}
   */
  function validateTokenPayload(payload, allowedHosts) {
    if (!payload || typeof payload !== 'object') {
      throw makeJetonError('KI-Jeton-Antwort ungültig', 'AI_TOKEN_RESPONSE_INVALID');
    }

    const { token, exp, endpoint, deployment, deploymentTranscribe, endpointTranscribe, regionTranscribe, modelFamily, region, apiVersion } = /** @type {Record<string, unknown>} */ (payload);

    // Token string check (reject control characters / CRLF)
    if (
      typeof token !== 'string' ||
      token.length < MIN_TOKEN_LENGTH ||
      token.length > MAX_TOKEN_LENGTH ||
      RE_CONTROL_CHARS.test(token)
    ) {
      throw makeJetonError('KI-Jeton-Antwort ungültig', 'AI_TOKEN_RESPONSE_INVALID');
    }

    // Expiry check (UNIX seconds integer)
    if (typeof exp !== 'number' || !Number.isInteger(exp)) {
      throw makeJetonError('KI-Jeton-Antwort ungültig', 'AI_TOKEN_RESPONSE_INVALID');
    }

    const currentSec = Math.floor(nowFn() / 1000);
    const ttl = exp - currentSec;

    if (ttl <= 0) {
      throw makeJetonError('KI-Jeton ist abgelaufen', 'AI_TOKEN_EXPIRED');
    }
    if (ttl > MAX_TTL_SECONDS) {
      throw makeJetonError('KI-Jeton-Gültigkeitsdauer überschritten', 'AI_TOKEN_TTL_EXCEEDED');
    }

    // Endpoint URL check
    const epVal = validateEndpointUrl(/** @type {string} */ (endpoint), /** @type {string[] | undefined} */ (allowedHosts));
    if (!epVal.ok || !epVal.cleanEndpoint) {
      throw makeJetonError('KI-Jeton-Endpunkt unzulässig', 'AI_HOST_NOT_ALLOWED');
    }

    // Deployment check
    if (typeof deployment !== 'string' || !RE_SAFE_SEGMENT.test(deployment)) {
      throw makeJetonError('KI-Jeton-Deploymentname ungültig', 'AI_DEPLOYMENT_INVALID');
    }

    if (deploymentTranscribe !== undefined && deploymentTranscribe !== null) {
      if (typeof deploymentTranscribe !== 'string' || !RE_SAFE_SEGMENT.test(deploymentTranscribe)) {
        throw makeJetonError('KI-Jeton-Deploymentname Transkription ungültig', 'AI_DEPLOYMENT_INVALID');
      }
    }

    // Region check (EU Data Boundary)
    const normalizedRegion = (typeof region === 'string' ? region : '').toLowerCase();
    if (!(/** @type {readonly string[]} */ (EU_DATA_BOUNDARY_REGIONS)).includes(normalizedRegion)) {
      throw makeJetonError('KI-Jeton-Region liegt nicht in EU Data Boundary', 'AI_INVALID_REGION');
    }

    // ApiVersion check
    if (typeof apiVersion !== 'string' || !RE_API_VERSION.test(apiVersion)) {
      throw makeJetonError('KI-Jeton-API-Version ungültig', 'AI_API_VERSION_INVALID');
    }

    // O-260: optional separate transcription resource. Same image allowlist (a compromised centre
    // cannot redirect audio elsewhere); region never inherited from the text resource.
    /** @type {string | null} */
    let cleanTranscribeEndpoint = null;
    /** @type {string | null} */
    let normalizedRegionTranscribe = null;
    if (endpointTranscribe !== undefined && endpointTranscribe !== null) {
      const tVal = validateEndpointUrl(/** @type {string} */ (endpointTranscribe), /** @type {string[] | undefined} */ (allowedHosts));
      if (!tVal.ok || !tVal.cleanEndpoint) {
        throw makeJetonError('KI-Jeton-Endpunkt Transkription unzulässig', 'AI_HOST_NOT_ALLOWED');
      }
      const rT = (typeof regionTranscribe === 'string' ? regionTranscribe : '').toLowerCase();
      if (!(/** @type {readonly string[]} */ (EU_DATA_BOUNDARY_REGIONS)).includes(rT)) {
        throw makeJetonError('KI-Jeton-Region Transkription liegt nicht in EU Data Boundary', 'AI_INVALID_REGION');
      }
      cleanTranscribeEndpoint = tVal.cleanEndpoint;
      normalizedRegionTranscribe = rT;
    }

    /** @type {'standard' | 'reasoning' | null} */
    let family = null;
    if (modelFamily !== undefined && modelFamily !== null) {
      if (modelFamily !== 'standard' && modelFamily !== 'reasoning') {
        throw makeJetonError('KI-Jeton-Modellfamilie ungültig', 'AI_MODEL_FAMILY_INVALID');
      }
      family = modelFamily;
    }

    return {
      token,
      exp,
      endpoint: epVal.cleanEndpoint,
      deployment,
      deploymentTranscribe: typeof deploymentTranscribe === 'string' ? deploymentTranscribe : null,
      endpointTranscribe: cleanTranscribeEndpoint,
      regionTranscribe: normalizedRegionTranscribe,
      modelFamily: family,
      region: normalizedRegion,
      apiVersion
    };
  }

  // Gemeinsames Schema mit dem Zentrum (merkez-istemci/ki-bericht-schema.js) — eine Quelle.
  /** @param {unknown} report @returns {JetonBericht} */
  function validateReportSnapshot(report) {
    const g = pruefeKiBericht(report);
    if (!g.ok) throw new Error((g.grund && BERICHT_FEHLER[g.grund]) || BERICHT_FEHLER.form);
    return /** @type {JetonBericht} */ (g.bericht);
  }

  /** @returns {Promise<JetonToken>} */
  async function performRefresh() {
    if (isLocked()) throw quotaError();

    const cfg = getConfig();
    const effectiveAllowedHosts = options.allowedHosts || cfg.allowedHosts;
    const centreTimeoutMs = (typeof options.centreTimeoutMs === 'number' && options.centreTimeoutMs > 0 && options.centreTimeoutMs <= 15000)
      ? options.centreTimeoutMs
      : INTERNAL_CENTRE_TIMEOUT_MS;

    const centreController = new AbortController();
    const centreTimer = setTimeout(() => {
      centreController.abort(new DOMException('Zentrum Zeitüberschreitung nach ' + centreTimeoutMs + 'ms', 'TimeoutError'));
    }, centreTimeoutMs);

    /** @type {Record<string, any> | null | undefined} */
    let res;
    try {
      if (!pendingReport && typeof options.aggregateSupplier === 'function') {
        try {
          // O-186: Ist der zuletzt gemeldete Tag vorbei, zuerst dessen Abschlussbericht (gleiche
          // reportId, Zähler wachsen → Zentrum „aktualisiert"); nur solange das Zentrum ihn annimmt (< 2 Tage).
          const jetztMs = nowFn();
          abschlussLaeuft = sonBildirterTagMs !== null && sonBildirterTagMs < utcTagStart(jetztMs)
            && jetztMs - sonBildirterTagMs < 2 * TAG_MS;
          const supplierPromise = Promise.resolve(abschlussLaeuft && sonBildirterTagMs !== null
            ? options.aggregateSupplier(sonBildirterTagMs)
            : options.aggregateSupplier());
          const report = await raceSignal(supplierPromise, AbortSignal.timeout(Math.max(1, Math.min(1000, Math.floor(centreTimeoutMs / 2)))), 'Aggregat nicht verfügbar');
          if (report && typeof report === 'object') {
            pendingReport = validateReportSnapshot(report);
            aggregateDiagnostic = 'OK';
          } else {
            abschlussLaeuft = false;
          }
        } catch (err) {
          abschlussLaeuft = false;
          aggregateDiagnostic = 'AI_AGGREGATE_UNAVAILABLE';
        }
      }

      const requestBody = {
        antragsteller: 'praxura-box',
        report: pendingReport ? { ...pendingReport } : null
      };

      const fetchPromise = fetchMerkez('/v1/ki/jeton', {
        method: 'POST',
        body: requestBody,
        signal: centreController.signal,
        ...(options.merkezOptions || {})
      });
      res = await raceSignal(fetchPromise, centreController.signal, 'Zentrum Zeitüberschreitung');
    } catch {
      // Centre network failure: retain unexpired token if valid
      const currentSec = Math.floor(nowFn() / 1000);
      if (currentToken && currentSec < currentToken.exp) {
        const epVal = validateEndpointUrl(currentToken.endpoint, effectiveAllowedHosts);
        if (epVal.ok) {
          return currentToken;
        }
      }
      throw makeJetonError('Zentrum für KI-Jeton nicht erreichbar', 'AI_JETON_UNAVAILABLE', 503);
    } finally {
      clearTimeout(centreTimer);
    }

    // Quota: only 402 + code AI_QUOTA_EXCEEDED (M4.11 α). Report outcome first, then lock (β).
    // 429, a 402 without that code and non-JSON bodies fall through to the transient path below.
    const body = res && res.json && typeof res.json === 'object' ? /** @type {Record<string, any>} */ (res.json) : null;
    if (res?.status === 402 && body?.code === 'AI_QUOTA_EXCEEDED') {
      handleReportOutcome(body);
      currentToken = null;
      disabledUntilMs = kilitBitisMs(body.resetAt, nowFn());
      disabledReason = 'AI_QUOTA_EXCEEDED';
      throw quotaError();
    }

    if (!res?.ok || !body) {
      const currentSec = Math.floor(nowFn() / 1000);
      if (currentToken && currentSec < currentToken.exp) {
        const epVal = validateEndpointUrl(currentToken.endpoint, effectiveAllowedHosts);
        if (epVal.ok) {
          return currentToken;
        }
      }
      throw makeJetonError('KI-Jeton konnte nicht ausgestellt werden', 'AI_JETON_UNAVAILABLE', 503);
    }

    // Validate payload strictly
    /** @type {JetonToken} */
    let validated;
    try {
      validated = validateTokenPayload(body, effectiveAllowedHosts);
    } catch (valErr) {
      const currentSec = Math.floor(nowFn() / 1000);
      if (currentToken && currentSec < currentToken.exp) {
        const epVal = validateEndpointUrl(currentToken.endpoint, effectiveAllowedHosts);
        if (epVal.ok) {
          return currentToken;
        }
      }
      const code = valErr && typeof valErr === 'object' && 'code' in valErr && typeof valErr.code === 'string'
        ? valErr.code
        : 'AI_TOKEN_RESPONSE_INVALID';
      throw makeJetonError('KI-Jeton-Antwort ungültig', code, 503);
    }

    // Acknowledgement / rejection of the staged report (exact match required)
    handleReportOutcome(body);

    currentToken = validated;
    return validated;
  }

  /**
   * @param {{ forceRefresh?: boolean, rejectedToken?: string, signal?: AbortSignal }} [opts]
   * @returns {Promise<JetonToken>}
   */
  async function getToken({ forceRefresh = false, rejectedToken, signal } = {}) {
    const cfg = getConfig();

    // 1. Enforce dynamic configuration readiness before cache or network
    if (cfg.mode !== 'jeton') {
      throw makeJetonError('KI-Dienst ist deaktiviert', 'AI_MODE_NOT_JETON', 503);
    }
    if (!cfg.activationReady) {
      throw makeJetonError('KI-Dienst ist nicht betriebsbereit geschaltet', 'AI_NOT_ACTIVATED', 503);
    }
    if (!cfg.valid) {
      throw makeJetonError('KI-Konfiguration ist ungültig', cfg.code || 'AI_CONFIG_INVALID', 503);
    }

    if (isLocked()) throw quotaError();

    if (signal?.aborted) {
      throw new DOMException('Anfrage vor Jeton-Abruf abgebrochen', 'AbortError');
    }

    const currentSec = Math.floor(nowFn() / 1000);
    const skewSec = Math.floor(refreshSkewMs / 1000);
    const effectiveAllowedHosts = options.allowedHosts || cfg.allowedHosts;

    // 2. Revalidate cached target against current allowlist and expiry
    if (currentToken) {
      const epVal = validateEndpointUrl(currentToken.endpoint, effectiveAllowedHosts);
      if (!epVal.ok) {
        currentToken = null; // Host removed or no longer permitted
      }
    }

    // 3. Handle 401 parallel race: if another caller already refreshed token, reuse it!
    if (forceRefresh && rejectedToken && currentToken && currentToken.token !== rejectedToken) {
      if (currentSec < currentToken.exp) {
        return currentToken;
      }
    }

    // 4. Return cached token if still valid and outside proactive skew window
    if (!forceRefresh && currentToken && currentSec < (currentToken.exp - skewSec)) {
      return currentToken;
    }

    // If forceRefresh matches rejected token, invalidate cached entry
    if (forceRefresh && rejectedToken && currentToken?.token === rejectedToken) {
      currentToken = null;
    }

    // 5. Singleflight deduplication: shared promise, but isolated per-caller abort
    if (!singleflightPromise) {
      singleflightPromise = (async () => {
        try {
          return await performRefresh();
        } finally {
          singleflightPromise = null;
        }
      })();
    }

    const token = await raceSignal(singleflightPromise, signal, 'Anfrage vor Jeton-Abruf abgebrochen');
    const cfgAfter = getConfig();
    if (cfgAfter.mode !== 'jeton' || !cfgAfter.activationReady || !cfgAfter.valid) {
      throw makeJetonError('KI-Konfiguration während Token-Erstellung ungültig geworden', 'AI_CONFIG_CHANGED', 503);
    }
    const epValAfter = validateEndpointUrl(token.endpoint, options.allowedHosts || cfgAfter.allowedHosts);
    if (!epValAfter.ok) {
      throw makeJetonError('KI-Konfiguration während Token-Erstellung ungültig geworden', 'AI_CONFIG_CHANGED', 503);
    }
    return token;
  }

  /** @param {Record<string, unknown>} [customReport] */
  async function reportUsage(customReport) {
    /** @type {unknown} */
    let report = customReport;
    if (!report && typeof options.aggregateSupplier === 'function') {
      try {
        const timeoutController = new AbortController();
        const tid = setTimeout(() => timeoutController.abort(new DOMException('Supplier Timeout', 'TimeoutError')), 1000);
        try {
          report = await raceSignal(Promise.resolve(options.aggregateSupplier()), timeoutController.signal, 'Supplier Timeout');
          aggregateDiagnostic = 'OK';
        } finally {
          clearTimeout(tid);
        }
      } catch (err) {
        aggregateDiagnostic = 'AI_AGGREGATE_UNAVAILABLE';
        return { ok: false, staged: false };
      }
    }

    if (!report || typeof report !== 'object') {
      return { ok: false, staged: false };
    }

    const validated = validateReportSnapshot(report);

    // Bounded: exactly one pending report. Reusing reportId with different payload rejected.
    if (pendingReport) {
      if (pendingReport.reportId === validated.reportId) {
        if (JSON.stringify(pendingReport) !== JSON.stringify(validated)) {
          throw new Error('Bestehende reportId darf nicht mit abweichenden Daten überschrieben werden');
        }
        return { ok: true, staged: true };
      }
      throw new Error('Bereits eine ausstehende Aggregatmeldung vorhanden');
    }

    pendingReport = validated;
    return { ok: true, staged: true };
  }

  function getState() {
    return {
      hasToken: Boolean(currentToken),
      tokenDisabled: isLocked(),
      disabledUntil: disabledUntilMs,
      exp: currentToken ? currentToken.exp : null,
      disabledReason,
      hasPendingReport: Boolean(pendingReport),
      aggregateDiagnostic
    };
  }

  return {
    getToken,
    invalidate,
    reportUsage,
    getState
  };
}
