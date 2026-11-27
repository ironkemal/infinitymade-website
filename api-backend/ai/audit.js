// Audit logger — every AI call writes one row to ai_audit_log.
// Failures to write must not break the request flow (best-effort).
//
// M4 Logging/Privacy Contract Guarantees:
// - HMAC request hashing with random process-only seed (no raw content hashes).
// - Console and audit errors log fixed technical codes only, never raw error/message/cause or prompts.
// - Error field in ai_audit_log is sanitized to fixed technical code via safeAiError.
// - makeUsageAggregateSupplier exports cumulative UTC daily aggregates by known task.
//   No PHI or per-request timestamps; numeric counts only; finite pagination with completeness failure.
//   Informational consumption, never billing/quota proof.

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { createAiConfig } from './ki-config.js';
import { hashRequest, safeAiError, KNOWN_AI_TASKS } from './ki-privacy.js';
import { normalisiereKiModell } from './ki-preise.js';

export { hashRequest, safeAiError };

const ALLOWED_AUDIT_MODELS = new Set([
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'whisper',
  'gpt-4o-transcribe',
  'gpt-4o-mini-transcribe',
]);
const ALLOWED_AUDIT_STATUSES = new Set(['ok', 'success', 'error', 'blocked', 'rueckfrage']);
const EXTENDED_AUDIT_SELECT = 'task, prompt_tokens, completion_tokens, total_tokens, reasoning_tokens, audio_seconds';
const LEGACY_AUDIT_SELECT = 'task, prompt_tokens, completion_tokens, total_tokens';

/**
 * Detects Postgres `42703` (`undefined_column`) or schema-cache errors when
 * Entwurf 0136 (`reasoning_tokens`, `audio_seconds`) has not yet been applied.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
function isUndefinedAuditColumnError(err) {
  if (!err || typeof err !== 'object') return false;
  const record = /** @type {{ code?: unknown, message?: unknown, details?: unknown, hint?: unknown }} */ (err);
  if (record.code === '42703') return true;
  const text = [record.message, record.details, record.hint]
    .filter((v) => typeof v === 'string')
    .join(' ')
    .toLowerCase();
  return text.includes('reasoning_tokens') || text.includes('audio_seconds') || text.includes('does not exist');
}

/**
 * @typedef {{ prompt_tokens?: number | null, completion_tokens?: number | null, total_tokens?: number | null, reasoning_tokens?: number | null, audio_seconds?: number | null }} AiTokenUsage
 * @typedef {{
 *   tenantId?: string | null,
 *   userId?: string | null,
 *   task: string,
 *   model?: string | null,
 *   deployment?: string | null,
 *   usage?: AiTokenUsage | null,
 *   latencyMs?: number | null,
 *   status?: string | null,
 *   error?: unknown,
 *   dryRun?: boolean,
 *   requestHash?: string | null
 * }} LogCallInput
 * @typedef {{ calls: number, prompt_tokens: number, completion_tokens: number, total_tokens: number, reasoning_tokens?: number, audio_seconds?: number }} TaskAggregate
 * @typedef {{
 *   now?: number | Date | (() => number | Date),
 *   boxId?: string,
 *   pageSize?: number,
 *   maxPages?: number,
 *   knownTasks?: Set<string>
 * }} UsageAggregateOptions
 * @typedef {Error & { code?: string }} AuditError
 */

/**
 * @param {string} message
 * @param {string} code
 * @returns {AuditError}
 */
