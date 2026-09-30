-- Anamnese je Fachbereich + Versionierung (append-only, § 630f BGB)
-- + drei kleine Spalten fuer Podologie/§302 und GPS-Check-in (Oturum C, 30.09.2026).
--
-- Datei geschrieben 30.09.2026. Live-Status: db/REGISTER.md (anamnese, attendance,
-- podologie_behandlungen, pat_fussbefund, profiles, diagnosegruppen).
--
-- NUMMER: 0045/0046 sind fuer die Kostentraeger-Arbeit (Q4/2026) reserviert und
--   entstehen erst nach dieser Datei. Luecken sind erlaubt (migrate.js
--   pruefeVersionen); eine Box, die 0047 zuerst sieht, faehrt 0045/0046 im naechsten
--   Image als "offen" nach. Diese Datei beruehrt keine Objekte von 0045/0046
--   (kostentraeger*, Annahmestellen) — Reihenfolge deshalb egal (onprem 30.09.2026).
--
-- ZAEHLER (nachgerechnet, nicht gemessen): +2 Funktion (anamnese_versionieren,
--   anamnese_unveraenderlich), +2 Trigger, +2 Index (anamnese_aktuell_uidx,
--   anamnese_version_uidx). Der FK uebernommen_von legt keinen Index an; seine
--   RI-Trigger sind tgisinternal (Regel _hinweis_0025). Alles andere counter-neutral.
--
-- ==========================================================================
-- TEIL 1 — anamnese (Spezifikation db-ustasi 30.09.2026, C:/tmp/praxura/B-devir-A-30-09.md §1)
-- ==========================================================================
-- Kemal 30.09.2026: Anamnese ist je Fachbereich ein eigenes Formular. Fachspezifische
-- Antworten in `felder jsonb`, die Formdefinition lebt im Frontend-Modul
-- (module/anamnese-formulare.js, `form_version`). Wie pat_fussbefund append-only:
-- jede Speicherung = neue Zeile; `version`/`ist_aktuell` vergibt ausschliesslich
-- der Trigger (der Client schickt sie nicht, und was er schickt, wird verworfen).
--
-- `quelle='kiosk'` = vom Patienten selbst ausgefuellt, ungeprueft, bis die Praxis
-- `geprueft_am/geprueft_von` setzt (einziger erlaubter Nachtrag, NULL -> Wert).
--
-- DELETE bleibt BEWUSST erlaubt (DSGVO-Loeschkette, api/dsgvo.js; Lehre aus
-- podologie_behandlungen). Deshalb muss `uebernommen_von` Wert -> NULL erlaubt sein:
-- ON DELETE SET NULL ist intern ein UPDATE auf die verweisende Zeile (onprem 30.09.2026).
--
-- Alt-Zeilen (12, Testdaten, je (owner, patient) genau eine): fachbereich 'physio',
-- version 1, quelle 'praxis', geprueft = letzte Bearbeitung.
--
-- Schreiber: nur das Frontend (RLS owner_and_team, auth.uid() gesetzt). Der einzige
-- Backend-Schreiber (/api/rezept/save) wurde im selben Commit entfernt. Schreibt
-- spaeter ein service_role-Weg, muss er created_by (und bei 'praxis' geprueft_von)
-- selbst mitgeben — auth.uid() ist dort NULL, und der Trigger RAISEt deswegen NICHT.
--
-- :beta / :stable: aeltere Images lesen anamnese per select('*') mit und schreiben
--   nicht (Frontend-Schreibweg kommt mit dem Anamnese-Modul). Ein altes Frontend,
--   das noch UPDATE auf anamnese macht, bekommt einen Fehler — gewollt (§ 630f).
--
-- DSGVO: anamnese steht in api/dsgvo.js mit select '*' (Auskunft) und in der
--   Loeschkette (alle Zeilen des Patienten = alle Versionen). Keine Codeaenderung.

ALTER TABLE public.anamnese
  ADD COLUMN fachbereich     text NOT NULL DEFAULT 'physio'
      CONSTRAINT anamnese_fachbereich_check CHECK (fachbereich IN ('physio','podo','ergo','logo')),
  ADD COLUMN felder          jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN form_version    smallint NOT NULL DEFAULT 1,
  ADD COLUMN version         integer NOT NULL DEFAULT 1,
  ADD COLUMN ist_aktuell     boolean NOT NULL DEFAULT true,
  ADD COLUMN quelle          text NOT NULL DEFAULT 'praxis'
      CONSTRAINT anamnese_quelle_check CHECK (quelle IN ('praxis','kiosk')),
  ADD COLUMN geprueft_am     timestamptz,
  ADD COLUMN geprueft_von    uuid REFERENCES auth.users(id),
  ADD COLUMN uebernommen_von uuid REFERENCES public.anamnese(id) ON DELETE SET NULL;

