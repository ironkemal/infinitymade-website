-- Physio-Pilot P1: K6 Eigene Formulare + Signatur, K7 Akte-Dokumente, K8 Physio-Befund.
-- Entwurf db-ustasi (31.10.2026), nach Review überarbeitet.
-- Aufbewahrung: patient_dokumente / physio_befunde = Behandlungsdokumentation (§ 630f BGB), kein physisches DELETE.
-- Berichtigung nur als neue Fassung bzw. Soft-Delete mit Grund.
-- SaaS: angewandt 31.10.2026, MCP.
-- ZAEHLER: public_tablo +3, rls_policy +9, fonksiyon +10, trigger +13, index +14.

-- ── 1. praxis_formulare ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.praxis_formulare (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id     uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  titel           text NOT NULL CHECK (length(btrim(titel)) > 0),
  storage_path    text NOT NULL,
  pdf_sha256      text NOT NULL CHECK (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  signatur_felder jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(signatur_felder) = 'array'),
  ist_einwilligung boolean NOT NULL DEFAULT false,
  consent_type    text,
  version         integer NOT NULL DEFAULT 1,
  aktiv           boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT praxis_formulare_storage_path_check CHECK (
    storage_path LIKE (owner_id::text || '/%')
    AND storage_path !~ '(^|/)\.\.(/|$)'
    AND storage_path !~ '//'
  )
);
ALTER TABLE public.praxis_formulare OWNER TO postgres;
CREATE INDEX IF NOT EXISTS idx_praxis_formulare_owner ON public.praxis_formulare (owner_id) WHERE aktiv;
CREATE INDEX IF NOT EXISTS idx_praxis_formulare_business ON public.praxis_formulare (business_id);

-- PDF und feste Metadaten sperren; nach Verwendung in der Akte sind auch Felder und Einwilligungs-Flags fest.
CREATE OR REPLACE FUNCTION public.praxis_formulare_pdf_fest()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.id          IS DISTINCT FROM OLD.id
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
     OR NEW.pdf_sha256   IS DISTINCT FROM OLD.pdf_sha256
     OR NEW.version      IS DISTINCT FROM OLD.version
     OR NEW.created_at   IS DISTINCT FROM OLD.created_at
     OR NEW.created_by   IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'praxis_formulare: ID, PDF, Version und Ersteller sind fest — ein geaendertes PDF ist eine neue Zeile'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.patient_dokumente WHERE formular_id = OLD.id) THEN
    IF NEW.signatur_felder   IS DISTINCT FROM OLD.signatur_felder
       OR NEW.ist_einwilligung IS DISTINCT FROM OLD.ist_einwilligung
       OR NEW.consent_type    IS DISTINCT FROM OLD.consent_type THEN
      RAISE EXCEPTION 'praxis_formulare: Nach Verwendung in der Akte sind Signaturfelder und Einwilligungs-Flags fest'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.praxis_formulare_pdf_fest() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.praxis_formulare_pdf_fest() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS praxis_formulare_pdf_fest_trg ON public.praxis_formulare;
CREATE TRIGGER praxis_formulare_pdf_fest_trg BEFORE UPDATE ON public.praxis_formulare
  FOR EACH ROW EXECUTE FUNCTION public.praxis_formulare_pdf_fest();

DROP TRIGGER IF EXISTS trg_set_business_id ON public.praxis_formulare;
CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.praxis_formulare
  FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();

ALTER TABLE public.praxis_formulare ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.praxis_formulare FROM anon;
REVOKE DELETE, TRUNCATE ON TABLE public.praxis_formulare FROM authenticated;

DROP POLICY IF EXISTS praxis_formulare_owner_and_team_select ON public.praxis_formulare;
CREATE POLICY praxis_formulare_owner_and_team_select ON public.praxis_formulare AS PERMISSIVE FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS praxis_formulare_owner_and_team_insert ON public.praxis_formulare;
CREATE POLICY praxis_formulare_owner_and_team_insert ON public.praxis_formulare AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS praxis_formulare_owner_and_team_update ON public.praxis_formulare;
CREATE POLICY praxis_formulare_owner_and_team_update ON public.praxis_formulare AS PERMISSIVE FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid()));

