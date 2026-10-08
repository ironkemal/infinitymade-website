// Comprehensive tests for ki-gateway.js (M4.1 / M4.3 / K4 safety).
//   node api-backend/ai/ki-gateway.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeKiTask } from './ki-gateway.js';
import { createFakeOwnerDecisionStore } from './ki-einwilligung.js';
import { createAiConfig } from './ki-config.js';
import { createConfirmationService } from './ki-rueckfrage.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-test-'));
const confirmationService = createConfirmationService({ secret: Buffer.alloc(32, 7), directory: tempDir });


const TENANT_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function makeValidAuth(tenantId = TENANT_1) {
  return {
    userId: tenantId,
    tenantId,
    role: 'owner'
  };
}

function makeReadyConfig(mode = 'direkt') {
  return createAiConfig({
    AI_MODE: mode,
    AI_ACTIVATION_READY: '1',
    AI_MAIL_READY: '1',
    AI_ENDPOINT: 'https://praxura-test.services.ai.azure.com',
    AI_API_KEY: 'test-key-12345',
    AI_REGION: 'swedencentral'
  }, { allowedHosts: ['praxura-test.services.ai.azure.com'] });
}

test('auszeroDIcalls: mode "aus" throws 503 and makes ZERO transport calls', async () => {
  let transportCalled = 0;
  const cfg = createAiConfig({ AI_MODE: 'aus' });

  await assert.rejects(
    async () => executeKiTask({
      task: 'b2c-draft',
      payload: { intent: 'Test' },
      context: { auth: makeValidAuth() },
      buildMessages: () => [{ role: 'user', content: 'test' }],
      validateOutput: () => true,
      dependencies: { dictionary: [],
        config: cfg,
        transport: async () => { transportCalled++; return {}; }
      }
    }),
    (err) => {
      assert.equal(err.code, 'AI_MODE_AUS');
      assert.equal(err.status, 503);
      return true;
    }
  );

  assert.equal(transportCalled, 0, 'Transport darf im Modus aus keinesfalls aufgerufen werden');
});

test('invalidcontext: missing or incomplete auth throws 401/403', async () => {
  await assert.rejects(
    async () => executeKiTask({
      task: 'b2c-draft',
      payload: { intent: 'Test' },
      context: {}, // missing auth
      buildMessages: () => [],
    validateOutput: () => true
    }),
    (err) => {
      assert.equal(err.code, 'KI_AUTH_REQUIRED');
      assert.equal(err.status, 401);
      return true;
    }
  );
});

