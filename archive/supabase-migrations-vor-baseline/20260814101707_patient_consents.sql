-- Digitale Patienten-Einwilligung (P2) — Konsey 2026-08-14
-- konsey/tutanak/2026-08-14-patienten-uebergabe-einwilligung.md
-- compliance/LEGAL_DECISIONS.md, Zeile 2026-08-14
--
-- Bindende Vorgaben von legal-de, die sich hier im Schema abbilden:
--   (2) zwei getrennte Texte, zwei getrennte Unterschriften -> je eine Zeile,
--       consent_type unterscheidet sie. Keine Sammelzeile.
--   (3) Art. 7 Abs. 1 Nachweispflicht: nicht nur ein Haekchen, sondern der
--       VOLLE Text -> text_snapshot + text_version + text_sha256.
--   (4) KEINE ip_address. Auf dem Praxis-Tablet ist die IP der Praxis-Router,
--       Beweiswert null -> Art. 5 Abs. 1 lit. c. Das Muster aus consent_log
--       wird bewusst NICHT uebernommen.
--   (5) Unterschrift als Raster-PNG im Bucket patient-documents. Keine
--       Druck-/Geschwindigkeits-/Dynamikdaten -> kein Art. 9.
--   (6) Aufbewahrung 10 Jahre (§630f Abs. 3 BGB) -> Loeschsperre per Trigger.
--   (7) Eigene Tabelle. consent_log gehoert einem ANDEREN Betroffenen
--       (Praxisinhaber, B2B-AVV/AGB) und wird nicht erweitert.

BEGIN;

CREATE TABLE IF NOT EXISTS public.patient_consents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  business_id         uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  patient_id          uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,

  consent_type        text NOT NULL,
  -- Text-Nachweis (Art. 7 Abs. 1). snapshot ist die Quelle der Wahrheit,
  -- version/sha256 dienen dem schnellen Vergleich.
  text_version        text NOT NULL,
  text_sha256         text NOT NULL,
  text_snapshot       text NOT NULL,

  -- Raster-PNG im privaten Bucket `patient-documents`, Pfad <owner_id>/<patient_id>/...
  signature_path      text,
  signed_name         text,

  consented_at        timestamptz NOT NULL DEFAULT now(),
  captured_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  device_label        text,

  -- Art. 7 Abs. 3: Datenschutz-Einwilligung ist jederzeit widerruflich.
  -- Widerruf loescht die Zeile NICHT (Nachweis + §630f), er markiert sie.
  revoked_at          timestamptz,
  revoke_reason       text,

  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT patient_consents_type_chk CHECK (consent_type IN (
    'behandlungsvertrag',   -- §630d BGB + Ausfallgebuehr (kommerzielle Bedingung)
    'datenschutz',          -- Art. 7 DSGVO, widerruflich
    'selbstzahler',         -- Nagelspange & Co. (Backlog-faehig, v1 erlaubt)
    'foto'                  -- Fussbefund-Foto (Backlog, Typ hier schon zulaessig)
  )),
  CONSTRAINT patient_consents_sha_chk CHECK (text_sha256 ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE public.patient_consents IS
  'Digitale Patienten-Einwilligungen (einfache elektronische Signatur). '
  'Aufbewahrung 10 Jahre (§630f Abs. 3 BGB). Bewusst OHNE ip_address. '
  'Nicht mit consent_log verwechseln — das ist die B2B-Seite (Praxisinhaber).';
COMMENT ON COLUMN public.patient_consents.text_snapshot IS
  'Vollstaendiger unterschriebener Text zum Zeitpunkt der Unterschrift. '
  'Unveraenderlich — Aenderungen an der Vorlage duerfen den Nachweis nicht beruehren.';

CREATE INDEX IF NOT EXISTS patient_consents_patient_idx
  ON public.patient_consents (patient_id, consented_at DESC);
CREATE INDEX IF NOT EXISTS patient_consents_owner_idx
  ON public.patient_consents (owner_id, consented_at DESC);
CREATE INDEX IF NOT EXISTS patient_consents_type_idx
  ON public.patient_consents (patient_id, consent_type, consented_at DESC);

-- ---------------------------------------------------------------------
-- Mandantentrennung — Schreibweise (a) aus db/SCHEMA-RLS.sql §1
-- ---------------------------------------------------------------------
ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_consents_owner_select ON public.patient_consents;
CREATE POLICY patient_consents_owner_select ON public.patient_consents
  FOR SELECT USING (
    auth.uid() = owner_id
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = patient_consents.owner_id)
  );

DROP POLICY IF EXISTS patient_consents_owner_insert ON public.patient_consents;
CREATE POLICY patient_consents_owner_insert ON public.patient_consents
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = patient_consents.owner_id)
  );

-- UPDATE nur fuer den Widerruf. Kein DELETE-Policy -> Loeschen ist fuer
-- authenticated grundsaetzlich nicht moeglich (zusaetzlich Trigger unten).
DROP POLICY IF EXISTS patient_consents_owner_revoke ON public.patient_consents;
CREATE POLICY patient_consents_owner_revoke ON public.patient_consents
  FOR UPDATE USING (
    auth.uid() = owner_id
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = patient_consents.owner_id)
  ) WITH CHECK (
    auth.uid() = owner_id
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE owner_id = patient_consents.owner_id)
  );

-- ---------------------------------------------------------------------
-- Unveraenderlichkeit des Nachweises + 10-Jahres-Sperre (§630f Abs. 3 BGB)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_patient_consents_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.consented_at > (now() - interval '10 years') THEN
      RAISE EXCEPTION
        'Einwilligung ist nach §630f Abs. 3 BGB 10 Jahre aufzubewahren (unterschrieben am %).',
        OLD.consented_at::date
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: nur Widerrufsfelder duerfen sich aendern.
  IF NEW.id                  IS DISTINCT FROM OLD.id
     OR NEW.owner_id         IS DISTINCT FROM OLD.owner_id
     OR NEW.patient_id       IS DISTINCT FROM OLD.patient_id
     OR NEW.consent_type     IS DISTINCT FROM OLD.consent_type
     OR NEW.text_version     IS DISTINCT FROM OLD.text_version
     OR NEW.text_sha256      IS DISTINCT FROM OLD.text_sha256
     OR NEW.text_snapshot    IS DISTINCT FROM OLD.text_snapshot
     OR NEW.signature_path   IS DISTINCT FROM OLD.signature_path
     OR NEW.signed_name      IS DISTINCT FROM OLD.signed_name
     OR NEW.consented_at     IS DISTINCT FROM OLD.consented_at
     OR NEW.captured_by_user_id IS DISTINCT FROM OLD.captured_by_user_id
     OR NEW.device_label     IS DISTINCT FROM OLD.device_label
  THEN
    RAISE EXCEPTION
      'Einwilligungsnachweis ist unveraenderlich (Art. 7 Abs. 1 DSGVO). Nur revoked_at/revoke_reason duerfen gesetzt werden.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patient_consents_immutable ON public.patient_consents;
CREATE TRIGGER trg_patient_consents_immutable
  BEFORE UPDATE OR DELETE ON public.patient_consents
  FOR EACH ROW EXECUTE FUNCTION public.fn_patient_consents_immutable();

COMMIT;