-- ── 2. patient_dokumente ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_dokumente (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  business_id   uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  lead_id       uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  kategorie     text NOT NULL CHECK (kategorie IN ('befund_extern','arztbrief','bildgebung','foto','formular_signiert','sonstiges')),
  formular_id   uuid REFERENCES public.praxis_formulare(id) ON DELETE RESTRICT,
  storage_path  text NOT NULL,
  dateiname     text NOT NULL,
  mime_type     text NOT NULL,
  groesse_bytes bigint NOT NULL CHECK (groesse_bytes >= 0),
  datei_sha256  text NOT NULL CHECK (datei_sha256 ~ '^[0-9a-f]{64}$'),
  notiz         text,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  geloescht_at  timestamptz,
  geloescht_von uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  loeschgrund   text,
  CONSTRAINT patient_dokumente_storage_path_check CHECK (
    storage_path LIKE (owner_id::text || '/%')
    AND storage_path !~ '(^|/)\.\.(/|$)'
    AND storage_path !~ '//'
  ),
  CONSTRAINT patient_dokumente_geloescht_check CHECK (
    (geloescht_at IS NULL AND geloescht_von IS NULL AND loeschgrund IS NULL)
    OR (geloescht_at IS NOT NULL AND length(btrim(loeschgrund)) > 0)
  )
);
ALTER TABLE public.patient_dokumente OWNER TO postgres;
CREATE INDEX IF NOT EXISTS idx_patient_dokumente_lead ON public.patient_dokumente (owner_id, lead_id) WHERE geloescht_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_dokumente_business ON public.patient_dokumente (business_id);
CREATE INDEX IF NOT EXISTS idx_patient_dokumente_formular ON public.patient_dokumente (formular_id) WHERE formular_id IS NOT NULL;

-- Physisches DELETE verweigern (Aufbewahrungspflicht nach § 630f BGB)
CREATE OR REPLACE FUNCTION public.patient_dokumente_delete_gesperrt()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION 'patient_dokumente: Physisches Loeschen verboten (Aufbewahrungspflicht nach § 630f BGB)'
    USING ERRCODE = 'check_violation';
END;
$function$;
ALTER FUNCTION public.patient_dokumente_delete_gesperrt() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.patient_dokumente_delete_gesperrt() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS patient_dokumente_delete_gesperrt_trg ON public.patient_dokumente;
CREATE TRIGGER patient_dokumente_delete_gesperrt_trg BEFORE DELETE ON public.patient_dokumente
  FOR EACH ROW EXECUTE FUNCTION public.patient_dokumente_delete_gesperrt();

-- Mandantenprüfung Fremdschlüssel
CREATE OR REPLACE FUNCTION public.patient_dokumente_mandant_pruefen()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lead_owner uuid;
  v_formular_owner uuid;
  v_biz_owner uuid;
BEGIN
  SELECT l.owner_id INTO v_lead_owner FROM public.leads l WHERE l.id = NEW.lead_id;
  IF v_lead_owner IS NULL OR v_lead_owner IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'patient_dokumente: lead_id gehoert nicht zum Mandanten'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.formular_id IS NOT NULL THEN
    SELECT f.owner_id INTO v_formular_owner FROM public.praxis_formulare f WHERE f.id = NEW.formular_id;
    IF v_formular_owner IS NULL OR v_formular_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'patient_dokumente: formular_id gehoert nicht zum Mandanten'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.business_id IS NOT NULL THEN
    SELECT b.owner_id INTO v_biz_owner FROM public.businesses b WHERE b.id = NEW.business_id;
    IF v_biz_owner IS NULL OR v_biz_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'patient_dokumente: business_id gehoert nicht zum Mandanten'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.patient_dokumente_mandant_pruefen() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.patient_dokumente_mandant_pruefen() FROM PUBLIC, anon, authenticated;

