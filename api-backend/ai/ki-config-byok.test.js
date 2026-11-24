// KI-Stufe 2 Option D (Konsey 24.11.2026): eigener Azure-Zugang nur unter Betreiber-Schalter, nur direkt, nur EU.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiConfig, byokHostErlaubt, VERIFIED_AZURE_HOSTS } from './ki-config.js';

const basis = { AI_MODE: 'direkt', AI_API_KEY: 'synthetisch-nicht-echt', AI_MODEL_TEXT: 'gpt-4o-mini', AI_API_VERSION: '2024-10-21', SUPABASE_PUBLIC_URL: 'https://box.example.invalid' };
const eigen = 'https://praxis-muster.openai.azure.com';

test('ohne Betreiber-Schalter: eigener Host abgelehnt, Praxura-Host weiter gültig', () => {
  assert.equal(createAiConfig({ ...basis, AI_ENDPOINT: eigen, AI_REGION: 'swedencentral' }).code, 'AI_HOST_NOT_ALLOWED');
  const pr = createAiConfig({ ...basis, AI_ENDPOINT: `https://${VERIFIED_AZURE_HOSTS[0]}` });
  assert.equal(pr.valid, true, pr.code);
});

test('mit Schalter + direkt + ausdrücklicher EU-Region: gültig, Endpunkt bereinigt', () => {
  const c = createAiConfig({ ...basis, AI_BYOK_ALLOWED: '1', AI_ENDPOINT: eigen, AI_REGION: 'germanywestcentral' });
  assert.equal(c.valid, true, c.code);
  assert.equal(c.endpoint, eigen);
  assert.equal(c.region, 'germanywestcentral');
  const cs = createAiConfig({ ...basis, AI_BYOK_ALLOWED: '1', AI_ENDPOINT: 'https://praxis-1.cognitiveservices.azure.com', AI_REGION: 'swedencentral' });
  assert.equal(cs.valid, true, cs.code);
});

test('eigener Host: Region nie aus dem Namen raten, Nicht-EU abgelehnt', () => {
  assert.equal(createAiConfig({ ...basis, AI_BYOK_ALLOWED: '1', AI_ENDPOINT: 'https://swedencentral-praxis.openai.azure.com' }).code, 'AI_INVALID_REGION');
  assert.equal(createAiConfig({ ...basis, AI_BYOK_ALLOWED: '1', AI_ENDPOINT: eigen, AI_REGION: 'eastus' }).code, 'AI_INVALID_REGION');
});

test('Jeton-Weg bleibt unberührt: Schalter ändert die Jeton-Konfiguration nicht, Aussteller-Host nur feste Liste', async () => {
  // Im Jeton-Modus kommt der Endpunkt vom Jeton-Aussteller, nicht aus der .env (vorhandenes Verhalten).
  const ohne = createAiConfig({ ...basis, AI_MODE: 'jeton', AI_ENDPOINT: eigen, AI_REGION: 'swedencentral' });
  const mit = createAiConfig({ ...basis, AI_MODE: 'jeton', AI_BYOK_ALLOWED: '1', AI_ENDPOINT: eigen, AI_REGION: 'swedencentral' });
  assert.deepEqual(mit, ohne);
  const fs = await import('node:fs');
  const jeton = fs.readFileSync(new URL('./ki-jeton.js', import.meta.url), 'utf8');
  assert.equal(/byok/i.test(jeton), false, 'ki-jeton.js darf die BYOK-Regel nicht kennen');
});

test('Umgehungsversuche bleiben gesperrt', () => {
  for (const ep of ['https://a.b.openai.azure.com', 'https://x.openai.azure.com.evil.example', 'https://openai.azure.com', 'https://x.openai.azure.net',
    'https://praxis.openai.azure.com:8443', 'https://u:p@praxis.openai.azure.com', 'https://praxis.openai.azure.com/pfad', 'http://praxis.openai.azure.com',
    'https://-praxis.openai.azure.com', 'https://pra--xis.openai.azure.com', 'https://169.254.169.254', 'https://localhost']) {
    const c = createAiConfig({ ...basis, AI_BYOK_ALLOWED: '1', AI_ENDPOINT: ep, AI_REGION: 'swedencentral' });
    assert.notEqual(c.valid, true, ep);
  }
  assert.equal(byokHostErlaubt('praxis.openai.azure.com'), true);
  assert.equal(byokHostErlaubt('PRAXIS.cognitiveservices.azure.com'), true);
  assert.equal(byokHostErlaubt('a.b.openai.azure.com'), false);
  assert.equal(byokHostErlaubt(''), false);
});

test('nur Box: ohne Box-Marker (SaaS) bleibt der eigene Host gesperrt, auch mit Schalter', () => {
  const saas = { ...basis }; delete saas.SUPABASE_PUBLIC_URL;
  assert.equal(createAiConfig({ ...saas, AI_BYOK_ALLOWED: '1', AI_ENDPOINT: eigen, AI_REGION: 'swedencentral' }).code, 'AI_HOST_NOT_ALLOWED');
});

test('nur Datenklasse A: mit eigenem Host nie Freitext, Praxura-Host behält die Betreiber-Einstellung', () => {
  const c = createAiConfig({ ...basis, AI_BYOK_ALLOWED: '1', AI_ALLOW_FREETEXT: '1', AI_ENDPOINT: eigen, AI_REGION: 'swedencentral' });
  assert.equal(c.valid, true, c.code); assert.equal(c.allowFreeText, false);
  const pr = createAiConfig({ ...basis, AI_ALLOW_FREETEXT: '1', AI_ENDPOINT: `https://${VERIFIED_AZURE_HOSTS[0]}` });
  assert.equal(pr.allowFreeText, true);
});
