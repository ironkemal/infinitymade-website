// Audit logger — every AI call writes one row to ai_audit_log.
// Failures to write must not break the request flow (best-effort).

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export function hashRequest(payload) {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
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
}) {
  try {
    const { error: insErr } = await supabase.from('ai_audit_log').insert({
      tenant_id: tenantId,
      user_id: userId,
      task,
      model: model || null,
      deployment: deployment || null,
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null,
      latency_ms: latencyMs ?? null,
      status,
      error: error ? String(error).slice(0, 1000) : null,
      dry_run: !!dryRun,
      request_hash: requestHash
    });
    if (insErr) console.error('[ai/audit] insert failed:', insErr.message);
  } catch (e) {
    console.error('[ai/audit] exception:', e.message);
  }
}