function createAuditError(message, code) {
  /** @type {AuditError} */
  const err = new Error(message);
  err.code = code;
  return err;
}

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let defaultSupabase = null;
/** @returns {import('@supabase/supabase-js').SupabaseClient | null} */
function getSupabaseClient() {
  if (!defaultSupabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    defaultSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return defaultSupabase;
}

/**
 * @param {LogCallInput} entry
 * @param {import('@supabase/supabase-js').SupabaseClient | null} [client=null]
 * @returns {Promise<void>}
 */
export async function logCall({
  tenantId,
  userId,
  task,
  model,
  deployment,
  usage = {},
  latencyMs,
  status,
  error = null,
  dryRun = false,
  requestHash = null
}, client = null) {
  try {
    const supabase = client || getSupabaseClient();
    if (!supabase) {
      console.error('[ai/audit] AUDIT_CLIENT_MISSING');
      return;
    }

    const safeTask = typeof task === 'string' && KNOWN_AI_TASKS.has(task) ? task : 'unknown';
    const normalizedModel = normalisiereKiModell(model);
    const safeModel = normalizedModel && ALLOWED_AUDIT_MODELS.has(normalizedModel) ? normalizedModel : null;
    const currentCfg = createAiConfig();
    const safeDeployment = (deployment === currentCfg.deployment || (currentCfg.transcribeDeployment && deployment === currentCfg.transcribeDeployment)) ? deployment : null;
    const safeStatus = typeof status === 'string' && ALLOWED_AUDIT_STATUSES.has(status) ? status : 'unknown';

    const pt = Number.isSafeInteger(usage?.prompt_tokens) && typeof usage?.prompt_tokens === 'number' && usage.prompt_tokens >= 0 ? usage.prompt_tokens : null;
    const ct = Number.isSafeInteger(usage?.completion_tokens) && typeof usage?.completion_tokens === 'number' && usage.completion_tokens >= 0 ? usage.completion_tokens : null;
    const tt = Number.isSafeInteger(usage?.total_tokens) && typeof usage?.total_tokens === 'number' && usage.total_tokens >= 0 ? usage.total_tokens : null;
    const rt = Number.isSafeInteger(usage?.reasoning_tokens) && typeof usage?.reasoning_tokens === 'number' && usage.reasoning_tokens >= 0 ? usage.reasoning_tokens : null;
    const as = Number.isSafeInteger(usage?.audio_seconds) && typeof usage?.audio_seconds === 'number' && usage.audio_seconds >= 0 ? usage.audio_seconds : null;

    const lat = Number.isInteger(latencyMs) ? latencyMs : null;
    const safeErrorCode = error ? safeAiError(error).code : null;

    const legacyRow = {
      tenant_id: tenantId,
      user_id: userId,
      task: safeTask,
      model: safeModel,
      deployment: safeDeployment,
      prompt_tokens: pt,
      completion_tokens: ct,
      total_tokens: tt,
      latency_ms: lat,
      status: safeStatus,
      error: safeErrorCode,
      dry_run: !!dryRun,
      request_hash: typeof requestHash === 'string' && /^[a-f0-9]{64}$/i.test(requestHash) ? requestHash : null
    };
    let { error: insErr } = await supabase.from('ai_audit_log').insert({
      ...legacyRow,
      reasoning_tokens: rt,
      audio_seconds: as,
    });
    if (insErr && isUndefinedAuditColumnError(insErr)) {
      ({ error: insErr } = await supabase.from('ai_audit_log').insert(legacyRow));
    }
    if (insErr) {
      console.error('[ai/audit] AUDIT_INSERT_FAILED');
    }
  } catch {
    console.error('[ai/audit] AUDIT_EXCEPTION');
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {string} tenantId
 * @param {UsageAggregateOptions} [options={}]
 * @returns {(at?: number | Date) => Promise<{ reportId: string, windowStart: string, windowEnd: string, taskTotals: Record<string, TaskAggregate> }>}
 */
export function makeUsageAggregateSupplier(supabase, tenantId, options = {}) {
  if (!supabase || typeof supabase.from !== 'function') {
    throw new Error('Supabase-Client erforderlich');
  }
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('Gültige tenantId erforderlich');
  }

  const {
    now,
    boxId = 'default',
    pageSize = 1000,
    maxPages = 20,
    knownTasks = KNOWN_AI_TASKS
  } = options;

  // `at` (optional, ms/Date): Tag des Abschlussberichts (O-186) — gleiches Fenster, gleiche reportId.
  return async function usageAggregateSupplier(at) {
    /** @type {Date} */
    let currentDate;
    if (at != null) {
      currentDate = new Date(at);
    } else if (typeof now === 'function') {
      currentDate = new Date(now());
    } else if (now != null) {
      currentDate = new Date(now);
    } else {
      currentDate = new Date();
    }

    if (isNaN(currentDate.getTime())) {
      throw createAuditError('Ungültige Zeitstempel', 'AI_AGGREGATE_INVALID_TIME');
    }

    const y = currentDate.getUTCFullYear();
    const m = currentDate.getUTCMonth();
    const d = currentDate.getUTCDate();

    const windowStart = new Date(Date.UTC(y, m, d, 0, 0, 0, 0)).toISOString();
    const windowEnd = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0)).toISOString();

    const dateSegment = `${y}${String(m + 1).padStart(2, '0')}${String(d).padStart(2, '0')}`;

    // Stable report id full tenant/boxHMAC digest avoids prefixcollision
    const safeBoxId = typeof boxId === 'string' ? boxId : 'default';
    const digest = crypto.createHmac('sha256', 'report_salt').update(`${tenantId}:${safeBoxId}`).digest('hex').slice(0, 40);
    const reportId = `rep_${dateSegment}_${digest}`.slice(0, 64);

    /** @type {Record<string, TaskAggregate>} */
    const taskTotals = {};
    let pageIndex = 0;
    let hasMore = true;
    let selectCols = EXTENDED_AUDIT_SELECT;

    while (hasMore) {
      if (pageIndex >= maxPages) {
        throw createAuditError('Aggregatabruf unvollständig: Seitenlimit überschritten', 'AI_AGGREGATE_INCOMPLETE');
      }

      const from = pageIndex * pageSize;
      const to = from + pageSize - 1;

      /** @param {string} cols */
      const runPageQuery = (cols) => {
        let query = supabase
          .from('ai_audit_log')
          .select(cols)
          .eq('tenant_id', tenantId)
          .eq('dry_run', false)
          .gte('created_at', windowStart)
          .lt('created_at', windowEnd); // exclusive next midnight

        if (typeof query.order === 'function') {
          query = query.order('id', { ascending: true });
        }

        return query.range(from, to);
      };

      let { data, error } = await runPageQuery(selectCols);
      if (error && selectCols === EXTENDED_AUDIT_SELECT && isUndefinedAuditColumnError(error)) {
        selectCols = LEGACY_AUDIT_SELECT;
        ({ data, error } = await runPageQuery(selectCols));
      }

      if (error) {
        throw createAuditError('Datenbankabfrage für Nutzungsaggregat fehlgeschlagen', 'AI_AGGREGATE_QUERY_FAILED');
      }

      if (!Array.isArray(data)) {
        throw createAuditError('Ungültige Datenantwort der Datenbank', 'AI_AGGREGATE_MALFORMED');
      }

      for (const rawRow of data) {
        if (!rawRow || typeof rawRow !== 'object') {
          throw createAuditError('Ungültiger Datensatz im Audit-Log', 'AI_AGGREGATE_MALFORMED');
        }
        const row = /** @type {Record<string, unknown>} */ (rawRow);

        const task = row.task;
        if (typeof task !== 'string' || !knownTasks.has(task)) {
          throw createAuditError('Unbekannter Task im Audit-Log', 'AI_AGGREGATE_MALFORMED_TASK');
        }

        const pt = row.prompt_tokens == null ? 0 : Number(row.prompt_tokens);
        const ct = row.completion_tokens == null ? 0 : Number(row.completion_tokens);
        const tt = row.total_tokens == null ? 0 : Number(row.total_tokens);
        const rt = row.reasoning_tokens == null ? 0 : Number(row.reasoning_tokens);
        const as = row.audio_seconds == null ? 0 : Number(row.audio_seconds);

        if (
          !Number.isInteger(pt) || pt < 0 ||
          !Number.isInteger(ct) || ct < 0 ||
          !Number.isInteger(tt) || tt < 0 ||
          !Number.isInteger(rt) || rt < 0 ||
          !Number.isInteger(as) || as < 0
        ) {
          throw createAuditError('Ungültige Token-Metriken im Audit-Log', 'AI_AGGREGATE_MALFORMED_METRIC');
        }

        if (!taskTotals[task]) {
          taskTotals[task] = {
            calls: 0,
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          };
        }

        const nextPt = taskTotals[task].prompt_tokens + pt;
        const nextCt = taskTotals[task].completion_tokens + ct;
        const nextTt = taskTotals[task].total_tokens + tt;
        const nextRt = (taskTotals[task].reasoning_tokens || 0) + rt;
        const nextAs = (taskTotals[task].audio_seconds || 0) + as;

        if (
          nextPt > Number.MAX_SAFE_INTEGER ||
          nextCt > Number.MAX_SAFE_INTEGER ||
          nextTt > Number.MAX_SAFE_INTEGER ||
          nextRt > Number.MAX_SAFE_INTEGER ||
          nextAs > Number.MAX_SAFE_INTEGER
        ) {
          throw createAuditError('Token overflow', 'AI_AGGREGATE_OVERFLOW');
        }

        taskTotals[task].calls += 1;
        taskTotals[task].prompt_tokens = nextPt;
        taskTotals[task].completion_tokens = nextCt;
        taskTotals[task].total_tokens = nextTt;
        if (nextRt > 0) taskTotals[task].reasoning_tokens = nextRt;
        if (nextAs > 0) taskTotals[task].audio_seconds = nextAs;
      }

      if (data.length < pageSize) {
        hasMore = false;
      } else {
        pageIndex += 1;
      }
    }

    return {
      reportId,
      windowStart,
      windowEnd,
      taskTotals
    };
  };
}


// Lazy reuse of the existing audit client; no second counter or content store.
/** @returns {import('@supabase/supabase-js').SupabaseClient | null} */
export function getAiSupabaseClient() { return getSupabaseClient(); }
/**
 * @param {string} tenantId
 * @returns {(at?: number | Date) => Promise<{ reportId: string, windowStart: string, windowEnd: string, taskTotals: Record<string, TaskAggregate> }>}
 */
export function makeDefaultUsageAggregateSupplier(tenantId) {
  return (at) => makeUsageAggregateSupplier(getSupabaseClient(), tenantId)(at);
}
