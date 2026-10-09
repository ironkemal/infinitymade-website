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
import { createAiConfig, validateEndpointUrl, EU_DATA_BOUNDARY_REGIONS } from './ki-config.js';
import { pruefeKiBericht } from '../merkez-istemci/ki-bericht-schema.js';

const MAX_TTL_SECONDS = 3600;
const MIN_TOKEN_LENGTH = 10;
const MAX_TOKEN_LENGTH = 4096;
const DEFAULT_REFRESH_SKEW_MS = 300_000; // 5 minutes before expiry
const MIN_REFRESH_SKEW_MS = 5_000;
const MAX_REFRESH_SKEW_MS = 600_000;
const INTERNAL_CENTRE_TIMEOUT_MS = 15_000;

const RE_SAFE_SEGMENT = /^[a-zA-Z0-9_-]{1,64}$/;
const RE_API_VERSION = /^\d{4}-\d{2}-\d{2}(-preview)?$/;
const RE_CONTROL_CHARS = /[\r\n\x00-\x1f\x7f]/;

// M4.11 β: quota lock bounds. resetAt is the centre's next Berlin month start (≤ 31 days + DST).
const QUOTA_LOCK_FALLBACK_MS = 6 * 3600_000;
const QUOTA_LOCK_MAX_MS = 32 * 86_400_000;

// Gründe aus pruefeKiBericht → feste deutsche Meldungen (keine Eingabe wird gespiegelt).
const BERICHT_FEHLER = Object.freeze({
  form: 'Aggregatdaten ungültig',
  zusatzfeld: 'Aggregatdaten enthalten unzulässige Felder',
  report_id: 'reportId ungültig',
  fenster: 'Zeitfenster muss ein kanonischer UTC-Tag (00:00:00.000Z, 24 Stunden) sein',
  tasks: 'Unbekannter Task in taskTotals',
  metrik: 'Token-Metriken müssen nicht-negative Ganzzahlen sein'
});

/**
 * Ende der Kontingentsperre (ms). resetAt = UNIX-Sekunden vom Zentrum; fehlt er, ist er
 * keine Ganzzahl, liegt er nicht in der Zukunft oder weiter als 32 Tage entfernt → now + 6 h.
 * Rein, ohne Seiteneffekte (M4.11 β).
 */
export function kilitBitisMs(resetAtSec, nowMs) {
  if (Number.isSafeInteger(resetAtSec)) {
    const bis = resetAtSec * 1000;
    if (bis > nowMs && bis - nowMs <= QUOTA_LOCK_MAX_MS) return bis;
  }
  return nowMs + QUOTA_LOCK_FALLBACK_MS;
}

/**
 * Races a promise against an AbortSignal.
 * Cleans up listeners in finally block.
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
 * @param {Object} [options.config] AI config object
 * @param {Function} [options.configProvider] Supplier function for AI config
 * @param {Function} [options.merkezFetchImpl] Fetch implementation (defaults to merkezFetch)
 * @param {Object} [options.merkezOptions] Extra options passed to merkezFetch (e.g. kimlik, baseUrl)
 * @param {Function} [options.now] Timestamp provider in ms (defaults to Date.now)
 * @param {Function} [options.aggregateSupplier] Supplier of audit window aggregate metrics
 * @param {number} [options.refreshSkewMs] Lead time for proactive refresh (bounded)
 * @param {ReadonlyArray<string>} [options.allowedHosts] Host allowlist override
 * @returns {{
 *   getToken: (opts?: {forceRefresh?: boolean, rejectedToken?: string, signal?: AbortSignal}) => Promise<{token: string, exp: number, endpoint: string, deployment: string, region: string, apiVersion: string}>,
 *   invalidate: (rejectedToken?: string) => void,
 *   reportUsage: (report?: object) => Promise<{ok: boolean, staged: boolean}>,
 *   getState: () => {hasToken: boolean, tokenDisabled: boolean, disabledUntil: number|null, exp: number|null, disabledReason: string|null, hasPendingReport: boolean}
 * }}
 */
