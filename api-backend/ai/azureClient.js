// Azure OpenAI / KI transport client (M4.1 / M4.11 / K4 safety).
//
// Key architectural guarantees:
// - Dynamic per-call configuration via ki-config.js. Zero import-time assertions or throws.
// - Supports 'direkt' (api-key) and 'jeton' (Authorization: Bearer) modes.
// - Default mode 'aus' yields safe German 503 error before any network.
// - Operator readiness-gate AI_ACTIVATION_READY=1 enforced before network.
// - Explicit mock only ({ mock: true, mockFn }) — never implicit mock on missing config/dev.
// - Multimodal image/blocks rejected at transport (OCR blocked; text-only shape).
// - Sanitized message shape: only { role, content }, known roles, no extra keys.
// - store:false on every request; redirect:error; no raw URLs/secrets/prompts in errors.
// - 401 in jeton mode: isolated per caller, reuses fresh parallel token, exactly one retry.
// - 429 handling: re-resolves target before retry, bounded queue (max 8), bounded Retry-After.
// - Total timeout includes body consumption; explicit timeoutMs seam for fast tests.
// - AbortSignal support races all stages, removes listeners in finally, masks signal reason secrets.

import { createAiConfig, validateEndpointUrl, EU_DATA_BOUNDARY_REGIONS, RE_SAFE_SEGMENT } from './ki-config.js';
import { createJetonClient } from './ki-jeton.js';

const RE_API_VERSION = /^\d{4}-\d{2}-\d{2}(-preview)?$/;
const RE_CONTROL_CHARS = /[\r\n\x00-\x1f\x7f]/;
const ALLOWED_ROLES = Object.freeze(new Set(['system', 'user', 'assistant']));

const MAX_429_QUEUE = 8;
const MAX_429_RETRIES = 2;
const MAX_RETRY_AFTER_MS = 10_000;
const MIN_RETRY_AFTER_MS = 500;
const DEFAULT_TIMEOUT_MS = 45_000;

let active429Waiters = 0;
/** @type {ReturnType<typeof createJetonClient> | null} */
let globalJetonClient = null;

function getGlobalJetonClient() {
  if (!globalJetonClient) {
    globalJetonClient = createJetonClient({
      configProvider: () => createAiConfig()
    });
  }
  return globalJetonClient;
}

/**
 * @typedef {Error & { code?: string, status?: number }} AzureClientError
 * @typedef {{
 *   getToken: (opts?: { forceRefresh?: boolean, rejectedToken?: string, signal?: AbortSignal }) => Promise<Record<string, any>>,
 *   invalidate: (rejectedToken?: string) => void
 * }} JetonClientLike
 * @typedef {Awaited<ReturnType<ReturnType<typeof createJetonClient>['getToken']>>} JetonAuthToken
 * @typedef {{
 *   messages?: Array<Record<string, unknown>>,
 *   responseFormat?: Record<string, unknown> | null,
 *   temperature?: number,
 *   maxTokens?: number,
 *   deployment?: string,
 *   mock?: boolean,
 *   mockFn?: (opts: { messages?: Array<Record<string, unknown>>, responseFormat?: Record<string, unknown> | null }) => unknown,
 *   config?: Record<string, any>,
 *   configProvider?: () => Record<string, any>,
 *   fetchImpl?: (url: string, init: Record<string, any>) => Promise<any>,
 *   jetonClient?: JetonClientLike,
 *   beforeSend?: () => boolean | Promise<boolean>,
 *   signal?: AbortSignal,
 *   timeoutMs?: number
 * }} ChatOptions
 * @typedef {{
 *   audioBuffer?: Buffer | Uint8Array,
 *   mimeType?: string,
 *   deployment?: string,
 *   mock?: boolean,
 *   mockFn?: (opts: { audioBuffer?: Buffer | Uint8Array, mimeType?: string }) => unknown,
 *   config?: Record<string, any>,
 *   configProvider?: () => Record<string, any>,
 *   fetchImpl?: (url: string, init: Record<string, any>) => Promise<any>,
 *   jetonClient?: JetonClientLike,
 *   beforeSend?: () => boolean | Promise<boolean>,
 *   signal?: AbortSignal,
 *   timeoutMs?: number
 * }} TranscribeOptions
 * @typedef {{
 *   endpoint: string,
 *   deployment: string,
 *   apiVersion: string,
 *   headers: Record<string, string>
 * }} ResolvedTarget
 */

/**
 * @param {string} message
 * @param {string} code
 * @param {number} [status]
 * @param {string} [name]
 * @returns {AzureClientError}
 */
function makeClientError(message, code, status, name) {
  /** @type {AzureClientError} */
  const err = new Error(message);
  err.code = code;
  if (status !== undefined) err.status = status;
  if (name) err.name = name;
  return err;
}

/**
 * Races a promise against an AbortSignal, removing listeners in finally block.
 * Guarantees that arbitrary secrets in signal.reason are never reflected.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {AbortSignal | undefined} signal
 * @param {string} [defaultErrMsg]
 * @returns {Promise<T>}
 */
