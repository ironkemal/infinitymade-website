import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { createCockpitRouter, normalizeSectorToFachbereich } from './cockpit.js';

// Mock-Preise gemäß Vertrag von api-backend/ai/ki-preise.js
const mockPricing = {
  KI_PREISE_STAND: '2026-11-27',
  KI_MODEL_PREISE: Object.freeze({
    'gpt-5-mini': {
      billingType: 'tokens',
      inputPerMtokEur: 0.25,
      outputPerMtokEur: 2.0,
      reasoningIncludedInOutput: true,
      resource: 'de-text',
      retiresOn: null,
    },
    'gpt-4o-transcribe': {
      billingType: 'audio',
      audioPerMinuteEur: 0.0055,
      resource: 'se-audio',
      retiresOn: null,
    },
    'gpt-4o': {
      billingType: 'tokens',
      inputPerMtokEur: 2.3,
      outputPerMtokEur: 9.2,
      reasoningIncludedInOutput: false,
      resource: 'de-text',
      retiresOn: '2026-12-31',
    },
  }),
  berechneKiKostenEur({ model, promptTokens = 0, completionTokens = 0, reasoningTokens = 0, audioSeconds = 0 }) {
    const spec = this.KI_MODEL_PREISE[model];
    if (!spec) {
      return {
        costEur: 0,
        billingType: 'unknown',
        resource: 'unknown',
        knownModel: false,
        breakdown: { inputEur: 0, outputEur: 0, audioEur: 0, reasoningShareEur: 0 },
      };
    }
    if (spec.billingType === 'audio') {
      const audioEur = (audioSeconds / 60) * spec.audioPerMinuteEur;
      return {
        costEur: audioEur,
        billingType: 'audio',
        resource: spec.resource,
        knownModel: true,
        breakdown: { inputEur: 0, outputEur: 0, audioEur, reasoningShareEur: 0 },
      };
    }
    const inputEur = (promptTokens / 1_000_000) * spec.inputPerMtokEur;
    // reasoning_tokens sind in completion_tokens bereits enthalten -> kein Doppelzählen!
    const outputEur = (completionTokens / 1_000_000) * spec.outputPerMtokEur;
    const reasoningShareEur = spec.reasoningIncludedInOutput && completionTokens > 0
      ? (Math.min(reasoningTokens, completionTokens) / 1_000_000) * spec.outputPerMtokEur
      : 0;
    return {
      costEur: inputEur + outputEur,
      billingType: 'tokens',
      resource: spec.resource,
      knownModel: true,
      breakdown: { inputEur, outputEur, audioEur: 0, reasoningShareEur },
    };
  },
  kiAbkuendigungen() {
    return [{ model: 'gpt-4o', retiresOn: '2026-12-31', daysRemaining: 34, resource: 'de-text' }];
  },
};

function makeOpsSupabase({ tokenUsers = {}, members = {} } = {}) {
  return {
    auth: {
      async getUser(token) {
        const user = tokenUsers[token];
        if (!user) return { data: { user: null }, error: { message: 'invalid jwt' } };
        return { data: { user }, error: null };
      },
    },
    from(table) {
      assert.equal(table, 'ops_members');
      let filterId = null;
      const builder = {
        select() { return builder; },
        eq(col, val) {
          if (col === 'id') filterId = val;
          return builder;
        },
        async maybeSingle() {
          return { data: members[filterId] || null, error: null };
        },
      };
      return builder;
    },
  };
}

