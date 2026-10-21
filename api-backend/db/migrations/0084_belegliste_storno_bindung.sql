-- SaaS: angewandt 18.10.2026 (MCP: 20261017225700, Freigabe Melih 18.10.2026; Pflichtberater db-ustasi, gkv-302, onprem, fonksiyon-ustasi: GO)
-- Kassenbuch-Storno: jeder Storno-Beleg wird an sein Original gebunden, ein Original kann nur
-- einmal storniert werden (auch gegen Altstornos ohne Verweis und gegen den Saldo-Weg).
-- Rein additiv: nullable Spalte, Trigger. :stable schreibt die Spalte nicht, der Trigger setzt sie
-- aus dem Altformat 'STORNO für Beleg-Nr: N (...)'. Nicht aufloesbare Stornos laufen unveraendert durch
-- (storno_von bleibt NULL), damit der alte Rezept-Saldo-Weg nicht bricht. Kein Backfill der Altzeilen
-- (belegliste ist append-only, prevent_belegliste_mod).
ALTER TABLE public.belegliste ADD COLUMN IF NOT EXISTS storno_von uuid REFERENCES public.belegliste(id);
ALTER TABLE public.belegliste ADD CONSTRAINT belegliste_storno_von_nur_storno
  CHECK (storno_von IS NULL OR type = 'storno');
CREATE UNIQUE INDEX IF NOT EXISTS belegliste_storno_von_einmal
  ON public.belegliste (storno_von) WHERE storno_von IS NOT NULL;
COMMENT ON COLUMN public.belegliste.storno_von IS 'Original-Beleg, den dieser Storno aufhebt (je Original hoechstens ein Storno). NULL bei Altstornos und beim Rezept-Saldo-Storno.';

CREATE OR REPLACE FUNCTION public.belegliste_storno_pruefen()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_nr bigint;
  v_otype text;
  v_onr bigint;
  v_oamount numeric;
  v_oowner uuid;
  v_saldo numeric;
BEGIN
  IF NEW.type <> 'storno' THEN
    RETURN NEW;
  END IF;

  -- Verweis aus dem Altformat aufloesen (alte Backend-Version schreibt storno_von nicht).
  IF NEW.storno_von IS NULL AND NEW.reference_text ~ '^STORNO für Beleg-Nr: [1-9][0-9]{0,14} \(' THEN
    v_nr := substring(NEW.reference_text from '^STORNO für Beleg-Nr: ([1-9][0-9]{0,14}) \(')::bigint;
    SELECT id INTO NEW.storno_von FROM public.belegliste
     WHERE owner_id = NEW.owner_id AND beleg_nr = v_nr AND type <> 'storno';
  END IF;

  IF NEW.storno_von IS NOT NULL THEN
    SELECT owner_id, type, beleg_nr, amount_eur INTO v_oowner, v_otype, v_onr, v_oamount
      FROM public.belegliste WHERE id = NEW.storno_von FOR UPDATE;
    IF NOT FOUND OR v_oowner <> NEW.owner_id OR v_otype = 'storno' THEN
      RAISE EXCEPTION 'Storno verweist auf keinen stornierbaren Originalbeleg dieser Praxis.' USING ERRCODE = '23514';
    END IF;
    IF NEW.amount_eur <> -v_oamount THEN
      RAISE EXCEPTION 'Storno muss den Betrag des Originals vollstaendig aufheben.' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.belegliste s
       WHERE s.owner_id = NEW.owner_id AND s.type = 'storno' AND s.storno_von IS NULL
         AND s.reference_text ~ '^STORNO für Beleg-Nr: [1-9][0-9]{0,14} \('
         AND substring(s.reference_text from '^STORNO für Beleg-Nr: ([1-9][0-9]{0,14}) \(')::bigint = v_onr
    ) THEN
      RAISE EXCEPTION 'Dieser Beleg wurde bereits storniert.' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Zuzahlungs-Saldo je Rezept darf durch einen Storno nie negativ werden (deckt auch den
  -- Rezept-Saldo-Weg und gleichzeitige Anfragen ab).
  IF NEW.prescription_id IS NOT NULL AND (NEW.storno_von IS NULL OR v_otype = 'zuzahlung') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.prescription_id::text, 0));
    SELECT coalesce(sum(amount_eur), 0) INTO v_saldo FROM public.belegliste
     WHERE owner_id = NEW.owner_id AND prescription_id = NEW.prescription_id
       AND type IN ('zuzahlung', 'storno');
    IF v_saldo + NEW.amount_eur < 0 THEN
      RAISE EXCEPTION 'Storno uebersteigt den gezahlten Betrag des Rezepts.' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.belegliste_storno_pruefen() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_belegliste_storno_pruefen ON public.belegliste;
CREATE TRIGGER trg_belegliste_storno_pruefen BEFORE INSERT ON public.belegliste
  FOR EACH ROW EXECUTE FUNCTION public.belegliste_storno_pruefen();
