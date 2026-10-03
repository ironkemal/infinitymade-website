import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createPendingGuard } from './rechnung-speichern.js';

const dashboardUrl = new URL('../dashboard.js', import.meta.url);
const dashboardContent = fs.readFileSync(dashboardUrl, 'utf8');

function extractSaveInvoiceDeclaration(src) {
  const guardStart = src.indexOf('const invoiceSaveGuard');
  if (guardStart !== -1) {
    const fnStart = src.indexOf('async function saveInvoice', guardStart);
    if (fnStart !== -1) {
      const openBrace = src.indexOf('{', fnStart);
      let depth = 1;
      let inString = null;
      let inComment = false;
      for (let i = openBrace + 1; i < src.length; i++) {
        const char = src[i];
        const prev = src[i - 1];
        if (inComment) {
          if (inComment === 'line' && char === '\n') inComment = false;
          else if (inComment === 'block' && prev === '*' && char === '/') inComment = false;
          continue;
        }
        if (inString) {
          if (char === inString && prev !== '\\') inString = null;
          continue;
        }
        if (char === '/' && src[i + 1] === '/') { inComment = 'line'; i++; continue; }
        if (char === '/' && src[i + 1] === '*') { inComment = 'block'; i++; continue; }
        if (char === "'" || char === '"' || char === '`') { inString = char; continue; }
        if (char === '{') depth++;
        else if (char === '}') {
          depth--;
          if (depth === 0) {
            return src.slice(guardStart, i + 1);
          }
        }
      }
    }
  }

  const fnMatch = src.match(/async\s+function\s+saveInvoice\s*\([^)]*\)\s*\{/);
  if (fnMatch) {
    const startIndex = fnMatch.index;
    const openBrace = src.indexOf('{', startIndex);
    let depth = 1;
    let inString = null;
    let inComment = false;
    for (let i = openBrace + 1; i < src.length; i++) {
      const char = src[i];
      const prev = src[i - 1];
      if (inComment) {
        if (inComment === 'line' && char === '\n') inComment = false;
        else if (inComment === 'block' && prev === '*' && char === '/') inComment = false;
        continue;
      }
      if (inString) {
        if (char === inString && prev !== '\\') inString = null;
        continue;
      }
      if (char === '/' && src[i + 1] === '/') { inComment = 'line'; i++; continue; }
      if (char === '/' && src[i + 1] === '*') { inComment = 'block'; i++; continue; }
      if (char === "'" || char === '"' || char === '`') { inString = char; continue; }
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          return src.slice(startIndex, i + 1);
        }
      }
    }
  }
  throw new Error('Could not find saveInvoice declaration in dashboard.js');
}

const extractedDeclaration = extractSaveInvoiceDeclaration(dashboardContent);