test('client tenant in payload is rejected with 400 KI_SCHEMA', async () => {
  const cfg = makeReadyConfig();
  await assert.rejects(
    async () => executeKiTask({
      task: 'b2c-draft',
      payload: { intent: 'Test', tenant_id: 'attacker-tenant' },
      context: { auth: makeValidAuth() },
      buildMessages: () => [],
      validateOutput: () => true,
      dependencies: { dictionary: [], config: cfg }
    }),
    (err) => {
      assert.equal(err.code, 'KI_SCHEMA');
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test('ocr task is always 503 disabled', async () => {
  const cfg = makeReadyConfig();
  await assert.rejects(
    async () => executeKiTask({
      task: 'rezept-ocr',
      payload: {},
      context: { auth: makeValidAuth() },
      buildMessages: () => [],
      validateOutput: () => true,
      dependencies: { dictionary: [], config: cfg }
    }),
    (err) => {
      assert.equal(err.code, 'AI_OCR_DISABLED');
      assert.equal(err.status, 503);
      return true;
    }
  );
});

test('missing owner opt-in throws 503 AI_OWNER_OPTIN_REQUIRED', async () => {
  const cfg = makeReadyConfig();
  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: false });

  await assert.rejects(
    async () => executeKiTask({
      task: 'appointment-confirm-draft',
      payload: { slots: [{ date: '2026-10-15', time: '10:00' }] },
      context: { auth: makeValidAuth() },
      buildMessages: () => [],
      validateOutput: () => true,
      dependencies: { dictionary: [],
        config: cfg,
        ownerDecisionStore: ownerStore
      }
    }),
    (err) => {
      assert.equal(err.code, 'AI_OWNER_OPTIN_REQUIRED');
      assert.equal(err.status, 503);
      return true;
    }
  );
});

test('operator readiness gate (AI_ACTIVATION_READY=0) blocks with 503', async () => {
  const cfgNotReady = createAiConfig({
    AI_MODE: 'direkt',
    AI_ACTIVATION_READY: '0',
    AI_ENDPOINT: 'https://praxura-test.services.ai.azure.com',
    AI_API_KEY: 'test-key',
    AI_REGION: 'swedencentral'
  }, { allowedHosts: ['praxura-test.services.ai.azure.com'] });

  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });

  await assert.rejects(
    async () => executeKiTask({
      task: 'appointment-confirm-draft',
      payload: { slots: [{ date: '2026-10-15', time: '10:00' }] },
      context: { auth: makeValidAuth() },
      buildMessages: () => [],
      validateOutput: () => true,
      dependencies: { dictionary: [],
        config: cfgNotReady,
        ownerDecisionStore: ownerStore
      }
    }),
    (err) => {
      assert.equal(err.code, 'AI_NOT_ACTIVATED');
      assert.equal(err.status, 503);
      return true;
    }
  );
});

test('mailReady gate blocks mail draft tasks when false', async () => {
  const cfgMailNotReady = createAiConfig({
    AI_MODE: 'direkt',
    AI_ACTIVATION_READY: '1',
    AI_MAIL_READY: '0', // Mail not ready!
    AI_ENDPOINT: 'https://praxura-test.services.ai.azure.com',
    AI_API_KEY: 'test-key',
    AI_REGION: 'swedencentral'
  }, { allowedHosts: ['praxura-test.services.ai.azure.com'] });

  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });

  await assert.rejects(
    async () => executeKiTask({
      task: 'appointment-confirm-draft',
      payload: { slots: [{ date: '2026-10-15', time: '10:00' }] },
      context: { auth: makeValidAuth() },
      buildMessages: () => [],
      validateOutput: () => true,
      dependencies: { dictionary: [],
        config: cfgMailNotReady,
        ownerDecisionStore: ownerStore
      }
    }),
    (err) => {
      assert.equal(err.code, 'AI_MAIL_DISABLED');
      assert.equal(err.status, 503);
      return true;
    }
  );
});

test('jeton mode refuses B-freetext with 403 KI_FREITEXT_GESPERRT', async () => {
  const cfgJeton = createAiConfig({
    AI_MODE: 'jeton',
    AI_ACTIVATION_READY: '1',
    AI_MAIL_READY: '1',
    AI_REGION: 'swedencentral'
  });
  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });

  await assert.rejects(
    async () => executeKiTask({
      task: 'b2c-draft',
      payload: { intent: 'Freitext Auftrag' },
      context: { auth: makeValidAuth() },
      buildMessages: () => [],
      validateOutput: () => true,
      dependencies: { dictionary: [],
        config: cfgJeton,
        ownerDecisionStore: ownerStore
      }
    }),
    (err) => {
      assert.equal(err.code, 'KI_FREITEXT_GESPERRT');
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test('direct mode triggers 409 KI_RUECKFRAGE challenge on unconfirmed residual PII in freetext', async () => {
  const cfg = makeReadyConfig();
  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });

  await assert.rejects(
    async () => executeKiTask({
      task: 'b2c-draft',
      payload: {
        intent: 'Bitte Rückruf unter 987654321 veranlassen.'
      },
      context: { auth: makeValidAuth() },
      buildMessages: (p) => [{ role: 'user', content: p.intent }],
      validateOutput: () => true,
      dependencies: { dictionary: [],
        config: { ...cfg, allowFreeText: true },
        ownerDecisionStore: ownerStore,
        confirmationService
      }
    }),
    (err) => {
      assert.equal(err.code, 'KI_RUECKFRAGE');
      assert.equal(err.status, 409);
      assert.ok(err.challengeId);
      assert.ok(err.candidates?.length > 0);
      assert.equal(err.candidates[0].type, 'ZIFFERNFOLGE');
      return true;
    }
  );
});

