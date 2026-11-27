// AI Configuration & Provider transport config (M4.1 / K4 safety).
//
// Computes configuration per-call from environment or injected options.
// Pure, no import-time exceptions, no network calls, no model initialization.
//
// Mode hierarchy:
// - Default is 'aus'.
// - Explicit AI_MODE wins over legacy AZURE_* settings.
// - Missing AI_MODE falls back to complete legacy AZURE_* config as 'direkt'.
// - AI_* overrides legacy AZURE_*, even when explicitly empty string.
// - Legacy AZURE_DRY_RUN never enables automatic mock/success.
// - Operator gating AI_ACTIVATION_READY=1 and AI_MAIL_READY=1 are strictly immutable.
// - Region assertion is a supplementary technical guard, not an unqualified legal compliance guarantee.

/**
 * Verified Azure host allowlist (O-169 condition 3): exact host names, no wildcard, no env
 * override — a compromised centre must not be able to redirect masked text elsewhere.
 * Praxura resources (K-20). A new host needs a new image.
 * O-260 (27.11.2026): text/vision moved to `praxura-ai-resource` (Germany West Central, Data Zone EUR,
 * gpt-5-mini); transcription stays in Sweden Central (gpt-4o-transcribe has no Data Zone in Germany).
 */
export const VERIFIED_AZURE_HOSTS = Object.freeze([
  'kemal-mul58wcs-swedencentral.cognitiveservices.azure.com',
  'praxura-ai-resource.cognitiveservices.azure.com'
]);

/**
 * Parameter family of the text deployment. The deployment name says nothing about the model
 * (BYOK: a practice's own gpt-4o deployment may be called anything), so it is an explicit setting:
 * - 'standard'  → temperature + max_tokens (gpt-4o / gpt-4.1 family) — default, today's behaviour
 * - 'reasoning' → max_completion_tokens + reasoning_effort, no temperature (gpt-5 family)
 */
export const MODEL_FAMILIES = Object.freeze(['standard', 'reasoning']);
export const REASONING_EFFORTS = Object.freeze(['minimal', 'low', 'medium', 'high']);

/**
 * EU Data Boundary regions.
 * Technical supplementary assertion: rejects endpoints outside this set.
 * Does not constitute an independent legal DSGVO guarantee without appropriate contracts.
 */
export const EU_DATA_BOUNDARY_REGIONS = Object.freeze([
  'germanywestcentral',
  'westeurope',
  'northeurope',
  'francecentral',
  'swedencentral',
  'switzerlandnorth',
  'switzerlandwest',
  'norwayeast',
  'polandcentral',
  'italynorth',
  'spaincentral'
]);

const VALID_MODES = new Set(['aus', 'direkt', 'jeton']);

/**
 * Eigener Azure-Zugang der Praxis (Konsey 24.11.2026, KI-Stufe 2 Option D): nur Box, nur `.env`.
 * Greift ausschließlich bei AI_MODE=direkt UND AI_BYOK_ALLOWED=1 — nie auf dem Jeton-Weg.
 * Genau ein DNS-Label vor `.openai.azure.com` oder `.cognitiveservices.azure.com` (keine Unterdomänen,
 * kein Freitext-Host: guvenlik ⛔ SSRF). Die Region verrät der Hostname nicht → AI_REGION ist Pflicht.
 */
const RE_BYOK_HOST = /^[a-z0-9](?:[a-z0-9-]{0,62})\.(?:openai|cognitiveservices)\.azure\.com$/;
/** @param {string} hostname */
export function byokHostErlaubt(hostname) {
  return typeof hostname === 'string' && RE_BYOK_HOST.test(hostname.toLowerCase()) && !hostname.toLowerCase().includes('--');
}
// Azure deployment names may contain dots (gpt-4.1-mini); a leading dot and ".." stay out of the URL path.
export const RE_SAFE_SEGMENT = /^(?!.*\.\.)[a-zA-Z0-9_-][a-zA-Z0-9._-]{0,63}$/;
const RE_API_VERSION = /^\d{4}-\d{2}-\d{2}(-preview)?$/;
const RE_CONTROL_CHARS = /[\r\n\x00-\x1f\x7f]/;

/**
 * @param {object} obj
 * @param {string} key
 * @returns {boolean}
 */
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} aiKey
 * @param {string | null} legacyKey
 * @param {string} [fallback='']
 * @returns {string}
 */