function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createTestEnvironment(customMocks = {}) {
  const domElements = {
    invPatientSelect: {
      id: 'invPatientSelect',
      value: 'patient-synthetic-1',
      selectedIndex: 0,
      options: [{ value: 'patient-synthetic-1', text: 'Erika Mustermann' }]
    },
    invEigenPct: { id: 'invEigenPct', value: '10' },
    invKasse: { id: 'invKasse', value: '45.00' },
    invNotes: { id: 'invNotes', value: 'Synthetic test invoice notes' },
    invPrintBtn: { id: 'invPrintBtn', disabled: true },
    invDmrzBtn: { id: 'invDmrzBtn', disabled: true },
    invSaveBtn: { id: 'invSaveBtn', disabled: customMocks.initialSaveBtnDisabled ?? false }
  };

  if (customMocks.dom) {
    Object.assign(domElements, customMocks.dom);
  }

  const documentMock = {
    getElementById(id) {
      return domElements[id] || null;
    }
  };

  const insertCalls = [];
  const updateCalls = [];
  let insertDeferred = customMocks.insertDeferred || null;
  let updateDeferred = customMocks.updateDeferred || null;
  let insertResult = customMocks.insertResult !== undefined
    ? customMocks.insertResult
    : { data: { id: 'inv-synth-999', invoice_number: 'RE-2026-0001' }, error: null };
  let updateResult = customMocks.updateResult !== undefined
    ? customMocks.updateResult
    : { data: { id: 'inv-synth-999', invoice_number: 'RE-2026-0001' }, error: null };

  const supabaseMock = {
    insertCalls,
    updateCalls,
    auth: {
      async getSession() {
        return { data: { session: { access_token: 'synthetic-jwt-token' } }, error: null };
      }
    },
    from(tableName) {
      return {
        insert(payload) {
          insertCalls.push(payload);
          return {
            select(fields) {
              return {
                maybeSingle() {
                  if (insertDeferred) {
                    return insertDeferred.promise.then(() => insertResult);
                  }
                  return Promise.resolve(insertResult);
                }
              };
            }
          };
        },
        update(payload) {
          let targetId = null;
          return {
            eq(col, val) {
              targetId = val;
              updateCalls.push({ payload, col, val });
              return {
                select(fields) {
                  return {
                    maybeSingle() {
                      if (updateDeferred) {
                        return updateDeferred.promise.then(() => updateResult);
                      }
                      return Promise.resolve(updateResult);
                    }
                  };
                }
              };
            }
          };
        }
      };
    }
  };

  const toastCalls = [];
  const consoleErrors = [];
  const behandlungenVerknuepfenCalls = [];
  const zahlungsartCalls = [];
  let loadRechnungenCalls = 0;
  const openInvViewCalls = [];
  const zeigeRechnungsModusCalls = [];

  const windowObj = {
    _currentInvoiceId: customMocks.initialInvoiceId || null
  };

  const sandbox = {
    createPendingGuard,
    document: documentMock,
    window: windowObj,
    supabase: supabaseMock,
    console: {
      log() {},
      warn() {},
      error(...args) { consoleErrors.push(args); }
    },
    showToast(msg, type = 'info') {
      toastCalls.push({ msg, type });
    },
    invLines: customMocks.invLines !== undefined
      ? customMocks.invLines
      : [{ name: 'Physiotherapie', quantity: 2, unit_price: 35.5 }],
    invPatientInsuranceType: customMocks.invPatientInsuranceType || 'gesetzlich',
    invPrescriptionId: customMocks.invPrescriptionId || null,
    invVerordnungId: customMocks.invVerordnungId || null,
    invBehandlungIds: customMocks.invBehandlungIds || ['beh-101'],
    currentProfile: {
      steuernummer: '99/888/7777',
      ust_id: 'DE999888777'
    },
    API: 'https://api.praxura.synthetic',
    kassiereZuzahlung() {},
    aggregateInvLines: customMocks.aggregateInvLines || ((lines) => lines.slice()),
    renderInvLines() {},
    calcInvTotals() {},
    getOwnerId: () => 'owner-synthetic-uuid',
    steuerStatusVon: () => 'befreit',
    berechneSteuer: (lines, status) => ({
      netto: 71,
      steuer: 0,
      brutto: 71,
      tax_summary: { steuer: 0, details: [] }
    }),
    leistungszeitraum: () => ({ von: '2026-10-01', bis: '2026-10-04' }),
    verordnungAuswahl: () => ({ prescriptionId: null, notizZeile: null }),
    steuerhinweisText: () => 'Kein Steuerausweis',
    behandlungenVerknuepfen: customMocks.behandlungenVerknuepfen || (async (sb, opts) => {
      behandlungenVerknuepfenCalls.push(opts);
    }),
    zahlungsartNachRechnungAbfragen: customMocks.zahlungsartNachRechnungAbfragen || (async (opts) => {
      zahlungsartCalls.push(opts);
    }),
    loadRechnungen: async () => { loadRechnungenCalls++; },
    openInvView: async (id) => { openInvViewCalls.push(id); },
    zeigeRechnungsModus: (mode) => { zeigeRechnungsModusCalls.push(mode); },
    parseFloat,
    Boolean
  };

  const context = vm.createContext(sandbox);

  const wrapperCode = `
    ${extractedDeclaration}
    globalThis.saveInvoice = saveInvoice;
  `;

  vm.runInContext(wrapperCode, context);

  return {
    context,
    saveInvoice: context.saveInvoice,
    domElements,
    supabaseMock,
    toastCalls,
    consoleErrors,
    windowObj,
    behandlungenVerknuepfenCalls,
    zahlungsartCalls,
    getLoadRechnungenCalls: () => loadRechnungenCalls,
    openInvViewCalls,
    setInsertDeferred(d) { insertDeferred = d; },
    setInsertResult(r) { insertResult = r; },
    setUpdateDeferred(d) { updateDeferred = d; },
    setUpdateResult(r) { updateResult = r; }
  };
}