test('end-to-end task execution: masking, transport, output validation, values-only unmasking', async () => {
  const cfg = makeReadyConfig();
  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });

  let sentMessages = null;
  const mockTransport = async ({ messages }) => {
    sentMessages = messages;
    // Simulate model using the received placeholder
    const userMsg = messages.find(m => m.role === 'user')?.content || '';

    const placeholderMatch = userMsg.match(/⟦NAME_[a-f0-9]{32}_\d+⟧/);
    const placeholder = placeholderMatch ? placeholderMatch[0] : '⟦NAME_fake_1⟧';

    return {
      content: JSON.stringify({
        subject: `Termin für ${placeholder}`,
        body: `Sehr geehrte/r ${placeholder}, Ihr Termin ist bestätigt.`
      }),
      usage: { prompt_tokens: 15, completion_tokens: 20, total_tokens: 35 },
      model: 'gpt-4o-mini',
      deployment: 'gpt-4o-mini',
      dry_run: false,
      latency_ms: 120
    };
  };

  const result = await executeKiTask({
    task: 'appointment-confirm-draft',
    payload: {
      slots: [{ date: '2026-10-15', time: '14:00', employeeName: 'Therapeut Max' }],
      patient: { name: 'Erika Musterfrau', email: 'erika@example.de' },
      service: { title: 'Physiotherapie', duration: 45 }
    },
    context: { auth: makeValidAuth() },
    buildMessages: (payload) => [
      { role: 'user', content: `Patient: ${payload.patient?.name}` }
    ],
    validateOutput: () => true, validateOutput_old: (parsed) => {
      assert.ok(parsed.subject);
      assert.ok(parsed.body);
      return true;
    },
    validateOutput: () => true,
    dependencies: { dictionary: [],
      config: cfg,
      ownerDecisionStore: ownerStore,
      transport: mockTransport,
      confirmationService
    }
  });

  // 1. Assert cleartext name was NOT sent to transport
  assert.ok(!sentMessages[0].content.includes('Erika Musterfrau'));
  assert.ok(/⟦NAME_[a-f0-9]+_\d+⟧/.test(sentMessages[0].content));

  // 2. Assert restored output contains unmasked name in VALUES
  assert.equal(result.output.subject, 'Termin für Erika Musterfrau');
  assert.equal(result.output.body, 'Sehr geehrte/r Erika Musterfrau, Ihr Termin ist bestätigt.');

  // 3. Assert meta shape
  assert.deepEqual(result.meta.usage, { prompt_tokens: 15, completion_tokens: 20, total_tokens: 35 });
  assert.equal(result.meta.dry_run, false);
});

test('output scan fails closed with 502 KI_ANTWORT_UNGUELTIG if model leaks cleartext KVNR', async () => {
  const cfg = makeReadyConfig();
  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });

  const leakTransport = async () => ({
    content: JSON.stringify({
      subject: 'Termin',
      body: 'Geleakte KVNR: A123456789' // Raw KVNR in response!
    }),
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    model: 'gpt-4o-mini',
    deployment: 'gpt-4o-mini',
    dry_run: false,
    latency_ms: 50
  });

  await assert.rejects(
    async () => executeKiTask({
      task: 'appointment-confirm-draft',
      payload: {
        slots: [{ date: '2026-10-15', time: '14:00' }],
        patient: { name: 'Patient X' }
      },
      context: { auth: makeValidAuth() },
      buildMessages: () => [{ role: 'user', content: 'Test' }],
      validateOutput: () => true,
      dependencies: { dictionary: [],
        config: cfg,
        ownerDecisionStore: ownerStore,
        transport: leakTransport
      }
    }),
    (err) => {
      assert.equal(err.code, 'KI_ANTWORT_UNGUELTIG');
      assert.equal(err.status, 502);
      assert.equal(err.message, 'KI-Antwort enthält unzulässige Daten');
      return true;
    }
  );
});