-- BEFORE INSERT: geloescht_* auf NULL erzwingen, created_by setzen
CREATE OR REPLACE FUNCTION public.patient_dokumente_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.geloescht_at := NULL;
  NEW.geloescht_von := NULL;
  NEW.loeschgrund := NULL;
  NEW.created_by := coalesce(auth.uid(), NEW.created_by);
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.patient_dokumente_before_insert() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.patient_dokumente_before_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS patient_dokumente_before_insert_trg ON public.patient_dokumente;
CREATE TRIGGER patient_dokumente_before_insert_trg BEFORE INSERT ON public.patient_dokumente
  FOR EACH ROW EXECUTE FUNCTION public.patient_dokumente_before_insert();

DROP TRIGGER IF EXISTS trg_set_business_id ON public.patient_dokumente;
CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.patient_dokumente
  FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();

DROP TRIGGER IF EXISTS trg_zz_patient_dokumente_mandant ON public.patient_dokumente;
CREATE TRIGGER trg_zz_patient_dokumente_mandant
  BEFORE INSERT OR UPDATE OF owner_id, lead_id, formular_id, business_id ON public.patient_dokumente
  FOR EACH ROW EXECUTE FUNCTION public.patient_dokumente_mandant_pruefen();

CREATE OR REPLACE FUNCTION public.patient_dokumente_unveraenderlich()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Alle Inhaltsspalten sind unveraenderlich.
  IF (to_jsonb(NEW) - ARRAY['geloescht_at','geloescht_von','loeschgrund'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['geloescht_at','geloescht_von','loeschgrund']) THEN
    RAISE EXCEPTION 'patient_dokumente ist unveraenderlich — nur Soft-Delete (geloescht_*) erlaubt'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Solange geloescht_at NULL bleibt, duerfen geloescht_von / loeschgrund sich nicht aendern.
  IF OLD.geloescht_at IS NULL AND NEW.geloescht_at IS NULL THEN
    IF NEW.geloescht_von IS NOT NULL OR NEW.loeschgrund IS NOT NULL THEN
      RAISE EXCEPTION 'patient_dokumente: geloescht_von und loeschgrund nur bei gesetztem geloescht_at erlaubt'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Ein geloeschtes Dokument kann nicht wiederhergestellt oder weiter geaendert werden.
  IF OLD.geloescht_at IS NOT NULL THEN
    RAISE EXCEPTION 'patient_dokumente: ein geloeschtes Dokument kann nicht geaendert oder wiederhergestellt werden'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Beim Uebergang auf NOT NULL: Stempel und Ausloeser erzwingen, Loeschgrund pruefen.
  IF OLD.geloescht_at IS NULL AND NEW.geloescht_at IS NOT NULL THEN
    IF length(btrim(coalesce(NEW.loeschgrund, ''))) = 0 THEN
      RAISE EXCEPTION 'patient_dokumente: Loeschgrund ist Pflicht'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.geloescht_at := now();
    NEW.geloescht_von := coalesce(auth.uid(), NEW.geloescht_von);
  END IF;

  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.patient_dokumente_unveraenderlich() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.patient_dokumente_unveraenderlich() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS patient_dokumente_unveraenderlich_trg ON public.patient_dokumente;
CREATE TRIGGER patient_dokumente_unveraenderlich_trg BEFORE UPDATE ON public.patient_dokumente
  FOR EACH ROW EXECUTE FUNCTION public.patient_dokumente_unveraenderlich();

ALTER TABLE public.patient_dokumente ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.patient_dokumente FROM anon;
REVOKE DELETE, TRUNCATE ON TABLE public.patient_dokumente FROM authenticated;

DROP POLICY IF EXISTS patient_dokumente_owner_and_team_select ON public.patient_dokumente;
CREATE POLICY patient_dokumente_owner_and_team_select ON public.patient_dokumente AS PERMISSIVE FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS patient_dokumente_owner_and_team_insert ON public.patient_dokumente;
CREATE POLICY patient_dokumente_owner_and_team_insert ON public.patient_dokumente AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS patient_dokumente_owner_and_team_update ON public.patient_dokumente;
CREATE POLICY patient_dokumente_owner_and_team_update ON public.patient_dokumente AS PERMISSIVE FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid()));

