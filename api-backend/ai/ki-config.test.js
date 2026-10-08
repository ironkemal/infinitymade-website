import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAiConfig,
  validateEndpointUrl,
  VERIFIED_AZURE_HOSTS,
  EU_DATA_BOUNDARY_REGIONS
} from './ki-config.js';

test('import-safe: VERIFIED_AZURE_HOSTS is frozen empty array, no production endpoints invented', () => {
  assert.ok(Object.isFrozen(VERIFIED_AZURE_HOSTS));
  assert.equal(VERIFIED_AZURE_HOSTS.length, 0);
  assert.ok(Array.isArray(EU_DATA_BOUNDARY_REGIONS));
  assert.ok(EU_DATA_BOUNDARY_REGIONS.includes('germanywestcentral'));
});

test('defaultaus: empty env defaults to mode aus without throwing', () => {
  const cfg = createAiConfig({});
  assert.equal(cfg.mode, 'aus');
  assert.equal(cfg.valid, true);
  assert.equal(cfg.code, 'AI_MODE_AUS');
  assert.equal(cfg.activationReady, false);
  assert.equal(cfg.mailReady, false);
});

test('legacy-explicitoff: explicit AI_MODE=aus wins over complete legacy AZURE configuration', () => {
  const env = {
    AI_MODE: 'aus',
    AZURE_OPENAI_ENDPOINT: 'https://legacy-host.openai.azure.com',
    AZURE_OPENAI_API_KEY: 'test-key',
    AZURE_OPENAI_DEPLOYMENT: 'gpt-4o',
    AZURE_OPENAI_REGION: 'germanywestcentral',
    AI_ACTIVATION_READY: '1'
  };
  const cfg = createAiConfig(env, { allowedHosts: ['legacy-host.openai.azure.com'] });
  assert.equal(cfg.mode, 'aus');
  assert.equal(cfg.valid, true);
  assert.equal(cfg.code, 'AI_MODE_AUS');
  assert.equal(cfg.activationReady, true);
});

test('direct fallback: missing AI_MODE uses complete legacy AZURE_* config as direkt', () => {
  const env = {
    AZURE_OPENAI_ENDPOINT: 'https://legacy-host.openai.azure.com',
    AZURE_OPENAI_API_KEY: 'test-key',
    AZURE_OPENAI_DEPLOYMENT: 'gpt-4o-mini',
    AZURE_OPENAI_REGION: 'germanywestcentral',
    AI_ACTIVATION_READY: '1'
  };
  const cfg = createAiConfig(env, { allowedHosts: ['legacy-host.openai.azure.com'] });
  assert.equal(cfg.mode, 'direkt');
  assert.equal(cfg.valid, true);
  assert.equal(cfg.code, 'OK');
  assert.equal(cfg.apiKey, 'test-key');
  assert.equal(cfg.endpoint, 'https://legacy-host.openai.azure.com');
  assert.equal(cfg.region, 'germanywestcentral');
  assert.equal(cfg.activationReady, true);
});

test('direct fallback incomplete: missing legacy key leaves mode aus', () => {
  const env = {
    AZURE_OPENAI_ENDPOINT: 'https://legacy-host.openai.azure.com'
    // missing AZURE_OPENAI_API_KEY
  };
  const cfg = createAiConfig(env, { allowedHosts: ['legacy-host.openai.azure.com'] });
  assert.equal(cfg.mode, 'aus');
});

test('override: explicitly present AI_* overrides legacy even when empty string', () => {
  const env = {
    AZURE_OPENAI_ENDPOINT: 'https://legacy-host.openai.azure.com',
    AZURE_OPENAI_API_KEY: 'legacy-key',
    AI_ENDPOINT: '', // explicit empty overrides legacy
    AI_ACTIVATION_READY: '1'
  };
  // Without AI_ENDPOINT, legacy would have been complete -> mode direkt.
  // With AI_ENDPOINT='', endpoint is empty -> incomplete -> mode aus
  const cfg = createAiConfig(env);
  assert.equal(cfg.mode, 'aus');
  assert.equal(cfg.endpoint, '');
});

test('invalid-mode: unknown mode fails closed', () => {
  const cfg = createAiConfig({ AI_MODE: 'invalid_mode' });
  assert.equal(cfg.valid, false);
  assert.equal(cfg.code, 'AI_INVALID_MODE');
  assert.equal(cfg.mode, 'invalid_mode');
});

test('unsupported-provider: provider other than azure fails closed', () => {
  const cfg = createAiConfig({
    AI_MODE: 'direkt',
    AI_PROVIDER: 'bedrock',
    AI_ENDPOINT: 'https://host.openai.azure.com',
    AI_API_KEY: 'key'
  });
  assert.equal(cfg.valid, false);
  assert.equal(cfg.code, 'AI_UNSUPPORTED_PROVIDER');
});

test('jeton mode: valid without local apiKey/endpoint', () => {
  const cfg = createAiConfig({
    AI_MODE: 'jeton',
    AI_ACTIVATION_READY: '1',
    AI_REGION: 'germanywestcentral'
  });
  assert.equal(cfg.mode, 'jeton');
  assert.equal(cfg.valid, true);
  assert.equal(cfg.code, 'OK');
  assert.equal(cfg.activationReady, true);
});