function raceSignal(promise, signal, defaultErrMsg = 'KI-Anfrage abgebrochen') {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(makeClientError(defaultErrMsg, 'AI_ABORTED', 499, 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (!settled) {
        settled = true;
        reject(makeClientError(defaultErrMsg, 'AI_ABORTED', 499, 'AbortError'));
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
 * @param {number} ms
 * @param {AbortSignal | undefined} signal
 */
function sleepWithSignal(ms, signal) {
  return raceSignal(
    new Promise((resolve) => setTimeout(resolve, ms)),
    signal,
    'KI-Anfrage während Wartezeit abgebrochen'
  );
}

/**
 * Call Azure OpenAI / KI Chat Completions.
 *
 * @param {ChatOptions} [opts]
 * @returns {Promise<{content:string, usage:{prompt_tokens:number,completion_tokens:number,total_tokens:number}, model:string, deployment:string, dry_run:boolean, latency_ms:number}>}
 */
export async function chat(opts = {}) {
  const {
    messages,
    responseFormat,
    temperature = 0.4,
    maxTokens = 1200,
    deployment,
    mock = false,
    mockFn,
    config: injectedConfig,
    configProvider,
    fetchImpl = globalThis.fetch,
    jetonClient: injectedJetonClient,
    beforeSend,
    signal: externalSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = opts;

  const t0 = Date.now();

  // 1. Explicit mock handling
  if (mock) {
    if (typeof mockFn !== 'function') {
      throw makeClientError('Expliziter Mock erfordert eine mockFn-Funktion', 'AI_MOCK_FN_REQUIRED', 500);
    }
    const content = mockFn({ messages, responseFormat });
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content ?? '');
    return {
      content: contentStr,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: deployment || 'gpt-4o-mini',
      deployment: deployment || 'gpt-4o-mini',
      dry_run: true,
      latency_ms: Date.now() - t0
    };
  }

  // 2. Resolve configuration dynamically
  const cfg = injectedConfig || (typeof configProvider === 'function' ? configProvider() : createAiConfig());

  // 3. Mode 'aus' gate: safe German 503 before any network
  if (cfg.mode === 'aus') {
    throw makeClientError('KI-Dienst ist deaktiviert', 'AI_MODE_AUS', 503);
  }

  // 4. Operator readiness gate: AI_ACTIVATION_READY=1 required
  if (!cfg.activationReady) {
    throw makeClientError('KI-Dienst ist nicht betriebsbereit geschaltet', 'AI_NOT_ACTIVATED', 503);
  }

  // 5. Config validity check
  if (!cfg.valid) {
    throw makeClientError('KI-Konfiguration ist ungültig', cfg.code || 'AI_CONFIG_INVALID', 503);
  }

  // 6. Sanitized message transport validation
  if (!Array.isArray(messages) || messages.length === 0) {
    throw makeClientError('Ungültige oder leere Nachrichtenliste', 'AI_MESSAGES_INVALID', 400);
  }

  /** @type {Array<{ role: string, content: string, name?: string }>} */
  const sanitizedMessages = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') {
      throw makeClientError('Ungültiges Nachrichtenobjekt', 'AI_MESSAGES_INVALID', 400);
    }
    const keys = Object.keys(m);
    for (const k of keys) {
      if (k !== 'role' && k !== 'content' && k !== 'name') {
        throw makeClientError('Unerwartete Eigenschaft in Nachrichtenobjekt', 'AI_MESSAGES_INVALID', 400);
      }
    }
    if (typeof m.role !== 'string' || !ALLOWED_ROLES.has(m.role)) {
      throw makeClientError('Ungültige Rolle in Nachrichtenobjekt', 'AI_MESSAGES_INVALID', 400);
    }
    if (typeof m.content !== 'string') {
      throw makeClientError('Multimodale Inhalte und Bilder sind am KI-Transport nicht zulässig', 'AI_MULTIMODAL_BLOCKED', 400);
    }
    sanitizedMessages.push({
      role: m.role,
      content: m.content,
      ...(m.name ? { name: String(m.name).slice(0, 64) } : {})
    });
  }

  // 7. responseFormat validation
  /** @type {{ type: 'json_object' | 'text' } | undefined} */
  let sanitizedResponseFormat = undefined;
  if (responseFormat) {
    if (typeof responseFormat !== 'object' || responseFormat === null) {
      throw makeClientError('Ungültiges responseFormat', 'AI_PAYLOAD_INVALID', 400);
    }
    const keys = Object.keys(responseFormat);
    if (
      keys.length !== 1 ||
      keys[0] !== 'type' ||
      (responseFormat.type !== 'json_object' && responseFormat.type !== 'text')
    ) {
      throw makeClientError('Unzulässiger responseFormat-Deskriptor', 'AI_PAYLOAD_INVALID', 400);
    }
    sanitizedResponseFormat = { type: responseFormat.type };
  }

  // 8. Numeric temperature and maxTokens bounds
  const numTemp = Number(temperature);
  if (!Number.isFinite(numTemp) || numTemp < 0 || numTemp > 2) {
    throw makeClientError('Ungültige Temperatur', 'AI_PAYLOAD_INVALID', 400);
  }

  const numTokens = Number(maxTokens);
  if (!Number.isInteger(numTokens) || numTokens < 1 || numTokens > 16384) {
    throw makeClientError('Ungültige maxTokens', 'AI_PAYLOAD_INVALID', 400);
  }

  // 9. Combined timeout budget (explicit timeoutMs seam)
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new DOMException('KI-Anfrage Zeitüberschreitung', 'TimeoutError'));
  }, timeoutMs);

  /** @type {AbortSignal} */
  let combinedSignal;
  /** @type {(() => void) | null} */
  let combinedCleanup = null;
  if (typeof AbortSignal.any === 'function' && externalSignal) {
    combinedSignal = AbortSignal.any([externalSignal, timeoutController.signal]);
  } else if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      throw makeClientError('KI-Anfrage abgebrochen', 'AI_ABORTED', 499, 'AbortError');
    }
    const combinedController = new AbortController();
    const forwardAbort = () => combinedController.abort(new DOMException('KI-Anfrage abgebrochen', 'AbortError'));
    const timeoutAbort = () => combinedController.abort(timeoutController.signal.reason);
    externalSignal.addEventListener('abort', forwardAbort, { once: true });
    timeoutController.signal.addEventListener('abort', timeoutAbort, { once: true });
    combinedCleanup = () => {
      externalSignal.removeEventListener('abort', forwardAbort);
      timeoutController.signal.removeEventListener('abort', timeoutAbort);
    };
    combinedSignal = combinedController.signal;
  } else {
    combinedSignal = timeoutController.signal;
  }

  try {
    const jClient = injectedJetonClient || (
      cfg.mode === 'jeton'
        ? (injectedConfig ? createJetonClient({ config: injectedConfig }) : getGlobalJetonClient())
        : null
    );

    return await executeTransport({
      cfg,
      messages: sanitizedMessages,
      responseFormat: sanitizedResponseFormat,
      temperature: numTemp,
      maxTokens: numTokens,
      deploymentOverride: deployment,
      fetchImpl,
      jetonClient: jClient,
      beforeSend,
      signal: combinedSignal,
      t0
    });
  } catch (err) {
    const errName = err && typeof err === 'object' && 'name' in err ? err.name : undefined;
    const reasonName = combinedSignal.reason && typeof combinedSignal.reason === 'object' && 'name' in combinedSignal.reason
      ? combinedSignal.reason.name
      : undefined;
    if (errName === 'TimeoutError' || (combinedSignal.aborted && reasonName === 'TimeoutError')) {
      throw makeClientError('KI-Anfrage Zeitüberschreitung', 'AI_TIMEOUT', 503);
    }
    if (errName === 'AbortError' || combinedSignal.aborted) {
      throw makeClientError('KI-Anfrage abgebrochen', 'AI_ABORTED', 499, 'AbortError');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (combinedCleanup) combinedCleanup();
  }
}

