-- 0136_ai_audit_reasoning_and_audio.sql
-- Entwurf 0136 — vor Live-Apply (nach GO) nach api-backend/db/migrations/0136_ai_audit_reasoning_and_audio.sql verschieben, SaaS-Datum setzen, erwartete-zaehler.json und db/SCHEMA*.sql erneuern
-- Zaehlerneutral (nur 2 nullable Spalten auf public.ai_audit_log).
--
-- Zweck (Faz 1A KI-Tracking & Kostenrechnung):
--   1. `reasoning_tokens`: speichert verdeckte Reasoning-Tokens bei Reasoning-Modellen (z. B. gpt-5-Familie).
--      Teilmenge von `completion_tokens` (Azure berechnet sie als Completion-Tokens) — niemals doppelt bepreisen.
--   2. `audio_seconds`: speichert abrechenbare Transkriptionsdauer in Sekunden (Audio-Modelle wie
--      `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `whisper`).
--
-- Abwaertskompatibilitaet:
--   Beide Spalten sind NULLABLE mit DEFAULT NULL und nicht-negativem CHECK; aeltere Box-Images und
--   bestehende Eintraege ohne diese Felder bleiben 100 % kompatibel.

BEGIN;

ALTER TABLE public.ai_audit_log
  ADD COLUMN IF NOT EXISTS reasoning_tokens integer DEFAULT NULL CHECK (reasoning_tokens IS NULL OR reasoning_tokens >= 0),
  ADD COLUMN IF NOT EXISTS audio_seconds integer DEFAULT NULL CHECK (audio_seconds IS NULL OR audio_seconds >= 0);

COMMENT ON COLUMN public.ai_audit_log.reasoning_tokens IS
  'Hidden reasoning token count (subset of completion_tokens; never billed twice — Azure bills reasoning tokens as completion tokens).';

COMMENT ON COLUMN public.ai_audit_log.audio_seconds IS
  'Billable audio transcription duration in seconds for audio models (e.g. gpt-4o-transcribe, whisper).';

COMMIT;
