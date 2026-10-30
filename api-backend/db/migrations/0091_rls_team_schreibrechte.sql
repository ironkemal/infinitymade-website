-- SaaS: angewandt 30.10.2026 (MCP; Pflichtberater db-ustasi, guvenlik S-62/S-63, onprem: GO)
-- CLAUDE_SYNC_AUDIT_REPORT §1.4 — drei RLS-Luecken zwischen Dashboard und Datenbank plus eine
-- Festschreibungsluecke:
--   1. working_hours: der Inhaber konnte Arbeitszeiten seiner Mitarbeiter nicht speichern (Zeilen ohne
--      owner_id), und der alte owner_id-Zweig vertraute einem vom Client gesendeten owner_id — eine
--      fremde Praxis konnte Zeilen fuer fremde Mitarbeiter anlegen (guvenlik S-62). Neu: Recht ueber
--      die Mitarbeiterbeziehung (profiles.owner_id), owner_id wird per Trigger abgeleitet.
--   2. breaks: dem Inhaber fehlte jede Policy fuer Pausen seiner Mitarbeiter.
--   3. profiles: Anrede/Profilbild eines Mitarbeiters speicherte 0 Zeilen ohne Fehler. Neu: eng
--      begrenzte UPDATE-Policy; der Schutztrigger laesst dabei NUR anrede und avatar_url durch
--      (Positivliste per jsonb-Vergleich — eine spaeter ergaenzte Spalte ist automatisch gesperrt).
--   4. podologie_behandlungen: therapiezeit_min ist abrechnungsrelevant (§302) und war nach dem
--      Speichern noch aenderbar (guvenlik S-63). Wird nur beim Anlegen geschrieben.
-- Team-Schreibrecht auf podologie_behandlungen wird bewusst NICHT geoeffnet: alle Schreibwege liegen
-- im Panel podologie-billing (nav-registry roles: ['owner']).
-- :stable/:beta-sicher: nur Policies/Trigger, keine Spalte entfernt. Der weggefallene owner_id-Zweig
-- deckte ausser dem Fremdschreiben nichts ab, was die Beziehungspruefung nicht auch deckt.

-- ── 1. working_hours ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.working_hours_owner_ableiten()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
BEGIN
  -- Nie dem Client trauen: owner_id = Mandant der Zeile (Mitarbeiter -> sein Inhaber, Inhaber -> er
  -- selbst, wie server.js beim Onboarding schreibt). Unbekannter user_id -> NULL.
  SELECT COALESCE(p.owner_id, p.id) INTO NEW.owner_id FROM public.profiles p WHERE p.id = NEW.user_id;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.working_hours_owner_ableiten() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.working_hours_owner_ableiten() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_working_hours_owner_ableiten ON public.working_hours;
CREATE TRIGGER trg_working_hours_owner_ableiten
  BEFORE INSERT OR UPDATE OF user_id, owner_id ON public.working_hours
  FOR EACH ROW EXECUTE FUNCTION public.working_hours_owner_ableiten();

-- Altbestand auf dieselbe Regel ziehen: Mitarbeiterzeilen ohne owner_id (routes/mitarbeiter-zugang.js)
-- oder mit der eigenen id, Inhaberzeilen ohne owner_id. Ohne den Nachtrag blieben sie bei der
-- Kontoloeschung (filter owner_id) liegen.
UPDATE public.working_hours w
   SET owner_id = COALESCE(p.owner_id, p.id)
  FROM public.profiles p
 WHERE p.id = w.user_id
   AND w.owner_id IS DISTINCT FROM COALESCE(p.owner_id, p.id);

DROP POLICY IF EXISTS working_hours_owner_modify ON public.working_hours;
DROP POLICY IF EXISTS working_hours_team_modify ON public.working_hours;
CREATE POLICY working_hours_team_modify ON public.working_hours
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = working_hours.user_id AND p.owner_id = auth.uid()))
  WITH CHECK (user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = working_hours.user_id AND p.owner_id = auth.uid()));

-- ── 2. breaks ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own breaks" ON public.breaks;
DROP POLICY IF EXISTS breaks_team_modify ON public.breaks;
CREATE POLICY breaks_team_modify ON public.breaks
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = breaks.user_id AND p.owner_id = auth.uid()))
  WITH CHECK (user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = breaks.user_id AND p.owner_id = auth.uid()));

-- ── 3. profiles ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_update_team ON public.profiles;
CREATE POLICY profiles_update_team ON public.profiles
  AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING (owner_id = auth.uid() AND role = 'employee' AND id <> auth.uid())
  WITH CHECK (owner_id = auth.uid() AND role = 'employee' AND id <> auth.uid());