/**
 * @param {{
 *   cfg: Record<string, any>,
 *   messages: Array<{ role: string, content: string, name?: string }>,
 *   responseFormat: { type: 'json_object' | 'text' } | undefined,
 *   temperature: number,
 *   maxTokens: number,
 *   deploymentOverride: string | undefined,
 *   fetchImpl: (url: string, init: Record<string, any>) => Promise<any>,
 *   jetonClient: JetonClientLike | null,
 *   beforeSend: (() => boolean | Promise<boolean>) | undefined,
 *   signal: AbortSignal,
 *   t0: number
 * }} params
 */
async function executeTransport({
  cfg,
  messages,
  responseFormat,
  temperature,
  maxTokens,
  deploymentOverride,
  fetchImpl,
  jetonClient,
  beforeSend,
  signal,
  t0
}) {
  /** @type {JetonAuthToken | null} */
  let jetonAuth = null;
  let hasRefreshedJeton401 = false;

  /**
   * @param {{ forceRefresh?: boolean, rejectedToken?: string }} [opts]
   * @returns {Promise<ResolvedTarget>}
   */
  async function resolveTarget(opts = {}) {
    if (cfg.mode === 'jeton') {
      if (!jetonClient) {
        throw makeClientError('Jeton-Client nicht initialisiert', 'AI_JETON_UNAVAILABLE', 503);
      }
      jetonAuth = /** @type {JetonAuthToken} */ (await raceSignal(jetonClient.getToken({ signal, ...opts }), signal));

      if (!jetonAuth || typeof jetonAuth !== 'object' || typeof jetonAuth.token !== 'string' || jetonAuth.token.length < 10 || jetonAuth.token.length > 4096 || RE_CONTROL_CHARS.test(jetonAuth.token)) {
        throw makeClientError('Token ungültig', 'AI_AUTH_INVALID', 503);
      }
      if (!Number.isInteger(jetonAuth.exp)) {
        throw makeClientError('Token-Ablauf ungültig', 'AI_AUTH_INVALID', 503);
      }
      const currentSec = Math.floor(Date.now()/1000);
      const ttl = jetonAuth.exp - currentSec;
      if (ttl <= 0 || ttl > 3600) {
        throw makeClientError('Token abgelaufen oder zu lang', 'AI_AUTH_INVALID', 503);
      }

      // Validate returned token target every send
      const epVal = validateEndpointUrl(jetonAuth.endpoint, cfg.allowedHosts);
      if (!epVal.ok || !epVal.cleanEndpoint) {
        throw makeClientError('Jeton-Endpunkt unzulässig', 'AI_HOST_NOT_ALLOWED', 503);
      }

      if (typeof jetonAuth.region !== 'string' || !(/** @type {readonly string[]} */ (EU_DATA_BOUNDARY_REGIONS)).includes(jetonAuth.region.toLowerCase())) {
        throw makeClientError('Region ungültig', 'AI_INVALID_REGION', 503);
      }
      if (typeof jetonAuth.apiVersion !== 'string' || !RE_API_VERSION.test(jetonAuth.apiVersion)) {
        throw makeClientError('API-Version ungültig', 'AI_API_VERSION_INVALID', 503);
      }

      const targetDeployment = jetonAuth.deployment; // Jeton bleibt an das vom Aussteller freigegebene Deployment gebunden.
      if (!RE_SAFE_SEGMENT.test(targetDeployment)) {
        throw makeClientError('Deploymentname ist ungültig', 'AI_DEPLOYMENT_INVALID', 503);
      }

      if (deploymentOverride && deploymentOverride !== targetDeployment) {
        throw makeClientError('Deploymentkonflikt in Jeton-Modus', 'AI_DEPLOYMENT_MISMATCH', 400);
      }

      return {
        endpoint: epVal.cleanEndpoint,
        deployment: targetDeployment,
        apiVersion: jetonAuth.apiVersion,
        headers: {
          'Authorization': `Bearer ${jetonAuth.token}`
        }
      };
    }

    // Direct mode
    const epVal = validateEndpointUrl(cfg.endpoint, cfg.allowedHosts);
    if (!epVal.ok || !epVal.cleanEndpoint) {
      throw makeClientError('Endpunkt unzulässig', epVal.code || 'AI_HOST_NOT_ALLOWED', 503);
    }

    const targetDeployment = deploymentOverride || cfg.deployment;
    if (!RE_SAFE_SEGMENT.test(targetDeployment)) {
      throw makeClientError('Deploymentname ist ungültig', 'AI_DEPLOYMENT_INVALID', 503);
    }

    if (RE_CONTROL_CHARS.test(cfg.apiKey)) {
      throw makeClientError('API-Key enthält unzulässige Steuerzeichen', 'AI_AUTH_INVALID', 503);
    }

    return {
      endpoint: epVal.cleanEndpoint,
      deployment: targetDeployment,
      apiVersion: cfg.apiVersion,
      headers: {
        'api-key': cfg.apiKey
      }
    };
  }

  let target = await resolveTarget();
  let attempts429 = 0;

  while (true) {
    if (signal.aborted) {
      throw makeClientError('KI-Anfrage abgebrochen', 'AI_ABORTED', 499, 'AbortError');
    }

    const url = `${target.endpoint.replace(/\/+$/, '')}/openai/deployments/${encodeURIComponent(target.deployment)}/chat/completions?api-version=${target.apiVersion}`;
    const payload = {
      messages,
      temperature,
      max_tokens: maxTokens,
      store: false,
      ...(responseFormat ? { response_format: responseFormat } : {})
    };

    // Recheck consent after token acquisition and every retry wait. Keep this
    // outside the communication catch so the gateway's safe denial survives.
    if (typeof beforeSend === 'function') {
      const permitted = await raceSignal(Promise.resolve().then(beforeSend), signal);
      if (permitted !== true) {
        throw makeClientError('KI-Freigabe nicht verfügbar', 'AI_OWNER_DISABLED', 503);
      }
    }
    /** @type {any} */
    let res;
    try {
      const fetchPromise = fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...target.headers
        },
        body: JSON.stringify(payload),
        redirect: 'error',
        signal
      });
      res = await raceSignal(fetchPromise, signal, 'KI-Anfrage abgebrochen');
    } catch (fetchErr) {
      const fetchErrName = fetchErr && typeof fetchErr === 'object' && 'name' in fetchErr ? fetchErr.name : undefined;
      if (fetchErrName === 'AbortError' || signal.aborted) {
        throw fetchErr;
      }
      throw makeClientError('KI-Dienst Kommunikationsfehler', 'AI_COMMUNICATION_ERROR', 503);
    }

    // Handle 401 in Jeton mode: isolated per caller, respects parallel refresh
    if (res.status === 401 && cfg.mode === 'jeton' && !hasRefreshedJeton401 && jetonClient) {
      hasRefreshedJeton401 = true;
      const rejectedToken = (/** @type {JetonAuthToken | null} */ (jetonAuth))?.token;
      jetonClient.invalidate(rejectedToken);
      target = await resolveTarget({ forceRefresh: true, rejectedToken });
      continue;
    }

    if (res.status === 401) {
      throw makeClientError('KI-Dienst nicht verfügbar (Authentifizierung fehlgeschlagen)', 'AI_UNAVAILABLE', 503);
    }

    // Handle 429 Rate Limit / Backpressure
    if (res.status === 429) {
      if (attempts429 >= MAX_429_RETRIES) {
        throw makeClientError('KI-Dienst überlastet (Ratenbegrenzung)', 'AI_RATE_LIMIT_EXCEEDED', 503);
      }

      if (active429Waiters >= MAX_429_QUEUE) {
        throw makeClientError('KI-Dienst überlastet (Warteschlange voll)', 'AI_QUEUE_FULL', 503);
      }

      const retryAfterHeader = res.headers?.get ? res.headers.get('retry-after') : null;
      let waitMs = 1000 * Math.pow(2, attempts429);
      if (retryAfterHeader) {
        const parsedSec = Number(retryAfterHeader);
        if (Number.isFinite(parsedSec) && parsedSec > 0) {
          waitMs = parsedSec * 1000;
        } else {
          const parsedDate = Date.parse(retryAfterHeader);
          if (!Number.isNaN(parsedDate)) {
             waitMs = parsedDate - Date.now();
          }
        }
      }
      waitMs = Math.max(MIN_RETRY_AFTER_MS, Math.min(MAX_RETRY_AFTER_MS, waitMs));

      active429Waiters++;
      try {
        await sleepWithSignal(waitMs, signal);
      } finally {
        active429Waiters--;
      }
      attempts429++;

      // Re-resolve target before retry since cached token may have expired during wait
      target = await resolveTarget();
      continue;
    }

    if (!res.ok) {
      // Consume body safely raced with signal
      await raceSignal(Promise.resolve(res.text()).catch(() => ''), signal, 'KI-Anfrage abgebrochen').catch(() => '');
      throw makeClientError('KI-Dienst nicht verfügbar', res.status === 403 ? 'AI_FORBIDDEN' : 'AI_UNAVAILABLE', 503);
    }

    /** @type {any} */
    let json;
    try {
      json = await raceSignal(Promise.resolve(res.json()), signal, 'KI-Anfrage abgebrochen');
    } catch (parseErr) {
      const parseErrName = parseErr && typeof parseErr === 'object' && 'name' in parseErr ? parseErr.name : undefined;
      if (parseErrName === 'AbortError' || signal.aborted) throw parseErr;
      throw makeClientError('KI-Antwort konnte nicht verarbeitet werden', 'AI_RESPONSE_MALFORMED', 503);
    }

    const choices = json?.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      throw makeClientError('KI-Antwort konnte nicht verarbeitet werden', 'AI_RESPONSE_MALFORMED', 503);
    }

    const choice = choices[0];
    if (typeof choice?.message?.content !== 'string') {
      throw makeClientError('KI-Antwort konnte nicht verarbeitet werden', 'AI_RESPONSE_MALFORMED', 503);
    }
    const content = choice.message.content;

    const rawUsage = json?.usage;
    if (!rawUsage || typeof rawUsage !== 'object') {
      throw makeClientError('KI-Antwort enthält ungültige Nutzungsdaten', 'AI_RESPONSE_MALFORMED', 503);
    }

    const pt = Number(rawUsage.prompt_tokens);
    const ct = Number(rawUsage.completion_tokens);
    const tt = Number(rawUsage.total_tokens);

    if (
      !Number.isInteger(pt) || pt < 0 ||
      !Number.isInteger(ct) || ct < 0 ||
      !Number.isInteger(tt) || tt < 0
    ) {
      throw makeClientError('KI-Antwort enthält ungültige Nutzungsdaten', 'AI_RESPONSE_MALFORMED', 503);
    }

    const usage = {
      prompt_tokens: pt,
      completion_tokens: ct,
      total_tokens: tt
    };

    let safeModel = target.deployment;
    if (typeof json?.model === 'string' && ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'].includes(json.model)) {
      safeModel = json.model;
    }

    return {
      content,
      usage,
      model: safeModel,
      deployment: target.deployment,
      dry_run: false,
      latency_ms: Date.now() - t0
    };
  }
}

