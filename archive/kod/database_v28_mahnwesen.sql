-- v28: Mahnwesen — payment dunning table for overdue Zuzahlung invoices.
--
-- Tracks reminder letters sent to patients who haven't paid their co-payment.
-- Level: 1=Zahlungserinnerung, 2=1. Mahnung, 3=2. Mahnung (letzte Mahnung)
-- Status: offen → bezahlt | abgeschrieben

CREATE TABLE IF NOT EXISTS public.mahnungen (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prescription_id  UUID    NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  patient_id       UUID    REFERENCES public.leads(id) ON DELETE SET NULL,
  mahnung_nr       BIGINT  NOT NULL,
  level            SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 3),
  amount_eur       NUMERIC(10,2) NOT NULL,
  original_faelligkeit DATE NOT NULL,
  neue_faelligkeit DATE    NOT NULL,
  sent_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  status           TEXT    NOT NULL DEFAULT 'offen'
                   CHECK (status IN ('offen', 'bezahlt', 'abgeschrieben')),
  notes            TEXT,
  UNIQUE (owner_id, mahnung_nr)
);

CREATE INDEX IF NOT EXISTS idx_mahnungen_owner_status
  ON public.mahnungen (owner_id, status, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_mahnungen_prescription
  ON public.mahnungen (prescription_id);

-- Auto-increment mahnung_nr per owner (same pattern as belegliste)
CREATE OR REPLACE FUNCTION set_next_mahnung_nr()
RETURNS TRIGGER AS $$
DECLARE next_nr BIGINT;
BEGIN
  SELECT COALESCE(MAX(mahnung_nr), 0) + 1 INTO next_nr
    FROM public.mahnungen WHERE owner_id = NEW.owner_id;
  NEW.mahnung_nr := next_nr;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_mahnung_nr ON public.mahnungen;
CREATE TRIGGER trg_set_mahnung_nr
  BEFORE INSERT ON public.mahnungen
  FOR EACH ROW
  WHEN (NEW.mahnung_nr IS NULL OR NEW.mahnung_nr = 0)
  EXECUTE FUNCTION set_next_mahnung_nr();

-- RLS
ALTER TABLE public.mahnungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mahnungen_select" ON public.mahnungen FOR SELECT
  USING (
    auth.uid() = owner_id
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = mahnungen.owner_id)
  );

CREATE POLICY "mahnungen_insert" ON public.mahnungen FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "mahnungen_update" ON public.mahnungen FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