function getEnvOverride(env, aiKey, legacyKey, fallback = '') {
  if (hasOwn(env, aiKey)) {
    return env[aiKey] !== undefined ? String(env[aiKey]) : '';
  }
  if (legacyKey && hasOwn(env, legacyKey)) {
    return env[legacyKey] !== undefined ? String(env[legacyKey]) : '';
  }
  return fallback;
}

/**
 * Validates endpoint URL strictly:
 * - HTTPS only
 * - No credentials (userinfo)
 * - No custom port except standard 443
 * - No query string or fragment
 * - Path must be root or empty
 * - Host must be in allowedHosts
 * - No CRLF or control characters
 *
 * @param {string} endpoint
 * @param {ReadonlyArray<string>} allowedHosts
 * @returns {{ok: boolean, code?: string, hostname?: string, cleanEndpoint?: string}}
 */
export function validateEndpointUrl(endpoint, allowedHosts = []) {
  if (!endpoint || typeof endpoint !== 'string') {
    return { ok: false, code: 'AI_ENDPOINT_EMPTY' };
  }
  if (RE_CONTROL_CHARS.test(endpoint)) {
    return { ok: false, code: 'AI_ENDPOINT_CONTROL_CHARS_FORBIDDEN' };
  }
  if (!/^https:\/\//i.test(endpoint)) {
    return { ok: false, code: 'AI_ENDPOINT_NOT_HTTPS' };
  }

  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    return { ok: false, code: 'AI_ENDPOINT_MALFORMED' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, code: 'AI_ENDPOINT_NOT_HTTPS' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, code: 'AI_ENDPOINT_USERINFO_FORBIDDEN' };
  }
  if (parsed.port && parsed.port !== '443') {
    return { ok: false, code: 'AI_ENDPOINT_PORT_FORBIDDEN' };
  }
  if (parsed.search) {
    return { ok: false, code: 'AI_ENDPOINT_QUERY_FORBIDDEN' };
  }
  if (parsed.hash) {
    return { ok: false, code: 'AI_ENDPOINT_HASH_FORBIDDEN' };
  }
  if (parsed.pathname !== '' && parsed.pathname !== '/') {
    return { ok: false, code: 'AI_ENDPOINT_PATH_FORBIDDEN' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname.length > 253 || RE_CONTROL_CHARS.test(hostname)) {
    return { ok: false, code: 'AI_ENDPOINT_MALFORMED' };
  }

  const hostList = Array.isArray(allowedHosts) ? allowedHosts : Array.from(allowedHosts || []);
  const isAllowed = hostList.some(h => String(h).toLowerCase() === hostname);

  if (!isAllowed) {
    return { ok: false, code: 'AI_HOST_NOT_ALLOWED', hostname };
  }

  return { ok: true, hostname, cleanEndpoint: `https://${hostname}` };
}

/**
 * @typedef {'aus' | 'direkt' | 'jeton'} AiMode
 */

/**
 * @typedef {{
 *   valid: boolean,
 *   code: string,
 *   mode: AiMode | (string & {}),
 *   provider: string,
 *   endpoint: string,
 *   apiKey: string,
 *   deployment: string,
 *   visionDeployment: string,
 *   transcribeDeployment: string,
 *   apiVersion: string,
 *   region: string,
 *   activationReady: boolean,
 *   mailReady: boolean,
 *   allowFreeText: boolean,
 *   allowedHosts: ReadonlyArray<string>,
 *   modelFamily?: 'standard' | 'reasoning',
 *   reasoningEffort?: string,
 *   transcribeEndpoint?: string,
 *   transcribeApiKey?: string,
 *   transcribeRegion?: string,
 *   transcribeAllowedHosts?: ReadonlyArray<string>,
 *   transcribeCode?: string
 * }} AiConfig
 */

/**
 * Creates and validates the AI configuration.
 *
 * @param {Record<string, string|undefined>} [env=process.env]
 * @param {{allowedHosts?: ReadonlyArray<string>}} [options]
 * @returns {AiConfig}
 */