/**
 * Returns safe summary of the AI configuration.
 * Metadata whitelisted for type, length, control characters.
 *
 * @param {Record<string, any>} [customConfig] optional config override for testing
 * @returns {{
 *   endpoint: string,
 *   deployment: string,
 *   api_version: string,
 *   region: string,
 *   dry_run: boolean,
 *   mode: string,
 *   available: boolean,
 *   code: string
 * }}
 */
export function configSummary(customConfig) {
  const cfg = customConfig || createAiConfig();
  let maskedEndpoint = '(unset)';

  if (cfg.endpoint && typeof cfg.endpoint === 'string') {
    try {
      const u = new URL(cfg.endpoint);
      const hostPart = u.hostname.split('.')[0];
      if (/^[a-zA-Z0-9_-]{1,64}$/.test(hostPart)) {
        maskedEndpoint = hostPart + '.…';
      } else {
        maskedEndpoint = '(invalid)';
      }
    } catch {
      maskedEndpoint = '(invalid)';
    }
  }

  const safeDeployment = (typeof cfg.deployment === 'string' && RE_SAFE_SEGMENT.test(cfg.deployment))
    ? cfg.deployment
    : '(invalid)';

  const safeApiVersion = (typeof cfg.apiVersion === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(cfg.apiVersion))
    ? cfg.apiVersion
    : '(invalid)';

  const safeRegion = (typeof cfg.region === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(cfg.region))
    ? cfg.region
    : '(unset)';

  const safeMode = (typeof cfg.mode === 'string' && /^[a-zA-Z0-9_-]{1,32}$/.test(cfg.mode))
    ? cfg.mode
    : 'aus';

  const safeCode = (typeof cfg.code === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(cfg.code))
    ? cfg.code
    : 'OK';

  const isAvailable = cfg.mode !== 'aus' && Boolean(cfg.activationReady) && Boolean(cfg.valid);

  return {
    endpoint: maskedEndpoint,
    deployment: safeDeployment,
    api_version: safeApiVersion,
    region: safeRegion,
    dry_run: false,
    mode: safeMode,
    available: isAvailable,
    code: safeCode
  };
}

