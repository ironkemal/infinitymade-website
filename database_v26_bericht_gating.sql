-- v26: Gating of Therapieberichte (Physician Reports)
-- Block billing of prescriptions if a report was requested but is not finalized ('erledigt')

ALTER TABLE public.prescriptions 
  ADD COLUMN IF NOT EXISTS bericht_angefordert BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS bericht_status TEXT DEFAULT 'offen' NOT NULL CHECK (bericht_status IN ('offen', 'in_arbeit', 'erledigt'));

CREATE INDEX IF NOT EXISTS idx_prescriptions_bericht_status 
  ON public.prescriptions (bericht_angefordert, bericht_status);
