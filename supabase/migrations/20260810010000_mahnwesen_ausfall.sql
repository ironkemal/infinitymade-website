-- Mahnungen auch für Ausfallrechnungen (Loop-Liste "Kassieren", Aufgabe 9)
--
-- Blocker war: mahnungen.prescription_id ist NOT NULL (database_v28_mahnwesen.sql),
-- eine Ausfallrechnung hat aber kein Rezept. Schemaumbau freigegeben von Melih
-- am 10.08.2026.
--
-- Eine Mahnung bezieht sich künftig auf GENAU EINE Quelle: entweder auf ein
-- Rezept (offene Zuzahlung) oder auf eine Ausfallrechnung. Der CHECK verhindert
-- beides gleichzeitig und auch keines von beidem.

ALTER TABLE public.mahnungen
  ALTER COLUMN prescription_id DROP NOT NULL;

ALTER TABLE public.mahnungen
  ADD COLUMN IF NOT EXISTS ausfallrechnung_id uuid
    REFERENCES public.ausfallrechnungen(id) ON DELETE CASCADE;

ALTER TABLE public.mahnungen
  DROP CONSTRAINT IF EXISTS mahnungen_genau_eine_quelle;
ALTER TABLE public.mahnungen
  ADD CONSTRAINT mahnungen_genau_eine_quelle
    CHECK (num_nonnulls(prescription_id, ausfallrechnung_id) = 1);

CREATE INDEX IF NOT EXISTS idx_mahnungen_ausfall
  ON public.mahnungen (ausfallrechnung_id);

COMMENT ON COLUMN public.mahnungen.ausfallrechnung_id IS
  'Gemahnte Ausfallrechnung. Genau eines von prescription_id / ausfallrechnung_id ist gesetzt (CHECK mahnungen_genau_eine_quelle).';
