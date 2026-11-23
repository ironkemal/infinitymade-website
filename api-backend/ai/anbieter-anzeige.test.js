// Phase 7b KI-Stufe 1 (23.11.2026): GET /api/ai/_config zeigt Anbieter + Region nur lesend —
// nie Host, Endpunkt oder Deployment (guvenlik: kein Hinweis auf Infrastruktur, kein SSRF-Orakel).
import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-unused-key';
const { anbieterAnzeige } = await import('./router.js');

test('anbieterAnzeige: aus → nichts; direkt/jeton → Name + Region, EU erkannt', () => {
  assert.equal(anbieterAnzeige({ mode: 'aus', provider: 'azure', region: 'swedencentral' }), null);
  assert.equal(anbieterAnzeige(null), null);
  const a = anbieterAnzeige({ mode: 'direkt', provider: 'azure', region: 'swedencentral', endpoint: 'https://geheim.openai.azure.com', deployment: 'gpt-x', apiKey: 'k' });
  assert.deepEqual(a, { name: 'Microsoft Azure OpenAI', region: 'swedencentral', euRegion: true });
  assert.equal(JSON.stringify(a).includes('geheim'), false);
  assert.equal(anbieterAnzeige({ mode: 'jeton', provider: 'azure', region: 'eastus' }).euRegion, false);
});

test('anbieterAnzeige: ungültige Region wird verworfen, unbekannter Anbieter neutral benannt', () => {
  assert.equal(anbieterAnzeige({ mode: 'direkt', provider: 'azure', region: '<b>x</b>' }).region, null);
  assert.equal(anbieterAnzeige({ mode: 'direkt', provider: 'irgendwas', region: 'swedencentral' }).name, 'Unbekannter Anbieter');
});