test('parallel tasks from different tenants have isolated nonces and maps', async () => {
  const cfg = makeReadyConfig();
  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });

  const nonces = [];
  const captureTransport = async ({ messages }) => {
    const content = messages[0].content;
    const match = content.match(/⟦NAME_([a-f0-9]+)_1⟧/);
    if (match) nonces.push(match[1]);
    return {
      content: JSON.stringify({ result: 'ok' }),
      usage: {},
      model: 'test',
      deployment: 'test',
      dry_run: false,
      latency_ms: 10
    };
  };

  await Promise.all([
    executeKiTask({
      task: 'appointment-confirm-draft',
      payload: { slots: [{ date: '2026-10-15', time: '10:00' }], patient: { name: 'Hans' } },
      context: { auth: makeValidAuth(TENANT_1) },
      buildMessages: (p) => [{ role: 'user', content: `Name: ${p.patient.name}` }],
      validateOutput: () => true,
      dependencies: { dictionary: [], config: cfg, ownerDecisionStore: ownerStore, transport: captureTransport }
    }),
    executeKiTask({
      task: 'appointment-confirm-draft',
      payload: { slots: [{ date: '2026-10-15', time: '11:00' }], patient: { name: 'Peter' } },
      context: { auth: makeValidAuth(TENANT_2) },
      buildMessages: (p) => [{ role: 'user', content: `Name: ${p.patient.name}` }],
      validateOutput: () => true,
      dependencies: { dictionary: [], config: cfg, ownerDecisionStore: ownerStore, transport: captureTransport }
    })
  ]);

  assert.equal(nonces.length, 2);
  assert.notEqual(nonces[0], nonces[1], 'Parallele Mandantenaufrufe müssen getrennte Nonces haben');
});

test('confirmation flow: ki_confirmation resolves challenge and executes task', async () => {
  const cfg = makeReadyConfig();
  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });

  const payloadInitial = {
    intent: 'Bitte Rückruf unter 987654321 veranlassen.'
  };

  // 1. First call fails with 409 KI_RUECKFRAGE and gives challenge
  let challengeId = null;
  let candidateId = null;
  try {
    await executeKiTask({
      task: 'b2c-draft',
      payload: payloadInitial,
      context: { auth: makeValidAuth() },
      buildMessages: (p) => [{ role: 'user', content: p.intent }],
      validateOutput: () => true,
      dependencies: { dictionary: [],
        config: { ...cfg, allowFreeText: true },
        ownerDecisionStore: ownerStore,
        confirmationService
      }
    });
  } catch (err) {
    assert.equal(err.code, 'KI_RUECKFRAGE');
    challengeId = err.challengeId;
    candidateId = err.candidates[0].id;
  }

  assert.ok(challengeId);
  assert.ok(candidateId);

  // 2. Second call with ki_confirmation succeeds
  const payloadConfirmed = {
    ...payloadInitial,
    ki_confirmation: {
      challengeId,
      choices: [{ id: candidateId, action: 'maskieren' }]
    }
  };

  const mockTransport = async (opts) => {
    // Find the placeholder for "Erika Musterfrau" from the masked prompt
    const content = opts.messages[0].content;
    const match = content.match(/⟦NAME_[a-f0-9]{32}_\d+⟧/);
    const placeholder = match ? match[0] : '⟦NAME_fake_1⟧';
    return {
      content: JSON.stringify({
        subject: 'Bestätigt'
      }),
      model: 'gpt-4o-mini',
      deployment: 'test-dep',
      usage: { total_tokens: 42 },
      dry_run: false,
      latency_ms: 150
    };
  };



  const res = await executeKiTask({
    task: 'b2c-draft',
    payload: payloadConfirmed,
    context: { auth: makeValidAuth() },
    buildMessages: (p) => [{ role: 'user', content: p.intent }],
    validateOutput: () => true,
    dependencies: { dictionary: [],
        config: { ...cfg, allowFreeText: true },
        ownerDecisionStore: ownerStore,
        transport: mockTransport,
        confirmationService
      }
  });

  assert.equal(res.output.subject, 'Bestätigt');
});

