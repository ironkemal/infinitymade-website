/**
 * Praxura Cockpit Backend Routes (`/api/cockpit/*`)
 *
 * Läuft ausschließlich im SaaS-Backend (`!istKutu()` in `server.js`).
 * Authentifizierung über das separate Ops-Supabase-Projekt (`OPS_SUPABASE_URL` +
 * `OPS_SUPABASE_SERVICE_ROLE_KEY`), Fail-Closed mit 503 wenn unkonfiguriert.
 *
 * DSGVO / G1: KEINE Patientendaten (PHI), keine personenbezogenen Praxis-Kontaktdaten
 * aus dem Produkt-Schema — ausschließlich B2B-Mandanten-Metadaten (Name, Fachbereich,
 * Tarifstatus) und aggregierte KI-Nutzungszahlen.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const VALID_ROLES = new Set(['founder', 'tech', 'support', 'sales']);
const AUDIT_PAGE_SIZE = 1000;
const AUDIT_MAX_PAGES = 50;

/** @type {Promise<any> | null} */
let cachedPricingPromise = null;

/**
 * Lädt `api-backend/ai/ki-preise.js` faul (oder nutzt injiziertes Modul in Tests).
 * @param {any} injected
 */
async function resolvePricing(injected) {
  if (injected) return injected;
  if (!cachedPricingPromise) {
    cachedPricingPromise = import('../ai/ki-preise.js').catch((err) => {
      cachedPricingPromise = null;
      throw err;
    });
  }
  return cachedPricingPromise;
}

/**
 * Berechnet UTC-Monatsgrenzen `[startIso, endIso)`.
 * @param {string | undefined} rawMonth
 * @returns {{ ok: true, month: string, startIso: string, endIso: string } | { ok: false, error: string }}
 */
export function parseMonthUtc(rawMonth) {
  const month = (typeof rawMonth === 'string' && rawMonth.trim())
    ? rawMonth.trim()
    : new Date().toISOString().slice(0, 7);

  if (!MONTH_RE.test(month)) {
    return { ok: false, error: 'INVALID_MONTH' };
  }
  const [yStr, mStr] = month.split('-');
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  const start = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIdx + 1, 1, 0, 0, 0, 0));
  return { ok: true, month, startIso: start.toISOString(), endIso: end.toISOString() };
}

/**
 * Normalisiert `profiles.sector` / `businesses.sector` auf kanonische Cockpit-Fachbereiche.
 * @param {string | null | undefined} sector
 * @returns {'physiotherapie' | 'ergotherapie' | 'logopaedie' | 'podologie' | 'interdisziplinaer' | null}
 */
export function normalizeSectorToFachbereich(sector) {
  if (typeof sector !== 'string') return null;
  const key = sector.trim().toLowerCase();
  if (!key) return null;
  switch (key) {
    case 'physiotherapy':
    case 'physiotherapie':
      return 'physiotherapie';
    case 'ergotherapy':
    case 'ergotherapie':
      return 'ergotherapie';
    case 'logopaedie':
    case 'logopädie':
    case 'speech':
      return 'logopaedie';
    case 'podologie':
    case 'podiatry':
      return 'podologie';
    case 'interdisziplinaer':
    case 'interdisziplinär':
    case 'praxis':
    case 'massage':
    case 'other':
      return 'interdisziplinaer';
    default:
      return null;
  }
}

/**
 * Prüft auf PostgreSQL `42703` (undefined_column), damit noch nicht migrierte
 * Zusatzspalten (`reasoning_tokens`, `audio_seconds`) sauber abgefangen werden.
 * @param {any} error
 */
function isUndefinedColumnError(error) {
  if (!error) return false;
  if (error.code === '42703') return true;
  return /column\s+.*\s+does not exist/i.test(String(error.message || ''));
}

/**
 * Erzeugt einen Ops-Supabase-Client aus Env-Variablen (Singleton) oder liefert null.
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
let cachedEnvOpsSupabase = null;
let cachedEnvOpsKey = '';
export function getOpsSupabaseFromEnv() {
  const url = (process.env.OPS_SUPABASE_URL || '').trim();
  const key = (process.env.OPS_SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  const cacheTag = `${url}::${key}`;
  if (!cachedEnvOpsSupabase || cachedEnvOpsKey !== cacheTag) {
    cachedEnvOpsSupabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedEnvOpsKey = cacheTag;
  }
  return cachedEnvOpsSupabase;
}

/**
 * Express-Middleware für Cockpit-RBAC gegen das Ops-Supabase-Projekt.
 * @param {string[]} allowedRoles
 * @param {{ getOpsSupabase?: () => any }} [opts]
 */