CREATE OR REPLACE FUNCTION public.profiles_privilegierte_spalten_schuetzen()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Profile werden nur serverseitig angelegt.'
      USING ERRCODE = '42501';
  END IF;

  -- Fremdes Profil (Inhaber -> Mitarbeiter, Policy profiles_update_team): Positivliste.
  -- updated_at setzt der spaeter laufende Trigger profiles_updated_at, gehoert nicht zum Inhalt.
  IF auth.uid() IS DISTINCT FROM NEW.id THEN
    IF (to_jsonb(NEW) - 'anrede' - 'avatar_url' - 'updated_at')
       IS DISTINCT FROM (to_jsonb(OLD) - 'anrede' - 'avatar_url' - 'updated_at') THEN
      RAISE EXCEPTION 'Bei Mitarbeitern kann der Inhaber nur Anrede und Profilbild aendern.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.owner_id                     IS DISTINCT FROM OLD.owner_id
  OR NEW.role                         IS DISTINCT FROM OLD.role
  OR NEW.plan                         IS DISTINCT FROM OLD.plan
  OR NEW.plan_status                  IS DISTINCT FROM OLD.plan_status
  OR NEW.trial_ends_at                IS DISTINCT FROM OLD.trial_ends_at
  OR NEW.current_period_end           IS DISTINCT FROM OLD.current_period_end
  OR NEW.stripe_customer_id           IS DISTINCT FROM OLD.stripe_customer_id
  OR NEW.stripe_subscription_id       IS DISTINCT FROM OLD.stripe_subscription_id
  OR NEW.stripe_price_id              IS DISTINCT FROM OLD.stripe_price_id
  OR NEW.is_active                    IS DISTINCT FROM OLD.is_active
  OR NEW.activated_at                 IS DISTINCT FROM OLD.activated_at
  OR NEW.deletion_scheduled_at        IS DISTINCT FROM OLD.deletion_scheduled_at
  OR NEW.dta_pro_subscription_item_id IS DISTINCT FROM OLD.dta_pro_subscription_item_id
  THEN
    RAISE EXCEPTION 'Diese Profilfelder können nur serverseitig geändert werden.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.company_code IS DISTINCT FROM OLD.company_code THEN
    IF OLD.company_code IS NOT NULL
       OR NEW.company_code IS NULL
       OR NEW.company_code <> upper(NEW.company_code) THEN
      RAISE EXCEPTION 'Der Praxiscode kann nur einmal und nur in Großbuchstaben gesetzt werden.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 4. podologie_behandlungen: therapiezeit_min festschreiben ───────────────
CREATE OR REPLACE FUNCTION public.podologie_behandlungen_festschreibung()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.behandlungsdatum  is distinct from old.behandlungsdatum
  or new.hpnr_codes        is distinct from old.hpnr_codes
  or new.diagnosegruppe    is distinct from old.diagnosegruppe
  or new.lokalisation      is distinct from old.lokalisation
  or new.notizen           is distinct from old.notizen
  or new.betrag_gkv        is distinct from old.betrag_gkv
  or new.therapiezeit_min  is distinct from old.therapiezeit_min
  or new.owner_id          is distinct from old.owner_id
  or new.created_at        is distinct from old.created_at
  or new.herkunft          is distinct from old.herkunft
  then
    raise exception 'Dokumentierte Behandlung ist unveraenderlich (§ 630f Abs. 1 S. 2 BGB). Eine Korrektur erfolgt durch Stornierung mit Grund und eine neue Behandlungszeile.';
  end if;

  if old.storniert_am is not null
     and (new.storniert_am  is distinct from old.storniert_am
       or new.storno_grund  is distinct from old.storno_grund
       or new.storniert_von is distinct from old.storniert_von)
  then
    raise exception 'Eine Stornierung laesst sich nicht zuruecknehmen oder aendern (§ 630f Abs. 1 S. 2 BGB).';
  end if;

  if new.verordnung_id is not null
     and new.verordnung_id is distinct from old.verordnung_id
  then
    raise exception 'Die Zuordnung zur Verordnung ist festgeschrieben und kann nur aufgehoben (NULL), nicht umgehaengt werden.';
  end if;

  if old.employee_id is not null
     and new.employee_id is not null
     and new.employee_id is distinct from old.employee_id
  then
    raise exception 'Die durchfuehrende Person ist festgeschrieben und kann nicht ausgetauscht werden.';
  end if;

  return new;
end $function$;