/**
 * Call Azure OpenAI audio transcription service.
 *
 * @param {TranscribeOptions} [opts]
 * @returns {Promise<{text: string, usage: {prompt_tokens: number, completion_tokens: number, total_tokens: number}, model: string, deployment: string, dry_run: boolean, latency_ms: number}>}
 */
export async function transcribe(opts = {}) {
  const {
    audioBuffer,
    mimeType = 'audio/webm',
    deployment: deploymentOverride,
    mock = false,
    mockFn,
    config: injectedConfig,
    configProvider,
    fetchImpl = globalThis.fetch,
    jetonClient: injectedJetonClient,
    beforeSend,
    signal: externalSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = opts;

  const t0 = Date.now();

  // 1. Explicit mock handling
  if (mock) {
    if (typeof mockFn !== 'function') {
      throw makeClientError('Expliziter Mock erfordert eine mockFn-Funktion', 'AI_MOCK_FN_REQUIRED', 500);
    }
    const res = /** @type {any} */ (mockFn({ audioBuffer, mimeType }));
    const textStr = typeof res === 'string' ? res : (typeof res?.text === 'string' ? res.text : '');
    return {
      text: textStr,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: deploymentOverride || 'whisper',
      deployment: deploymentOverride || 'whisper',
      dry_run: true,
      latency_ms: Date.now() - t0
    };
  }

  // 2. Resolve configuration dynamically
  const cfg = injectedConfig || (typeof configProvider === 'function' ? configProvider() : createAiConfig());

  // 3. Mode 'aus' gate
  if (cfg.mode === 'aus') {
    throw makeClientError('KI-Dienst ist deaktiviert', 'AI_MODE_AUS', 503);
  }

  // 4. Operator readiness gate
  if (!cfg.activationReady) {
    throw makeClientError('KI-Dienst ist nicht betriebsbereit geschaltet', 'AI_NOT_ACTIVATED', 503);
  }

  // 5. Config validity check
  if (!cfg.valid) {
    throw makeClientError('KI-Konfiguration ist ungültig', cfg.code || 'AI_CONFIG_INVALID', 503);
  }

  // 6. Audio validation
  if (!audioBuffer || (!Buffer.isBuffer(audioBuffer) && !(audioBuffer instanceof Uint8Array))) {
    throw makeClientError('Ungültige Audiodaten', 'AI_PAYLOAD_INVALID', 400);
  }

  if (audioBuffer.length > 10 * 1024 * 1024) {
    throw makeClientError('Audiodatei überschreitet das Limit von 10 MB', 'AI_PAYLOAD_TOO_LARGE', 413);
  }

  // 7. Timeout handling
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new DOMException('KI-Anfrage Zeitüberschreitung', 'TimeoutError'));
  }, timeoutMs);

  /** @type {AbortSignal} */
  let combinedSignal;
  /** @type {(() => void) | null} */
  let combinedCleanup = null;
  if (typeof AbortSignal.any === 'function' && externalSignal) {
    combinedSignal = AbortSignal.any([externalSignal, timeoutController.signal]);
  } else if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      throw makeClientError('KI-Anfrage abgebrochen', 'AI_ABORTED', 499, 'AbortError');
    }
    const combinedController = new AbortController();
    const forwardAbort = () => combinedController.abort(new DOMException('KI-Anfrage abgebrochen', 'AbortError'));
    const timeoutAbort = () => combinedController.abort(timeoutController.signal.reason);
    externalSignal.addEventListener('abort', forwardAbort, { once: true });
    timeoutController.signal.addEventListener('abort', timeoutAbort, { once: true });
    combinedCleanup = () => {
      externalSignal.removeEventListener('abort', forwardAbort);
      timeoutController.signal.removeEventListener('abort', timeoutAbort);
    };
    combinedSignal = combinedController.signal;
  } else {
    combinedSignal = timeoutController.signal;
  }

  try {
    const jClient = injectedJetonClient || (
      cfg.mode === 'jeton'
        ? (injectedConfig ? createJetonClient({ config: injectedConfig }) : getGlobalJetonClient())
        : null
    );

    return await executeTranscribeTransport({
      cfg,
      audioBuffer,
      mimeType,
      deploymentOverride,
      fetchImpl,
      jetonClient: jClient,
      beforeSend,
      signal: combinedSignal,
      t0
    });
  } catch (err) {
    const errName = err && typeof err === 'object' && 'name' in err ? err.name : undefined;
    const reasonName = combinedSignal.reason && typeof combinedSignal.reason === 'object' && 'name' in combinedSignal.reason
      ? combinedSignal.reason.name
      : undefined;
    if (errName === 'TimeoutError' || (combinedSignal.aborted && reasonName === 'TimeoutError')) {
      throw makeClientError('KI-Anfrage Zeitüberschreitung', 'AI_TIMEOUT', 503);
    }
    if (errName === 'AbortError' || combinedSignal.aborted) {
      throw makeClientError('KI-Anfrage abgebrochen', 'AI_ABORTED', 499, 'AbortError');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (combinedCleanup) combinedCleanup();
  }
}

