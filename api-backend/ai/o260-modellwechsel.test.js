// O-260 (27.11.2026): gpt-5-mini (reasoning-Familie) + getrennte Transkriptions-Ressource.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiConfig, healthSummary } from './ki-config.js';
import { chat, transcribe, knownModel } from './azureClient.js';

const TEXT = 'https://praxura-ai-resource.cognitiveservices.azure.com/';
const SE = 'https://kemal-mul58wcs-swedencentral.cognitiveservices.azure.com/';
const basis = {
  AI_MODE: 'direkt', AI_ACTIVATION_READY: '1', AI_ENDPOINT: TEXT, AI_API_KEY: 'text-key',
  AI_MODEL_TEXT: 'gpt-5-mini', AI_REGION: 'germanywestcentral', AI_API_VERSION: '2025-03-01-preview',
  AI_MODEL_TRANSCRIBE: 'gpt-4o-transcribe'
};

/** @param {Record<string, unknown>} json */
function fakeFetch(json, calls) {
  return async (url, init) => {
    calls.push({ url, init });
    return { status: 200, ok: true, headers: new Map(), json: async () => json, text: async () => JSON.stringify(json) };
  };
}
const okChat = { model: 'gpt-5-mini-2025-08-07', choices: [{ message: { content: 'Hallo' }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 70, total_tokens: 75 } };

test('Familie: Standard bleibt Default (heutiges Verhalten), ungültige Werte fail-closed', () => {
  assert.equal(createAiConfig(basis).modelFamily, 'standard');
  assert.equal(createAiConfig({ ...basis, AI_MODEL_FAMILY: 'reasoning' }).modelFamily, 'reasoning');
  assert.equal(createAiConfig({ ...basis, AI_MODEL_FAMILY: 'gpt5' }).code, 'AI_MODEL_FAMILY_INVALID');
  assert.equal(createAiConfig({ ...basis, AI_REASONING_EFFORT: 'extrem' }).code, 'AI_REASONING_EFFORT_INVALID');
  assert.equal(createAiConfig({ ...basis, AI_MODEL_FAMILY: 'reasoning' }).reasoningEffort, 'low');
});

test('Neue Text-Ressource: Host erlaubt, Region aus AI_REGION (Name verrät sie nicht)', () => {
  const cfg = createAiConfig(basis);
  assert.equal(cfg.valid, true, cfg.code);
  assert.equal(cfg.region, 'germanywestcentral');
  assert.equal(createAiConfig({ ...basis, AI_REGION: '' }).code, 'AI_INVALID_REGION');
});

test('chat reasoning: max_completion_tokens mit Reserve, reasoning_effort, keine temperature', async () => {
  const calls = [];
  const cfg = createAiConfig({ ...basis, AI_MODEL_FAMILY: 'reasoning' });
  const r = await chat({ messages: [{ role: 'user', content: 'Hi' }], maxTokens: 5, config: cfg, fetchImpl: fakeFetch(okChat, calls) });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.max_completion_tokens, 5 + 2048);
  assert.equal(body.reasoning_effort, 'low');
  assert.equal('temperature' in body, false);
  assert.equal('max_tokens' in body, false);
  assert.match(calls[0].url, /praxura-ai-resource\.cognitiveservices\.azure\.com\/openai\/deployments\/gpt-5-mini\//);
  assert.equal(r.model, 'gpt-5-mini');
});

test('chat standard: temperature + max_tokens wie bisher', async () => {
  const calls = [];
  const cfg = createAiConfig(basis);
  await chat({ messages: [{ role: 'user', content: 'Hi' }], maxTokens: 300, temperature: 0.3, config: cfg, fetchImpl: fakeFetch(okChat, calls) });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.max_tokens, 300);
  assert.equal(body.temperature, 0.3);
  assert.equal('max_completion_tokens' in body, false);
});

test('knownModel: Datumssuffix weg, Unbekanntes null', () => {
  assert.equal(knownModel('gpt-5-mini-2025-08-07'), 'gpt-5-mini');
  assert.equal(knownModel('gpt-4.1-mini'), 'gpt-4.1-mini');
  assert.equal(knownModel('evil/../x'), null);
});

test('Transkription ohne eigene Ressource: wie bisher Text-Endpunkt + Text-Key', async () => {
  const calls = [];
  const cfg = createAiConfig(basis);
  assert.equal(cfg.transcribeCode, 'OK');
  await transcribe({ audioBuffer: Buffer.from('x'), config: cfg, fetchImpl: fakeFetch({ text: 'ok' }, calls) });
  assert.match(calls[0].url, /^https:\/\/praxura-ai-resource\./);
  assert.equal(calls[0].init.headers['api-key'], 'text-key');
});

test('Transkription getrennt: eigener Endpunkt, eigener Key, Region aus eigenem Host (nicht geerbt)', async () => {
  const calls = [];
  const cfg = createAiConfig({ ...basis, AI_TRANSCRIBE_ENDPOINT: SE, AI_TRANSCRIBE_API_KEY: 'se-key' });
  assert.equal(cfg.transcribeCode, 'OK');
  assert.equal(cfg.transcribeRegion, 'swedencentral');
  assert.equal(cfg.region, 'germanywestcentral');
  const r = await transcribe({ audioBuffer: Buffer.from('x'), config: cfg, fetchImpl: fakeFetch({ text: 'Diktat' }, calls) });
  assert.match(calls[0].url, /^https:\/\/kemal-mul58wcs-swedencentral\.cognitiveservices\.azure\.com\/openai\/deployments\/gpt-4o-transcribe\/audio\/transcriptions/);
  assert.equal(calls[0].init.headers['api-key'], 'se-key');
  assert.equal(r.text, 'Diktat');
});

