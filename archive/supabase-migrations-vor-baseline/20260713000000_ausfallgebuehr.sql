-- Ausfallgebühr (no-show / late-cancel fee) — per-business settings + private invoices
-- Applied to live DB 2026-07-13 via MCP (migration name: ausfallgebuehr)

-- 1. Per-business settings
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS ausfall_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ausfall_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS ausfall_amount_eur numeric(10,2),
  ADD COLUMN IF NOT EXISTS ausfall_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS ausfall_cutoff_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS ausfall_hinweis text;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_ausfall_mode_check CHECK (ausfall_mode IN ('fixed','percent'));

COMMENT ON COLUMN public.businesses.ausfall_enabled IS 'Ausfallgebühr aktiv: bei No-Show/kurzfristiger Absage kann eine private Ausfallrechnung erstellt werden';
COMMENT ON COLUMN public.businesses.ausfall_cutoff_hours IS 'Absagefrist in Stunden — spätere Absagen gelten als Ausfall';
COMMENT ON COLUMN public.businesses.ausfall_hinweis IS 'Eigener Hinweistext auf der Ausfallrechnung (z.B. Verweis auf die Ausfallvereinbarung)';

-- 2. Ausfallrechnungen
CREATE TABLE public.ausfallrechnungen (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  rechnung_nr bigint NOT NULL,
  reason text NOT NULL DEFAULT 'no_show',
  amount_eur numeric(10,2) NOT NULL,
  leistung_datum timestamp with time zone,
  service_name text,
  status text NOT NULL DEFAULT 'offen',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid,
  bezahlt_at timestamp with time zone,
  CONSTRAINT ausfallrechnungen_reason_check CHECK (reason IN ('no_show','late_cancel')),
  CONSTRAINT ausfallrechnungen_amount_check CHECK (amount_eur > 0),
  CONSTRAINT ausfallrechnungen_status_check CHECK (status IN ('offen','bezahlt','storniert','abgeschrieben'))
);

COMMENT ON TABLE public.ausfallrechnungen IS 'Private Ausfallhonorar-Rechnungen (Schadensersatz, umsatzsteuerfrei) für No-Shows und kurzfristige Absagen. Nicht GKV-relevant.';

CREATE INDEX idx_ausfallrechnungen_owner ON public.ausfallrechnungen(owner_id, status);
CREATE INDEX idx_ausfallrechnungen_booking ON public.ausfallrechnungen(booking_id);

-- Per-owner laufende Rechnungsnummer (same pattern as mahnung_nr)
CREATE FUNCTION public.set_next_ausfallrechnung_nr() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $$
DECLARE next_nr BIGINT;
BEGIN
  SELECT COALESCE(MAX(rechnung_nr), 0) + 1 INTO next_nr
    FROM public.ausfallrechnungen WHERE owner_id = NEW.owner_id;
  NEW.rechnung_nr := next_nr;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_ausfallrechnung_nr
  BEFORE INSERT ON public.ausfallrechnungen
  FOR EACH ROW EXECUTE FUNCTION public.set_next_ausfallrechnung_nr();

-- RLS (mirrors mahnungen)
ALTER TABLE public.ausfallrechnungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY ausfallrechnungen_select ON public.ausfallrechnungen FOR SELECT
  USING ((auth.uid() = owner_id) OR (auth.uid() IN (
    SELECT profiles.id FROM public.profiles WHERE profiles.owner_id = ausfallrechnungen.owner_id)));

CREATE POLICY ausfallrechnungen_insert ON public.ausfallrechnungen FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY ausfallrechnungen_update ON public.ausfallrechnungen FOR UPDATE
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 3. Belegliste: neuer Beleg-Typ 'ausfall'
ALTER TABLE public.belegliste DROP CONSTRAINT belegliste_type_check;
ALTER TABLE public.belegliste ADD CONSTRAINT belegliste_type_check
  CHECK (type = ANY (ARRAY['zuzahlung'::text, 'barverkauf'::text, 'storno'::text, 'ausfall'::text]));