/**
 * @param {{
 *   cfg: Record<string, any>,
 *   audioBuffer: Buffer | Uint8Array,
 *   mimeType: string,
 *   deploymentOverride: string | undefined,
 *   fetchImpl: (url: string, init: Record<string, any>) => Promise<any>,
 *   jetonClient: JetonClientLike | null,
 *   beforeSend: (() => boolean | Promise<boolean>) | undefined,
 *   signal: AbortSignal,
 *   t0: number
 * }} params
 */
async function executeTranscribeTransport({
  cfg,
  audioBuffer,
  mimeType,
  deploymentOverride,
  fetchImpl,
  jetonClient,
  beforeSend,
  signal,
  t0
}) {
  /** @type {JetonAuthToken | null} */
  let jetonAuth = null;
  let hasRefreshedJeton401 = false;

  /**
   * @param {{ forceRefresh?: boolean, rejectedToken?: string }} [opts]
   * @returns {Promise<ResolvedTarget>}
   */
  async function resolveTranscribeTarget(opts = {}) {
    if (cfg.mode === 'jeton') {
      if (!jetonClient) {
        throw makeClientError('Jeton-Client nicht initialisiert', 'AI_JETON_UNAVAILABLE', 503);
      }
      jetonAuth = /** @type {JetonAuthToken} */ (await raceSignal(jetonClient.getToken({ signal, ...opts }), signal));

      if (!jetonAuth || typeof jetonAuth !== 'object' || typeof jetonAuth.token !== 'string' || jetonAuth.token.length < 10 || jetonAuth.token.length > 4096 || RE_CONTROL_CHARS.test(jetonAuth.token)) {
        throw makeClientError('Token ungültig', 'AI_AUTH_INVALID', 503);
      }

      const epVal = validateEndpointUrl(jetonAuth.endpoint, cfg.allowedHosts);
      if (!epVal.ok || !epVal.cleanEndpoint) {
        throw makeClientError('Jeton-Endpunkt unzulässig', 'AI_HOST_NOT_ALLOWED', 503);
      }

      const targetDeployment = jetonAuth.deploymentTranscribe;
      if (!targetDeployment) {
        throw makeClientError('Transkription ist nicht eingerichtet', 'AI_TRANSKRIPTION_NICHT_EINGERICHTET', 503);
      }
      if (!RE_SAFE_SEGMENT.test(targetDeployment)) {
        throw makeClientError('Deploymentname ist ungültig', 'AI_DEPLOYMENT_INVALID', 503);
      }

      if (deploymentOverride && deploymentOverride !== targetDeployment) {
        throw makeClientError('Deploymentkonflikt in Jeton-Modus', 'AI_DEPLOYMENT_MISMATCH', 400);
      }

      return {
        endpoint: epVal.cleanEndpoint,
        deployment: targetDeployment,
        apiVersion: jetonAuth.apiVersion,
        headers: {
          'Authorization': `Bearer ${jetonAuth.token}`
        }
      };
    }

    // Direct mode
    const epVal = validateEndpointUrl(cfg.endpoint, cfg.allowedHosts);
    if (!epVal.ok || !epVal.cleanEndpoint) {
      throw makeClientError('Endpunkt unzulässig', epVal.code || 'AI_HOST_NOT_ALLOWED', 503);
    }

    const targetDeployment = deploymentOverride || cfg.transcribeDeployment;
    if (!targetDeployment) {
      throw makeClientError('Transkription ist nicht eingerichtet', 'AI_TRANSKRIPTION_NICHT_EINGERICHTET', 503);
    }
    if (!RE_SAFE_SEGMENT.test(targetDeployment)) {
      throw makeClientError('Deploymentname ist ungültig', 'AI_DEPLOYMENT_INVALID', 503);
    }

    if (RE_CONTROL_CHARS.test(cfg.apiKey)) {
      throw makeClientError('API-Key enthält unzulässige Steuerzeichen', 'AI_AUTH_INVALID', 503);
    }

    return {
      endpoint: epVal.cleanEndpoint,
      deployment: targetDeployment,
      apiVersion: cfg.apiVersion,
      headers: {
        'api-key': cfg.apiKey
      }
    };
  }

  let target = await resolveTranscribeTarget();
  let attempts429 = 0;

  while (true) {
    if (signal.aborted) {
      throw makeClientError('KI-Anfrage abgebrochen', 'AI_ABORTED', 499, 'AbortError');
    }

    const url = `${target.endpoint.replace(/\/+$/, '')}/openai/deployments/${encodeURIComponent(target.deployment)}/audio/transcriptions?api-version=${target.apiVersion}`;

    if (typeof beforeSend === 'function') {
      const permitted = await raceSignal(Promise.resolve().then(beforeSend), signal);
      if (permitted !== true) {
        throw makeClientError('KI-Freigabe nicht verfügbar', 'AI_OWNER_DISABLED', 503);
      }
    }

    const formData = new FormData();
    const filename = mimeType && mimeType.includes('ogg') ? 'audio.ogg' : (mimeType && mimeType.includes('mp4') ? 'audio.mp4' : 'audio.webm');
    formData.append('file', new Blob([/** @type {BlobPart} */ (/** @type {unknown} */ (audioBuffer))], { type: mimeType || 'audio/webm' }), filename);
    formData.append('language', 'de');

    /** @type {any} */
    let res;
    try {
      const fetchPromise = fetchImpl(url, {
        method: 'POST',
        headers: {
          ...target.headers
        },
        body: formData,
        redirect: 'error',
        signal
      });
      res = await raceSignal(fetchPromise, signal, 'KI-Anfrage abgebrochen');
    } catch (fetchErr) {
      const fetchErrName = fetchErr && typeof fetchErr === 'object' && 'name' in fetchErr ? fetchErr.name : undefined;
      if (fetchErrName === 'AbortError' || signal.aborted) {
        throw fetchErr;
      }
      throw makeClientError('KI-Dienst Kommunikationsfehler', 'AI_COMMUNICATION_ERROR', 503);
    }

    // Handle 401 in Jeton mode: retry once
    if (res.status === 401 && cfg.mode === 'jeton' && !hasRefreshedJeton401 && jetonClient) {
      hasRefreshedJeton401 = true;
      const rejectedToken = (/** @type {JetonAuthToken | null} */ (jetonAuth))?.token;
      jetonClient.invalidate(rejectedToken);
      target = await resolveTranscribeTarget({ forceRefresh: true, rejectedToken });
      continue;
    }

    if (res.status === 401) {
      throw makeClientError('KI-Dienst nicht verfügbar (Authentifizierung fehlgeschlagen)', 'AI_UNAVAILABLE', 503);
    }

    if (res.status === 429) {
      if (attempts429 >= MAX_429_RETRIES) {
        throw makeClientError('KI-Dienst überlastet (Ratenbegrenzung)', 'AI_RATE_LIMIT_EXCEEDED', 503);
      }
      attempts429++;
      let delayMs = 1000;
      const retryAfter = res.headers?.get?.('retry-after');
      if (retryAfter) {
        const parsed = parseInt(retryAfter, 10);
        if (Number.isFinite(parsed) && parsed > 0) delayMs = Math.min(parsed * 1000, MAX_RETRY_AFTER_MS);
      }
      await sleepWithSignal(delayMs, signal);
      target = await resolveTranscribeTarget({ forceRefresh: true });
      continue;
    }

    if (!res.ok) {
      throw makeClientError('KI-Dienst nicht verfügbar', 'AI_UNAVAILABLE', 503);
    }

    let rawText = '';
    try {
      rawText = await raceSignal(Promise.resolve(res.text()), signal, 'KI-Anfrage abgebrochen');
    } catch (bodyErr) {
      const bodyErrName = bodyErr && typeof bodyErr === 'object' && 'name' in bodyErr ? bodyErr.name : undefined;
      if (bodyErrName === 'AbortError' || signal.aborted) throw bodyErr;
      throw makeClientError('KI-Antwort konnte nicht empfangen werden', 'AI_COMMUNICATION_ERROR', 503);
    }

    let parsedText = '';
    try {
      const json = JSON.parse(rawText);
      parsedText = typeof json?.text === 'string' ? json.text : (typeof json === 'string' ? json : rawText);
    } catch {
      parsedText = rawText;
    }

    return {
      text: parsedText.trim(),
      model: target.deployment,
      deployment: target.deployment,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      dry_run: false,
      latency_ms: Date.now() - t0
    };
  }
}
