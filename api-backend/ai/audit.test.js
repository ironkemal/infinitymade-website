import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashRequest,
  safeAiError,
  logCall,
  makeUsageAggregateSupplier
} from './audit.js';

test('audit: re-exports hashRequest and safeAiError with HMAC protection', () => {
  assert.equal(typeof hashRequest, 'function');
  assert.equal(typeof safeAiError, 'function');

  const h = hashRequest({ test: 123 });
  assert.equal(typeof h, 'string');
  assert.match(h, /^[a-f0-9]{64}$/);
});

test('logCall: retains the process-keyed HMAC without storing request content', async () => {
  const fingerprint = hashRequest({ prompt: 'SYNTHETIC_HMAC_SENTINEL' });
  let row;
  await logCall({ task: 'b2c-draft', requestHash: fingerprint }, {
    from: () => ({ insert: async (value) => { row = value; return { error: null }; } })
  });
  assert.equal(row.request_hash, fingerprint);
  assert.match(row.request_hash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(row).includes('SYNTHETIC_HMAC_SENTINEL'), false);
});

test('logCall: sanitizes error and prevents raw exception leakage', async () => {
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (msg) => logs.push(msg);

  try {
    let capturedRow = null;
    const fakeClient = {
      from(table) {
        return {
          async insert(row) {
            capturedRow = row;
            return { error: null };
          }
        };
      }
    };

    await logCall({
      tenantId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      task: 'b2c-draft',
      model: 'gpt-4o',
      deployment: 'azure-eastus',
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      latencyMs: 150,
      status: 'error',
      error: new Error('SENSITIVE_PROVIDER_RAW_MESSAGE_LEAK'),
      dryRun: false,
      requestHash: '1234567890abcdef'
    }, fakeClient);

    assert.ok(capturedRow);
    assert.equal(capturedRow.task, 'b2c-draft');
    assert.equal(capturedRow.model, 'gpt-4o');
    assert.equal(capturedRow.deployment, null);
    assert.equal(capturedRow.status, 'error');
    assert.equal(capturedRow.error, 'AI_UNAVAILABLE');
    assert.equal(capturedRow.prompt_tokens, 10);
    assert.equal(capturedRow.latency_ms, 150);

    assert.ok(!logs.some(l => l.includes('SENSITIVE_PROVIDER_RAW_MESSAGE_LEAK')));
  } finally {
    console.error = originalConsoleError;
  }
});

test('logCall: handles insert error gracefully', async () => {
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (msg) => logs.push(msg);

  try {
    const fakeClient = {
      from() {
        return {
          async insert() {
            return { error: new Error('DB Error') };
          }
        };
      }
    };

    await logCall({
      tenantId: '123',
      task: 'b2c-draft'
    }, fakeClient);

    assert.ok(logs.some(l => l.includes('AUDIT_INSERT_FAILED')));
  } finally {
    console.error = originalConsoleError;
  }
});

test('logCall: handles insert throw gracefully', async () => {
  const originalConsoleError = console.error;
  const logs = [];
  console.error = (msg) => logs.push(msg);

  try {
    const fakeClient = {
      from() {
        throw new Error('Explosive DB Error');
      }
    };

    await logCall({
      tenantId: '123',
      task: 'b2c-draft'
    }, fakeClient);

    assert.ok(logs.some(l => l.includes('AUDIT_EXCEPTION')));
  } finally {
    console.error = originalConsoleError;
  }
});

test('makeUsageAggregateSupplier: validates required arguments', () => {
  assert.throws(() => {
    makeUsageAggregateSupplier(null, 'tenant-123');
  }, /Supabase-Client erforderlich/);

  assert.throws(() => {
    makeUsageAggregateSupplier({ from: () => {} }, null);
  }, /Gültige tenantId erforderlich/);
});