-- ── 3. physio_befunde ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.physio_befunde (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  business_id     uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  lead_id         uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  eintrag_id      uuid NOT NULL DEFAULT gen_random_uuid(),
  version         integer NOT NULL DEFAULT 1,
  ist_aktuell     boolean NOT NULL DEFAULT true,
  befundart       text NOT NULL CHECK (befundart IN ('erst','zwischen','abschluss')),
  befund_datum    date NOT NULL DEFAULT current_date,
  therapeut_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  daten           jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(daten) = 'object'),
  form_version    smallint NOT NULL DEFAULT 1,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT physio_befunde_eintrag_version_uq UNIQUE (owner_id, eintrag_id, version)
);
ALTER TABLE public.physio_befunde OWNER TO postgres;
CREATE UNIQUE INDEX IF NOT EXISTS physio_befunde_aktuell_uidx ON public.physio_befunde (owner_id, eintrag_id) WHERE ist_aktuell;
CREATE INDEX IF NOT EXISTS idx_physio_befunde_lead ON public.physio_befunde (owner_id, lead_id, befund_datum DESC) WHERE ist_aktuell;
CREATE INDEX IF NOT EXISTS idx_physio_befunde_business ON public.physio_befunde (business_id);
CREATE INDEX IF NOT EXISTS idx_physio_befunde_prescription ON public.physio_befunde (prescription_id) WHERE prescription_id IS NOT NULL;

-- Physisches DELETE verweigern (Aufbewahrungspflicht nach § 630f BGB)
CREATE OR REPLACE FUNCTION public.physio_befunde_delete_gesperrt()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION 'physio_befunde: Physisches Loeschen verboten (Aufbewahrungspflicht nach § 630f BGB)'
    USING ERRCODE = 'check_violation';
END;
$function$;
ALTER FUNCTION public.physio_befunde_delete_gesperrt() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.physio_befunde_delete_gesperrt() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS physio_befunde_delete_gesperrt_trg ON public.physio_befunde;
CREATE TRIGGER physio_befunde_delete_gesperrt_trg BEFORE DELETE ON public.physio_befunde
  FOR EACH ROW EXECUTE FUNCTION public.physio_befunde_delete_gesperrt();

-- Mandantenprüfung Fremdschlüssel
CREATE OR REPLACE FUNCTION public.physio_befunde_mandant_pruefen()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lead_owner uuid;
  v_rx_owner uuid;
  v_rx_patient uuid;
  v_therapeut_valid boolean;
  v_biz_owner uuid;
BEGIN
  SELECT l.owner_id INTO v_lead_owner FROM public.leads l WHERE l.id = NEW.lead_id;
  IF v_lead_owner IS NULL OR v_lead_owner IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'physio_befunde: lead_id gehoert nicht zum Mandanten'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.prescription_id IS NOT NULL THEN
    SELECT rx.owner_id, rx.patient_id INTO v_rx_owner, v_rx_patient
      FROM public.prescriptions rx WHERE rx.id = NEW.prescription_id;
    IF v_rx_owner IS NULL OR v_rx_owner IS DISTINCT FROM NEW.owner_id OR v_rx_patient IS DISTINCT FROM NEW.lead_id THEN
      RAISE EXCEPTION 'physio_befunde: prescription_id gehoert nicht zu Mandant und Patient'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.therapeut_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = NEW.therapeut_id
         AND (p.id = NEW.owner_id OR p.owner_id = NEW.owner_id)
    ) INTO v_therapeut_valid;
    IF NOT v_therapeut_valid THEN
      RAISE EXCEPTION 'physio_befunde: therapeut_id gehoert nicht zum Praxis-Team'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.business_id IS NOT NULL THEN
    SELECT b.owner_id INTO v_biz_owner FROM public.businesses b WHERE b.id = NEW.business_id;
    IF v_biz_owner IS NULL OR v_biz_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'physio_befunde: business_id gehoert nicht zum Mandanten'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.physio_befunde_mandant_pruefen() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.physio_befunde_mandant_pruefen() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.physio_befunde_versionieren()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_max integer;