-- Backfill VOR den Triggern (der UPDATE-Schutz wuerde ihn sonst abweisen).
UPDATE public.anamnese SET
  geprueft_am  = COALESCE(updated_at, created_at),
  geprueft_von = COALESCE(updated_by, created_by);

CREATE UNIQUE INDEX anamnese_aktuell_uidx
  ON public.anamnese (owner_id, patient_id, fachbereich) WHERE ist_aktuell;
CREATE UNIQUE INDEX anamnese_version_uidx
  ON public.anamnese (owner_id, patient_id, fachbereich, version);

CREATE OR REPLACE FUNCTION public.anamnese_versionieren()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_max integer;
BEGIN
  -- Zwei gleichzeitige Speicherungen derselben Akte duerfen nicht dieselbe
  -- Versionsnummer ziehen. Transaktions-Lock mit zwei Argumenten (eigener
  -- Namensraum, kollidiert nicht mit dem Lock des Migrations-Runners).
  PERFORM pg_advisory_xact_lock(
    hashtext('anamnese'),
    hashtext(NEW.owner_id::text || '/' || NEW.patient_id::text || '/' || NEW.fachbereich)
  );

  SELECT max(version) INTO v_max
    FROM public.anamnese
   WHERE owner_id = NEW.owner_id
     AND patient_id = NEW.patient_id
     AND fachbereich = NEW.fachbereich;

  NEW.version := coalesce(v_max, 0) + 1;

  IF v_max IS NOT NULL THEN
    UPDATE public.anamnese
       SET ist_aktuell = false
     WHERE owner_id = NEW.owner_id
       AND patient_id = NEW.patient_id
       AND fachbereich = NEW.fachbereich
       AND ist_aktuell;
  END IF;

  NEW.ist_aktuell := true;
  NEW.created_at  := now();
  NEW.updated_at  := now();
  NEW.created_by  := coalesce(NEW.created_by, auth.uid());
  NEW.updated_by  := NEW.created_by;

  IF NEW.quelle = 'kiosk' THEN
    -- Selbstauskunft des Patienten ist ungeprueft, egal was der Client schickt.
    NEW.geprueft_am  := NULL;
    NEW.geprueft_von := NULL;
  ELSE
    NEW.geprueft_am  := now();
    NEW.geprueft_von := coalesce(NEW.geprueft_von, auth.uid());
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.anamnese_unveraenderlich()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
BEGIN
  -- Erlaubt sind genau drei Uebergaenge, alles andere ist eine Aenderung der
  -- Dokumentation (§ 630f Abs. 1 BGB: Berichtigung nur als neue Fassung):
  --   ist_aktuell      true  -> false   (anamnese_versionieren beim Nachfolger)
  --   geprueft_am/_von NULL  -> Wert    (Praxis bestaetigt eine Kiosk-Anamnese)
  --   uebernommen_von  Wert  -> NULL    (ON DELETE SET NULL der Loeschkette)
  IF (to_jsonb(NEW) - ARRAY['ist_aktuell','geprueft_am','geprueft_von','uebernommen_von'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['ist_aktuell','geprueft_am','geprueft_von','uebernommen_von']) THEN
    RAISE EXCEPTION 'anamnese ist unveraenderlich — Aenderung nur als neue Fassung (INSERT)'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.ist_aktuell AND NOT OLD.ist_aktuell THEN
    RAISE EXCEPTION 'anamnese: eine abgeloeste Fassung kann nicht wieder aktuell werden'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.geprueft_am IS NOT NULL AND NEW.geprueft_am IS DISTINCT FROM OLD.geprueft_am THEN
    RAISE EXCEPTION 'anamnese: geprueft_am ist bereits gesetzt'
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.geprueft_von IS NOT NULL AND NEW.geprueft_von IS DISTINCT FROM OLD.geprueft_von THEN
    RAISE EXCEPTION 'anamnese: geprueft_von ist bereits gesetzt'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.uebernommen_von IS NOT NULL AND NEW.uebernommen_von IS DISTINCT FROM OLD.uebernommen_von THEN
    RAISE EXCEPTION 'anamnese: uebernommen_von kann nur entfernt, nicht geaendert werden'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER anamnese_versionieren_trg
  BEFORE INSERT ON public.anamnese
  FOR EACH ROW EXECUTE FUNCTION public.anamnese_versionieren();

CREATE TRIGGER anamnese_unveraenderlich_trg
  BEFORE UPDATE ON public.anamnese
  FOR EACH ROW EXECUTE FUNCTION public.anamnese_unveraenderlich();

-- Lehre 0035: FROM PUBLIC allein genuegt in Supabase nicht.
REVOKE EXECUTE ON FUNCTION public.anamnese_versionieren() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.anamnese_versionieren() FROM anon;
REVOKE EXECUTE ON FUNCTION public.anamnese_versionieren() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.anamnese_unveraenderlich() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.anamnese_unveraenderlich() FROM anon;
REVOKE EXECUTE ON FUNCTION public.anamnese_unveraenderlich() FROM authenticated;

COMMENT ON COLUMN public.anamnese.fachbereich IS
  'Formular je Fachbereich (physio|podo|ergo|logo). Alt-Zeilen vor 0047 = physio.';
COMMENT ON COLUMN public.anamnese.felder IS
  'Fachspezifische Antworten; Schluessel definiert module/anamnese-formulare.js je form_version.';
COMMENT ON COLUMN public.anamnese.ist_aktuell IS
  'Vergibt anamnese_versionieren(). Leser brauchen .eq(''ist_aktuell'', true).';
COMMENT ON COLUMN public.anamnese.quelle IS
  'praxis = von der Praxis erfasst (geprueft beim Speichern); kiosk = Selbstauskunft, ungeprueft bis geprueft_am.';

-- ==========================================================================
-- TEIL 2 — podologie_behandlungen.therapiezeit_min (gkv-302 30.09.2026, Konsey S0)
-- ==========================================================================
-- c Komplexbehandlung (78020) setzt > 20 min Therapiezeit voraus; es gab keinen
-- Ort, an dem die Dauer dauerhaft stand. Nullable, keine Altwerte. Frontend: Oturum A.
-- Nicht in podologie_behandlungen_festschreibung aufgenommen (bleibt nachtragbar);
-- ob sie nach Festschreibung gesperrt wird, entscheidet gkv-302 (offen).
ALTER TABLE public.podologie_behandlungen
  ADD COLUMN therapiezeit_min smallint
      CONSTRAINT podologie_behandlungen_therapiezeit_check
      CHECK (therapiezeit_min IS NULL OR therapiezeit_min BETWEEN 1 AND 600);
COMMENT ON COLUMN public.podologie_behandlungen.therapiezeit_min IS
  'Dokumentierte Therapiezeit in Minuten (78020 Komplexbehandlung: > 20). NULL = nicht erfasst.';

-- ==========================================================================
-- TEIL 3 — pat_fussbefund.wagner_grad (Konsey S0: Wagner wird im Fussbefund erfasst)
-- ==========================================================================
ALTER TABLE public.pat_fussbefund
  ADD COLUMN wagner_grad smallint
      CONSTRAINT pat_fussbefund_wagner_grad_check
      CHECK (wagner_grad IS NULL OR wagner_grad BETWEEN 0 AND 5);
COMMENT ON COLUMN public.pat_fussbefund.wagner_grad IS
  'Wagner-Grad 0-5 (diabetisches Fusssyndrom). NULL = nicht erhoben.';

-- ==========================================================================
-- TEIL 4 — GPS-Check-in (guvenlik A-19 + legal-de 30.09.2026)
-- ==========================================================================
-- (a) Owner-Schalter, Standard AUS. Owner-Einstellungen liegen in profiles, nicht in
--     businesses (Einzelpraxis hat keinen businesses-Eintrag).
-- (b) attendance.check_in_valid darf NULL sein = "nicht geprueft" (Schalter aus,
--     Standort verweigert, Praxiskoordinate fehlt). Bisher NOT NULL DEFAULT false —
--     damit stand jeder Nicht-Pruefung als "ungueltig" im Bericht. Nur Lockerung,
--     keine Datenaenderung; der DEFAULT false bleibt fuer aeltere Images.
ALTER TABLE public.profiles
  ADD COLUMN gps_checkin_pruefen boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.profiles.gps_checkin_pruefen IS
  'Owner-Einstellung: beim Check-in einmalig pruefen, ob der Mitarbeiter im 150-m-Umkreis der Praxis ist. Gespeichert wird nur das Ergebnis, nie Koordinaten. Standard aus.';

ALTER TABLE public.attendance
  ALTER COLUMN check_in_valid DROP NOT NULL;
COMMENT ON COLUMN public.attendance.check_in_valid IS
  'true = im 150-m-Umkreis, false = ausserhalb, NULL = nicht geprueft (Schalter aus, kein Standort, keine Praxiskoordinate).';

-- ==========================================================================
-- TEIL 5 — diagnosegruppen DF/NF/QF: ICD<->DG vor DTA hart (gkv-302 30.09.2026)
-- ==========================================================================
-- Wie UI1/UI2. Wirkung im Preflight nur bei 'mismatch' UND leerem Diagnosetext
-- (billing/dta/preflight.js). Spiegel: api-backend/ai/validators/diagnosegruppen.json
-- (check_diagnosegruppen_icd.js gleicht daraus ab — beide im selben Commit).
UPDATE public.diagnosegruppen
   SET icd_enforcement = 'hard_before_dta'
 WHERE code IN ('DF','NF','QF');