test('Transkription falsch konfiguriert: nur Transkription aus, Text-Assistent bleibt gültig', async () => {
  for (const [env, code] of [
    [{ AI_TRANSCRIBE_ENDPOINT: SE }, 'AI_TRANSCRIBE_KEY_INVALID'],
    [{ AI_TRANSCRIBE_ENDPOINT: 'https://fremd.openai.azure.com/', AI_TRANSCRIBE_API_KEY: 'k' }, 'AI_HOST_NOT_ALLOWED'],
    [{ AI_TRANSCRIBE_ENDPOINT: SE, AI_TRANSCRIBE_API_KEY: 'k', AI_TRANSCRIBE_REGION: 'eastus' }, 'AI_INVALID_REGION']
  ]) {
    const cfg = createAiConfig({ ...basis, ...env });
    assert.equal(cfg.valid, true);
    assert.equal(cfg.transcribeCode, code);
    assert.equal(healthSummary(cfg).transcribeReady, false);
    const calls = [];
    await assert.rejects(transcribe({ audioBuffer: Buffer.from('x'), config: cfg, fetchImpl: fakeFetch({ text: 'x' }, calls) }), (e) => e.code === code);
    assert.equal(calls.length, 0, 'kein Netzwerk bei Fehlkonfiguration');
  }
});

// ── Jeton-Weg (Box): Zentrum schickt Transkriptions-Ressource + Modellfamilie mit ──
import { createJetonClient } from './ki-jeton.js';
const HOSTS = ['praxura-ai-resource.cognitiveservices.azure.com', 'kemal-mul58wcs-swedencentral.cognitiveservices.azure.com'];
const NOW = Date.now(); // azureClient prüft die Restlaufzeit gegen die echte Uhr
function jetonPayload(extra = {}) {
  return {
    token: 'sample-valid-token-value-12345', // secret-scan: ignore
    exp: Math.floor(NOW / 1000) + 1800, endpoint: TEXT, deployment: 'gpt-5-mini',
    deploymentTranscribe: 'gpt-4o-transcribe', region: 'germanywestcentral', apiVersion: '2025-03-01-preview', ...extra
  };
}
function jetonClient(payload) {
  return createJetonClient({
    config: createAiConfig({ AI_MODE: 'jeton', AI_ACTIVATION_READY: '1', AI_REGION: 'germanywestcentral' }, { allowedHosts: HOSTS }),
    merkezFetchImpl: async () => ({ status: 200, ok: true, json: payload }), now: () => NOW, allowedHosts: HOSTS
  });
}

test('Jeton: endpointTranscribe/regionTranscribe/modelFamily optional — altes Zentrum bleibt kompatibel', async () => {
  const alt = await jetonClient(jetonPayload()).getToken();
  assert.equal(alt.endpointTranscribe, null);
  assert.equal(alt.modelFamily, null);
  const neu = await jetonClient(jetonPayload({ endpointTranscribe: SE, regionTranscribe: 'swedencentral', modelFamily: 'reasoning' })).getToken();
  assert.equal(neu.endpointTranscribe, 'https://kemal-mul58wcs-swedencentral.cognitiveservices.azure.com');
  assert.equal(neu.regionTranscribe, 'swedencentral');
  assert.equal(neu.modelFamily, 'reasoning');
});

test('Jeton: fremder Transkriptions-Host, Nicht-EU-Region, unbekannte Familie → fail-closed', async () => {
  for (const [extra, code] of [
    [{ endpointTranscribe: 'https://boese.openai.azure.com/', regionTranscribe: 'swedencentral' }, 'AI_HOST_NOT_ALLOWED'],
    [{ endpointTranscribe: SE, regionTranscribe: 'eastus' }, 'AI_INVALID_REGION'],
    [{ endpointTranscribe: SE }, 'AI_INVALID_REGION'],
    [{ modelFamily: 'gpt5' }, 'AI_MODEL_FAMILY_INVALID']
  ]) {
    await assert.rejects(jetonClient(jetonPayload(extra)).getToken(), (e) => e.code === code, JSON.stringify(extra));
  }
});

test('Jeton: Chat nimmt Familie vom Zentrum, Transkription geht an die eigene Ressource', async () => {
  const cfg = createAiConfig({ AI_MODE: 'jeton', AI_ACTIVATION_READY: '1', AI_REGION: 'germanywestcentral' }, { allowedHosts: HOSTS });
  const jc = jetonClient(jetonPayload({ endpointTranscribe: SE, regionTranscribe: 'swedencentral', modelFamily: 'reasoning' }));
  const calls = [];
  await chat({ messages: [{ role: 'user', content: 'Hi' }], config: cfg, jetonClient: jc, fetchImpl: fakeFetch(okChat, calls) });
  const body = JSON.parse(calls[0].init.body);
  assert.equal('temperature' in body, false);
  assert.ok(body.max_completion_tokens > 0);
  assert.match(calls[0].url, /^https:\/\/praxura-ai-resource\./);
  await transcribe({ audioBuffer: Buffer.from('x'), config: cfg, jetonClient: jc, fetchImpl: fakeFetch({ text: 'ok' }, calls) });
  assert.match(calls[1].url, /^https:\/\/kemal-mul58wcs-swedencentral\..*gpt-4o-transcribe\/audio\/transcriptions/);
  assert.match(calls[1].init.headers.Authorization, /^Bearer /);
});