export function createJetonClient(options = {}) {
  const fetchMerkez = options.merkezFetchImpl || merkezFetch;
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
  let currentToken = null;
  let singleflightPromise = null;
  let disabledUntilMs = null; // M4.11 β: quota lock end; checked on each request, no timer
  let disabledReason = null;
  let pendingReport = null; // Staged cumulative snapshot
  let aggregateDiagnostic = null;

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
    const err = new Error('KI-Jetonkontingent erschöpft (Zentrum)');
    err.code = disabledReason || 'AI_QUOTA_EXCEEDED';
    err.status = 503;
    return err;
  }

  // Report acknowledgement / permanent rejection from the centre (M4.11 γ). Only the ID is logged.
  function handleReportOutcome(json) {
    if (!pendingReport || !json || typeof json !== 'object') return;
    if (json.acknowledgedReportId === pendingReport.reportId) {
      pendingReport = null;
    } else if (json.rejectedReportId === pendingReport.reportId) {
      console.warn(`[ki-jeton] Aggregatmeldung vom Zentrum abgelehnt und verworfen: ${pendingReport.reportId}`);
      pendingReport = null;
    }
  }

  function validateTokenPayload(payload, allowedHosts) {
    if (!payload || typeof payload !== 'object') {
      const err = new Error('KI-Jeton-Antwort ungültig');
      err.code = 'AI_TOKEN_RESPONSE_INVALID';
      throw err;
    }

    const { token, exp, endpoint, deployment, region, apiVersion } = payload;

    // Token string check (reject control characters / CRLF)
    if (
      typeof token !== 'string' ||
      token.length < MIN_TOKEN_LENGTH ||
      token.length > MAX_TOKEN_LENGTH ||
      RE_CONTROL_CHARS.test(token)
    ) {
      const err = new Error('KI-Jeton-Antwort ungültig');
      err.code = 'AI_TOKEN_RESPONSE_INVALID';
      throw err;
    }

    // Expiry check (UNIX seconds integer)
    if (!Number.isInteger(exp)) {
      const err = new Error('KI-Jeton-Antwort ungültig');
      err.code = 'AI_TOKEN_RESPONSE_INVALID';
      throw err;
    }

    const currentSec = Math.floor(nowFn() / 1000);
    const ttl = exp - currentSec;

    if (ttl <= 0) {
      const err = new Error('KI-Jeton ist abgelaufen');
      err.code = 'AI_TOKEN_EXPIRED';
      throw err;
    }
    if (ttl > MAX_TTL_SECONDS) {
      const err = new Error('KI-Jeton-Gültigkeitsdauer überschritten');
      err.code = 'AI_TOKEN_TTL_EXCEEDED';
      throw err;
    }

    // Endpoint URL check
    const epVal = validateEndpointUrl(endpoint, allowedHosts);
    if (!epVal.ok) {
      const err = new Error('KI-Jeton-Endpunkt unzulässig');
      err.code = 'AI_HOST_NOT_ALLOWED';
      throw err;
    }

    // Deployment check
    if (typeof deployment !== 'string' || !RE_SAFE_SEGMENT.test(deployment)) {
      const err = new Error('KI-Jeton-Deploymentname ungültig');
      err.code = 'AI_DEPLOYMENT_INVALID';
      throw err;
    }

    // Region check (EU Data Boundary)
    const normalizedRegion = (region || '').toLowerCase();
    if (!EU_DATA_BOUNDARY_REGIONS.includes(normalizedRegion)) {
      const err = new Error('KI-Jeton-Region liegt nicht in EU Data Boundary');
      err.code = 'AI_INVALID_REGION';
      throw err;
    }

    // ApiVersion check
    if (typeof apiVersion !== 'string' || !RE_API_VERSION.test(apiVersion)) {
      const err = new Error('KI-Jeton-API-Version ungültig');
      err.code = 'AI_API_VERSION_INVALID';
      throw err;
    }

    return {
      token,
      exp,
      endpoint: epVal.cleanEndpoint,
      deployment,
      region: normalizedRegion,
      apiVersion
    };
  }

  // Gemeinsames Schema mit dem Zentrum (merkez-istemci/ki-bericht-schema.js) — eine Quelle.
  function validateReportSnapshot(report) {
    const g = pruefeKiBericht(report);
    if (!g.ok) throw new Error(BERICHT_FEHLER[g.grund] || BERICHT_FEHLER.form);
    return g.bericht;
  }

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

    let res;
    try {
      if (!pendingReport && typeof options.aggregateSupplier === 'function') {
        try {
          const supplierPromise = Promise.resolve(options.aggregateSupplier());
          const report = await raceSignal(supplierPromise, AbortSignal.timeout(Math.max(1, Math.min(1000, Math.floor(centreTimeoutMs / 2)))), 'Aggregat nicht verfügbar');
          if (report && typeof report === 'object') {
            pendingReport = validateReportSnapshot(report);
            aggregateDiagnostic = 'OK';
          }
        } catch (err) {
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
      const safeErr = new Error('Zentrum für KI-Jeton nicht erreichbar');
      safeErr.code = 'AI_JETON_UNAVAILABLE';
      safeErr.status = 503;
      throw safeErr;
    } finally {
      clearTimeout(centreTimer);
    }

    // Quota: only 402 + code AI_QUOTA_EXCEEDED (M4.11 α). Report outcome first, then lock (β).
    // 429, a 402 without that code and non-JSON bodies fall through to the transient path below.
    const body = res && res.json && typeof res.json === 'object' ? res.json : null;
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
      const failErr = new Error('KI-Jeton konnte nicht ausgestellt werden');
      failErr.code = 'AI_JETON_UNAVAILABLE';
      failErr.status = 503;
      throw failErr;
    }

    // Validate payload strictly
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
      const invalidErr = new Error('KI-Jeton-Antwort ungültig');
      invalidErr.code = valErr.code || 'AI_TOKEN_RESPONSE_INVALID';
      invalidErr.status = 503;
      throw invalidErr;
    }

    // Acknowledgement / rejection of the staged report (exact match required)
    handleReportOutcome(body);

    currentToken = validated;
    return validated;
  }

  async function getToken({ forceRefresh = false, rejectedToken, signal } = {}) {
    const cfg = getConfig();

    // 1. Enforce dynamic configuration readiness before cache or network
    if (cfg.mode !== 'jeton') {
      const err = new Error('KI-Dienst ist deaktiviert');
      err.code = 'AI_MODE_NOT_JETON';
      err.status = 503;
      throw err;
    }
    if (!cfg.activationReady) {
      const err = new Error('KI-Dienst ist nicht betriebsbereit geschaltet');
      err.code = 'AI_NOT_ACTIVATED';
      err.status = 503;
      throw err;
    }
    if (!cfg.valid) {
      const err = new Error('KI-Konfiguration ist ungültig');
      err.code = cfg.code || 'AI_CONFIG_INVALID';
      err.status = 503;
      throw err;
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
       const err = new Error('KI-Konfiguration während Token-Erstellung ungültig geworden');
       err.code = 'AI_CONFIG_CHANGED';
       err.status = 503;
       throw err;
    }
    const epValAfter = validateEndpointUrl(token.endpoint, options.allowedHosts || cfgAfter.allowedHosts);
    if (!epValAfter.ok) {
       const err = new Error('KI-Konfiguration während Token-Erstellung ungültig geworden');
       err.code = 'AI_CONFIG_CHANGED';
       err.status = 503;
       throw err;
    }
    return token;
  }

  async function reportUsage(customReport) {
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