export function requireCockpitRole(allowedRoles, { getOpsSupabase } = {}) {
  const allowedSet = new Set(Array.isArray(allowedRoles) ? allowedRoles : []);
  return async (req, res, next) => {
    try {
      const ops = getOpsSupabase ? getOpsSupabase() : getOpsSupabaseFromEnv();
      if (!ops) {
        return res.status(503).json({ error: 'COCKPIT_AUTH_NOT_CONFIGURED' });
      }

      const authHeader = String(req.headers?.authorization || '');
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      const token = match ? match[1].trim() : '';
      if (!token) {
        return res.status(401).json({ error: 'MISSING_BEARER_TOKEN' });
      }

      const { data: userData, error: userErr } = await ops.auth.getUser(token);
      if (userErr || !userData?.user?.id) {
        return res.status(401).json({ error: 'INVALID_TOKEN' });
      }

      const { data: member, error: memberErr } = await ops
        .from('ops_members')
        .select('id, email, display_name, role, is_active')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (memberErr) {
        console.error('[cockpit/auth] member lookup failed:', memberErr.code || memberErr.message);
        return res.status(500).json({ error: 'COCKPIT_MEMBER_LOOKUP_FAILED' });
      }

      if (!member || member.is_active === false) {
        return res.status(403).json({ error: 'COCKPIT_ACCESS_DENIED' });
      }

      if (!VALID_ROLES.has(member.role) || !allowedSet.has(member.role)) {
        return res.status(403).json({ error: 'COCKPIT_ROLE_FORBIDDEN' });
      }

      req.cockpitUser = member;
      return next();
    } catch (err) {
      console.error('[cockpit/auth] unexpected error:', err?.message || err);
      return res.status(500).json({ error: 'COCKPIT_AUTH_ERROR' });
    }
  };
}

/**
 * Lädt `ai_audit_log` für einen UTC-Monat (optional nach tenantId gefiltert).
 * Fällt bei `42703` automatisch auf Basisspalten ohne `reasoning_tokens`/`audio_seconds` zurück.
 * @param {any} supabase
 * @param {{ startIso: string, endIso: string, tenantId?: string | null }} params
 */
async function fetchAuditLogsForMonth(supabase, { startIso, endIso, tenantId = null }) {
  const fullSelect = 'tenant_id, task, model, prompt_tokens, completion_tokens, total_tokens, reasoning_tokens, audio_seconds, status, dry_run, created_at';
  const baseSelect = 'tenant_id, task, model, prompt_tokens, completion_tokens, total_tokens, status, dry_run, created_at';

  const runQuery = async (columns) => {
    const rows = [];
    let truncated = false;
    for (let page = 0; page < AUDIT_MAX_PAGES; page++) {
      let query = supabase
        .from('ai_audit_log')
        .select(columns)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('id', { ascending: true });

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const canPaginate = typeof query.range === 'function';
      if (canPaginate) {
        const from = page * AUDIT_PAGE_SIZE;
        query = query.range(from, from + AUDIT_PAGE_SIZE - 1);
      }

      const { data, error } = await query;
      if (error) return { data: null, error, truncated: false };
      const batch = Array.isArray(data) ? data : [];
      rows.push(...batch);
      if (!canPaginate || batch.length < AUDIT_PAGE_SIZE) break;
      if (page === AUDIT_MAX_PAGES - 1 && batch.length === AUDIT_PAGE_SIZE) {
        truncated = true;
      }
    }
    return { data: rows, error: null, truncated };
  };

  let extendedColumnsAvailable = true;
  let result = await runQuery(fullSelect);
  if (result.error && isUndefinedColumnError(result.error)) {
    extendedColumnsAvailable = false;
    result = await runQuery(baseSelect);
  }
  if (result.error) {
    throw result.error;
  }
  const normalized = (result.data || []).map((row) => ({
    ...row,
    reasoning_tokens: extendedColumnsAvailable ? (Number(row.reasoning_tokens) || 0) : 0,
    audio_seconds: extendedColumnsAvailable ? (Number(row.audio_seconds) || 0) : 0,
  }));
  return { rows: normalized, extendedColumnsAvailable, truncated: Boolean(result.truncated) };
}

