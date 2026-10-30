// K4: Freitext im Jeton-Modus, ganzer Weg durch die Box-Seite — echter Task, echtes Gateway,
// echte Maske, echter Jeton-Client, echtes azureClient. Nur Zentrum und Azure sind Attrappen.
//   node --test api-backend/ai/k4-jeton-freitext.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiConfig } from './ki-config.js';
import { createJetonClient } from './ki-jeton.js';
import { createFakeOwnerDecisionStore } from './ki-einwilligung.js';
import { chat } from './azureClient.js';
import { run as b2cDraft } from './tasks/b2c-draft.js';

const HOST = 'test-swedencentral.cognitiveservices.azure.com';
const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ENV = { AI_MODE: 'jeton', AI_PROVIDER: '', AI_ACTIVATION_READY: '1', AI_MAIL_READY: '1', AI_ALLOW_FREETEXT: '1' };

function aufbau(env = ENV) {
  const config = createAiConfig(env, { allowedHosts: [HOST] });
  const zentrum = [];
  const azure = [];
  const jetonClient = createJetonClient({
    configProvider: () => config,
    merkezFetchImpl: async (pfad, opts) => {
      zentrum.push({ pfad, body: opts.body });
      return { ok: true, status: 200, json: {
        token: 'kurzzeit-jeton-1234', exp: Math.floor(Date.now() / 1000) + 3000,
        endpoint: `https://${HOST}/`, deployment: 'praxura-box', region: 'swedencentral', apiVersion: '2024-10-21'
      } };
    }
  });
  const fetchImpl = async (url, opts) => {
    azure.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
    return new Response(JSON.stringify({
      model: 'test', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      choices: [{ message: { content: JSON.stringify({ to_name: null, to_email: null, subject: 'Termin', body: 'Guten Tag' }) } }]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const context = { auth: { userId: TENANT, tenantId: TENANT, role: 'owner' }, dependencies: {
    config, jetonClient, dictionary: [], ownerDecisionStore: createFakeOwnerDecisionStore({ defaultEnabled: true }),
    confirmationService: { createChallenge: () => ({ challengeId: 'x', expiresAt: 1, candidates: [] }) },
    transport: (opts) => chat({ ...opts, fetchImpl })
  } };
  return { zentrum, azure, context };
}

test('Jeton vom Zentrum, Azure bekommt nur Maskiertes, das Zentrum sieht keinen Inhalt', async () => {
  const { zentrum, azure, context } = aufbau();
  const res = await b2cDraft({
    intent: 'Bitte Zoë Mustermann wegen ihrer Knieschmerzen einen neuen Termin anbieten.',
    contacts: [{ id: 'c1', name: 'Zoë Mustermann', email: 'zoe@example.invalid', phone: '0171 1234567' }],
    owner_info: { business_name: 'Musterpraxis' }
  }, context);
  assert.equal(res.draft.subject, 'Termin');

  assert.equal(azure.length, 1);
  assert.equal(new URL(azure[0].url).hostname, HOST);
  assert.equal(azure[0].headers.Authorization, 'Bearer kurzzeit-jeton-1234');
  assert.equal(azure[0].headers['api-key'], undefined);
  assert.equal(azure[0].body.store, false);
  const prompt = JSON.stringify(azure[0].body.messages);
  for (const klartext of ['Mustermann', 'Zoë', 'zoe@example.invalid', '1234567', 'Musterpraxis']) {
    assert.ok(!prompt.includes(klartext), `${klartext} darf nicht zu Azure`);
  }

  assert.equal(zentrum.length, 1);
  assert.equal(zentrum[0].pfad, '/v1/ki/jeton');
  const anZentrum = JSON.stringify(zentrum[0].body);
  for (const inhalt of ['Knieschmerzen', 'Mustermann', 'intent', 'messages']) {
    assert.ok(!anZentrum.includes(inhalt), `${inhalt} darf nicht zum Zentrum`);
  }
});

test('Unbekannte Ziffernfolge im Freitext: 409 Rückfrage vor Jeton und Azure', async () => {
  const { zentrum, azure, context } = aufbau();
  await assert.rejects(
    b2cDraft({ intent: 'Bitte Rückruf unter 987654321 veranlassen.' }, context),
    { code: 'KI_RUECKFRAGE', status: 409 }
  );
  assert.equal(zentrum.length, 0);
  assert.equal(azure.length, 0);
});

test('Ohne AI_ALLOW_FREETEXT bleibt der Mail-Entwurf zu, kein Jeton, kein Azure', async () => {
  const { zentrum, azure, context } = aufbau({ ...ENV, AI_ALLOW_FREETEXT: '0' });
  await assert.rejects(b2cDraft({ intent: 'Bitte Entwurf' }, context), { code: 'KI_FREITEXT_GESPERRT' });
  assert.equal(zentrum.length, 0);
  assert.equal(azure.length, 0);
});

test('Foto-OCR bleibt auch mit Freitext-Freigabe zu', async () => {
  const { run } = await import('./tasks/rezept-ocr.js');
  const { zentrum, azure, context } = aufbau();
  await assert.rejects(run({ image_base64: 'x' }, context), { code: 'AI_OCR_DISABLED' });
  assert.equal(zentrum.length, 0);
  assert.equal(azure.length, 0);
});
