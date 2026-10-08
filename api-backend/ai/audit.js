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

export { hashRequest, safeAiError };

let defaultSupabase = null;
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
    const safeModel = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'].includes(model) ? model : null;
    const safeDeployment = deployment === createAiConfig().deployment ? deployment : null;
    const safeStatus = ['ok', 'success', 'error', 'blocked'].includes(status) ? status : 'unknown';

    const pt = Number.isSafeInteger(usage?.prompt_tokens) && usage.prompt_tokens >= 0 ? usage.prompt_tokens : null;
    const ct = Number.isSafeInteger(usage?.completion_tokens) && usage.completion_tokens >= 0 ? usage.completion_tokens : null;
    const tt = Number.isSafeInteger(usage?.total_tokens) && usage.total_tokens >= 0 ? usage.total_tokens : null;

    const lat = Number.isInteger(latencyMs) ? latencyMs : null;
    const safeErrorCode = error ? safeAiError(error).code : null;

    const { error: insErr } = await supabase.from('ai_audit_log').insert({
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
    });
    if (insErr) {
      console.error('[ai/audit] AUDIT_INSERT_FAILED');
    }
  } catch {
    console.error('[ai/audit] AUDIT_EXCEPTION');
  }
}

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

  return async function usageAggregateSupplier() {
    let currentDate;
    if (typeof now === 'function') {
      currentDate = new Date(now());
    } else if (now != null) {
      currentDate = new Date(now);
    } else {
      currentDate = new Date();
    }

    if (isNaN(currentDate.getTime())) {
      const err = new Error('Ungültige Zeitstempel');
      err.code = 'AI_AGGREGATE_INVALID_TIME';
      throw err;
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

    const taskTotals = {};
    let pageIndex = 0;
    let hasMore = true;

    while (hasMore) {
      if (pageIndex >= maxPages) {
        const err = new Error('Aggregatabruf unvollständig: Seitenlimit überschritten');
        err.code = 'AI_AGGREGATE_INCOMPLETE';
        throw err;
      }

      const from = pageIndex * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('ai_audit_log')
        .select('task, prompt_tokens, completion_tokens, total_tokens')
        .eq('tenant_id', tenantId)
        .eq('dry_run', false)
        .gte('created_at', windowStart)
        .lt('created_at', windowEnd); // exclusive next midnight

      if (typeof query.order === 'function') {
        query = query.order('id', { ascending: true });
      }

      const { data, error } = await query.range(from, to);

      if (error) {
        const err = new Error('Datenbankabfrage für Nutzungsaggregat fehlgeschlagen');
        err.code = 'AI_AGGREGATE_QUERY_FAILED';
        throw err;
      }

      if (!Array.isArray(data)) {
        const err = new Error('Ungültige Datenantwort der Datenbank');
        err.code = 'AI_AGGREGATE_MALFORMED';
        throw err;
      }

      for (const row of data) {
        if (!row || typeof row !== 'object') {
          const err = new Error('Ungültiger Datensatz im Audit-Log');
          err.code = 'AI_AGGREGATE_MALFORMED';
          throw err;
        }

        const task = row.task;
        if (typeof task !== 'string' || !knownTasks.has(task)) {
          const err = new Error('Unbekannter Task im Audit-Log');
          err.code = 'AI_AGGREGATE_MALFORMED_TASK';
          throw err;
        }

        const pt = row.prompt_tokens == null ? 0 : Number(row.prompt_tokens);
        const ct = row.completion_tokens == null ? 0 : Number(row.completion_tokens);
        const tt = row.total_tokens == null ? 0 : Number(row.total_tokens);

        if (
          !Number.isInteger(pt) || pt < 0 ||
          !Number.isInteger(ct) || ct < 0 ||
          !Number.isInteger(tt) || tt < 0
        ) {
          const err = new Error('Ungültige Token-Metriken im Audit-Log');
          err.code = 'AI_AGGREGATE_MALFORMED_METRIC';
          throw err;
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

        if (nextPt > Number.MAX_SAFE_INTEGER || nextCt > Number.MAX_SAFE_INTEGER || nextTt > Number.MAX_SAFE_INTEGER) {
          const err = new Error('Token overflow');
          err.code = 'AI_AGGREGATE_OVERFLOW';
          throw err;
        }

        taskTotals[task].calls += 1;
        taskTotals[task].prompt_tokens = nextPt;
        taskTotals[task].completion_tokens = nextCt;
        taskTotals[task].total_tokens = nextTt;
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
export function getAiSupabaseClient() { return getSupabaseClient(); }
export function makeDefaultUsageAggregateSupplier(tenantId) {
  return () => makeUsageAggregateSupplier(getSupabaseClient(), tenantId)();
}