/**
 * Lädt B2B-Inhaberprofile (`profiles` mit `role = 'owner'`), ohne PHI.
 * @param {any} supabase
 */
async function fetchOwnerProfiles(supabase) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, business_name, sector, plan, plan_status, trial_ends_at, billing_interval, created_at, is_active, avv_accepted_at')
    .eq('role', 'owner');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/**
 * Lädt Praxis-Metadaten aus `businesses` (ohne Kontakt-PII/PHI).
 * @param {any} supabase
 */
async function fetchBusinessesMeta(supabase) {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, owner_id, business_name, sector, is_default, created_at');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/**
 * Baut eine Map `ownerId -> { name, fachbereich, createdAt }` (bevorzugt `is_default`).
 * @param {any[]} profiles
 * @param {any[]} businesses
 */
function buildPracticeLookup(profiles, businesses) {
  /** @type {Map<string, any>} */
  const defaultBizByOwner = new Map();
  for (const b of businesses) {
    const ownerId = b.owner_id;
    if (!ownerId) continue;
    const prev = defaultBizByOwner.get(ownerId);
    if (!prev || (b.is_default && !prev.is_default)) {
      defaultBizByOwner.set(ownerId, b);
    }
  }

  /** @type {Map<string, { name: string, fachbereich: string | null, createdAt: string | null }>} */
  const lookup = new Map();
  for (const p of profiles) {
    const biz = defaultBizByOwner.get(p.id);
    const name = biz?.business_name ?? biz?.name ?? p.business_name ?? 'Unbenannte Praxis';
    const rawSector = biz?.sector || biz?.fachbereich || p.sector || null;
    const fachbereich = normalizeSectorToFachbereich(rawSector);
    const createdAt = biz?.created_at ?? p.created_at ?? null;
    lookup.set(p.id, { name, fachbereich, createdAt });
  }
  return lookup;
}

function emptyResourceBucket() {
  return {
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    audioSeconds: 0,
    costEur: 0,
  };
}

function roundEur(val) {
  return Math.round((Number(val) || 0) * 1_000_000) / 1_000_000;
}

/**
 * Aggregiert KI-Audit-Zeilen mit `berechneKiKostenEur`.
 * Dry-Run- und blockierte Aufrufe werden gezählt, aber mit 0 EUR bewertet.
 * @param {any[]} rows
 * @param {any} pricingApi
 */
function aggregateAuditRows(rows, pricingApi) {
  const totals = {
    calls: 0,
    successCalls: 0,
    errorCalls: 0,
    dryRunCalls: 0,
    promptTokens: 0,
    completionTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    audioSeconds: 0,
    costEur: 0,
    inputEur: 0,
    outputEur: 0,
    audioEur: 0,
    reasoningShareEur: 0,
  };

  /** @type {Record<string, ReturnType<typeof emptyResourceBucket>>} */
  const byResource = {
    'de-text': emptyResourceBucket(),
    'se-audio': emptyResourceBucket(),
    'se-legacy': emptyResourceBucket(),
    'unknown': emptyResourceBucket(),
  };

  const byModelMap = new Map();
  const byTaskMap = new Map();
  const byTenantMap = new Map();

  for (const row of rows) {
    const model = row.model || 'unknown';
    const task = row.task || 'unknown';
    const tenantId = row.tenant_id || 'unknown';
    const promptTokens = Number(row.prompt_tokens) || 0;
    const completionTokens = Number(row.completion_tokens) || 0;
    const reasoningTokens = Number(row.reasoning_tokens) || 0;
    const totalTokens = Number(row.total_tokens) || (promptTokens + completionTokens);
    const audioSeconds = Number(row.audio_seconds) || 0;
    const isDryRun = Boolean(row.dry_run);
    const status = String(row.status || 'ok');
    const isBillable = !isDryRun && status !== 'blocked';

    const calc = isBillable
      ? pricingApi.berechneKiKostenEur({
          model,
          promptTokens,
          completionTokens,
          reasoningTokens,
          audioSeconds,
        })
      : {
          costEur: 0,
          billingType: 'none',
          resource: pricingApi.KI_MODEL_PREISE?.[model]?.resource || 'unknown',
          knownModel: Boolean(pricingApi.KI_MODEL_PREISE?.[model]),
          breakdown: { inputEur: 0, outputEur: 0, audioEur: 0, reasoningShareEur: 0 },
        };

    const resKey = byResource[calc.resource] ? calc.resource : 'unknown';
    const costEur = Number(calc.costEur) || 0;
    const inputEur = Number(calc.breakdown?.inputEur) || 0;
    const outputEur = Number(calc.breakdown?.outputEur) || 0;
    const audioEur = Number(calc.breakdown?.audioEur) || 0;
    const reasoningShareEur = Number(calc.breakdown?.reasoningShareEur) || 0;

    totals.calls += 1;
    if (isDryRun) totals.dryRunCalls += 1;
    else if (status === 'error' || status === 'blocked') totals.errorCalls += 1;
    else totals.successCalls += 1;

    totals.promptTokens += promptTokens;
    totals.completionTokens += completionTokens;
    totals.reasoningTokens += reasoningTokens;
    totals.totalTokens += totalTokens;
    totals.audioSeconds += audioSeconds;
    totals.costEur += costEur;
    totals.inputEur += inputEur;
    totals.outputEur += outputEur;
    totals.audioEur += audioEur;
    totals.reasoningShareEur += reasoningShareEur;

    const rBucket = byResource[resKey];
    rBucket.calls += 1;
    rBucket.promptTokens += promptTokens;
    rBucket.completionTokens += completionTokens;
    rBucket.reasoningTokens += reasoningTokens;
    rBucket.totalTokens += totalTokens;
    rBucket.audioSeconds += audioSeconds;
    rBucket.costEur += costEur;

    if (!byModelMap.has(model)) {
      byModelMap.set(model, {
        model,
        resource: resKey,
        billingType: calc.billingType || 'unknown',
        knownModel: Boolean(calc.knownModel),
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        audioSeconds: 0,
        costEur: 0,
        breakdown: { inputEur: 0, outputEur: 0, audioEur: 0, reasoningShareEur: 0 },
      });
    }
    const mEntry = byModelMap.get(model);
    mEntry.calls += 1;
    mEntry.promptTokens += promptTokens;
    mEntry.completionTokens += completionTokens;
    mEntry.reasoningTokens += reasoningTokens;
    mEntry.totalTokens += totalTokens;
    mEntry.audioSeconds += audioSeconds;
    mEntry.costEur += costEur;
    mEntry.breakdown.inputEur += inputEur;
    mEntry.breakdown.outputEur += outputEur;
    mEntry.breakdown.audioEur += audioEur;
    mEntry.breakdown.reasoningShareEur += reasoningShareEur;

    if (!byTaskMap.has(task)) {
      byTaskMap.set(task, {
        task,
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        audioSeconds: 0,
        costEur: 0,
      });
    }
    const tEntry = byTaskMap.get(task);
    tEntry.calls += 1;
    tEntry.promptTokens += promptTokens;
    tEntry.completionTokens += completionTokens;
    tEntry.reasoningTokens += reasoningTokens;
    tEntry.totalTokens += totalTokens;
    tEntry.audioSeconds += audioSeconds;
    tEntry.costEur += costEur;

    if (!byTenantMap.has(tenantId)) {
      byTenantMap.set(tenantId, {
        tenantId,
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        audioSeconds: 0,
        costEur: 0,
        byResource: {
          'de-text': emptyResourceBucket(),
          'se-audio': emptyResourceBucket(),
          'se-legacy': emptyResourceBucket(),
          'unknown': emptyResourceBucket(),
        },
      });
    }
    const tenEntry = byTenantMap.get(tenantId);
    tenEntry.calls += 1;
    tenEntry.promptTokens += promptTokens;
    tenEntry.completionTokens += completionTokens;
    tenEntry.reasoningTokens += reasoningTokens;
    tenEntry.totalTokens += totalTokens;
    tenEntry.audioSeconds += audioSeconds;
    tenEntry.costEur += costEur;
    const tenRes = tenEntry.byResource[resKey];
    tenRes.calls += 1;
    tenRes.promptTokens += promptTokens;
    tenRes.completionTokens += completionTokens;
    tenRes.reasoningTokens += reasoningTokens;
    tenRes.totalTokens += totalTokens;
    tenRes.audioSeconds += audioSeconds;
    tenRes.costEur += costEur;
  }

  totals.costEur = roundEur(totals.costEur);
  totals.inputEur = roundEur(totals.inputEur);
  totals.outputEur = roundEur(totals.outputEur);
  totals.audioEur = roundEur(totals.audioEur);
  totals.reasoningShareEur = roundEur(totals.reasoningShareEur);

  for (const bucket of Object.values(byResource)) {
    bucket.costEur = roundEur(bucket.costEur);
  }

  for (const m of byModelMap.values()) {
    m.costEur = roundEur(m.costEur);
    m.breakdown.inputEur = roundEur(m.breakdown.inputEur);
    m.breakdown.outputEur = roundEur(m.breakdown.outputEur);
    m.breakdown.audioEur = roundEur(m.breakdown.audioEur);
    m.breakdown.reasoningShareEur = roundEur(m.breakdown.reasoningShareEur);
  }

  for (const t of byTaskMap.values()) {
    t.costEur = roundEur(t.costEur);
  }

  for (const ten of byTenantMap.values()) {
    ten.costEur = roundEur(ten.costEur);
    for (const bucket of Object.values(ten.byResource)) {
      bucket.costEur = roundEur(bucket.costEur);
    }
  }

  return { totals, byResource, byModelMap, byTaskMap, byTenantMap };
}

/**
 * Erzeugt den Express-Router für `/api/cockpit`.
 * @param {object} deps
 * @param {any} deps.supabase           Produkt-Supabase-Client (service_role)
 * @param {any} [deps.opsSupabase]      Ops-Supabase-Client (optional für Tests)
 * @param {any} [deps.pricing]          KI-Preismodul (optional für Tests)
 */
export function createCockpitRouter({ supabase, opsSupabase = null, pricing = null } = {}) {
  const router = Router();
  const getOpsSupabase = opsSupabase ? () => opsSupabase : getOpsSupabaseFromEnv;

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'RATE_LIMITED' },
  });
  router.use(limiter);

  const authAll = requireCockpitRole(['founder', 'tech', 'support', 'sales'], { getOpsSupabase });
  const authKi = requireCockpitRole(['founder', 'tech', 'support'], { getOpsSupabase });

  // ── GET /api/cockpit/overview?month=YYYY-MM ──────────────────────────────
  router.get('/overview', authAll, async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'COCKPIT_PRODUCT_DB_NOT_CONFIGURED' });
      const parsed = parseMonthUtc(/** @type {string | undefined} */ (req.query?.month));
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });

      const role = req.cockpitUser.role;
      const canSeeBilling = role === 'founder' || role === 'sales';
      const canSeeKiCosts = role === 'founder' || role === 'tech';

      const pricingApi = await resolvePricing(pricing);
      const [profiles, auditResult] = await Promise.all([
        fetchOwnerProfiles(supabase),
        fetchAuditLogsForMonth(supabase, { startIso: parsed.startIso, endIso: parsed.endIso }),
      ]);

      const agg = aggregateAuditRows(auditResult.rows, pricingApi);

      const byPlan = {};
      const byPlanStatus = {};
      let activeCount = 0;
      let trialsCount = 0;
      let pastDueCount = 0;
      const nowMs = Date.now();
      const soonCutoffMs = nowMs + 14 * 24 * 60 * 60 * 1000;
      const trialsExpiringSoon = [];

      for (const p of profiles) {
        if (p.is_active !== false) activeCount += 1;
        const planKey = p.plan || 'unknown';
        byPlan[planKey] = (byPlan[planKey] || 0) + 1;

        const st = p.plan_status || 'pending';
        byPlanStatus[st] = (byPlanStatus[st] || 0) + 1;
        if (st === 'trialing' || st === 'trial') trialsCount += 1;
        if (st === 'past_due') pastDueCount += 1;

        if (canSeeBilling && p.trial_ends_at) {
          const tMs = Date.parse(p.trial_ends_at);
          if (Number.isFinite(tMs) && tMs >= nowMs && tMs <= soonCutoffMs) {
            trialsExpiringSoon.push({
              tenantId: p.id,
              name: p.business_name || 'Praxis',
              trialEndsAt: p.trial_ends_at,
            });
          }
        }
      }

      const customersSummary = {
        totalOwners: profiles.length,
        activeCount,
        ...(canSeeBilling ? {
          byPlan,
          byPlanStatus,
          trialsCount,
          pastDueCount,
          trialsExpiringSoon,
        } : {}),
      };

      const kiSummary = {
        calls: agg.totals.calls,
        successCalls: agg.totals.successCalls,
        errorCalls: agg.totals.errorCalls,
        dryRunCalls: agg.totals.dryRunCalls,
        promptTokens: agg.totals.promptTokens,
        completionTokens: agg.totals.completionTokens,
        reasoningTokens: agg.totals.reasoningTokens,
        totalTokens: agg.totals.totalTokens,
        audioSeconds: agg.totals.audioSeconds,
        extendedColumnsAvailable: auditResult.extendedColumnsAvailable,
        ...(canSeeKiCosts ? {
          totalCostEur: agg.totals.costEur,
          byResource: agg.byResource,
          retirements: pricingApi.kiAbkuendigungen(new Date()),
          pricingStand: pricingApi.KI_PREISE_STAND,
        } : {}),
      };

      res.set('Cache-Control', 'no-store');
      return res.json({
        month: parsed.month,
        role,
        truncated: Boolean(auditResult.truncated),
        customers: customersSummary,
        ki: kiSummary,
      });
    } catch (err) {
      console.error('[cockpit/overview] error:', err?.message || err);
      return res.status(500).json({ error: 'COCKPIT_OVERVIEW_FAILED' });
    }
  });

  // ── GET /api/cockpit/customers?month=YYYY-MM ─────────────────────────────
  router.get('/customers', authAll, async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'COCKPIT_PRODUCT_DB_NOT_CONFIGURED' });
      const parsed = parseMonthUtc(/** @type {string | undefined} */ (req.query?.month));
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });

      const role = req.cockpitUser.role;
      const canSeeBilling = role === 'founder' || role === 'sales';
      const canSeeKiCosts = role === 'founder' || role === 'tech';

      const pricingApi = await resolvePricing(pricing);
      const [profiles, businesses, auditResult] = await Promise.all([
        fetchOwnerProfiles(supabase),
        fetchBusinessesMeta(supabase),
        fetchAuditLogsForMonth(supabase, { startIso: parsed.startIso, endIso: parsed.endIso }),
      ]);

      const practiceLookup = buildPracticeLookup(profiles, businesses);
      const agg = aggregateAuditRows(auditResult.rows, pricingApi);

      const customers = profiles.map((p) => {
        const meta = practiceLookup.get(p.id) || {
          name: p.business_name || 'Praxis',
          fachbereich: normalizeSectorToFachbereich(p.sector),
          createdAt: p.created_at || null,
        };
        const ki = agg.byTenantMap.get(p.id);

        const stripCost = (bucket) => canSeeKiCosts
          ? bucket
          : {
              calls: bucket.calls,
              promptTokens: bucket.promptTokens,
              completionTokens: bucket.completionTokens,
              reasoningTokens: bucket.reasoningTokens,
              totalTokens: bucket.totalTokens,
              audioSeconds: bucket.audioSeconds,
            };

        const kiSummary = ki
          ? {
              calls: ki.calls,
              promptTokens: ki.promptTokens,
              completionTokens: ki.completionTokens,
              reasoningTokens: ki.reasoningTokens,
              totalTokens: ki.totalTokens,
              audioSeconds: ki.audioSeconds,
              ...(canSeeKiCosts ? { costEur: ki.costEur } : {}),
              byResource: {
                'de-text': stripCost(ki.byResource['de-text']),
                'se-audio': stripCost(ki.byResource['se-audio']),
                'se-legacy': stripCost(ki.byResource['se-legacy']),
                'unknown': stripCost(ki.byResource['unknown']),
              },
            }
          : {
              calls: 0,
              promptTokens: 0,
              completionTokens: 0,
              reasoningTokens: 0,
              totalTokens: 0,
              audioSeconds: 0,
              ...(canSeeKiCosts ? { costEur: 0 } : {}),
              byResource: {
                'de-text': stripCost(emptyResourceBucket()),
                'se-audio': stripCost(emptyResourceBucket()),
                'se-legacy': stripCost(emptyResourceBucket()),
                'unknown': stripCost(emptyResourceBucket()),
              },
            };

        return {
          tenantId: p.id,
          name: meta.name,
          fachbereich: meta.fachbereich,
          plan: p.plan || null,
          isActive: p.is_active !== false,
          avvAcceptedAt: p.avv_accepted_at || null,
          createdAt: meta.createdAt,
          ...(canSeeBilling ? {
            planStatus: p.plan_status || 'pending',
            trialEndsAt: p.trial_ends_at || null,
            billingInterval: p.billing_interval || null,
          } : {}),
          ki: kiSummary,
        };
      });

      customers.sort((a, b) => {
        if (canSeeKiCosts) return (b.ki.costEur || 0) - (a.ki.costEur || 0);
        return (b.ki.calls || 0) - (a.ki.calls || 0);
      });

      res.set('Cache-Control', 'no-store');
      return res.json({
        month: parsed.month,
        role,
        extendedColumnsAvailable: auditResult.extendedColumnsAvailable,
        truncated: Boolean(auditResult.truncated),
        customers,
      });
    } catch (err) {
      console.error('[cockpit/customers] error:', err?.message || err);
      return res.status(500).json({ error: 'COCKPIT_CUSTOMERS_FAILED' });
    }
  });

  // ── GET /api/cockpit/ki-usage?month=YYYY-MM&tenantId=<optional> ──────────
  router.get('/ki-usage', authKi, async (req, res) => {
    try {
      if (!supabase) return res.status(503).json({ error: 'COCKPIT_PRODUCT_DB_NOT_CONFIGURED' });
      const parsed = parseMonthUtc(/** @type {string | undefined} */ (req.query?.month));
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });

      const rawTenantId = typeof req.query?.tenantId === 'string' ? req.query.tenantId.trim() : '';
      if (rawTenantId && !UUID_RE.test(rawTenantId)) {
        return res.status(400).json({ error: 'INVALID_TENANT_ID' });
      }
      const tenantId = rawTenantId || null;

      const role = req.cockpitUser.role;
      const canSeeCosts = role === 'founder' || role === 'tech';

      const pricingApi = await resolvePricing(pricing);
      const [profiles, businesses, auditResult] = await Promise.all([
        fetchOwnerProfiles(supabase),
        fetchBusinessesMeta(supabase),
        fetchAuditLogsForMonth(supabase, { startIso: parsed.startIso, endIso: parsed.endIso, tenantId }),
      ]);

      const practiceLookup = buildPracticeLookup(profiles, businesses);
      const agg = aggregateAuditRows(auditResult.rows, pricingApi);

      const stripCostFields = (obj) => {
        if (canSeeCosts) return obj;
        const copy = { ...obj };
        delete copy.costEur;
        delete copy.breakdown;
        delete copy.inputEur;
        delete copy.outputEur;
        delete copy.audioEur;
        delete copy.reasoningShareEur;
        return copy;
      };

      const byModel = [...agg.byModelMap.values()]
        .map(stripCostFields)
        .sort((a, b) => (canSeeCosts ? (b.costEur - a.costEur) : (b.calls - a.calls)));

      const byTask = [...agg.byTaskMap.values()]
        .map(stripCostFields)
        .sort((a, b) => (canSeeCosts ? (b.costEur - a.costEur) : (b.calls - a.calls)));

      const byResource = Object.fromEntries(
        Object.entries(agg.byResource).map(([k, v]) => [k, stripCostFields(v)])
      );

      const byTenant = [...agg.byTenantMap.values()]
        .map((ten) => {
          const meta = practiceLookup.get(ten.tenantId);
          return stripCostFields({
            tenantId: ten.tenantId,
            name: meta?.name || ten.tenantId,
            fachbereich: meta?.fachbereich || null,
            calls: ten.calls,
            promptTokens: ten.promptTokens,
            completionTokens: ten.completionTokens,
            reasoningTokens: ten.reasoningTokens,
            totalTokens: ten.totalTokens,
            audioSeconds: ten.audioSeconds,
            costEur: ten.costEur,
          });
        })
        .sort((a, b) => (canSeeCosts ? (b.costEur - a.costEur) : (b.calls - a.calls)));

      res.set('Cache-Control', 'no-store');
      return res.json({
        month: parsed.month,
        tenantId,
        role,
        extendedColumnsAvailable: auditResult.extendedColumnsAvailable,
        truncated: Boolean(auditResult.truncated),
        totals: stripCostFields(agg.totals),
        byModel,
        byTask,
        byResource,
        byTenant,
        ...(canSeeCosts ? {
          pricingMeta: {
            stand: pricingApi.KI_PREISE_STAND,
            models: pricingApi.KI_MODEL_PREISE,
            retirements: pricingApi.kiAbkuendigungen(new Date()),
          },
        } : {}),
      });
    } catch (err) {
      console.error('[cockpit/ki-usage] error:', err?.message || err);
      return res.status(500).json({ error: 'COCKPIT_KI_USAGE_FAILED' });
    }
  });

  return router;
}
