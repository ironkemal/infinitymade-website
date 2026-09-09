-- ==============================================
-- INFINITY V9 - AI Audit Log (Phase 0)
-- 2026-05-16
--
-- Unified gateway for ALL AI calls (Azure OpenAI Frankfurt).
-- Every request flowing through /api/ai/* writes one row here.
-- Purpose: GDPR audit trail, per-tenant cost observability, debugging.
-- ==============================================

CREATE TABLE IF NOT EXISTS ai_audit_log (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  task              TEXT NOT NULL,
  model             TEXT,
  deployment        TEXT,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  latency_ms        INTEGER,
  status            TEXT NOT NULL,
  error             TEXT,
  dry_run           BOOLEAN DEFAULT FALSE,
  request_hash      TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_tenant_created
  ON ai_audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_audit_task_created
  ON ai_audit_log (task, created_at DESC);

ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_audit_select_own" ON ai_audit_log;
CREATE POLICY "ai_audit_select_own" ON ai_audit_log
  FOR SELECT USING (auth.uid() = tenant_id);

-- INSERT happens via service_role from the AI gateway; no anon insert policy.
