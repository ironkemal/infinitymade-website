-- Ops #297 (niedrig, Sicherheitshygiene) — Nebenfund aus der Advisor-Pruefung
-- vom 17.09.2026 waehrend Ops #254: 16 Funktionen sind aus `anon`, 17 aus
-- `authenticated` per /rest/v1/rpc/<name> aufrufbar (Supabase-Lints 0028/0029).
--
-- ZAEHLER: unveraendert (nur REVOKE EXECUTE; keiner der 10 Strukturzaehler in
-- api-backend/db/schema-zaehler.js liest ACLs — Tabelle/Policy/Funktion/Trigger/
-- Index/Extension/Bucket/Publication bleiben zahlengleich).
--
-- SaaS: angewandt 17.09.2026, MCP.
--
-- ---------------------------------------------------------------------------
-- Was hier WIRKLICH das Loch ist: nicht der anon-GRANT, sondern PUBLIC
-- ---------------------------------------------------------------------------
-- Fast alle betroffenen Funktionen tragen in `proacl` den Eintrag `=X/postgres`
-- — das ist ein GRANT an PUBLIC, also an *jede* Rolle. Ein
--     REVOKE EXECUTE ... FROM anon, authenticated;
-- allein haette daher GAR NICHTS geschlossen: beide Rollen haetten EXECUTE
-- weiterhin ueber PUBLIC geerbt, und der Advisor waere trotzdem rot geblieben.
-- Deshalb steht unten ueberall PUBLIC zuerst. (Dasselbe Muster wie 0002.)
--
-- ---------------------------------------------------------------------------
-- Teil 1 — Trigger-Funktionen (43 Stueck)
-- ---------------------------------------------------------------------------
-- Eine Funktion mit RETURNS trigger ist ueber PostgREST praktisch nicht
-- ausnutzbar ("trigger functions can only be called as triggers"), aber sie
-- gehoert auch nicht in die exponierte API — sie ist Innenleben der Tabelle.
--
-- Die tragende Annahme wurde am 17.09.2026 auf der Live-DB in einer
-- zurueckgerollten Transaktion BEWIESEN, nicht angenommen:
--   A) INSERT als `authenticated` nach dem REVOKE  -> Trigger feuert weiterhin
--      (updated_at gesetzt). PostgreSQL prueft EXECUTE auf Trigger-Funktionen
--      bei CREATE TRIGGER, nicht bei jedem Feuern.
--   B) direkter Aufruf als `authenticated`         -> 42501 permission denied
--   C) direkter Aufruf als `anon`                  -> 42501 permission denied
-- Genau das ist das gewuenschte Ergebnis: innen unveraendert, aussen zu.
--
-- Betroffen (Stand 17.09.2026, davon 7 SECURITY DEFINER = die vom Advisor
-- gemeldeten): aerzte_touch_updated_at, codex_192_booking_after_cancel,
-- codex_192_booking_before_write, codex_192_session_booking_guard,
-- fn_abrechnung_zahlung_status, fn_abrechnung_zeile_festschreibung,
-- fn_befreiung_backfill_prescriptions, fn_check_booking_closed_day,
-- fn_patient_consents_immutable*, fn_prescriptions_set_befreit,
-- fn_zuzahlung_guthaben_status, invoice_festschreibung,
-- notify_feedback_telegram, notify_new_referral_draft,
-- pat_fussbefund_versionieren, prescriptions_festschreibung,
-- prevent_abrechnung_zahlung_mod, prevent_belegliste_mod,
-- prevent_booking_status_korrekturen_mod, prevent_rechnung_zahlungen_mod,
-- prevent_zuzahlung_korrekturen_mod, seed_default_groups_for_business,
-- set_bookings_business_id_default, set_business_id_default,
-- set_invoice_nummer*, set_next_ausfallrechnung_nr*, set_next_beleg_nr*,
-- set_next_mahnung_nr*, set_updated_at, set_updated_at_now,
-- set_warteliste_updated_at, sync_leads_location,
-- sync_profiles_clinic_location, touch_updated_at, trg_billing_updated_at,
-- trg_normalize_booking_phone_fn, trg_normalize_lead_phone_fn,
-- trg_prescriptions_updated_at, update_attendance_updated_at,
-- update_updated_at_column, vergebe_patientennummer*,
-- vergebe_verordnungsnummer_rx*, verordnung_festschreibung
-- (* = SECURITY DEFINER)
--
-- Warum eine Schleife statt 43 x 3 ausgeschriebener REVOKE-Zeilen: auf einer
-- frischen On-Prem-Box entstehen diese Funktionen erst durch 0000..0023, und
-- ein ausgeschriebener Name, den es dort (noch) nicht gibt, laesst REVOKE mit
-- "function does not exist" scheitern und damit die ganze Box nicht hochkommen.
-- Die Schleife wirkt auf genau den Bestand, der zum Zeitpunkt des Laufs da ist.
-- Sie laeuft EINMAL — Trigger-Funktionen aus spaeteren Migrationen sind nicht
-- abgedeckt und muessen ihren REVOKE selbst mitbringen.

