-- database_v31_messreihen_blanko.sql
-- 1. Blankoverordnung Ampel alanları
-- 2. Messreihen (VAS/ROM) tablosu

-- ── 1. prescriptions: Blanko Ampel-System alanları ──────────────────────────
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS heilmittel_typ_blanko TEXT,
  ADD COLUMN IF NOT EXISTS vorrangig_einheiten    INTEGER,
  ADD COLUMN IF NOT EXISTS ergaenzend_einheiten   INTEGER;

-- ── 2. messreihen tablosu ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messreihen (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES public.leads(id)         ON DELETE CASCADE,
  prescription_id UUID          REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  typ             TEXT NOT NULL CHECK (typ IN ('VAS', 'ROM', 'kraft', 'custom')),
  koerperteil     TEXT,
  wert            NUMERIC(6,2)  NOT NULL,
  einheit         TEXT NOT NULL DEFAULT 'Punkte',
  gemessen_am     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  notiz           TEXT,
  erfasst_von     UUID          REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messreihen_lead    ON public.messreihen (lead_id, gemessen_am);
CREATE INDEX IF NOT EXISTS idx_messreihen_owner   ON public.messreihen (owner_id);

ALTER TABLE public.messreihen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messreihen_owner_access" ON public.messreihen;
CREATE POLICY "messreihen_owner_access" ON public.messreihen
  FOR ALL USING (
    owner_id = auth.uid()
    OR owner_id IN (
      SELECT owner_id FROM public.profiles WHERE id = auth.uid()
    )
  );