BEGIN
  -- Schutz vor Fremd-eintrag_id oder falscher lead_id
  IF EXISTS (
    SELECT 1 FROM public.physio_befunde
     WHERE eintrag_id = NEW.eintrag_id
       AND (owner_id IS DISTINCT FROM NEW.owner_id OR lead_id IS DISTINCT FROM NEW.lead_id)
  ) THEN
    RAISE EXCEPTION 'physio_befunde: eintrag_id gehoert bereits zu anderem Mandanten oder Patienten'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('physio_befunde'), hashtext(NEW.owner_id::text || '/' || NEW.eintrag_id::text));
  SELECT max(version) INTO v_max FROM public.physio_befunde
   WHERE owner_id = NEW.owner_id AND eintrag_id = NEW.eintrag_id;
  NEW.version := coalesce(v_max, 0) + 1;
  IF v_max IS NOT NULL THEN
    UPDATE public.physio_befunde SET ist_aktuell = false
     WHERE owner_id = NEW.owner_id AND eintrag_id = NEW.eintrag_id AND ist_aktuell;
  END IF;
  NEW.ist_aktuell := true;
  NEW.created_at  := now();
  NEW.created_by  := coalesce(auth.uid(), NEW.created_by);
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.physio_befunde_versionieren() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.physio_befunde_versionieren() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.physio_befunde_unveraenderlich()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Erlaubt ist nur ist_aktuell true -> false (ausgeloest vom Versionierungs-Trigger) und prescription_id -> NULL (ON DELETE SET NULL).
  IF (to_jsonb(NEW) - ARRAY['ist_aktuell','prescription_id'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['ist_aktuell','prescription_id']) THEN
    RAISE EXCEPTION 'physio_befunde ist unveraenderlich — Aenderung nur als neue Fassung (INSERT)'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.ist_aktuell AND NOT NEW.ist_aktuell AND pg_trigger_depth() <= 1 THEN
    RAISE EXCEPTION 'physio_befunde: Abloesen einer Fassung nur durch Versionierung zulaessig'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.ist_aktuell AND NOT OLD.ist_aktuell THEN
    RAISE EXCEPTION 'physio_befunde: eine abgeloeste Fassung kann nicht wieder aktuell werden'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.prescription_id IS NOT NULL AND NEW.prescription_id IS DISTINCT FROM OLD.prescription_id THEN
    RAISE EXCEPTION 'physio_befunde: prescription_id kann nur entfernt, nicht geaendert werden'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.physio_befunde_unveraenderlich() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.physio_befunde_unveraenderlich() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS physio_befunde_unveraenderlich_trg ON public.physio_befunde;
CREATE TRIGGER physio_befunde_unveraenderlich_trg BEFORE UPDATE ON public.physio_befunde
  FOR EACH ROW EXECUTE FUNCTION public.physio_befunde_unveraenderlich();

DROP TRIGGER IF EXISTS physio_befunde_versionieren_trg ON public.physio_befunde;
CREATE TRIGGER physio_befunde_versionieren_trg BEFORE INSERT ON public.physio_befunde
  FOR EACH ROW EXECUTE FUNCTION public.physio_befunde_versionieren();

DROP TRIGGER IF EXISTS trg_set_business_id ON public.physio_befunde;
CREATE TRIGGER trg_set_business_id BEFORE INSERT ON public.physio_befunde
  FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();

DROP TRIGGER IF EXISTS trg_zz_physio_befunde_mandant ON public.physio_befunde;
CREATE TRIGGER trg_zz_physio_befunde_mandant
  BEFORE INSERT OR UPDATE OF owner_id, lead_id, prescription_id, therapeut_id, business_id ON public.physio_befunde
  FOR EACH ROW EXECUTE FUNCTION public.physio_befunde_mandant_pruefen();

ALTER TABLE public.physio_befunde ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.physio_befunde FROM anon;
REVOKE DELETE, TRUNCATE ON TABLE public.physio_befunde FROM authenticated;

DROP POLICY IF EXISTS physio_befunde_owner_and_team_select ON public.physio_befunde;
CREATE POLICY physio_befunde_owner_and_team_select ON public.physio_befunde AS PERMISSIVE FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS physio_befunde_owner_and_team_insert ON public.physio_befunde;
CREATE POLICY physio_befunde_owner_and_team_insert ON public.physio_befunde AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS physio_befunde_owner_and_team_update ON public.physio_befunde;
CREATE POLICY physio_befunde_owner_and_team_update ON public.physio_befunde AS PERMISSIVE FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid()));

