-- ==============================================
-- INFINITY V18 — DTA-Pro Stripe addon flag
-- 2026-05-19
-- ==============================================
-- Adds tracking for the optional "DTA-Pro" subscription addon (+29 €/mo) that
-- gates the §302 SGB V Sammelabrechnung module (sidebar entry "Kassenabrechnung").
--
-- has_dta_pro                    — true while the addon is in the user's
--                                  Stripe subscription items list (active OR trialing).
-- dta_pro_subscription_item_id   — Stripe subscription_item id, used for
--                                  remove (DELETE /subscription_items/:id).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_dta_pro BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dta_pro_subscription_item_id TEXT;

-- During the pilot, grant DTA-Pro to all physiotherapy/praxis owners that
-- already have a paid plan, so the gating change does not break their workflow.
-- (Idempotent — only flips false → true.)
UPDATE profiles
SET has_dta_pro = TRUE
WHERE role = 'owner'
  AND sector IN ('physiotherapy', 'praxis')
  AND plan_status IN ('trial', 'active', 'past_due')
  AND has_dta_pro IS NOT TRUE;