describe('saveInvoice & createPendingGuard module suite', () => {
  it('concurrent calls: baseline executes 2 INSERTs while guarded executes exactly 1 INSERT', async () => {
    const deferred = createDeferred();
    const env = createTestEnvironment({ insertDeferred: deferred });
    const saveBtn = env.domElements.invSaveBtn;
    assert.strictEqual(saveBtn.disabled, false, 'Pre-condition: save button should initially be enabled');

    const firstCallPromise = env.saveInvoice();
    const disabledDuringSave = saveBtn.disabled;
    const secondCallPromise = env.saveInvoice();

    deferred.resolve();
    await Promise.all([firstCallPromise, secondCallPromise]);

    assert.strictEqual(
      env.supabaseMock.insertCalls.length,
      1,
      'Concurrent saveInvoice calls must result in exactly 1 INSERT (fails on baseline 2 INSERTs)'
    );
    assert.strictEqual(disabledDuringSave, true, 'Save button must be disabled immediately while pending');
    assert.strictEqual(saveBtn.disabled, false, 'Save button must be restored to enabled state after completion');
  });

  it('preserves previousDisabled=true when button was already disabled before invocation', async () => {
    const env = createTestEnvironment({ initialSaveBtnDisabled: true });
    const saveBtn = env.domElements.invSaveBtn;
    assert.strictEqual(saveBtn.disabled, true, 'Pre-condition: button starts disabled');

    await env.saveInvoice();

    assert.strictEqual(saveBtn.disabled, true, 'Save button must remain disabled when originally disabled');
  });

  it('validation error (missing patient) releases pending guard and restores button state', async () => {
    const env = createTestEnvironment();
    const saveBtn = env.domElements.invSaveBtn;
    env.domElements.invPatientSelect.value = '';

    await env.saveInvoice();

    assert.strictEqual(env.supabaseMock.insertCalls.length, 0, 'No DB call on validation error');
    assert.strictEqual(saveBtn.disabled, false, 'Save button must be restored after validation return');
    assert.ok(env.toastCalls.some(t => t.type === 'error' && t.msg.includes('Patienten')));

    env.domElements.invPatientSelect.value = 'patient-synthetic-1';
    await env.saveInvoice();
    assert.strictEqual(env.supabaseMock.insertCalls.length, 1, 'Subsequent save must succeed');
  });

  it('validation error (empty invoice lines) releases pending guard and restores button state', async () => {
    const env = createTestEnvironment({ invLines: [] });
    const saveBtn = env.domElements.invSaveBtn;

    await env.saveInvoice();

    assert.strictEqual(env.supabaseMock.insertCalls.length, 0, 'No DB call on empty lines');
    assert.strictEqual(saveBtn.disabled, false, 'Save button must be restored after empty lines validation');
    assert.ok(env.toastCalls.some(t => t.type === 'error' && t.msg.includes('Leistung')));

    env.context.invLines = [{ name: 'Massage', quantity: 1, unit_price: 20 }];
    await env.saveInvoice();
    assert.strictEqual(env.supabaseMock.insertCalls.length, 1, 'Subsequent save must succeed');
  });

  it('database error releases pending guard, restores button, logs to console, and allows retry', async () => {
    const env = createTestEnvironment({
      insertResult: { data: null, error: new Error('Postgres connection pool exhausted') }
    });
    const saveBtn = env.domElements.invSaveBtn;

    await env.saveInvoice();

    assert.strictEqual(env.supabaseMock.insertCalls.length, 1);
    assert.strictEqual(saveBtn.disabled, false, 'Save button must be restored after DB error');
    assert.ok(env.toastCalls.some(t => t.type === 'error' && t.msg.includes('Fehler beim Speichern')));
    assert.ok(env.consoleErrors.length > 0);

    env.setInsertResult({ data: { id: 'inv-synth-100', invoice_number: 'RE-2026-0002' }, error: null });
    await env.saveInvoice();
    assert.strictEqual(env.supabaseMock.insertCalls.length, 2, 'Subsequent retry save must be executed');
  });

  it('thrown helper error is caught, reported via German toast, and releases pending guard', async () => {
    let shouldThrow = true;
    const env = createTestEnvironment({
      behandlungenVerknuepfen: async () => {
        if (shouldThrow) {
          throw new Error('Helper failure during treatment linking');
        }
      }
    });
    const saveBtn = env.domElements.invSaveBtn;

    await env.saveInvoice();

    assert.strictEqual(saveBtn.disabled, false, 'Save button must be restored after thrown error');
    assert.ok(env.toastCalls.some(t => t.type === 'error' && t.msg.includes('Fehler beim Speichern: Helper failure')));
    assert.ok(env.consoleErrors.length > 0);

    shouldThrow = false;
    await env.saveInvoice();
    assert.strictEqual(env.supabaseMock.insertCalls.length, 1);
  });

  it('success sets window._currentInvoiceId and subsequent save triggers UPDATE instead of INSERT', async () => {
    const env = createTestEnvironment();
    assert.strictEqual(env.windowObj._currentInvoiceId, null);

    await env.saveInvoice();
    assert.strictEqual(env.supabaseMock.insertCalls.length, 1, 'First save performs INSERT');
    assert.strictEqual(env.supabaseMock.updateCalls.length, 0);
    assert.strictEqual(env.windowObj._currentInvoiceId, 'inv-synth-999');

    await env.saveInvoice();
    assert.strictEqual(env.supabaseMock.insertCalls.length, 1, 'Second save does not perform another INSERT');
    assert.strictEqual(env.supabaseMock.updateCalls.length, 1, 'Second save performs UPDATE');
    assert.strictEqual(env.supabaseMock.updateCalls[0].val, 'inv-synth-999');
    assert.strictEqual(env.domElements.invSaveBtn.disabled, false);
  });

  it('createPendingGuard helper: preserves this, arguments, return value, and propagates thrown errors when no onError', async () => {
    const mockBtn = { disabled: false };
    const targetContext = { role: 'admin-tester' };

    const guard = createPendingGuard(() => mockBtn);
    const result = await guard.call(targetContext, async function (a, b) {
      assert.strictEqual(this.role, 'admin-tester', 'this context must be preserved');
      return a + b;
    }, 40, 2);
    assert.strictEqual(result, 42, 'Return value must be preserved');
    assert.strictEqual(mockBtn.disabled, false, 'Button restored after success');

    const failingGuard = createPendingGuard(() => mockBtn);
    await assert.rejects(
      () => failingGuard(async function () {
        throw new Error('Helper internal rejection');
      }),
      /Helper internal rejection/,
      'Thrown error must propagate when no onError provided'
    );
    assert.strictEqual(mockBtn.disabled, false, 'Button restored after thrown error');
  });
});
