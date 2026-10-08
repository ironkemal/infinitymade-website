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
 * Verified Azure host allowlist.
 * Empty by default in compliance with K4: no invented production endpoint.
 * Production endpoints must be explicitly configured and approved.
 */
export const VERIFIED_AZURE_HOSTS = Object.freeze([]);

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
const RE_SAFE_SEGMENT = /^[a-zA-Z0-9_-]{1,64}$/;
const RE_API_VERSION = /^\d{4}-\d{2}-\d{2}(-preview)?$/;
const RE_CONTROL_CHARS = /[\r\n\x00-\x1f\x7f]/;

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

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
 * Creates and validates the AI configuration.
 *
 * @param {Record<string, string|undefined>} [env=process.env]
 * @param {{allowedHosts?: ReadonlyArray<string>}} [options]
 * @returns {{
 *   valid: boolean,
 *   code: string,
 *   mode: 'aus'|'direkt'|'jeton',
 *   provider: string,
 *   endpoint: string,
 *   apiKey: string,
 *   deployment: string,
 *   visionDeployment: string,
 *   apiVersion: string,
 *   region: string,
 *   activationReady: boolean,
 *   mailReady: boolean,
 *   allowedHosts: ReadonlyArray<string>
 * }}
 */
export function createAiConfig(env = process.env, { allowedHosts = VERIFIED_AZURE_HOSTS } = {}) {
  const safeEnv = env || {};
  const normalizedHosts = Object.freeze(
    Array.isArray(allowedHosts) ? [...allowedHosts] : Array.from(allowedHosts || [])
  );

  // Operator gating
  const activationReady = safeEnv.AI_ACTIVATION_READY === '1';
  const mailReady = safeEnv.AI_MAIL_READY === '1';
  const allowFreeText = safeEnv.AI_ALLOW_FREETEXT === '1';

  // Provider
  let provider = 'azure';
  if (hasOwn(safeEnv, 'AI_PROVIDER')) {
    provider = String(safeEnv.AI_PROVIDER || '').trim().toLowerCase();
  }

  // Values with legacy fallback
  const endpoint = getEnvOverride(safeEnv, 'AI_ENDPOINT', 'AZURE_OPENAI_ENDPOINT', '');
  const apiKey = getEnvOverride(safeEnv, 'AI_API_KEY', 'AZURE_OPENAI_API_KEY', '');
  const deployment = getEnvOverride(safeEnv, 'AI_MODEL_TEXT', 'AZURE_OPENAI_DEPLOYMENT', 'gpt-4o-mini');
  const visionDeployment = getEnvOverride(safeEnv, 'AI_MODEL_VISION', null, '');
  const apiVersion = getEnvOverride(safeEnv, 'AI_API_VERSION', 'AZURE_OPENAI_API_VERSION', '2024-10-21');
  let region = getEnvOverride(safeEnv, 'AI_REGION', 'AZURE_OPENAI_REGION', '').trim().toLowerCase();

  // Mode resolution
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
        apiVersion,
        region,
        activationReady,
        mailReady,
      allowFreeText,
        allowedHosts: normalizedHosts
      };
    }
    mode = rawMode;
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
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
    };
  }

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
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
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
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
    };
  }

  const endpointVal = validateEndpointUrl(endpoint, normalizedHosts);
  if (!endpointVal.ok) {
    return {
      valid: false,
      code: endpointVal.code,
      mode,
      provider,
      endpoint,
      apiKey,
      deployment,
      visionDeployment,
      apiVersion,
      region,
      activationReady,
      mailReady,
      allowFreeText,
      allowedHosts: normalizedHosts
    };
  }

  // Determine & validate EU region
  if (!region) {
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
      endpoint: endpointVal.cleanEndpoint,
      apiKey,
      deployment,
      visionDeployment,
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
    mode: 'direkt',
    provider,
    endpoint: endpointVal.cleanEndpoint,
    apiKey,
    deployment,
    visionDeployment,
    apiVersion,
    region,
    activationReady,
    mailReady,
      allowFreeText,
    allowedHosts: normalizedHosts
  };
}
export function healthSummary(customConfig) {
  const cfg = customConfig || createAiConfig();
  return {
    valid: cfg.valid,
    mode: cfg.mode,
    code: cfg.code,
    provider: cfg.provider,
    activationReady: cfg.activationReady,
    mailReady: cfg.mailReady
  };
}