-- ── 4. messreihen: Bezug zum Befund + Seite ─────────────────────────────────
ALTER TABLE public.messreihen
  ADD COLUMN IF NOT EXISTS befund_id uuid REFERENCES public.physio_befunde(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seite text;
ALTER TABLE public.messreihen DROP CONSTRAINT IF EXISTS messreihen_seite_check;
ALTER TABLE public.messreihen
  ADD CONSTRAINT messreihen_seite_check CHECK (seite IS NULL OR seite IN ('links','rechts','beidseits'));
CREATE INDEX IF NOT EXISTS idx_messreihen_befund ON public.messreihen (befund_id) WHERE befund_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.messreihen_befund_mandant_pruefen()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_befund_owner uuid;
  v_befund_lead uuid;
BEGIN
  IF NEW.befund_id IS NOT NULL THEN
    SELECT b.owner_id, b.lead_id INTO v_befund_owner, v_befund_lead
      FROM public.physio_befunde b WHERE b.id = NEW.befund_id;
    IF v_befund_owner IS NULL
       OR v_befund_owner IS DISTINCT FROM NEW.owner_id
       OR v_befund_lead IS DISTINCT FROM NEW.lead_id THEN
      RAISE EXCEPTION 'messreihen: befund_id gehoert nicht zu Mandant und Patient'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.messreihen_befund_mandant_pruefen() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.messreihen_befund_mandant_pruefen() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_zz_messreihen_befund ON public.messreihen;
CREATE TRIGGER trg_zz_messreihen_befund
  BEFORE INSERT OR UPDATE OF befund_id, owner_id, lead_id ON public.messreihen
  FOR EACH ROW EXECUTE FUNCTION public.messreihen_befund_mandant_pruefen();

-- ── 5. Storage-Bucket patient-documents (onprem O-233) ──────────────────────
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    UPDATE storage.buckets
       SET file_size_limit = 10485760,
           allowed_mime_types = ARRAY['application/pdf','image/png','image/jpeg','image/webp']
     WHERE id = 'patient-documents';
  END IF;
END $$;

-- ── 6. patient_consents: Einwilligungsart fuer Praxis-eigene Formulare (K6) ─
-- Die Tabelle bleibt unveraenderlich/RESTRICT; erweitert wird nur die erlaubte Wertemenge.
ALTER TABLE public.patient_consents DROP CONSTRAINT IF EXISTS patient_consents_type_chk;
ALTER TABLE public.patient_consents
  ADD CONSTRAINT patient_consents_type_chk CHECK (consent_type = ANY (ARRAY['behandlungsvertrag'::text, 'datenschutz'::text, 'selbstzahler'::text, 'foto'::text, 'praxis_formular'::text]));