export function createAiConfig(env = process.env, { allowedHosts = VERIFIED_AZURE_HOSTS } = {}) {
  const safeEnv = env || {};
  const normalizedHosts = Object.freeze(
    Array.isArray(allowedHosts) ? [...allowedHosts] : Array.from(allowedHosts || [])
  );

  // Operator gating
  const activationReady = safeEnv.AI_ACTIVATION_READY === '1';
  const mailReady = safeEnv.AI_MAIL_READY === '1';
  let allowFreeText = safeEnv.AI_ALLOW_FREETEXT === '1';

  // Provider
  let provider = 'azure';
  if (hasOwn(safeEnv, 'AI_PROVIDER')) {
    // Compose passes an empty AI_PROVIDER when unset; empty means the default, not "unknown".
    provider = String(safeEnv.AI_PROVIDER || '').trim().toLowerCase() || 'azure';
  }

  // Values with legacy fallback
  const endpoint = getEnvOverride(safeEnv, 'AI_ENDPOINT', 'AZURE_OPENAI_ENDPOINT', '');
  const apiKey = getEnvOverride(safeEnv, 'AI_API_KEY', 'AZURE_OPENAI_API_KEY', '');
  const deployment = getEnvOverride(safeEnv, 'AI_MODEL_TEXT', 'AZURE_OPENAI_DEPLOYMENT', 'gpt-4o-mini');
  const visionDeployment = getEnvOverride(safeEnv, 'AI_MODEL_VISION', null, '');
  const transcribeDeployment = getEnvOverride(safeEnv, 'AI_MODEL_TRANSCRIBE', null, '');
  const apiVersion = getEnvOverride(safeEnv, 'AI_API_VERSION', 'AZURE_OPENAI_API_VERSION', '2024-10-21');
  let region = getEnvOverride(safeEnv, 'AI_REGION', 'AZURE_OPENAI_REGION', '').trim().toLowerCase();
  const regionAusEnv = region;
  const modelFamilyRaw = String(safeEnv.AI_MODEL_FAMILY || '').trim().toLowerCase() || 'standard';
  const reasoningEffortRaw = String(safeEnv.AI_REASONING_EFFORT || '').trim().toLowerCase() || 'low';
  // Optional separate transcription resource (O-260). Empty → same resource as text (previous behaviour).
  const transcribeEndpointRaw = String(safeEnv.AI_TRANSCRIBE_ENDPOINT || '').trim();
  const transcribeApiKeyRaw = String(safeEnv.AI_TRANSCRIBE_API_KEY || '');
  const transcribeRegionRaw = String(safeEnv.AI_TRANSCRIBE_REGION || '').trim().toLowerCase();

  // Mode resolution
  /** @type {AiMode} */
  let mode;
  if (hasOwn(safeEnv, 'AI_MODE')) {
    const rawMode = String(safeEnv.AI_MODE || '').trim().toLowerCase();
    if (!VALID_MODES.has(rawMode)) {
      return {
        valid: false,
        code: 'AI_INVALID_MODE',
        mode: rawMode,
        provider,
        endpoint,
        apiKey,
        deployment,
        visionDeployment,
        transcribeDeployment,
        apiVersion,
        region,
        activationReady,
        mailReady,
      allowFreeText,
        allowedHosts: normalizedHosts
      };
    }
    mode = /** @type {AiMode} */ (rawMode);
  } else {
    // Missing AI_MODE: check if complete legacy AZURE_* config is available
    const legacyEndpoint = safeEnv.AZURE_OPENAI_ENDPOINT;
    const legacyApiKey = safeEnv.AZURE_OPENAI_API_KEY;
    const aiEndpointExplicit = hasOwn(safeEnv, 'AI_ENDPOINT');
    const aiKeyExplicit = hasOwn(safeEnv, 'AI_API_KEY');

    const effectiveEndpoint = aiEndpointExplicit ? safeEnv.AI_ENDPOINT : legacyEndpoint;
    const effectiveKey = aiKeyExplicit ? safeEnv.AI_API_KEY : legacyApiKey;

    if (effectiveEndpoint && effectiveKey) {
      mode = 'direkt';
    } else {
      mode = 'aus';
    }
  }

  // Fail-closed for unsupported provider
  if (provider !== 'azure') {
    return {
      valid: false,
      code: 'AI_UNSUPPORTED_PROVIDER',
      mode,
      provider,
      endpoint,
      apiKey,
      deployment,
      visionDeployment,
      transcribeDeployment,
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
    };
  }

  // Mode 'aus': safe failure / disabled state
  if (mode === 'aus') {
    return {
      valid: true,
      code: 'AI_MODE_AUS',
      mode: 'aus',
      provider,
      endpoint,
      apiKey,
      deployment,
      visionDeployment,
      transcribeDeployment,
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
    };
  }

  // Common checks for active modes ('direkt' and 'jeton')
  if (deployment && !RE_SAFE_SEGMENT.test(deployment)) {
    return {
      valid: false,
      code: 'AI_DEPLOYMENT_INVALID',
      mode,
      provider,
      endpoint,
      apiKey,
      deployment,
      visionDeployment,
      transcribeDeployment,
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
    };
  }

  if (transcribeDeployment && !RE_SAFE_SEGMENT.test(transcribeDeployment)) {
    return {
      valid: false,
      code: 'AI_DEPLOYMENT_INVALID',
      mode,
      provider,
      endpoint,
      apiKey,
      deployment,
      visionDeployment,
      transcribeDeployment,
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
    };
  }

  if (apiVersion && !RE_API_VERSION.test(apiVersion)) {
    return {
      valid: false,
      code: 'AI_API_VERSION_INVALID',
      mode,
      provider,
      endpoint,
      apiKey,
      deployment,
      visionDeployment,
      transcribeDeployment,
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
    };
  }

  if (apiKey && RE_CONTROL_CHARS.test(apiKey)) {
    return {
      valid: false,
      code: 'AI_API_KEY_INVALID',
      mode,
      provider,
      endpoint,
      apiKey,
      deployment,
      visionDeployment,
      transcribeDeployment,
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
    };
  }

  const familieUngueltig = !(/** @type {readonly string[]} */ (MODEL_FAMILIES)).includes(modelFamilyRaw);
  const effortUngueltig = !(/** @type {readonly string[]} */ (REASONING_EFFORTS)).includes(reasoningEffortRaw);
  if (familieUngueltig || effortUngueltig) {
    return {
      valid: false,
      code: familieUngueltig ? 'AI_MODEL_FAMILY_INVALID' : 'AI_REASONING_EFFORT_INVALID',
      mode,
      provider,
      endpoint,
      apiKey,
      deployment,
      visionDeployment,
      transcribeDeployment,
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
    };
  }
  const modelFamily = /** @type {'standard' | 'reasoning'} */ (modelFamilyRaw);
  const reasoningEffort = reasoningEffortRaw;

  // Jeton mode validation (endpoint/apiKey are supplied dynamically by token issuer)
  if (mode === 'jeton') {
    if (region && !EU_DATA_BOUNDARY_REGIONS.includes(region)) {
      return {
        valid: false,
        code: 'AI_INVALID_REGION',
        mode,
        provider,
        endpoint,
        apiKey,
        deployment,
        visionDeployment,
        transcribeDeployment,
        apiVersion,
        region,
        activationReady,
        mailReady,
      allowFreeText,
        allowedHosts: normalizedHosts
      };
    }

    return {
      valid: true,
      code: 'OK',
      mode: 'jeton',
      provider,
      endpoint,
      apiKey,
      deployment,
      visionDeployment,
      transcribeDeployment,
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts,
      modelFamily,
      reasoningEffort
    };
  }

  // Mode 'direkt' validation: requires local endpoint & apiKey
  if (!endpoint || !apiKey) {
    return {
      valid: false,
      code: 'AI_CONFIG_INCOMPLETE',
      mode,
      provider,
      endpoint,
      apiKey,
      deployment,
      visionDeployment,
      transcribeDeployment,
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
    };
  }

  // BYOK (Option D): eigener Host nur unter Betreiber-Schalter und nur im Modus direkt.
  let byokHost = null;
  // Nur Box: zusätzlich an den Box-Marker gekoppelt (SUPABASE_PUBLIC_URL nur in der Box, lib/dagitim.js istKutu) —
  // ein versehentlich auf dem SaaS-VPS gesetztes AI_BYOK_ALLOWED bleibt wirkungslos (Review Hauptsession 24.11.2026).
  const istBox = !!String(safeEnv.SUPABASE_PUBLIC_URL || '').trim();
  if (mode === 'direkt' && safeEnv.AI_BYOK_ALLOWED === '1' && istBox) {
    try {
      const h = new URL(String(endpoint)).hostname.toLowerCase();
      if (!normalizedHosts.some((x) => String(x).toLowerCase() === h) && byokHostErlaubt(h)) byokHost = h;
    } catch { /* ungültige URL prüft validateEndpointUrl */ }
  }
  // Nur Datenklasse A (Konsey 24.11.2026): mit eigenem Host nie Freitext, egal was AI_ALLOW_FREETEXT sagt.
  if (byokHost) allowFreeText = false;
  const endpointVal = validateEndpointUrl(endpoint, byokHost ? [...normalizedHosts, byokHost] : normalizedHosts);
  if (!endpointVal.ok) {
    return {
      valid: false,
      code: /** @type {string} */ (endpointVal.code),
      mode,
      provider,
      endpoint,
      apiKey,
      deployment,
      visionDeployment,
      transcribeDeployment,
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
    };
  }

  // Determine & validate EU region (eigener Host: nur ausdrückliche AI_REGION, nie aus dem Namen raten)
  if (byokHost) region = regionAusEnv;
  if (!region && !byokHost) {
    const lowerEndpoint = endpoint.toLowerCase();
    for (const r of EU_DATA_BOUNDARY_REGIONS) {
      if (lowerEndpoint.includes(r)) {
        region = r;
        break;
      }
    }
  }

  if (!region || !EU_DATA_BOUNDARY_REGIONS.includes(region)) {
    return {
      valid: false,
      code: 'AI_INVALID_REGION',
      mode,
      provider,
      endpoint: /** @type {string} */ (endpointVal.cleanEndpoint),
      apiKey,
      deployment,
      visionDeployment,
      transcribeDeployment,
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
    };
  }

  // Transcription target (O-260). Errors here only disable transcription (transcribeCode),
  // never the text assistant — a typo in the audio key must not take the mail assistant down.
  let transcribeEndpoint = /** @type {string} */ (endpointVal.cleanEndpoint);
  let transcribeApiKey = apiKey;
  let transcribeRegion = region;
  /** @type {ReadonlyArray<string>} */
  let transcribeAllowedHosts = byokHost ? [...normalizedHosts, byokHost] : normalizedHosts;
  let transcribeCode = 'OK';
  if (transcribeEndpointRaw) {
    let tHost = '';
    try { tHost = new URL(transcribeEndpointRaw).hostname.toLowerCase(); } catch { /* validateEndpointUrl meldet */ }
    const tByok = Boolean(byokHost) && tHost && !normalizedHosts.some((x) => String(x).toLowerCase() === tHost) && byokHostErlaubt(tHost);
    const tHosts = tByok ? [...normalizedHosts, tHost] : normalizedHosts;
    const tVal = validateEndpointUrl(transcribeEndpointRaw, tHosts);
    // Region never inherited from the text resource: explicit, else read from the host name (not for BYOK).
    let tRegion = transcribeRegionRaw;
    if (!tRegion && !tByok) tRegion = EU_DATA_BOUNDARY_REGIONS.find((r) => tHost.includes(r)) || '';
    if (!tVal.ok) {
      transcribeCode = tVal.code || 'AI_HOST_NOT_ALLOWED';
    } else if (!transcribeApiKeyRaw || RE_CONTROL_CHARS.test(transcribeApiKeyRaw)) {
      transcribeCode = 'AI_TRANSCRIBE_KEY_INVALID';
    } else if (!tRegion || !(/** @type {readonly string[]} */ (EU_DATA_BOUNDARY_REGIONS)).includes(tRegion)) {
      transcribeCode = 'AI_INVALID_REGION';
    } else {
      transcribeEndpoint = /** @type {string} */ (tVal.cleanEndpoint);
      transcribeApiKey = transcribeApiKeyRaw;
      transcribeRegion = tRegion;
      transcribeAllowedHosts = tHosts;
    }
    if (transcribeCode !== 'OK') {
      transcribeEndpoint = '';
      transcribeApiKey = '';
      transcribeRegion = '';
    }
  }

  return {
    valid: true,
    code: 'OK',
    mode: 'direkt',
    provider,
    endpoint: /** @type {string} */ (endpointVal.cleanEndpoint),
    apiKey,
    deployment,
    visionDeployment,
    transcribeDeployment,
    apiVersion,
    region,
    activationReady,
    mailReady,
      allowFreeText,
    allowedHosts: normalizedHosts,
    modelFamily,
    reasoningEffort,
    transcribeEndpoint,
    transcribeApiKey,
    transcribeRegion,
    transcribeAllowedHosts,
    transcribeCode
  };
}
/**
 * @param {AiConfig} [customConfig]
 * @returns {{
 *   valid: boolean,
 *   mode: string,
 *   code: string,
 *   provider: string,
 *   activationReady: boolean,
 *   mailReady: boolean,
 *   transcribeReady: boolean
 * }}
 */
export function healthSummary(customConfig) {
  const cfg = customConfig || createAiConfig();
  return {
    valid: cfg.valid,
    mode: cfg.mode,
    code: cfg.code,
    provider: cfg.provider,
    activationReady: cfg.activationReady,
    mailReady: cfg.mailReady,
    transcribeReady: Boolean(cfg.transcribeDeployment) && (cfg.transcribeCode === undefined || cfg.transcribeCode === 'OK')
  };
}