function makeProductSupabase({ profiles = [], businesses = [], auditRows = [], missingExtendedCols = false, orderCalls = [] } = {}) {
  return {
    from(table) {
      let selectedCols = '';
      const filters = {};
      let rangeSlice = null;
      const builder = {
        select(cols) {
          selectedCols = cols || '';
          return builder;
        },
        eq(col, val) {
          filters[col] = val;
          return builder;
        },
        gte() { return builder; },
        lt() { return builder; },
        order(col, opts) {
          orderCalls.push({ table, selectedCols, col, opts });
          return builder;
        },
        range(from, to) {
          rangeSlice = [from, to];
          return builder;
        },
        then(resolve, reject) {
          return execute().then(resolve, reject);
        },
      };

      async function execute() {
        if (table === 'profiles') {
          const rows = profiles.filter((p) => !filters.role || p.role === filters.role);
          return { data: rows, error: null };
        }
        if (table === 'businesses') {
          return { data: businesses, error: null };
        }
        if (table === 'ai_audit_log') {
          if (missingExtendedCols && (selectedCols.includes('reasoning_tokens') || selectedCols.includes('audio_seconds'))) {
            return {
              data: null,
              error: { code: '42703', message: 'column ai_audit_log.reasoning_tokens does not exist' },
            };
          }
          const filtered = auditRows.filter((r) => !filters.tenant_id || r.tenant_id === filters.tenant_id);
          const rows = rangeSlice ? filtered.slice(rangeSlice[0], rangeSlice[1] + 1) : filtered;
          return { data: rows, error: null };
        }
        return { data: [], error: null };
      }

      return builder;
    },
  };
}

async function withServer(router, fn) {
  const app = express();
  app.use('/api/cockpit', router);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', /** @type {() => void} */ (r)));
  const addr = /** @type {import('node:net').AddressInfo} */ (server.address());
  const base = `http://127.0.0.1:${addr.port}/api/cockpit`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

const baseProductData = {
  profiles: [
    {
      id: TENANT_A,
      role: 'owner',
      business_name: 'Praxis Muster Podologie',
      sector: 'podologie',
      plan: 'professional',
      plan_status: 'active',
      trial_ends_at: null,
      billing_interval: 'monthly',
      created_at: '2026-06-01T10:00:00Z',
      is_active: true,
      avv_accepted_at: '2026-06-01T10:05:00Z',
    },
    {
      id: TENANT_B,
      role: 'owner',
      business_name: 'Physio Demo Süd',
      sector: 'physiotherapie',
      plan: 'starter',
      plan_status: 'past_due',
      trial_ends_at: '2026-12-05T00:00:00Z',
      billing_interval: 'monthly',
      created_at: '2026-10-01T10:00:00Z',
      is_active: true,
      avv_accepted_at: null,
    },
  ],
  businesses: [
    { id: 'b1', owner_id: TENANT_A, business_name: 'Praxis Muster Podologie Zentrum', sector: 'podologie', is_default: true, created_at: '2026-06-01T10:00:00Z' },
  ],
  auditRows: [
    {
      tenant_id: TENANT_A,
      task: 'rezept-ocr',
      model: 'gpt-5-mini',
      prompt_tokens: 1_000_000,
      completion_tokens: 500_000,
      total_tokens: 1_500_000,
      reasoning_tokens: 200_000, // bereits in completion_tokens (500k) enthalten!
      audio_seconds: 0,
      status: 'ok',
      dry_run: false,
      created_at: '2026-11-10T12:00:00Z',
    },
    {
      tenant_id: TENANT_A,
      task: 'diktat',
      model: 'gpt-4o-transcribe',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      reasoning_tokens: 0,
      audio_seconds: 120, // 2 Minuten * 0.0055 = 0.011 EUR
      status: 'ok',
      dry_run: false,
      created_at: '2026-11-11T12:00:00Z',
    },
    {
      tenant_id: TENANT_B,
      task: 'b2c-entwurf',
      model: 'gpt-5-mini',
      prompt_tokens: 500_000,
      completion_tokens: 100_000,
      total_tokens: 600_000,
      reasoning_tokens: 0,
      audio_seconds: 0,
      status: 'ok',
      dry_run: true, // Dry-Run darf keine Kosten erzeugen
      created_at: '2026-11-12T12:00:00Z',
    },
  ],
};

const baseOpsAuth = {
  tokenUsers: {
    'tok-founder': { id: 'u-founder' },
    'tok-tech': { id: 'u-tech' },
    'tok-support': { id: 'u-support' },
    'tok-sales': { id: 'u-sales' },
    'tok-inactive': { id: 'u-inactive' },
    'tok-unknown': { id: 'u-unknown' },
  },
  members: {
    'u-founder': { id: 'u-founder', email: 'f@example.test', display_name: 'Founder', role: 'founder', is_active: true },
    'u-tech': { id: 'u-tech', email: 't@example.test', display_name: 'Tech', role: 'tech', is_active: true },
    'u-support': { id: 'u-support', email: 's@example.test', display_name: 'Support', role: 'support', is_active: true },
    'u-sales': { id: 'u-sales', email: 'v@example.test', display_name: 'Sales', role: 'sales', is_active: true },
    'u-inactive': { id: 'u-inactive', email: 'i@example.test', display_name: 'Ex', role: 'founder', is_active: false },
  },
};

test('Fail-Closed 503 wenn OPS_SUPABASE nicht konfiguriert ist', async () => {
  const prevUrl = process.env.OPS_SUPABASE_URL;
  const prevKey = process.env.OPS_SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.OPS_SUPABASE_URL;
  delete process.env.OPS_SUPABASE_SERVICE_ROLE_KEY;
  try {
    const router = createCockpitRouter({
      supabase: makeProductSupabase(baseProductData),
      opsSupabase: null,
      pricing: mockPricing,
    });
    await withServer(router, async (base) => {
      const res = await fetch(`${base}/overview`, { headers: { Authorization: 'Bearer tok-founder' } });
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.error, 'COCKPIT_AUTH_NOT_CONFIGURED');
    });
  } finally {
    if (prevUrl !== undefined) process.env.OPS_SUPABASE_URL = prevUrl;
    if (prevKey !== undefined) process.env.OPS_SUPABASE_SERVICE_ROLE_KEY = prevKey;
  }
});