test('series-scheduler: opaque employee token mapping and back-conversion', async () => {
  const cfg = makeReadyConfig('jeton');
  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });

  const realEmpUuid = '99999999-9999-4999-8999-999999999999';
  let modelReceivedMessages = null;

  const mockTransport = async ({ messages }) => {
    modelReceivedMessages = messages;
    const content = messages[0].content;
    const empMatch = content.match(/⟦EMP_[a-f0-9]+_\d+⟧/);
    const empPlaceholder = empMatch ? empMatch[0] : '⟦EMP_missing⟧';
    const nameMatch = content.match(/⟦NAME_[a-f0-9]+_\d+⟧/);
    const namePlaceholder = nameMatch ? nameMatch[0] : '⟦NAME_missing⟧';

    return {
      content: JSON.stringify({
        selected: [{ date: '2026-10-15', time: '10:00', employeeId: empPlaceholder }],
        report: `Serie geplant für ${namePlaceholder}`
      }),
      usage: { prompt_tokens: 20, completion_tokens: 20, total_tokens: 40 },
      model: 'gpt-4o-mini',
      deployment: 'gpt-4o-mini',
      dry_run: false,
      latency_ms: 150
    };
  };

  const payload = {
    count: 1,
    recurrence: 'weekly',
    targetDates: ['2026-10-15'],
    candidates: [{ date: '2026-10-15', time: '10:00', employeeId: realEmpUuid }],
    employees: [{ id: realEmpUuid, name: 'Therapeut Hans' }],
    customer: { name: 'Patient Max' }
  };

  const res = await executeKiTask({
    task: 'series-scheduler',
    payload,
    context: { auth: makeValidAuth() },
    buildMessages: (p) => {
      return [{ role: 'user', content: `Slot bei Mitarbeiter ${p.employees[0].id} für ${p.customer.name}` }];
    },
    validateOutput: () => true,
    dependencies: { dictionary: [],
      config: cfg,
      ownerDecisionStore: ownerStore,
      transport: mockTransport,
      confirmationService
    }
  });

  // Verify real UUID was NOT in prompt
  assert.ok(!modelReceivedMessages[0].content.includes(realEmpUuid));

  // Verify restored result mapped opaque token back to real UUID
  assert.equal(res.output.selected[0].employeeId, realEmpUuid);
  assert.equal(res.output.selected[0].date, '2026-10-15');
});

test('handles JSON quotes, newlines, and unicode safely in values', async () => {
  const cfg = makeReadyConfig();
  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });

  const mockTransport = async () => ({
    content: JSON.stringify({
      subject: 'Termin "Spezial" & Zubehör',
      body: 'Zeile 1\nZeile 2 mit Umlauten: äöüß\n"Anführungszeichen"'
    }),
    usage: {},
    model: 'gpt-4o-mini',
    deployment: 'gpt-4o-mini',
    dry_run: false,
    latency_ms: 50
  });

  const res = await executeKiTask({
    task: 'appointment-confirm-draft',
    payload: {
      slots: [{ date: '2026-10-15', time: '10:00' }]
    },
    context: { auth: makeValidAuth() },
    buildMessages: () => [{ role: 'user', content: 'Prompt' }],
    validateOutput: () => true,
    dependencies: { dictionary: [],
      config: cfg,
      ownerDecisionStore: ownerStore,
      transport: mockTransport,
      confirmationService
    }
  });

  assert.equal(res.output.subject, 'Termin "Spezial" & Zubehör');
  assert.ok(res.output.body.includes('Zeile 1\nZeile 2'));
  assert.ok(res.output.body.includes('äöüß'));
});

