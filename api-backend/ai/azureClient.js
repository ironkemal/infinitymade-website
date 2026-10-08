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

import { createAiConfig, validateEndpointUrl, EU_DATA_BOUNDARY_REGIONS } from './ki-config.js';
import { createJetonClient } from './ki-jeton.js';

const RE_SAFE_SEGMENT = /^[a-zA-Z0-9_-]{1,64}$/;
const RE_API_VERSION = /^\d{4}-\d{2}-\d{2}(-preview)?$/;
const RE_CONTROL_CHARS = /[\r\n\x00-\x1f\x7f]/;
const ALLOWED_ROLES = Object.freeze(new Set(['system', 'user', 'assistant']));

const MAX_429_QUEUE = 8;
const MAX_429_RETRIES = 2;
const MAX_RETRY_AFTER_MS = 10_000;
const MIN_RETRY_AFTER_MS = 500;
const DEFAULT_TIMEOUT_MS = 45_000;

let active429Waiters = 0;
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
 * Races a promise against an AbortSignal, removing listeners in finally block.
 * Guarantees that arbitrary secrets in signal.reason are never reflected.
 */
function raceSignal(promise, signal, defaultErrMsg = 'KI-Anfrage abgebrochen') {
  if (!signal) return promise;
  if (signal.aborted) {
    const err = new Error(defaultErrMsg);
    err.name = 'AbortError';
    err.code = 'AI_ABORTED';
    err.status = 499;
    return Promise.reject(err);
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (!settled) {
        settled = true;
        const err = new Error(defaultErrMsg);
        err.name = 'AbortError';
        err.code = 'AI_ABORTED';
        err.status = 499;
        reject(err);
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
 * @param {Object} opts
 * @param {Array}  opts.messages          OpenAI-format messages array (text only)
 * @param {Object} [opts.responseFormat]  e.g. { type: 'json_object' }
 * @param {number} [opts.temperature=0.4]
 * @param {number} [opts.maxTokens=1200]
 * @param {string} [opts.deployment]      deployment override
 * @param {boolean} [opts.mock]           explicit mock flag (requires mockFn)
 * @param {Function} [opts.mockFn]        mock producer function
 * @param {Object} [opts.config]          injected AI config object
 * @param {Function} [opts.configProvider] injected config provider function
 * @param {Function} [opts.fetchImpl]     fetch implementation (defaults to globalThis.fetch)
 * @param {Object} [opts.jetonClient]     injected jeton client instance
 * @param {AbortSignal} [opts.signal]     external abort signal
 * @param {number} [opts.timeoutMs]       test timeout seam (defaults to 45000)
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
      const err = new Error('Expliziter Mock erfordert eine mockFn-Funktion');
      err.code = 'AI_MOCK_FN_REQUIRED';
      err.status = 500;
      throw err;
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
    const err = new Error('KI-Dienst ist deaktiviert');
    err.code = 'AI_MODE_AUS';
    err.status = 503;
    throw err;
  }

  // 4. Operator readiness gate: AI_ACTIVATION_READY=1 required
  if (!cfg.activationReady) {
    const err = new Error('KI-Dienst ist nicht betriebsbereit geschaltet');
    err.code = 'AI_NOT_ACTIVATED';
    err.status = 503;
    throw err;
  }

  // 5. Config validity check
  if (!cfg.valid) {
    const err = new Error('KI-Konfiguration ist ungültig');
    err.code = cfg.code || 'AI_CONFIG_INVALID';
    err.status = 503;
    throw err;
  }

  // 6. Sanitized message transport validation
  if (!Array.isArray(messages) || messages.length === 0) {
    const err = new Error('Ungültige oder leere Nachrichtenliste');
    err.code = 'AI_MESSAGES_INVALID';
    err.status = 400;
    throw err;
  }

  const sanitizedMessages = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') {
      const err = new Error('Ungültiges Nachrichtenobjekt');
      err.code = 'AI_MESSAGES_INVALID';
      err.status = 400;
      throw err;
    }
    const keys = Object.keys(m);
    for (const k of keys) {
      if (k !== 'role' && k !== 'content' && k !== 'name') {
        const err = new Error('Unerwartete Eigenschaft in Nachrichtenobjekt');
        err.code = 'AI_MESSAGES_INVALID';
        err.status = 400;
        throw err;
      }
    }
    if (!ALLOWED_ROLES.has(m.role)) {
      const err = new Error('Ungültige Rolle in Nachrichtenobjekt');
      err.code = 'AI_MESSAGES_INVALID';
      err.status = 400;
      throw err;
    }
    if (typeof m.content !== 'string') {
      const err = new Error('Multimodale Inhalte und Bilder sind am KI-Transport nicht zulässig');
      err.code = 'AI_MULTIMODAL_BLOCKED';
      err.status = 400;
      throw err;
    }
    sanitizedMessages.push({
      role: m.role,
      content: m.content,
      ...(m.name ? { name: String(m.name).slice(0, 64) } : {})
    });
  }

  // 7. responseFormat validation
  let sanitizedResponseFormat = undefined;
  if (responseFormat) {
    if (typeof responseFormat !== 'object' || responseFormat === null) {
      const err = new Error('Ungültiges responseFormat');
      err.code = 'AI_PAYLOAD_INVALID';
      err.status = 400;
      throw err;
    }
    const keys = Object.keys(responseFormat);
    if (
      keys.length !== 1 ||
      keys[0] !== 'type' ||
      (responseFormat.type !== 'json_object' && responseFormat.type !== 'text')
    ) {
      const err = new Error('Unzulässiger responseFormat-Deskriptor');
      err.code = 'AI_PAYLOAD_INVALID';
      err.status = 400;
      throw err;
    }
    sanitizedResponseFormat = { type: responseFormat.type };
  }

  // 8. Numeric temperature and maxTokens bounds
  const numTemp = Number(temperature);
  if (!Number.isFinite(numTemp) || numTemp < 0 || numTemp > 2) {
    const err = new Error('Ungültige Temperatur');
    err.code = 'AI_PAYLOAD_INVALID';
    err.status = 400;
    throw err;
  }

  const numTokens = Number(maxTokens);
  if (!Number.isInteger(numTokens) || numTokens < 1 || numTokens > 16384) {
    const err = new Error('Ungültige maxTokens');
    err.code = 'AI_PAYLOAD_INVALID';
    err.status = 400;
    throw err;
  }

  // 9. Combined timeout budget (explicit timeoutMs seam)
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new DOMException('KI-Anfrage Zeitüberschreitung', 'TimeoutError'));
  }, timeoutMs);

  let combinedSignal;
  let combinedCleanup = null;
  if (typeof AbortSignal.any === 'function' && externalSignal) {
    combinedSignal = AbortSignal.any([externalSignal, timeoutController.signal]);
  } else if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      const abortErr = new Error('KI-Anfrage abgebrochen');
      abortErr.name = 'AbortError';
      abortErr.code = 'AI_ABORTED';
      abortErr.status = 499;
      throw abortErr;
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
    if (err.name === 'TimeoutError' || combinedSignal.aborted && combinedSignal.reason?.name === 'TimeoutError') {
      const timeoutErr = new Error('KI-Anfrage Zeitüberschreitung');
      timeoutErr.code = 'AI_TIMEOUT';
      timeoutErr.status = 503;
      throw timeoutErr;
    }
    if (err.name === 'AbortError' || combinedSignal.aborted) {
      const abortErr = new Error('KI-Anfrage abgebrochen');
      abortErr.name = 'AbortError';
      abortErr.code = 'AI_ABORTED';
      abortErr.status = 499;
      throw abortErr;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (combinedCleanup) combinedCleanup();
  }
}

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
  let jetonAuth = null;
  let hasRefreshedJeton401 = false;

  async function resolveTarget(opts = {}) {
    if (cfg.mode === 'jeton') {
      if (!jetonClient) {
        const err = new Error('Jeton-Client nicht initialisiert');
        err.code = 'AI_JETON_UNAVAILABLE';
        err.status = 503;
        throw err;
      }
      jetonAuth = await raceSignal(jetonClient.getToken({ signal, ...opts }), signal);

      if (!jetonAuth || typeof jetonAuth !== 'object' || typeof jetonAuth.token !== 'string' || jetonAuth.token.length < 10 || jetonAuth.token.length > 4096 || RE_CONTROL_CHARS.test(jetonAuth.token)) {
        const err = new Error('Token ungültig'); err.code = 'AI_AUTH_INVALID'; err.status = 503; throw err;
      }
      if (!Number.isInteger(jetonAuth.exp)) {
         const err = new Error('Token-Ablauf ungültig'); err.code = 'AI_AUTH_INVALID'; err.status = 503; throw err;
      }
      const currentSec = Math.floor(Date.now()/1000);
      const ttl = jetonAuth.exp - currentSec;
      if (ttl <= 0 || ttl > 3600) {
         const err = new Error('Token abgelaufen oder zu lang'); err.code = 'AI_AUTH_INVALID'; err.status = 503; throw err;
      }

      // Validate returned token target every send
      const epVal = validateEndpointUrl(jetonAuth.endpoint, cfg.allowedHosts);
      if (!epVal.ok) {
        const err = new Error('Jeton-Endpunkt unzulässig');
        err.code = 'AI_HOST_NOT_ALLOWED';
        err.status = 503;
        throw err;
      }

      if (typeof jetonAuth.region !== 'string' || !EU_DATA_BOUNDARY_REGIONS.includes(jetonAuth.region.toLowerCase())) {
        const err = new Error('Region ungültig'); err.code = 'AI_INVALID_REGION'; err.status = 503; throw err;
      }
      if (typeof jetonAuth.apiVersion !== 'string' || !RE_API_VERSION.test(jetonAuth.apiVersion)) {
        const err = new Error('API-Version ungültig'); err.code = 'AI_API_VERSION_INVALID'; err.status = 503; throw err;
      }

      const targetDeployment = jetonAuth.deployment; // Jeton bleibt an das vom Aussteller freigegebene Deployment gebunden.
      if (!RE_SAFE_SEGMENT.test(targetDeployment)) {
        const err = new Error('Deploymentname ist ungültig');
        err.code = 'AI_DEPLOYMENT_INVALID';
        err.status = 503;
        throw err;
      }

      if (deploymentOverride && deploymentOverride !== targetDeployment) {
        const err = new Error('Deploymentkonflikt in Jeton-Modus');
        err.code = 'AI_DEPLOYMENT_MISMATCH';
        err.status = 400;
        throw err;
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
    if (!epVal.ok) {
      const err = new Error('Endpunkt unzulässig');
      err.code = epVal.code || 'AI_HOST_NOT_ALLOWED';
      err.status = 503;
      throw err;
    }

    const targetDeployment = deploymentOverride || cfg.deployment;
    if (!RE_SAFE_SEGMENT.test(targetDeployment)) {
      const err = new Error('Deploymentname ist ungültig');
      err.code = 'AI_DEPLOYMENT_INVALID';
      err.status = 503;
      throw err;
    }

    if (RE_CONTROL_CHARS.test(cfg.apiKey)) {
      const err = new Error('API-Key enthält unzulässige Steuerzeichen');
      err.code = 'AI_AUTH_INVALID';
      err.status = 503;
      throw err;
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
      const abortErr = new Error('KI-Anfrage abgebrochen');
      abortErr.name = 'AbortError';
      abortErr.code = 'AI_ABORTED';
      abortErr.status = 499;
      throw abortErr;
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
        const err = new Error('KI-Freigabe nicht verfügbar');
        err.code = 'AI_OWNER_DISABLED';
        err.status = 503;
        throw err;
      }
    }
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
      if (fetchErr.name === 'AbortError' || signal.aborted) {
        throw fetchErr;
      }
      const err = new Error('KI-Dienst Kommunikationsfehler');
      err.code = 'AI_COMMUNICATION_ERROR';
      err.status = 503;
      throw err;
    }

    // Handle 401 in Jeton mode: isolated per caller, respects parallel refresh
    if (res.status === 401 && cfg.mode === 'jeton' && !hasRefreshedJeton401) {
      hasRefreshedJeton401 = true;
      const rejectedToken = jetonAuth?.token;
      jetonClient.invalidate(rejectedToken);
      target = await resolveTarget({ forceRefresh: true, rejectedToken });
      continue;
    }

    if (res.status === 401) {
      const err = new Error('KI-Dienst nicht verfügbar (Authentifizierung fehlgeschlagen)');
      err.code = 'AI_UNAVAILABLE';
      err.status = 503;
      throw err;
    }

    // Handle 429 Rate Limit / Backpressure
    if (res.status === 429) {
      if (attempts429 >= MAX_429_RETRIES) {
        const err = new Error('KI-Dienst überlastet (Ratenbegrenzung)');
        err.code = 'AI_RATE_LIMIT_EXCEEDED';
        err.status = 503;
        throw err;
      }

      if (active429Waiters >= MAX_429_QUEUE) {
        const err = new Error('KI-Dienst überlastet (Warteschlange voll)');
        err.code = 'AI_QUEUE_FULL';
        err.status = 503;
        throw err;
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
      await raceSignal(res.text().catch(() => ''), signal, 'KI-Anfrage abgebrochen').catch(() => '');
      const err = new Error('KI-Dienst nicht verfügbar');
      err.code = res.status === 403 ? 'AI_FORBIDDEN' : 'AI_UNAVAILABLE';
      err.status = 503;
      throw err;
    }

    let json;
    try {
      json = await raceSignal(res.json(), signal, 'KI-Anfrage abgebrochen');
    } catch (parseErr) {
      if (parseErr.name === 'AbortError' || signal.aborted) throw parseErr;
      const err = new Error('KI-Antwort konnte nicht verarbeitet werden');
      err.code = 'AI_RESPONSE_MALFORMED';
      err.status = 503;
      throw err;
    }

    const choices = json?.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      const err = new Error('KI-Antwort konnte nicht verarbeitet werden');
      err.code = 'AI_RESPONSE_MALFORMED';
      err.status = 503;
      throw err;
    }

    const choice = choices[0];
    if (typeof choice?.message?.content !== 'string') {
      const err = new Error('KI-Antwort konnte nicht verarbeitet werden');
      err.code = 'AI_RESPONSE_MALFORMED';
      err.status = 503;
      throw err;
    }
    const content = choice.message.content;

    const rawUsage = json?.usage;
    if (!rawUsage || typeof rawUsage !== 'object') {
      const err = new Error('KI-Antwort enthält ungültige Nutzungsdaten');
      err.code = 'AI_RESPONSE_MALFORMED';
      err.status = 503;
      throw err;
    }

    const pt = Number(rawUsage.prompt_tokens);
    const ct = Number(rawUsage.completion_tokens);
    const tt = Number(rawUsage.total_tokens);

    if (
      !Number.isInteger(pt) || pt < 0 ||
      !Number.isInteger(ct) || ct < 0 ||
      !Number.isInteger(tt) || tt < 0
    ) {
      const err = new Error('KI-Antwort enthält ungültige Nutzungsdaten');
      err.code = 'AI_RESPONSE_MALFORMED';
      err.status = 503;
      throw err;
    }

    const usage = {
      prompt_tokens: pt,
      completion_tokens: ct,
      total_tokens: tt
    };

    let safeModel = target.deployment;
    if (['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'].includes(json?.model)) {
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
 * @param {Object} [customConfig] optional config override for testing
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

  const safeDeployment = (typeof cfg.deployment === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(cfg.deployment))
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