test('401 bei fehlendem oder ungültigem Token, 403 bei inaktivem Mitglied oder fehlendem ops_members-Eintrag', async () => {
  const router = createCockpitRouter({
    supabase: makeProductSupabase(baseProductData),
    opsSupabase: makeOpsSupabase(baseOpsAuth),
    pricing: mockPricing,
  });
  await withServer(router, async (base) => {
    assert.equal((await fetch(`${base}/overview`)).status, 401);
    assert.equal((await fetch(`${base}/overview`, { headers: { Authorization: 'Bearer bad' } })).status, 401);
    assert.equal((await fetch(`${base}/overview`, { headers: { Authorization: 'Bearer tok-unknown' } })).status, 403);
    assert.equal((await fetch(`${base}/overview`, { headers: { Authorization: 'Bearer tok-inactive' } })).status, 403);
    // Sales darf /ki-usage nicht aufrufen
    assert.equal((await fetch(`${base}/ki-usage`, { headers: { Authorization: 'Bearer tok-sales' } })).status, 403);
  });
});

test('200 /overview liefert rollengefilterte Daten (founder vs support vs sales vs tech)', async () => {
  const router = createCockpitRouter({
    supabase: makeProductSupabase(baseProductData),
    opsSupabase: makeOpsSupabase(baseOpsAuth),
    pricing: mockPricing,
  });
  await withServer(router, async (base) => {
    // Founder: sieht Billing + KI-Kosten + Abkündigungen
    const rFounder = await fetch(`${base}/overview?month=2026-11`, { headers: { Authorization: 'Bearer tok-founder' } });
    assert.equal(rFounder.status, 200);
    const f = await rFounder.json();
    assert.equal(f.customers.totalOwners, 2);
    assert.equal(f.customers.pastDueCount, 1);
    assert.ok(f.customers.byPlanStatus);
    assert.equal(f.ki.calls, 3);
    assert.equal(f.ki.dryRunCalls, 1);
    // Kosten: 1M*0.25 + 0.5M*2.0 (1.25) + 2min*0.0055 (0.011) = 1.261 EUR
    assert.equal(f.ki.totalCostEur, 1.261);
    assert.equal(f.ki.retirements.length, 1);

    // Support: keine Billing-Details, keine EUR-Kosten, keine Abkündigungen
    const rSupport = await fetch(`${base}/overview?month=2026-11`, { headers: { Authorization: 'Bearer tok-support' } });
    assert.equal(rSupport.status, 200);
    const s = await rSupport.json();
    assert.equal(s.customers.totalOwners, 2);
    assert.equal(s.customers.pastDueCount, undefined);
    assert.equal(s.customers.byPlanStatus, undefined);
    assert.equal(s.ki.calls, 3);
    assert.equal(s.ki.totalCostEur, undefined);
    assert.equal(s.ki.retirements, undefined);

    // Sales: Billing-Zahlen da, aber keine KI-EUR-Kosten
    const rSales = await fetch(`${base}/overview?month=2026-11`, { headers: { Authorization: 'Bearer tok-sales' } });
    assert.equal(rSales.status, 200);
    const sl = await rSales.json();
    assert.equal(sl.customers.pastDueCount, 1);
    assert.equal(sl.ki.totalCostEur, undefined);

    // Tech: KI-EUR-Kosten da, keine Billing-Zahlen
    const rTech = await fetch(`${base}/overview?month=2026-11`, { headers: { Authorization: 'Bearer tok-tech' } });
    assert.equal(rTech.status, 200);
    const tc = await rTech.json();
    assert.equal(tc.customers.pastDueCount, undefined);
    assert.equal(tc.ki.totalCostEur, 1.261);
  });
});