test('makeUsageAggregateSupplier: aggregates cumulative tokens and calls by known task', async () => {
  const capturedFilters = [];
  const testTenant = '11111111-1111-1111-1111-111111111111';

  const mockRows = [
    { task: 'b2c-draft', prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    { task: 'b2c-draft', prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
    { task: 'rezept-validate', prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
    { task: 'appointment-confirm-draft', prompt_tokens: null, completion_tokens: 10, total_tokens: 10 }
  ];

  let selectedFields = null;

  const mockSupabase = {
    from(tableName) {
      assert.equal(tableName, 'ai_audit_log');
      const builder = {
        select(fields) {
          selectedFields = fields;
          return builder;
        },
        eq(col, val) {
          capturedFilters.push({ op: 'eq', col, val });
          return builder;
        },
        gte(col, val) {
          capturedFilters.push({ op: 'gte', col, val });
          return builder;
        },
        lt(col, val) {
          capturedFilters.push({ op: 'lt', col, val });
          return builder;
        },
        order() {
          return builder;
        },
        async range(_from, _to) {
          return { data: mockRows, error: null };
        }
      };
      return builder;
    }
  };

  const fixedTimestamp = Date.UTC(2026, 9, 8, 14, 30, 0); // 2026-10-08 14:30 UTC
  const supplier = makeUsageAggregateSupplier(mockSupabase, testTenant, {
    now: fixedTimestamp,
    boxId: 'praxura-box-01',
    pageSize: 1000
  });

  const report = await supplier();

  // Validate bounds and stable reportId
  assert.equal(report.windowStart, '2026-10-08T00:00:00.000Z');
  assert.equal(report.windowEnd, '2026-10-09T00:00:00.000Z');
  assert.ok(/^[a-zA-Z0-9_-]{1,64}$/.test(report.reportId));
  assert.ok(report.reportId.includes('20261008'));

  // Validate minimal selected fields (no PHI, no user_id, no request timestamps)
  assert.equal(selectedFields, 'task, prompt_tokens, completion_tokens, total_tokens');

  // Validate filter assertions: tenant-filtered and dry_run=false
  assert.ok(capturedFilters.some(f => f.op === 'eq' && f.col === 'tenant_id' && f.val === testTenant));
  assert.ok(capturedFilters.some(f => f.op === 'eq' && f.col === 'dry_run' && f.val === false));
  assert.ok(capturedFilters.some(f => f.op === 'gte' && f.col === 'created_at' && f.val === '2026-10-08T00:00:00.000Z'));
  assert.ok(capturedFilters.some(f => f.op === 'lt' && f.col === 'created_at' && f.val === '2026-10-09T00:00:00.000Z'));

  // Validate cumulative totals by task
  assert.deepEqual(report.taskTotals['b2c-draft'], {
    calls: 2,
    prompt_tokens: 300,
    completion_tokens: 150,
    total_tokens: 450
  });

  assert.deepEqual(report.taskTotals['rezept-validate'], {
    calls: 1,
    prompt_tokens: 50,
    completion_tokens: 25,
    total_tokens: 75
  });

  assert.deepEqual(report.taskTotals['appointment-confirm-draft'], {
    calls: 1,
    prompt_tokens: 0,
    completion_tokens: 10,
    total_tokens: 10
  });
});

test('makeUsageAggregateSupplier: handles multi-page pagination', async () => {
  const page1 = [
    { task: 'b2c-draft', prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    { task: 'b2c-draft', prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
  ];
  const page2 = [
    { task: 'b2c-draft', prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
  ];

  let rangeCalls = 0;
  const mockSupabase = {
    from() {
      const b = {
        select: () => b,
        eq: () => b,
        gte: () => b,
        lt: () => b,
        order: () => b,
        async range(from, _to) {
          rangeCalls++;
          if (from === 0) return { data: page1, error: null };
          return { data: page2, error: null };
        }
      };
      return b;
    }
  };

  const supplier = makeUsageAggregateSupplier(mockSupabase, 'tenant-abc', {
    now: Date.UTC(2026, 9, 8, 12, 0, 0),
    pageSize: 2,
    maxPages: 5
  });

  const report = await supplier();
  assert.equal(rangeCalls, 2);
  assert.equal(report.taskTotals['b2c-draft'].calls, 3);
  assert.equal(report.taskTotals['b2c-draft'].total_tokens, 60);
});

test('makeUsageAggregateSupplier: at-Argument liefert Fenster und reportId des Vortags (O-186)', async () => {
  const fenster = [];
  const mockSupabase = {
    from() {
      const b = {
        select: () => b, eq: () => b, order: () => b,
        gte: (_c, v) => { fenster.push(v); return b; },
        lt: (_c, v) => { fenster.push(v); return b; },
        async range() { return { data: [], error: null }; }
      };
      return b;
    }
  };
  const supplier = makeUsageAggregateSupplier(mockSupabase, 'tenant-abc', { now: Date.UTC(2026, 9, 9, 0, 10) });
  const heute = await supplier();
  const vortagAbschluss = await supplier(Date.UTC(2026, 9, 8));
  const vortagTagsueber = await makeUsageAggregateSupplier(mockSupabase, 'tenant-abc', { now: Date.UTC(2026, 9, 8, 23, 30) })();
  assert.equal(vortagAbschluss.windowStart, '2026-10-08T00:00:00.000Z');
  assert.equal(vortagAbschluss.windowEnd, '2026-10-09T00:00:00.000Z');
  assert.equal(vortagAbschluss.reportId, vortagTagsueber.reportId);
  assert.notEqual(heute.reportId, vortagAbschluss.reportId);
  assert.deepEqual(fenster.slice(2, 4), ['2026-10-08T00:00:00.000Z', '2026-10-09T00:00:00.000Z']);
});

test('makeUsageAggregateSupplier: fails explicitly on pagination overflow', async () => {
  const fullPage = [
    { task: 'b2c-draft', prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
  ];

  const mockSupabase = {
    from() {
      const b = {
        select: () => b,
        eq: () => b,
        gte: () => b,
        lt: () => b,
        order: () => b,
        async range() {
          return { data: fullPage, error: null };
        }
      };
      return b;
    }
  };

  const supplier = makeUsageAggregateSupplier(mockSupabase, 'tenant-abc', {
    pageSize: 1,
    maxPages: 3
  });

  await assert.rejects(async () => {
    await supplier();
  }, (err) => {
    assert.equal(err.code, 'AI_AGGREGATE_INCOMPLETE');
    return true;
  });
});

test('makeUsageAggregateSupplier: fails explicitly on DB query failure', async () => {
  const mockSupabase = {
    from() {
      const b = {
        select: () => b,
        eq: () => b,
        gte: () => b,
        lt: () => b,
        order: () => b,
        async range() {
          return { data: null, error: { message: 'Database connection failed' } };
        }
      };
      return b;
    }
  };

  const supplier = makeUsageAggregateSupplier(mockSupabase, 'tenant-abc');

  await assert.rejects(async () => {
    await supplier();
  }, (err) => {
    assert.equal(err.code, 'AI_AGGREGATE_QUERY_FAILED');
    return true;
  });
});

test('makeUsageAggregateSupplier: fails explicitly on unknown task in audit log', async () => {
  const mockSupabase = {
    from() {
      const b = {
        select: () => b,
        eq: () => b,
        gte: () => b,
        lt: () => b,
        order: () => b,
        async range() {
          return {
            data: [{ task: 'UNAUTHORIZED_EXPERIMENTAL_TASK', prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }],
            error: null
          };
        }
      };
      return b;
    }
  };

  const supplier = makeUsageAggregateSupplier(mockSupabase, 'tenant-abc');

  await assert.rejects(async () => {
    await supplier();
  }, (err) => {
    assert.equal(err.code, 'AI_AGGREGATE_MALFORMED_TASK');
    return true;
  });
});

test('makeUsageAggregateSupplier: fails explicitly on malformed token metrics', async () => {
  const mockSupabase = {
    from() {
      const b = {
        select: () => b,
        eq: () => b,
        gte: () => b,
        lt: () => b,
        order: () => b,
        async range() {
          return {
            data: [{ task: 'b2c-draft', prompt_tokens: -50, completion_tokens: 10, total_tokens: -40 }],
            error: null
          };
        }
      };
      return b;
    }
  };

  const supplier = makeUsageAggregateSupplier(mockSupabase, 'tenant-abc');

  await assert.rejects(async () => {
    await supplier();
  }, (err) => {
    assert.equal(err.code, 'AI_AGGREGATE_MALFORMED_METRIC');
    return true;
  });
});

test('makeUsageAggregateSupplier: directly integrates with ki-jeton createJetonClient', async () => {
  const { createJetonClient } = await import('./ki-jeton.js');
  const mockSupabase = {
    from() {
      const b = {
        select: () => b,
        eq: () => b,
        gte: () => b,
        lt: () => b,
        order: () => b,
        async range() {
          return {
            data: [
              { task: 'b2c-draft', prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 },
              { task: 'rezept-validate', prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }
            ],
            error: null
          };
        }
      };
      return b;
    }
  };

  const supplier = makeUsageAggregateSupplier(mockSupabase, 'tenant-int-test-1', {
    now: Date.UTC(2026, 9, 8, 10, 0, 0),
    boxId: 'box-int-1'
  });

  const jetonClient = createJetonClient({
    config: { mode: 'jeton', activationReady: true, allowedHosts: [] },
    aggregateSupplier: supplier
  });

  const result = await jetonClient.reportUsage();
  assert.equal(result.ok, true);
  assert.equal(result.staged, true);
});
