-- zweistufig: pending_employee_registrations — Schritt 1 war 01c57cf (01.10.2026, Schreib- und Lesepfad
--   stillgelegt, employee-signup.html nur noch Hinweis); :stable wurde nie veröffentlicht, alte
--   :beta-Images lesen die Tabelle nur per maybeSingle() und steigen still aus (onprem O-143).
-- profiles: privilegierte Spalten nur noch serverseitig schreibbar (guvenlik S-39).
--
-- WARUM: Die Policies „Users manage own profile" [ALL] und „Users can update own
--   profile" [UPDATE] erlaubten jeder angemeldeten Person, die EIGENE Zeile ohne
--   Spaltengrenze zu ändern. `auth_tenant_id()` = COALESCE(owner_id, id) liest
--   genau diese Zeile, und alle Team-Policies sowie `api-backend/ai/auth.js`
--   bestimmen den Mandanten daraus. Ein einziger PATCH
--   {owner_id: <fremde Praxis>, role: 'employee'} hätte also Lese- und
--   Schreibzugriff auf fremde Patienten, Verordnungen und Termine gegeben
--   (guvenlik 02.10.2026: kritisch). Nebenbei: plan/plan_status/trial_ends_at
--   waren selbst verlängerbar.
--
-- WAS:
--   1. BEFORE INSERT OR UPDATE-Trigger (SECURITY INVOKER — mit DEFINER wäre
--      current_user immer der Funktionsinhaber und die Sperre wirkungslos).
--      Greift nur, wenn current_user = authenticated/anon, also bei PostgREST-
--      Aufrufen aus dem Browser. service_role (Backend, Stripe-Webhook,
--      api/dsgvo.js) und SECURITY-DEFINER-Funktionen (handle_new_user,
--      delete_expired_accounts) laufen nicht als diese Rollen und bleiben frei.
--      * UPDATE: gesperrt sind owner_id, role, plan, plan_status, trial_ends_at,
--        current_period_end, stripe_customer_id, stripe_subscription_id,
--        stripe_price_id, is_active, activated_at, deletion_scheduled_at,
--        dta_pro_subscription_item_id.
--      * company_code: nur EINMAL setzbar (OLD IS NULL) und nur in Großbuchstaben
--        (dashboard.js ensureCompanyCode, kalender.js init schreiben genau so).
--      * INSERT: es gibt keinen Client-Pfad (Profil entsteht in handle_new_user)
--        → für authenticated/anon immer abgelehnt.
--   2. Policies: die überlappenden ALL/UPDATE/INSERT-Policies weg, eine einzige
--      UPDATE-Policy mit WITH CHECK. Kein DELETE/INSERT mehr vom Client (das
--      war der Weg „eigene Zeile löschen, neu anlegen"). Kontolöschung läuft
--      über api/dsgvo.js mit service_role. SELECT-Policies bleiben unverändert.
--   3. Eindeutigkeit von company_code unabhängig von Groß-/Kleinschreibung
--      (find_owner_id_by_code vergleicht mit upper()). Live 02.10.: 0 Dubletten,
--      0 Kleinbuchstaben-Codes.
--   4. pending_employee_registrations DROP: alter Mail-Self-Signup, seit 01.10.2026
--      (01c57cf) durch den Einrichtungscode ersetzt. Live 0 Zeilen; anon durfte
--      mit CHECK(true) einfügen (S-38 Auflage 8). db-ustasi 02.10.: Vier-Quellen-
--      Regel leer (nur confirm.html — im selben Commit entfernt — und das tote
--      employee-signup.js; keine Funktion/View/FK; nicht in api/dsgvo.js).
--
-- Client-Folgen im selben Commit: onboarding.js schreibt `plan` nicht mehr
--   (kommt vom Webhook), confirm.html applyPendingEmployeeData() entfernt.
--
-- SaaS: angewandt 02.10.2026, MCP.
-- ZAEHLER: public_tablo -1, rls_policy -5 (profiles: 3 weg, 1 neu; pending: 3 weg),
--   fonksiyon +1, trigger +1, index ±0 (pending PK −1, profiles_company_code_upper_key +1).

CREATE OR REPLACE FUNCTION public.profiles_privilegierte_spalten_schuetzen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Profile werden nur serverseitig angelegt.'
      USING ERRCODE = '42501';
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
$$;

REVOKE ALL ON FUNCTION public.profiles_privilegierte_spalten_schuetzen() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_privilegierte_spalten_schuetzen ON public.profiles;
CREATE TRIGGER profiles_privilegierte_spalten_schuetzen
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_privilegierte_spalten_schuetzen();

DROP POLICY IF EXISTS "Users manage own profile"     ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own            ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_company_code_upper_key
  ON public.profiles (upper(company_code))
  WHERE company_code IS NOT NULL;

DROP TABLE IF EXISTS public.pending_employee_registrations;