test('jeton mode: invalid region fails closed', () => {
  const cfg = createAiConfig({
    AI_MODE: 'jeton',
    AI_REGION: 'eastus'
  });
  assert.equal(cfg.valid, false);
  assert.equal(cfg.code, 'AI_INVALID_REGION');
});

test('hosturlnegative: validateEndpointUrl enforces strict constraints', () => {
  const allowed = ['valid-host.openai.azure.com'];

  // Not HTTPS
  assert.equal(validateEndpointUrl('http://valid-host.openai.azure.com', allowed).code, 'AI_ENDPOINT_NOT_HTTPS');

  // Userinfo forbidden
  assert.equal(validateEndpointUrl('https://user:pass@valid-host.openai.azure.com', allowed).code, 'AI_ENDPOINT_USERINFO_FORBIDDEN');

  // Port forbidden (only 443 permitted)
  assert.equal(validateEndpointUrl('https://valid-host.openai.azure.com:8443', allowed).code, 'AI_ENDPOINT_PORT_FORBIDDEN');

  // Query forbidden
  assert.equal(validateEndpointUrl('https://valid-host.openai.azure.com/?key=val', allowed).code, 'AI_ENDPOINT_QUERY_FORBIDDEN');

  // Hash forbidden
  assert.equal(validateEndpointUrl('https://valid-host.openai.azure.com/#fragment', allowed).code, 'AI_ENDPOINT_HASH_FORBIDDEN');

  // Path forbidden (must be empty or /)
  assert.equal(validateEndpointUrl('https://valid-host.openai.azure.com/openai/deployments', allowed).code, 'AI_ENDPOINT_PATH_FORBIDDEN');

  // Host not in allowlist
  assert.equal(validateEndpointUrl('https://unknown-host.openai.azure.com', allowed).code, 'AI_HOST_NOT_ALLOWED');

  // Valid HTTPS host in allowlist with standard or explicit 443 port
  const valid1 = validateEndpointUrl('https://valid-host.openai.azure.com', allowed);
  assert.equal(valid1.ok, true);
  assert.equal(valid1.cleanEndpoint, 'https://valid-host.openai.azure.com');

  const valid2 = validateEndpointUrl('https://valid-host.openai.azure.com:443/', allowed);
  assert.equal(valid2.ok, true);
  assert.equal(valid2.cleanEndpoint, 'https://valid-host.openai.azure.com');
});

test('region: direct mode rejects non-EU regions', () => {
  const env = {
    AI_MODE: 'direkt',
    AI_ENDPOINT: 'https://my-host.openai.azure.com',
    AI_API_KEY: 'test-key',
    AI_REGION: 'us-west-2'
  };
  const cfg = createAiConfig(env, { allowedHosts: ['my-host.openai.azure.com'] });
  assert.equal(cfg.valid, false);
  assert.equal(cfg.code, 'AI_INVALID_REGION');
});

test('region: direct mode infers EU region from Foundry-style host when region unset', () => {
  const env = {
    AI_MODE: 'direkt',
    AI_ENDPOINT: 'https://praxura-swedencentral.services.ai.azure.com',
    AI_API_KEY: 'test-key'
  };
  const cfg = createAiConfig(env, { allowedHosts: ['praxura-swedencentral.services.ai.azure.com'] });
  assert.equal(cfg.valid, true);
  assert.equal(cfg.region, 'swedencentral');
});

test('operator gating: activationReady and mailReady strictly read from AI_* env vars', () => {
  const cfg1 = createAiConfig({
    AI_ACTIVATION_READY: '1',
    AI_MAIL_READY: '1'
  });
  assert.equal(cfg1.activationReady, true);
  assert.equal(cfg1.mailReady, true);

  const cfg2 = createAiConfig({
    AI_ACTIVATION_READY: '0',
    AI_MAIL_READY: 'false'
  });
  assert.equal(cfg2.activationReady, false);
  assert.equal(cfg2.mailReady, false);
});

test('control characters: apiKey or endpoint with CRLF fails closed', () => {
  const env = {
    AI_MODE: 'direkt',
    AI_ENDPOINT: 'https://valid-host.openai.azure.com\r\ninjection',
    AI_API_KEY: 'valid-key',
    AI_REGION: 'germanywestcentral'
  };
  const cfg1 = createAiConfig(env, { allowedHosts: ['valid-host.openai.azure.com'] });
  assert.equal(cfg1.valid, false);

  const envKey = {
    AI_MODE: 'direkt',
    AI_ENDPOINT: 'https://valid-host.openai.azure.com',
    AI_API_KEY: 'key\r\nX-Injected: true',
    AI_REGION: 'germanywestcentral'
  };
  const cfg2 = createAiConfig(envKey, { allowedHosts: ['valid-host.openai.azure.com'] });
  assert.equal(cfg2.valid, false);
  assert.equal(cfg2.code, 'AI_API_KEY_INVALID');
});
