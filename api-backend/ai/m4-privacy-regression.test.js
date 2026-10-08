import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEvent, sanitizeTransaction } from '../instrument.js';
import { logCall } from './audit.js';

test('M4 Privacy Regression', async (t) => {
  await t.test('sanitizeEvent: alphanumeric sentinel patient strings never survive Sentry fields, frame strings strict undefined', () => {
    const sentinel = 'PATIENT123SECRET456';
    const rawEvent = {
      event_id: '12345678901234567890123456789012',
      timestamp: 1600000000,
      level: 'error',
      platform: 'node',
      exception: {
        values: [
          {
            type: `TypeError ${sentinel}`,
            value: `Cannot read properties of undefined ${sentinel}`,
            mechanism: {
              type: `generic ${sentinel}`,
              data: { user: sentinel }
            },
            stacktrace: {
              frames: [
                {
                  filename: `/app/src/${sentinel}.js`,
                  function: `doSomething${sentinel}`,
                  module: `mod_${sentinel}`,
                  lineno: 10,
                  colno: 5,
                  in_app: true,
                  vars: { secret: sentinel }
                }
              ]
            }
          }
        ]
      },
      transaction: `GET /api/patient/${sentinel}`,
      breadcrumbs: [
        { message: sentinel }
      ],
      extra: {
        patient: sentinel
      },
      user: {
        id: sentinel,
        ip_address: '1.2.3.4'
      }
    };

    const safeEvent = sanitizeEvent(rawEvent, {});
    const eventStr = JSON.stringify(safeEvent);
    assert.ok(!eventStr.includes(sentinel), `Sentinel ${sentinel} should not be present in sanitized event`);

    // Check specific structural invariants
    assert.equal(safeEvent.exception.values[0].type, 'Error');
    assert.equal(safeEvent.exception.values[0].value, '[REDACTED]');
    assert.equal(safeEvent.exception.values[0].mechanism.type, 'generic');
    assert.equal(safeEvent.exception.values[0].mechanism.data, undefined);

    // Strict undefined
    assert.equal(safeEvent.exception.values[0].stacktrace.frames[0].filename, undefined);
    assert.equal(safeEvent.exception.values[0].stacktrace.frames[0].function, undefined);
    assert.equal(safeEvent.exception.values[0].stacktrace.frames[0].module, undefined);
    assert.equal(safeEvent.exception.values[0].stacktrace.frames[0].vars, undefined);

    assert.equal(safeEvent.transaction, undefined);
    assert.equal(safeEvent.breadcrumbs, undefined);
    assert.equal(safeEvent.extra, undefined);
    assert.equal(safeEvent.user, undefined);
  });

  await t.test('sanitizeTransaction: sentinel transaction/span fields are sanitized', () => {
    const sentinel = 'PATIENT123SECRET456';
    const rawTx = {
      type: 'transaction',
      event_id: '12345678901234567890123456789012',
      timestamp: 1600000000,
      start_timestamp: 1599999999,
      transaction: `GET /api/patient/${sentinel}`,
      contexts: {
        trace: {
          trace_id: '12345678901234567890123456789012',
          span_id: '1234567890123456',
          op: `http.server ${sentinel}`
        }
      },
      spans: [
        {
          span_id: 'abcdef1234567890',
          parent_span_id: '1234567890123456',
          op: `db.query ${sentinel}`,
          description: `SELECT * FROM patients WHERE id = '${sentinel}'`,
          timestamp: 1600000000,
          start_timestamp: 1599999999
        }
      ]
    };

    const safeTx = sanitizeTransaction(rawTx);
    const txStr = JSON.stringify(safeTx);
    assert.ok(!txStr.includes(sentinel), `Sentinel ${sentinel} should not be present in sanitized transaction`);

    assert.equal(safeTx.transaction, 'backend');
    assert.equal(safeTx.spans[0].op, 'backend');
    assert.equal(safeTx.spans[0].description, 'backend');
  });

  await t.test('audit: model/error/source arbitrary fields do not contain sentinel strings', async () => {
    const sentinel = 'PATIENT123SECRET456';

    let insertedRow = null;
    const fakeSupabaseClient = {
      from: (table) => {
        assert.equal(table, 'ai_audit_log');
        return {
          insert: (row) => {
            insertedRow = row;
            return { error: null };
          }
        };
      }
    };

    const rawError = new Error(`Connection failed for ${sentinel}`);
    rawError.code = `CUSTOM_ERR_${sentinel}`;

    await logCall({
      tenantId: 'tenant-1',
      userId: 'user-1',
      task: `b2c-draft${sentinel}`,
      model: `gpt-4o-${sentinel}`,
      deployment: `dep-${sentinel}`,
      status: `error-${sentinel}`,
      error: rawError,
      requestHash: `hash-${sentinel}`
    }, fakeSupabaseClient);

    const rowStr = JSON.stringify(insertedRow);

    assert.ok(!rowStr.includes(sentinel), `Sentinel ${sentinel} should not be present in audit row`);
    assert.equal(insertedRow.task, 'unknown');
    assert.equal(insertedRow.model, null);
    assert.equal(insertedRow.deployment, null);
    assert.equal(insertedRow.status, 'unknown');
    assert.equal(insertedRow.error, 'AI_UNAVAILABLE');
    assert.equal(insertedRow.request_hash, null);
  });
});