DO $$
DECLARE
  f record;
  n int := 0;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.prorettype = 'pg_catalog.trigger'::regtype
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'   -- Extension-eigene nicht anfassen
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', f.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', f.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', f.sig);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Ops #297: EXECUTE auf % Trigger-Funktionen von PUBLIC/anon/authenticated entzogen', n;
END $$;

-- ---------------------------------------------------------------------------
-- Teil 2 — delete_expired_accounts(): der einzige echte Fund
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, RETURNS void, ohne Argumente — also ueber
-- POST /rest/v1/rpc/delete_expired_accounts von JEDEM aufrufbar, auch ohne
-- Login. `proacl` war `=X/postgres | postgres=X/postgres | service_role=X/postgres`:
-- kein expliziter anon-GRANT, aber der PUBLIC-Eintrag hat genuegt.
--
-- Die Funktion anonymisiert Profile (business_name/Name/Adresse/IBAN/IK/
-- Steuernummer -> '[geloescht]' bzw. NULL). Der Radius ist begrenzt — sie
-- fasst nur Profile mit deletion_scheduled_at <= NOW() und plan_status in
-- ('canceled','expired') an, ein Fremder kann also nichts auswaehlen, sondern
-- hoechstens den ohnehin faelligen Lauf vorziehen. Trotzdem: eine schreibende,
-- DSGVO-relevante Aufraeumfunktion darf nicht am offenen Internet haengen.
--
-- Einziger Aufrufer ist der Cron in api-backend/server.js:3855 —
-- supabase.rpc('delete_expired_accounts') auf dem service_role-Client.
-- service_role behaelt EXECUTE, der Cron laeuft unveraendert weiter.

DO $$
BEGIN
  IF to_regprocedure('public.delete_expired_accounts()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.delete_expired_accounts() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.delete_expired_accounts() FROM anon;
    REVOKE EXECUTE ON FUNCTION public.delete_expired_accounts() FROM authenticated;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- BEWUSST NICHT ANGEFASST — wer hier aufraeumt, legt die App lahm
-- ---------------------------------------------------------------------------
-- auth_tenant_id(), is_admin()
--   Das sind RLS-Helfer, keine RPCs. Policy-Ausdruecke werden mit den Rechten
--   des *fragenden* Rollen ausgewertet, die EXECUTE-ACL wird also mitgeprueft.
--   Am 17.09.2026 in einer zurueckgerollten Transaktion gemessen:
--     REVOKE auth_tenant_id() -> SELECT auf `profiles` als authenticated
--                                endet mit 42501 permission denied.
--                                (Policy "Profiles tenant read" — das ist der
--                                 Login-/Dashboard-Pfad, also ein Totalausfall.)
--     REVOKE is_admin()       -> SELECT auf `visibility_reports` als
--                                authenticated endet mit 42501.
--   Der Advisor meldet beide, aber der Advisor kennt den Policy-Graphen nicht.
--
-- search_diagnosen(), search_heilmittel()
--   Legitime oeffentliche Kataloge-RPCs, aufgerufen aus katalog-suche.js:59/73.
--   Enthalten keine Mandanten- oder Patientendaten (ICD-Titel, HPNR-Positionen).
--
-- public_praxis_sector(uuid)
--   booking-request.html:677 — die oeffentliche Terminanfrage, laeuft als anon.
--
-- find_owner_id_by_code(text)
--   booking.js:75 (oeffentliche Buchungsseite). anon hat hier ohnehin KEIN
--   EXECUTE (kein PUBLIC-Eintrag in proacl) — der GRANT an authenticated bleibt
--   unangetastet, damit kein eingeloggter Pfad kippt.
--
-- st_estimatedextent(...) (3 Overloads)
--   Gehoeren zur PostGIS-Extension. Extension-eigene ACLs werden beim naechsten
--   Extension-Update ohnehin neu gesetzt; ein REVOKE hier waere ein stiller
--   Konflikt statt einer Loesung. Fachlich harmlos (Statistik-Schaetzung auf
--   Geometriespalten). Bleibt als dauerhafter Advisor-Rest stehen — bewusst.
