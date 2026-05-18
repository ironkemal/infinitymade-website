-- ==============================================
-- INFINITY V17 — Abrechnung PKCS#7 signed file tracking
-- 2026-05-19
-- ==============================================

ALTER TABLE abrechnung ADD COLUMN IF NOT EXISTS signed_storage_path TEXT;
ALTER TABLE abrechnung ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE abrechnung ADD COLUMN IF NOT EXISTS signed_by_cert_thumbprint TEXT;
