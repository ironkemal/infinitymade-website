import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEvent, sanitizeTransaction } from './instrument.js';

const SYNTHETIC_SENTINEL = 'SYNTHETIC_TEST_SENTINEL_SECRET_ALPHA_987654';

test('sanitizeEvent: completely strips synthetic sentinel from all content-bearing channels', () => {
  const event = {
    message: `Raw message leak: ${SYNTHETIC_SENTINEL}`,
    user: {
      id: `usr_${SYNTHETIC_SENTINEL}`,
      email: `test@${SYNTHETIC_SENTINEL}.local`,
      username: `patient_${SYNTHETIC_SENTINEL}`,
      ip_address: '127.0.0.1'
    },
    request: {
      url: `https://app.praxura.local/api/ai/test?param=${SYNTHETIC_SENTINEL}`,
      query_string: `token=${SYNTHETIC_SENTINEL}`,
      query: { q: SYNTHETIC_SENTINEL },
      cookies: { session: SYNTHETIC_SENTINEL },
      headers: {
        authorization: `Bearer ${SYNTHETIC_SENTINEL}`,
        cookie: `jwt=${SYNTHETIC_SENTINEL}`,
        'x-synthetic-header': SYNTHETIC_SENTINEL
      },
      data: {
        prompt: SYNTHETIC_SENTINEL,
        nested: { field: SYNTHETIC_SENTINEL }
      }
    },
    breadcrumbs: [
      { message: `Breadcrumb message: ${SYNTHETIC_SENTINEL}`, data: { ref: SYNTHETIC_SENTINEL } }
    ],
    extra: {
      debugData: SYNTHETIC_SENTINEL
    },
    extras: {
      additionalNotes: SYNTHETIC_SENTINEL
    },
    contexts: {
      patientContext: { id: SYNTHETIC_SENTINEL }
    },
    exception: {
      values: [
        {
          type: 'SyntheticError',
          value: `Exception message leak: ${SYNTHETIC_SENTINEL}`,
          cause: `Underlying cause: ${SYNTHETIC_SENTINEL}`,
          mechanism: {
            type: 'generic',
            description: `Mechanism: ${SYNTHETIC_SENTINEL}`,
            data: { payload: SYNTHETIC_SENTINEL }
          },
          stacktrace: {
            frames: [
              {
                filename: 'api-backend/ai/router.js',
                function: 'handleAiRequest',
                lineno: 42,
                colno: 10,
                in_app: true,
                vars: { localVariable: SYNTHETIC_SENTINEL },
                context_line: `const secret = "${SYNTHETIC_SENTINEL}";`
              }
            ]
          }
        }
      ]
    }
  };

  const sanitized = sanitizeEvent(event);
  assert.ok(sanitized, 'Event should not be dropped when valid');

  const serialized = JSON.stringify(sanitized);
  assert.ok(
    !serialized.includes(SYNTHETIC_SENTINEL),
    `Synthetic sentinel must not appear anywhere in sanitized event JSON: ${serialized}`
  );

  // Assert individual channel deletions
  assert.equal(sanitized.user, undefined);
  assert.equal(sanitized.breadcrumbs, undefined);
  assert.equal(sanitized.extra, undefined);
  assert.equal(sanitized.extras, undefined);
  assert.equal(sanitized.contexts, undefined);

  assert.equal(sanitized.request, undefined);

  assert.equal(sanitized.message, undefined);
  assert.equal(sanitized.exception.values[0].value, '[REDACTED]');
  assert.equal(sanitized.exception.values[0].cause, undefined);
  assert.equal(sanitized.exception.values[0].mechanism.data, undefined);
  assert.equal(sanitized.exception.values[0].mechanism.description, undefined);

  // Dynamic frame strings are removed; numeric positions remain.
  const frame = sanitized.exception.values[0].stacktrace.frames[0];
  assert.equal(frame.filename, undefined);
  assert.equal(frame.function, undefined);
  assert.equal(frame.lineno, 42);
  assert.equal(frame.colno, 10);
  assert.equal(frame.in_app, true);
  assert.equal(frame.vars, undefined);
  assert.equal(frame.context_line, undefined);
});

test('sanitizeEvent: bounds stack frames to maximum 25', () => {
  const frames = [];
  for (let i = 0; i < 40; i++) {
    frames.push({
      filename: `file_${i}.js`,
      function: `fn_${i}`,
      lineno: i,
      vars: { x: i }
    });
  }

  const event = {
    exception: {
      values: [
        {
          type: 'Error',
          value: 'Some error',
          stacktrace: { frames }
        }
      ]
    }
  };

  const sanitized = sanitizeEvent(event);
  const preservedFrames = sanitized.exception.values[0].stacktrace.frames;
  assert.equal(preservedFrames.length, 25);
  // Preserves innermost frames (slice(-25))
  assert.equal(preservedFrames[0].lineno, 15);
  assert.equal(preservedFrames[24].lineno, 39);
  assert.equal(preservedFrames[0].vars, undefined);
});

test('sanitizeEvent: fails closed by returning null on invalid input or exception', () => {
  assert.equal(sanitizeEvent(null), null);
  assert.equal(sanitizeEvent(undefined), null);
  assert.equal(sanitizeEvent('not-an-object'), null);

  const explosiveEvent = {};
  Object.defineProperty(explosiveEvent, 'exception', {
    get() {
      throw new Error('Explosive getter failure');
    }
  });

  assert.equal(sanitizeEvent(explosiveEvent), null);
});

test('sanitizeTransaction: strips sentinel and fails closed', () => {
  const tx = {
    user: { id: SYNTHETIC_SENTINEL },
    request: {
      url: `https://app.praxura.local/transaction?query=${SYNTHETIC_SENTINEL}`,
      headers: { auth: SYNTHETIC_SENTINEL },
      data: { body: SYNTHETIC_SENTINEL }
    },
    breadcrumbs: [{ message: SYNTHETIC_SENTINEL }],
    extra: { x: SYNTHETIC_SENTINEL },
    contexts: { ctx: SYNTHETIC_SENTINEL },
    spans: [
      {
        description: `SELECT * FROM table WHERE param = ${SYNTHETIC_SENTINEL}?id=1`,
        data: { queryParams: SYNTHETIC_SENTINEL }
      }
    ]
  };

  const sanitized = sanitizeTransaction(tx);
  assert.ok(sanitized, 'Transaction should not be dropped when valid');

  const serialized = JSON.stringify(sanitized);
  assert.ok(!serialized.includes(SYNTHETIC_SENTINEL), 'Transaction must not contain sentinel');

  assert.equal(sanitized.user, undefined);
  assert.equal(sanitized.request, undefined);
  assert.equal(sanitized.spans[0].data, undefined);

  // Fail-closed test
  assert.equal(sanitizeTransaction(null), null);

  const explosiveTx = {};
  Object.defineProperty(explosiveTx, 'spans', {
    get() {
      throw new Error('Explosive getter in transaction');
    }
  });
  assert.equal(sanitizeTransaction(explosiveTx), null);
});