test('adversarial: type shifting - object instead of string for intent is rejected with 400 KI_SCHEMA', async () => {
  const cfg = makeReadyConfig();
  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });
  await assert.rejects(
    async () => executeKiTask({
      task: 'b2c-draft',
      payload: { intent: { smuggled: 'data' } },
      context: { auth: makeValidAuth() },
      buildMessages: () => [],
      validateOutput: () => true,
      dependencies: { dictionary: [], config: cfg, ownerDecisionStore: ownerStore }
    }),
    (err) => {
      assert.equal(err.code, 'KI_SCHEMA');
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test('adversarial: type shifting - array instead of string for patient.name is rejected with 400 KI_SCHEMA', async () => {
  const cfg = makeReadyConfig();
  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });
  await assert.rejects(
    async () => executeKiTask({
      task: 'appointment-confirm-draft',
      payload: {
        slots: [{ date: '2026-10-15', time: '14:00' }],
        patient: { name: ['Erika', 'Musterfrau'] }
      },
      context: { auth: makeValidAuth() },
      buildMessages: () => [],
      validateOutput: () => true,
      dependencies: { dictionary: [], config: cfg, ownerDecisionStore: ownerStore }
    }),
    (err) => {
      assert.equal(err.code, 'KI_SCHEMA');
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test('adversarial: freetext with unapproved PII triggers KI_RUECKFRAGE before transport', async () => {
  const cfg = makeReadyConfig();
  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });

  await assert.rejects(
    async () => executeKiTask({
      task: 'b2c-draft',
      payload: { intent: 'Therapie, bitte Rückruf unter 987654321' }, // Unmasked digit sequence pattern
      context: { auth: makeValidAuth() },
      buildMessages: (p) => [{ role: 'user', content: p.intent }],
      validateOutput: () => true,
      dependencies: { dictionary: [],
        config: { ...cfg, allowFreeText: true },
        ownerDecisionStore: ownerStore,
        confirmationService
      }
    }),
    (err) => {
      assert.equal(err.code, 'KI_RUECKFRAGE');
      assert.equal(err.status, 409);
      assert.ok(err.candidates?.some(c => c.text === '987654321'));
      return true;
    }
  );
});

test('adversarial: deeply nested unexpected fields are rejected by schema', async () => {
  const cfg = makeReadyConfig();
  const ownerStore = createFakeOwnerDecisionStore({ defaultEnabled: true });
  await assert.rejects(
    async () => executeKiTask({
      task: 'appointment-confirm-draft',
      payload: {
        slots: [{ date: '2026-10-15', time: '14:00', employeeName: 'Max' }],
        unexpectedRoot: { deep: 'value' }
      },
      context: { auth: makeValidAuth() },
      buildMessages: () => [],
      validateOutput: () => true,
      dependencies: { dictionary: [], config: cfg, ownerDecisionStore: ownerStore }
    }),
    (err) => {
      assert.equal(err.code, 'KI_SCHEMA');
      assert.equal(err.status, 400);
      assert.ok(err.message.includes('Unbekannte Eigenschaft'));
      return true;
    }
  );
});


function syntheticAppointment(overrides = {}) {
  return {
    task: 'appointment-confirm-draft', payload: {
      slots: [{ date: '2026-10-15', time: '14:00', employeeId: 'private-employee', employeeName: 'Private Clinician' }],
      patient: { name: 'Private Patient', email: 'private@example.test', phone: '022411234567' },
      service: { title: 'Private Patient Einzel', duration: 30 },
      owner_info: { business_name: 'Private Praxis', sender_name: 'Private Owner', city: 'Private City', phone: '022419876543', sector: 'physiotherapy' }
    }, context: { auth: makeValidAuth() },
    buildMessages: p => [{ role: 'user', content: JSON.stringify(p) }],
    validateOutput: p => Object.keys(p).length === 1 && p.ok === true,
    dependencies: { dictionary: [], config: makeReadyConfig(), ownerDecision: { enabled: true }, transport: async () => ({ content: '{"ok":true}' }) },
    ...overrides
  };
}

test('every private appointment leaf opaque before prompt; original payload unchanged', async () => {
  const params = syntheticAppointment();
  const original = JSON.stringify(params.payload);
  params.dependencies.transport = async ({ messages, jetonClient }) => {
    const prompt = JSON.stringify(messages);
    for (const raw of ['2026-10-15', '14:00', 'private-employee', 'Private Clinician', 'Private Patient', 'private@example.test', '022411234567', 'Private Praxis', 'Private Owner', 'Private City', '022419876543']) assert.ok(!prompt.includes(raw), raw);
    assert.equal(jetonClient, undefined, 'direct mode never initializes Jeton');
    return { content: '{"ok":true}' };
  };
  await executeKiTask(params);
  assert.equal(JSON.stringify(params.payload), original);
});

test('operator revoked during dictionary await blocks transport', async () => {
  const params = syntheticAppointment(); let cfg = makeReadyConfig(); let calls = 0;
  params.dependencies = { configProvider: () => cfg, ownerDecision: { enabled: true }, loadDictionary: async () => { cfg = { ...cfg, activationReady: false }; return []; }, transport: async () => { calls++; return { content: '{"ok":true}' }; } };
  await assert.rejects(executeKiTask(params), e => e.code === 'AI_MODE_AUS');
  assert.equal(calls, 0);
});

test('owner revoked during asynchronous operator refresh blocks transport', async () => {
  const params = syntheticAppointment(); let enabled = true; let configs = 0; let calls = 0;
  params.dependencies = { dictionary: [], configProvider: async () => { if (++configs === 2) enabled = false; return makeReadyConfig(); }, ownerDecisionStore: { read: async () => ({ enabled }) }, transport: async () => { calls++; return { content: '{"ok":true}' }; } };
  await assert.rejects(executeKiTask(params), e => e.code === 'AI_OWNER_OPTIN_REQUIRED');
  assert.equal(calls, 0);
});

test('output validation cannot whitelist invented token through mutable map', async () => {
  const params = syntheticAppointment();
  const forged = '⟦VALUE_ffffffffffffffffffffffffffffffff_999⟧';
  params.dependencies.transport = async () => ({ content: JSON.stringify({ ok: forged }) });
  params.validateOutput = (_out, { maskMap }) => { assert.ok(Object.isFrozen(maskMap)); assert.throws(() => { maskMap[forged] = 'Secret'; }, TypeError); return true; };
  await assert.rejects(executeKiTask(params), e => e.code === 'KI_ANTWORT_UNGUELTIG');
});

test('output raw email, address, dictionary name and malformed or token keys blocked', async () => {
  for (const output of [{ ok: 'private@example.test' }, { ok: '53721 Siegburg' }, { ok: 'Private Patient' }, { ok: '⟦broken' }, { '⟦VALUE_ffffffffffffffffffffffffffffffff_1⟧': true }]) {
    const params = syntheticAppointment(); params.validateOutput = () => true;
    params.dependencies.transport = async () => ({ content: JSON.stringify(output) });
    await assert.rejects(executeKiTask(params), e => e.code === 'KI_ANTWORT_UNGUELTIG');
  }
});

test('series preferred employee uses same opaque employee reference', async () => {
  const params = syntheticAppointment({ task: 'series-scheduler', payload: { count: 1, targetDates: ['2026-10-15'], emptyDates: [], candidates: [{ date: '2026-10-15', time: '14:00', employeeId: 'private-employee', bucket: 0 }], employees: [{ id: 'private-employee', name: 'Private Clinician' }], preferences: { preferredEmployee: 'private-employee' }, customer: { id: 'private-patient', name: 'Private Patient' } } });
  params.buildMessages = p => { assert.equal(p.preferences.preferredEmployee, p.candidates[0].employeeId); assert.equal(p.preferences.preferredEmployee, p.employees[0].id); assert.match(p.preferences.preferredEmployee, /^⟦EMP_[a-f0-9]{32}_1⟧$/); assert.notEqual(p.customer.id, 'private-patient'); assert.equal(p.targetDates[0], '2026-10-15'); return [{ role: 'user', content: JSON.stringify(p) }]; };
  await executeKiTask(params);
});

test('missing production dictionary fails closed instead of empty fallback', async () => {
  const params = syntheticAppointment(); delete params.dependencies.dictionary;
  let calls = 0; params.dependencies.transport = async () => { calls++; return { content: '{"ok":true}' }; };
  await assert.rejects(executeKiTask(params), e => e.code === 'KI_WOERTERBUCH_FEHLER');
  assert.equal(calls, 0);
});


test('gateway rejects multimodal image payload before transport', async () => {
  const params = syntheticAppointment(); let calls = 0;
  params.buildMessages = () => [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,SYNTHETIC' } }] }];
  params.dependencies.transport = async () => { calls++; return { content: '{"ok":true}' }; };
  await assert.rejects(executeKiTask(params), e => e.code === 'KI_SCHEMA');
  assert.equal(calls, 0);
});


test('actual driver rechecks owner and operator after asynchronous token acquisition', async () => {
  for (const revoked of ['owner', 'operator']) {
    const params = syntheticAppointment(); let enabled = true; let cfg = makeReadyConfig('jeton'); let providerCalls = 0; let tokenCalls = 0;
    params.dependencies = {
      dictionary: [], configProvider: () => cfg,
      ownerDecisionStore: { read: async () => ({ enabled }) },
      jetonClient: { getToken: async () => {
        tokenCalls++; await Promise.resolve();
        if (revoked === 'owner') enabled = false; else cfg = { ...cfg, activationReady: false };
        return { token: 'SYNTHETIC_TOKEN_1234567890', exp: Math.floor(Date.now() / 1000) + 1800, endpoint: 'https://praxura-test.services.ai.azure.com', deployment: 'gpt-4o-mini', region: 'swedencentral', apiVersion: '2024-10-21' }; // secret-scan: ignore — synthetic test token, no credential
      } }
    };
    params.chatOptions = { fetchImpl: async () => { providerCalls++; throw new Error('Synthetic provider must not be called after revocation'); } };
    await assert.rejects(executeKiTask(params), e => e.code === (revoked === 'owner' ? 'AI_OWNER_OPTIN_REQUIRED' : 'AI_MODE_AUS'));
    assert.equal(tokenCalls, 1); assert.equal(providerCalls, 0);
  }
});


test('explicit direct normalize freetext joins same confirmation gate before transport', async () => {
  const params = syntheticAppointment({ task: 'rezept-normalize', payload: { rezept: { heilmittel_feld_text: 'Bitte Rückruf unter 987654321 veranlassen.' }, heilmittel_positionen: [] } });
  params.dependencies.config = { ...makeReadyConfig(), allowFreeText: true };
  params.dependencies.confirmationService = confirmationService;
  let calls = 0; params.dependencies.transport = async () => { calls++; return { content: '{"ok":true}' }; };
  await assert.rejects(executeKiTask(params), e => e.code === 'KI_RUECKFRAGE' && e.status === 409 && e.candidates.length === 1);
  assert.equal(calls, 0);
});
