CREATE TABLE IF NOT EXISTS public.belegliste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  beleg_nr BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('zuzahlung', 'barverkauf', 'storno')),
  amount_eur NUMERIC(10,2) NOT NULL,
  patient_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  abrechnung_id UUID REFERENCES public.abrechnung(id) ON DELETE SET NULL,
  reference_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (owner_id, beleg_nr)
);

-- Indexing for high performance queries
CREATE INDEX IF NOT EXISTS idx_belegliste_owner_time 
  ON public.belegliste (owner_id, created_at DESC);

-- Strictly sequential beleg_nr generation per tenant
CREATE OR REPLACE FUNCTION set_next_beleg_nr()
RETURNS TRIGGER AS $$
DECLARE
  next_nr BIGINT;
BEGIN
  SELECT COALESCE(MAX(beleg_nr), 0) + 1 INTO next_nr
  FROM public.belegliste
  WHERE owner_id = NEW.owner_id;
  NEW.beleg_nr := next_nr;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_set_beleg_nr
  BEFORE INSERT ON public.belegliste
  FOR EACH ROW
  WHEN (NEW.beleg_nr IS NULL OR NEW.beleg_nr = 0)
  EXECUTE FUNCTION set_next_beleg_nr();

-- Bulletproof GoBD compliance trigger blocking UPDATE and DELETE queries
CREATE OR REPLACE FUNCTION prevent_belegliste_mod()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'GoBD Belegliste ist unveränderlich. UPDATE und DELETE Operationen sind gesetzlich verboten!';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_prevent_belegliste_mod
  BEFORE UPDATE OR DELETE ON public.belegliste
  FOR EACH ROW EXECUTE FUNCTION prevent_belegliste_mod();

-- Row Level Security (RLS) policies
ALTER TABLE public.belegliste ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Belegliste select scoping" ON public.belegliste;
CREATE POLICY "Belegliste select scoping" ON public.belegliste
  FOR SELECT USING (
    auth.uid() = owner_id 
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = belegliste.owner_id)
  );

DROP POLICY IF EXISTS "Belegliste insert scoping" ON public.belegliste;
CREATE POLICY "Belegliste insert scoping" ON public.belegliste
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id 
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = belegliste.owner_id)
  );