test('/customers und /ki-usage berechnen reasoning_tokens ohne Doppelzählung und audio_seconds korrekt (kein PHI)', async () => {
  const router = createCockpitRouter({
    supabase: makeProductSupabase(baseProductData),
    opsSupabase: makeOpsSupabase(baseOpsAuth),
    pricing: mockPricing,
  });
  await withServer(router, async (base) => {
    const rCust = await fetch(`${base}/customers?month=2026-11`, { headers: { Authorization: 'Bearer tok-founder' } });
    assert.equal(rCust.status, 200);
    const cBody = await rCust.json();
    assert.equal(cBody.customers.length, 2);
    const custA = cBody.customers.find((c) => c.tenantId === TENANT_A);
    assert.equal(custA.name, 'Praxis Muster Podologie Zentrum');
    assert.equal(custA.ki.calls, 2);
    assert.equal(custA.ki.reasoningTokens, 200_000);
    assert.equal(custA.ki.audioSeconds, 120);
    assert.equal(custA.ki.costEur, 1.261);

    // Support sieht weder planStatus noch costEur
    const rCustSup = await fetch(`${base}/customers?month=2026-11`, { headers: { Authorization: 'Bearer tok-support' } });
    const cSupBody = await rCustSup.json();
    const custASup = cSupBody.customers.find((c) => c.tenantId === TENANT_A);
    assert.equal(custASup.planStatus, undefined);
    assert.equal(custASup.ki.costEur, undefined);
    assert.equal(custASup.ki.calls, 2);

    // /ki-usage mit breakdown
    const rKi = await fetch(`${base}/ki-usage?month=2026-11&tenantId=${TENANT_A}`, {
      headers: { Authorization: 'Bearer tok-tech' },
    });
    assert.equal(rKi.status, 200);
    const kiBody = await rKi.json();
    assert.equal(kiBody.totals.costEur, 1.261);
    // reasoningShareEur = 200k / 1M * 2.0 = 0.4 EUR (als Anteil von outputEur = 1.0 EUR)
    assert.equal(kiBody.totals.outputEur, 1);
    assert.equal(kiBody.totals.reasoningShareEur, 0.4);
    assert.equal(kiBody.totals.audioEur, 0.011);
    assert.equal(kiBody.byResource['de-text'].costEur, 1.25);
    assert.equal(kiBody.byResource['se-audio'].costEur, 0.011);
    assert.ok(kiBody.pricingMeta.models['gpt-5-mini']);
  });
});

test('42703 Fallback wenn reasoning_tokens / audio_seconds Spalten noch nicht migriert sind (inkl. .order(id))', async () => {
  const orderCalls = [];
  const router = createCockpitRouter({
    supabase: makeProductSupabase({ ...baseProductData, missingExtendedCols: true, orderCalls }),
    opsSupabase: makeOpsSupabase(baseOpsAuth),
    pricing: mockPricing,
  });
  await withServer(router, async (base) => {
    const res = await fetch(`${base}/overview?month=2026-11`, { headers: { Authorization: 'Bearer tok-founder' } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ki.extendedColumnsAvailable, false);
    assert.equal(body.truncated, false);
    assert.equal(body.ki.reasoningTokens, 0);
    assert.equal(body.ki.audioSeconds, 0);
    // Token-Kosten funktionieren weiterhin, Audio ohne audio_seconds = 0
    assert.equal(body.ki.totalCostEur, 1.25);
    assert.equal(orderCalls.length, 2);
    assert.deepEqual(orderCalls.map((c) => ({ col: c.col, opts: c.opts })), [
      { col: 'id', opts: { ascending: true } },
      { col: 'id', opts: { ascending: true } },
    ]);
    assert.ok(orderCalls[0].selectedCols.includes('reasoning_tokens'));
    assert.ok(!orderCalls[1].selectedCols.includes('reasoning_tokens'));
  });
});

test('Paginierung setzt truncated=true wenn AUDIT_MAX_PAGES mit voller Seite erreicht wird', async () => {
  const fullPagesRows = Array.from({ length: 50_000 }, (_, i) => ({
    id: i + 1,
    tenant_id: TENANT_A,
    task: 'rezept-ocr',
    model: 'gpt-5-mini',
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
    reasoning_tokens: 0,
    audio_seconds: 0,
    status: 'ok',
    dry_run: false,
    created_at: '2026-11-10T12:00:00Z',
  }));
  const orderCalls = [];
  const router = createCockpitRouter({
    supabase: makeProductSupabase({ ...baseProductData, auditRows: fullPagesRows, orderCalls }),
    opsSupabase: makeOpsSupabase(baseOpsAuth),
    pricing: mockPricing,
  });
  await withServer(router, async (base) => {
    const [rOv, rCust, rKi] = await Promise.all([
      fetch(`${base}/overview?month=2026-11`, { headers: { Authorization: 'Bearer tok-founder' } }),
      fetch(`${base}/customers?month=2026-11`, { headers: { Authorization: 'Bearer tok-founder' } }),
      fetch(`${base}/ki-usage?month=2026-11`, { headers: { Authorization: 'Bearer tok-tech' } }),
    ]);
    const [bOv, bCust, bKi] = await Promise.all([rOv.json(), rCust.json(), rKi.json()]);
    assert.equal(bOv.truncated, true);
    assert.equal(bCust.truncated, true);
    assert.equal(bKi.truncated, true);
    assert.equal(bOv.ki.calls, 50_000);
    assert.ok(orderCalls.length >= 150);
    assert.ok(orderCalls.every((c) => c.col === 'id' && c.opts?.ascending === true));
  });
});

test('normalizeSectorToFachbereich mappt englische und kanonische Sektoren in /customers und /ki-usage', async () => {
  assert.equal(normalizeSectorToFachbereich('physiotherapy'), 'physiotherapie');
  assert.equal(normalizeSectorToFachbereich('physiotherapie'), 'physiotherapie');
  assert.equal(normalizeSectorToFachbereich('ergotherapy'), 'ergotherapie');
  assert.equal(normalizeSectorToFachbereich('ergotherapie'), 'ergotherapie');
  assert.equal(normalizeSectorToFachbereich('logopaedie'), 'logopaedie');
  assert.equal(normalizeSectorToFachbereich('logopädie'), 'logopaedie');
  assert.equal(normalizeSectorToFachbereich('speech'), 'logopaedie');
  assert.equal(normalizeSectorToFachbereich('podologie'), 'podologie');
  assert.equal(normalizeSectorToFachbereich('podiatry'), 'podologie');
  assert.equal(normalizeSectorToFachbereich('interdisziplinaer'), 'interdisziplinaer');
  assert.equal(normalizeSectorToFachbereich('interdisziplinär'), 'interdisziplinaer');
  assert.equal(normalizeSectorToFachbereich('praxis'), 'interdisziplinaer');
  assert.equal(normalizeSectorToFachbereich('massage'), 'interdisziplinaer');
  assert.equal(normalizeSectorToFachbereich('other'), 'interdisziplinaer');
  assert.equal(normalizeSectorToFachbereich('unknown-xyz'), null);
  assert.equal(normalizeSectorToFachbereich(null), null);

  const mappedData = {
    profiles: [
      { ...baseProductData.profiles[0], sector: 'podiatry' },
      { ...baseProductData.profiles[1], sector: 'physiotherapy' },
    ],
    businesses: [
      { id: 'b1', owner_id: TENANT_A, business_name: 'Praxis Muster Podologie Zentrum', sector: 'podiatry', is_default: true, created_at: '2026-06-01T10:00:00Z' },
      { id: 'b2', owner_id: TENANT_B, business_name: 'Physio Demo Süd', sector: 'physiotherapy', is_default: true, created_at: '2026-10-01T10:00:00Z' },
    ],
    auditRows: baseProductData.auditRows,
  };

  const router = createCockpitRouter({
    supabase: makeProductSupabase(mappedData),
    opsSupabase: makeOpsSupabase(baseOpsAuth),
    pricing: mockPricing,
  });

  await withServer(router, async (base) => {
    const [rCust, rKi] = await Promise.all([
      fetch(`${base}/customers?month=2026-11`, { headers: { Authorization: 'Bearer tok-founder' } }),
      fetch(`${base}/ki-usage?month=2026-11`, { headers: { Authorization: 'Bearer tok-tech' } }),
    ]);
    const [cBody, kBody] = await Promise.all([rCust.json(), rKi.json()]);
    assert.equal(cBody.truncated, false);
    assert.equal(kBody.truncated, false);
    assert.equal(cBody.customers.find((c) => c.tenantId === TENANT_A).fachbereich, 'podologie');
    assert.equal(cBody.customers.find((c) => c.tenantId === TENANT_B).fachbereich, 'physiotherapie');
    assert.equal(kBody.byTenant.find((t) => t.tenantId === TENANT_B).fachbereich, 'physiotherapie');
  });
});

test('400 bei ungültigem month oder tenantId', async () => {
  const router = createCockpitRouter({
    supabase: makeProductSupabase(baseProductData),
    opsSupabase: makeOpsSupabase(baseOpsAuth),
    pricing: mockPricing,
  });
  await withServer(router, async (base) => {
    assert.equal((await fetch(`${base}/overview?month=2026-13`, { headers: { Authorization: 'Bearer tok-founder' } })).status, 400);
    assert.equal((await fetch(`${base}/ki-usage?tenantId=not-a-uuid`, { headers: { Authorization: 'Bearer tok-tech' } })).status, 400);
  });
});

test('Integration mit echtem api-backend/ai/ki-preise.js (ohne injiziertes pricing)', async () => {
  const router = createCockpitRouter({
    supabase: makeProductSupabase(baseProductData),
    opsSupabase: makeOpsSupabase(baseOpsAuth),
  });
  await withServer(router, async (base) => {
    const res = await fetch(`${base}/ki-usage?month=2026-11`, {
      headers: { Authorization: 'Bearer tok-founder' },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.pricingMeta.stand, '2026-11-27');
    assert.equal(body.pricingMeta.models['gpt-4o-transcribe'].billingType, 'audio_minutes');
    // gpt-5-mini: 1M * 0.253 + 0.5M * 2.024 = 0.253 + 1.012 = 1.265
    // gpt-4o-transcribe: 2 min * 0.006072 = 0.012144
    assert.equal(body.totals.costEur, 1.277144);
  });
});
