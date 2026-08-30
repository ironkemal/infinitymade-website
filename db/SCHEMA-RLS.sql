-- =====================================================================
-- Praxura — RLS-Policies, Funktionen, Trigger, Indizes
-- =====================================================================
-- ERZEUGT AM:        2026-08-30 (Fussbefund: Versionen statt Ueberschreiben)
-- LETZTE MIGRATION:  pat_fussbefund_versionierung_und_serie
--                    davor: business_services_droppen_spiegeltabelle
--                    davor: prescription_sessions_booking_unique
--                    davor: leads_geschlecht_kodierung_dokumentieren
--                    davor: invoice_nummer_backfill_altbestand
--                    davor: invoices_ust_nummernkreis_gobd
--                    davor: invoices_verordnung_id
--                    davor: 20260815233848_verordnungsnummer_belegnummer
--                    davor: 20260815085338_leads_patientennummer
--                    davor: 20260814200147_leads_handy_getrennt
--                    davor: 20260814101707_patient_consents
--                    davor: 20260814101624_kiosk_pin_hardening
--                    davor: 20260814083941_fussbefund_termin_legende
--                    davor: 20260814082430_verordnungen_abrechnungsstatus_absetzung
--                    davor: tighten_avatars_storage_policies (12.08.)
--                    (danach am 11.08. sql-melih/SUPABASE-JETZT-AUSFUEHREN.sql
--                     im SQL-Editor gelaufen — keine Migrationszeile, aber in
--                     der DB vorhanden)
-- UMFANG:            152 RLS-Policies · 288 Indizes · 58 Trigger · 61 Funktionen
--                    (Zählweise siehe Kopf von db/SCHEMA.sql. Die alten
--                     Werte „60 Trigger · 54 Funktionen" widersprachen dort
--                     „58 Trigger · 60 Funktionen" — am 28.08.2026 gegen die
--                     Live-DB vereinheitlicht.)
-- Tabellen/Spalten:  db/SCHEMA.sql · Orientierung: db/README.md
--
-- ⚠️  MOMENTAUFNAHME. Nach jeder Migration neu erzeugen.
--
-- ⚠️  NICHT ENTHALTEN: storage.objects-Policies (Schema `storage`, nicht
--     `public`). Stand 12.08.2026 gibt es dort fünf Buckets:
--       avatars           public  — Mitarbeiterbilder + Praxis-Logo,
--                                   Schreiben nur im eigenen Ordner
--                                   (<profile_id>/…) oder im Ordner eines
--                                   eigenen Mitarbeiters
--       prescriptions     privat  — Ordner = owner_id
--       patient-documents privat  — Ordner = owner_id
--       abrechnungen      privat  — nur Lesen, Ordner = owner_id
--       referrals         privat
--     Wer Storage-Zugriff plant, prüft die Policies direkt in der DB.
-- =====================================================================


-- =====================================================================
-- 1. MANDANTENTRENNUNG — das Grundmuster
-- =====================================================================
-- Fast jede Policy ist eine Variante von:
--
--     auth.uid() = owner_id                             -- ich bin der Inhaber
--     OR auth.uid() IN (SELECT id FROM profiles         -- ich bin Mitarbeiter
--                       WHERE owner_id = <tabelle>.owner_id)
--
-- Es gibt drei Schreibweisen für dieselbe Absicht (historisch gewachsen):
--     a) auth.uid() IN (SELECT profiles.id FROM profiles WHERE profiles.owner_id = t.owner_id)
--     b) EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.owner_id = t.owner_id)
--     c) t.owner_id = (SELECT profiles.owner_id FROM profiles WHERE profiles.id = auth.uid())
-- Beim Anlegen neuer Policies eine davon übernehmen, nichts Neues erfinden.
--
-- RLS ist auf ALLEN Tabellen aktiv außer spatial_ref_sys (PostGIS, unkritisch).
--
-- ⚠️ Öffentlich lesbar (anon darf SELECT) — bewusst, für die Buchungsseite:
--      services · working_hours · time_offs · employee_services · custom_days
--      businesses + profiles (nur wenn booking_slug gesetzt und auth.uid() IS NULL)
--    Referenztabellen (unkritisch, keine Patientendaten):
--      diagnosegruppen · icd10_titles · icd_sector_ranges · heilmittel_katalog
--      heilmittel_catalog · krankenkassen · kostentraeger · dta_schluessel
--      heilmittel_position · heilmittel_tarif
--    anon darf INSERT: demo_bookings · pending_employee_registrations


-- =====================================================================
-- 2. RLS-POLICIES (152)
-- =====================================================================

-- abrechnung
--   abrechnung_owner_all [ALL]
--     USING (auth.uid() = owner_id OR auth.uid() IN (SELECT id FROM profiles WHERE owner_id = abrechnung.owner_id))

-- accommodations
--   Users manage own accommodations [ALL] USING (auth.uid() = user_id)

-- admin_users
--   users can check own admin status [SELECT] USING (auth.uid() = user_id)

-- aerzte
--   aerzte_select_owner [SELECT]
--     USING (auth.uid() = owner_id OR owner_id IN (SELECT owner_id FROM profiles WHERE id = auth.uid() AND role = 'employee'))
--   aerzte_insert_owner [INSERT] CHECK (auth.uid() = owner_id)
--   aerzte_update_owner [UPDATE] USING/CHECK (auth.uid() = owner_id)
--   aerzte_delete_owner [DELETE] USING (auth.uid() = owner_id)
--   ⚠️ Mitarbeiter dürfen LESEN, aber nicht schreiben.

-- ai_audit_log
--   ai_audit_select_own [SELECT] USING (auth.uid() = tenant_id)

-- anamnese
--   anamnese_owner_and_team_{select,insert,update,delete}
--     owner_id = auth.uid() OR owner_id = (SELECT owner_id FROM profiles WHERE id = auth.uid())

-- applications
--   Users can read/insert own applications — auth.uid() = user_id

-- attendance
--   employee_read_own   [SELECT] USING (auth.uid() = employee_id)
--   owner_read_team     [SELECT] USING (auth.uid() = owner_id)
--   employee_insert_own [INSERT] CHECK (auth.uid() = employee_id AND date = CURRENT_DATE)
--   employee_update_own [UPDATE] USING/CHECK (auth.uid() = employee_id)
--   owner_update_team   [UPDATE] USING (auth.uid() = owner_id)

-- ausfallrechnungen
--   ausfallrechnungen_select [SELECT] owner + Team
--   ausfallrechnungen_insert [INSERT] CHECK (auth.uid() = owner_id)
--   ausfallrechnungen_update [UPDATE] USING/CHECK (auth.uid() = owner_id)

-- b2b_contacts
--   owner_crud_b2b_contacts [ALL] owner + Team (EXISTS-Variante)

-- belegliste
--   Belegliste select scoping [SELECT] owner + Team
--   Belegliste insert scoping [INSERT] owner + Team
--   ⚠️ KEIN UPDATE/DELETE — GoBD. Trigger prevent_belegliste_mod() blockt zusätzlich.

-- booking_requests
--   owner sees own requests [ALL] owner + Team

-- bookings
--   Kullanıcılar kendi aldıkları randevuları görebilir [ALL] USING (auth.uid() = user_id)
--   bookings_owner_read [ALL] owner + Team
--   Owners can view/update team bookings [SELECT/UPDATE] USING (auth.uid() = owner_id)
--   Employees can view/insert/update/delete bookings for their owner
--     EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.owner_id = bookings.owner_id)
--   ⚠️ Acht Policies auf einer Tabelle, teils überlappend. Vor Änderungen
--      erst lesen — leicht, versehentlich Zugriff zu öffnen.

-- breaks
--   Users can manage own breaks [ALL] USING (user_id = auth.uid())
--   Employees can see owner breaks [SELECT] user_id = auth.uid() OR EXISTS(... p.owner_id = breaks.user_id)

-- business_services — Tabelle am 28.08.2026 gedroppt, damit auch ihre vier
--   Policies. Sie prüften `auth.uid() = business_id`, während in der Spalte
--   eine `businesses.id` stand; keine Zeile war je für eine Praxis sichtbar.
--   `services` ist die einzige Leistungstabelle.

-- businesses
--   businesses_select_owner_or_employee [SELECT] owner + Team
--   Public booking lookup businesses [SELECT] USING (auth.uid() IS NULL AND booking_slug IS NOT NULL)
--   businesses_insert/update/delete_owner_only — auth.uid() = owner_id

-- calendar_integrations
--   Kullanıcılar sadece kendi tokenlarını görebilir [ALL] USING (auth.uid() = user_id)

-- consent_log
--   users read own consents [SELECT] USING (auth.uid() = user_id)

-- custom_days
--   custom_days_owner_all [ALL] USING/CHECK (auth.uid() = owner_id)
--   custom_days_public_read [SELECT] USING (true)   ⚠️ für alle lesbar

-- data_access_log
--   owner reads own access log [SELECT] USING (auth.uid() = owner_id)

-- data_sharing_settings
--   dss_select [SELECT] owner + Team · dss_insert/update [.] owner_id = auth.uid()

-- demo_bookings
--   anon can insert demo_bookings [INSERT / anon] CHECK (true)
--   authenticated can select demo_bookings [SELECT / authenticated] USING (true)

-- diagnosegruppen
--   diagnosegruppen_read + read_only_reference [SELECT / anon,authenticated] USING (true)

-- document_vorlagen
--   vorlagen_owner_access [ALL] owner + Team (role = 'employee')

-- dta_schluessel
--   dta_schluessel_read_all [SELECT] USING (auth.role() = 'authenticated')

-- email_logs
--   owner_all [ALL] owner + Team

-- employee_business_assignments
--   eba_select [SELECT] employee_id = auth.uid() OR EXISTS(businesses b WHERE b.owner_id = auth.uid())
--   eba_write_owner_only [INSERT] · eba_update_owner_only [UPDATE] · eba_delete_owner_only [DELETE]
--     jeweils: Business gehört mir UND der Mitarbeiter gehört mir

-- employee_groups
--   employee_groups_owner_all [ALL] über businesses -> owner + Team

-- employee_scope_overrides
--   eso_owner_or_self [ALL] employee_id = auth.uid() OR Business gehört mir

-- employee_services
--   Authenticated operations employee services [ALL] USING/CHECK (auth.role() = 'authenticated')
--   Public read employee services [SELECT] USING (true)
--   ⚠️ Jeder eingeloggte Nutzer darf schreiben — mandantenübergreifend offen.
--      Bekannte Schwachstelle, Tabelle enthält nur Zuordnungs-IDs.

-- fahrten
--   fahrten select policy [SELECT] owner_id = auth.uid() OR user_id = auth.uid()
--   fahrten insert policy [INSERT] user_id = auth.uid() AND (owner oder Team)
--   fahrten update policy [UPDATE] user_id = auth.uid() OR owner_id = auth.uid()
--   fahrten delete policy [DELETE] owner_id = auth.uid()

-- feedbacks
--   feedbacks_select/insert/update_own — auth.uid() = user_id

-- fußstatus
--   owner_fußstatus [ALL] USING (owner_id = auth.uid())   ⚠️ ohne Team-Zugriff

-- group_scopes
--   group_scopes_via_group [ALL] über employee_groups -> businesses -> owner + Team

-- heilmittel_catalog / heilmittel_katalog / icd10_titles / icd_sector_ranges
--   read_only_reference bzw. *_read [SELECT / anon,authenticated] USING (true)

-- heilmittel_position / heilmittel_tarif / kostentraeger
--   *_read_all [SELECT] USING (auth.role() = 'authenticated')

-- invoices
--   owner_and_employee_invoices [ALL] owner + Team

-- krankenkassen
--   Allow authenticated read [SELECT / authenticated] USING (true)

-- kiosk_pins   ⚠️ RLS AKTIV, ABER BEWUSST OHNE POLICY
--   Keine einzige Policy + REVOKE ALL ON kiosk_pins FROM anon, authenticated.
--   PostgREST liefert damit garantiert nichts aus; nur service_role (Backend)
--   kommt an den scrypt-Hash. Ein 4-stelliger PIN wäre im Client in
--   Millisekunden durchprobiert — der Hash darf den Server nie verlassen.
--   Prüfung ausschließlich über POST /api/kiosk/pin/verify (api-backend).
--   ⚠️ Wer hier "der Vollständigkeit halber" eine Policy ergänzt, hebt den
--     Schutz auf. Das Fehlen ist die Maßnahme.

-- leads   ★ Hauptpatiententabelle
--   team view/insert/update/delete leads [/ authenticated]
--     owner_id = auth.uid() OR owner_id = (SELECT owner_id FROM profiles WHERE id = auth.uid())

-- mahnungen
--   mahnungen_select [SELECT] owner + Team · insert/update nur owner

-- messreihen
--   messreihen_owner_access [ALL] owner_id = auth.uid() OR owner_id IN (SELECT owner_id FROM profiles WHERE id = auth.uid())

-- module_visibility
--   mv_read_authenticated [SELECT / authenticated] USING (true)
--   mv_admin_insert/update/delete — is_admin()

-- pat_fussbefund
--   pat_fussbefund_owner_access [ALL] owner + Team

-- patient_consents   ★ digitale Patienten-Einwilligung (Konsey 2026-08-14)
--   patient_consents_owner_select [SELECT] owner + Team
--   patient_consents_owner_insert [INSERT] owner + Team
--   patient_consents_owner_revoke [UPDATE] owner + Team
--     alle drei: auth.uid() = owner_id
--                OR auth.uid() IN (SELECT id FROM profiles WHERE owner_id = patient_consents.owner_id)
--   ⚠️ KEIN DELETE-Policy — Löschen für authenticated grundsätzlich unmöglich.
--     Zusätzlich blockt trg_patient_consents_immutable 10 Jahre lang
--     (§630f Abs. 3 BGB) und lässt beim UPDATE nur revoked_at/revoke_reason zu.
--   ⚠️ Nicht mit `consent_log` verwechseln — das ist die B2B-Seite
--     (Praxisinhaber, AVV/AGB), andere betroffene Person, andere Frist.

-- patient_notes
--   owner_only [ALL] USING (auth.uid() = owner_id)   ⚠️ ohne Team-Zugriff

-- patients
--   owner sees own patients [ALL] owner + Team

-- pending_employee_registrations
--   anon_insert_pending_employee [INSERT] CHECK (true)
--   user_select/delete_own_pending_employee — email = eigene auth.users-Mail

-- podologie_behandlungen
--   owner_behandlungen [ALL] USING (owner_id = auth.uid())   ⚠️ ohne Team-Zugriff

-- prescription_documents
--   prescription_documents_owner_all [ALL] owner + Team

-- prescription_sessions / prescription_validations
--   *_via_prescription [ALL] prescription_id IN (SELECT id FROM prescriptions WHERE owner + Team)

-- prescriptions
--   prescriptions_owner_all [ALL] owner + Team

-- profiles
--   Users manage own profile [ALL] USING (auth.uid() = id)
--   Profiles tenant read [SELECT]
--     id = auth.uid() OR owner_id = auth.uid() OR id = auth_tenant_id() OR owner_id = auth_tenant_id()
--   Public booking lookup profiles [SELECT]
--     auth.uid() IS NULL AND booking_slug IS NOT NULL AND accepts_bookings = true
--   Users can insert/update own profile — auth.uid() = id

-- referral_drafts
--   Users can view/insert/update/delete own referral drafts — owner_id = auth.uid()

-- scraper_data
--   owner_crud_scraper_data [ALL] USING/CHECK (owner_id = auth.uid())

-- services
--   Public read services [SELECT] USING (true)   ⚠️ für alle lesbar
--   Kullanıcılar kendi hizmetlerini ekleyebilir/silebilir — user_id oder owner_id = auth.uid()
--   services_update [UPDATE] zusätzlich für Mitarbeiter (role = 'employee')

-- terapeut_zertifikat
--   zertifikat_owner_all [ALL] owner + Team

-- therapist_certificates
--   therapist_certificates_select/insert/delete
--     auth.uid() = owner_id OR auth.uid() = profile_id OR Team

-- time_offs
--   Authenticated operations time offs [ALL] USING/CHECK (auth.role() = 'authenticated')
--   Public read time offs [SELECT] USING (true)
--   ⚠️ Wie employee_services: jeder Eingeloggte darf schreiben.

-- trip_history / trip_plans
--   Users manage own history/plans [ALL] USING (auth.uid() = user_id)

-- ueberweisungen
--   ueberweisungen_select/insert/update/delete — owner + Team (c-Variante)

-- user_credits
--   Users can read own credits [SELECT] USING (auth.uid() = user_id)

-- user_preferences
--   user_preferences_self [ALL] USING (user_id = auth.uid())

-- vehicles
--   vehicles select policy [SELECT]
--     owner_id = auth.uid()
--     OR (Team AND (kind = 'gewerblich' OR created_by = auth.uid()))
--   vehicles insert policy [INSERT] created_by = auth.uid() AND (owner ODER privat+Team)
--   vehicles update/delete policy — owner_id = auth.uid() OR (kind='privat' AND created_by = auth.uid())
--   → Privatfahrzeuge eines Mitarbeiters bleiben vor Kollegen verborgen.

-- verordnungen
--   owner_verordnungen [ALL] USING (owner_id = auth.uid())   ⚠️ ohne Team-Zugriff

-- visibility_reports
--   vr_admin_read [SELECT] is_admin() · vr_admin_delete [DELETE] is_admin()
--   vr_insert_authenticated [INSERT] CHECK (true)
--   vr_update_authenticated [UPDATE] USING/CHECK (true)

-- warteliste
--   Owner zugriff auf warteliste [ALL] USING (owner_id = auth.uid())   ⚠️ ohne Team-Zugriff

-- working_hours
--   working_hours_owner_modify [ALL] USING/CHECK (auth.uid() = user_id OR auth.uid() = owner_id)
--   working_hours_owner_select [SELECT] dito
--   Public read working hours [SELECT] USING (true)   ⚠️ für alle lesbar

-- zaa_fehler
--   zaa_fehler_via_abrechnung [ALL] abrechnung_id IN (SELECT id FROM abrechnung WHERE owner + Team)

-- zuzahlung_befreiung
--   befreiung_owner_all [ALL] owner + Team

-- HINWEIS zu den fünf mit "⚠️ ohne Team-Zugriff" markierten Tabellen
-- (fußstatus, patient_notes, podologie_behandlungen, verordnungen, warteliste):
-- Nur der Inhaber sieht die Daten, angestellte Therapeuten nicht. Für die
-- Podologie-Tabellen ist das noch nicht entschieden — nicht stillschweigend
-- „korrigieren“, das ist eine Produktfrage.


-- =====================================================================
-- 3. FUNKTIONEN (61 eigene = alles in `public`, was keiner Extension gehört;
--    PostGIS-Funktionen sind deshalb ausgelassen)
-- =====================================================================

-- --- Berechtigung / Mandant --------------------------------------------
-- auth_tenant_id() -> uuid                                [SECURITY DEFINER]
CREATE OR REPLACE FUNCTION public.auth_tenant_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(p.owner_id, p.id) FROM profiles p WHERE p.id = auth.uid();
$function$;

-- is_admin() -> boolean                                   [SECURITY DEFINER]
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select exists (select 1 from admin_users where user_id = auth.uid())
$function$;

-- get_default_business(p_user uuid) -> uuid
CREATE OR REPLACE FUNCTION public.get_default_business(p_user uuid)
 RETURNS uuid LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT b.id FROM public.businesses b
    JOIN public.profiles p ON p.id = p_user
   WHERE b.owner_id = COALESCE(p.owner_id, p.id) AND b.is_default
   LIMIT 1
$function$;

-- get_my_permissions(p_business_id uuid) -> TABLE(module text, has_access boolean)
--   Owner bekommt pauschal TRUE für alle Module. Für Mitarbeiter gilt:
--   employee_scope_overrides schlägt group_scopes.
--   Modulliste (hartkodiert, muss zu nav-registry.js passen):
--     dashboard, calendar, customers, services, hours, team, notes, anamnese,
--     prescriptions, abrechnung, fahrtenbuch, b2b, b2c, feedback, settings

-- find_owner_id_by_code(p_code text) -> uuid              [SECURITY DEFINER]
--   6-stelliger company_code -> Inhaber (Mitarbeiter-Registrierung).

-- public_praxis_sector(p_owner_id uuid) -> text           [SECURITY DEFINER]
CREATE OR REPLACE FUNCTION public.public_praxis_sector(p_owner_id uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select p.sector from profiles p where p.id = p_owner_id limit 1;
$function$;

-- whoami() -> jsonb   (Debug-Helfer)


-- --- Suche (von den Frontend-Modulen aufgerufen) ------------------------
-- search_diagnosen(p_q text, p_bereich text = NULL, p_kind text = 'both', p_limit int = 25)
--   -> TABLE(kind, code, titel, bereich, terminal, in_sector, rank)  [SECURITY DEFINER]
--   Liefert Diagnosegruppen ('dg') und ICD-Codes ('icd') in einer Liste.
--   in_sector kommt aus icd_sector_ranges — Grundlage des strict-Filters.
--   Sortierung: in_sector DESC, dg vor icd, rank DESC, terminal DESC, code.
--   Leere Eingabe (p_q = NULL/'') liefert nur Diagnosegruppen — das ist das
--   „Leerklick zeigt Diagnosegruppen“-Verhalten des Pickers.
--   Rangvergabe dg:  exakt 100 · Präfix 90 · enthalten 70 · Label-Präfix 60 · sonst 40
--   Rangvergabe icd: exakt 100 · Präfix 90 · Titel-Präfix 60 · Titel-Wortanfang 50 · sonst 30
--   Volltext ist bewusst LIKE + Trigram-Index, kein tsvector.

-- search_heilmittel(p_q, p_bereich, p_diagnosegruppe, p_datum, p_limit = 100)
--   -> TABLE(code, bereich, label, kuerzel, kategorie, preis_eur, zuzahlung_eur,
--            dauer, max_pro_tag, max_pro_termin, notiz, rank)     [SECURITY DEFINER]
--   Liest heilmittel_katalog. Filtert auf Stichtag (p_datum, Default heute):
--     gueltig_ab <= d AND gueltig_bis >= d AND NOT deprecated
--     AND (ungueltig_ab IS NULL OR ungueltig_ab > d)
--   Diagnosegruppen-Filter greift nur, wenn das Heilmittel überhaupt
--   Diagnosegruppen hinterlegt hat (NULL = für alle zulässig).

-- find_patient_by_name_and_birth(p_vorname, p_nachname, p_geburtsdatum, p_owner_id)
--   -> TABLE(id, first_name, last_name, geburtsdatum, phone, email)  [SECURITY DEFINER]

-- normalize_phone(p text) -> text
--   Telefon-Normalisierung (DE). Wird von den Telefon-Triggern genutzt.


-- --- Onboarding / Vault -------------------------------------------------
-- pending_signup_store(p_email text, p_onboarding jsonb, p_password text) -> uuid  [SEC DEF]
-- pending_signup_consume(p_pending_id uuid) -> text                                [SEC DEF]
-- pending_signup_delete(p_pending_id uuid) -> void                                 [SEC DEF]
--   Einziger verbliebene Vault-Anwendungsfall: das temporäre Onboarding-Passwort.
-- handle_new_user() -> trigger                                                     [SEC DEF]
--   Legt beim Signup den profiles-Datensatz an (auth.users-Trigger).
-- delete_expired_accounts() -> void                                                [SEC DEF]
--   Löscht Konten nach Ablauf von deletion_scheduled_at.


-- --- Gmail-Token (Vault) ------------------------------------------------
-- get_gmail_token(p_user_id uuid) -> text                 [SECURITY DEFINER]
-- set_gmail_token(p_user_id uuid, p_token text) -> void   [SECURITY DEFINER]
-- clear_gmail_token(p_user_id uuid) -> void               [SECURITY DEFINER]


-- --- Abrechnung / Zuzahlung ---------------------------------------------
-- fn_is_patient_befreit(p_patient_id uuid, p_datum date) -> boolean
CREATE OR REPLACE FUNCTION public.fn_is_patient_befreit(p_patient_id uuid, p_datum date)
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM zuzahlung_befreiung
    WHERE patient_id = p_patient_id
      AND befreit_ab <= p_datum
      AND (befreit_bis IS NULL OR befreit_bis >= p_datum)
  );
$function$;
-- fn_prescriptions_set_befreit()        -> trigger  (setzt prescriptions.zuzahlung_befreit)
-- fn_befreiung_backfill_prescriptions() -> trigger  (Nachtrag bei Befreiungsänderung)
-- set_next_beleg_nr() · set_next_mahnung_nr() · set_next_ausfallrechnung_nr()
--   Lückenlose Nummernkreise je Inhaber. Zählen per MAX+1 im Trigger — bei
--   zwei gleichzeitigen Inserts kann dieselbe Nummer fallen, der UNIQUE-Index
--   fängt es dann als Fehler. Für Rechnungen wurde das ersetzt:
-- naechste_nummer(p_owner, p_kreis, p_jahr) -> bigint      [SECURITY DEFINER]
--   Zählt über die Tabelle `nummernkreise` per
--   INSERT .. ON CONFLICT DO UPDATE .. RETURNING — die Zeile ist damit gesperrt,
--   zwei gleichzeitige Aufrufe bekommen verschiedene Nummern.
-- set_invoice_nummer() -> trigger                          [SECURITY DEFINER]
--   Vergibt invoices.rechnung_nr + invoice_number ('INV-<Jahr>-<4-stellig>')
--   beim INSERT und schreibt sie beim UPDATE unveränderlich fort
--   (§ 14 Abs. 4 Nr. 4 UStG: einmalig vergebene fortlaufende Nummer).
--   Das Frontend zählt seit 16.08.2026 NICHT mehr selbst hoch.
-- invoice_festschreibung() -> trigger
--   Ab status <> 'draft' sind die inhaltlichen Felder der Rechnung gesperrt
--   (§ 146 Abs. 4 AO). Offen bleiben status, payment_*, paid_at, notes.
-- vergebe_patientennummer() -> trigger                    [SECURITY DEFINER]
--   Fortlaufende Patientennummer je Praxis, ab 1 (leads.patientennummer).
--   pg_advisory_xact_lock je owner_id: legen zwei Mitarbeiter gleichzeitig an,
--   laesen sonst beide dasselbe Maximum und die Nummer waere doppelt vergeben.
-- naechste_verordnungsnummer(p_owner, p_lead) -> integer  [SECURITY DEFINER]
--   Fortlaufende Verordnungsnummer JE PATIENT, ab 1. Zaehlt ueber BEIDE Toepfe
--   (prescriptions + verordnungen) — derselbe Patient darf nicht zweimal die 3
--   bekommen, sonst steht dieselbe Belegnummer zweimal in derselben DTA-Datei
--   (preflight P:01007). Sperre wie oben, je (owner_id, lead_id).
-- vergebe_verordnungsnummer_rx() / _vo() -> trigger        [SECURITY DEFINER]
--   Rufen sie auf. Wechselt die Verordnung den Patienten, wird die Nummer
--   verworfen und neu vergeben; die eingereichte `belegnummer` bleibt stehen.
-- prevent_belegliste_mod() -> trigger   GoBD: blockt UPDATE/DELETE auf belegliste.


-- --- Einwilligung / Nachweis --------------------------------------------
-- fn_patient_consents_immutable() -> trigger              [SECURITY DEFINER]
--   Hält den Einwilligungsnachweis unveränderlich (Art. 7 Abs. 1 DSGVO):
--   DELETE erst 10 Jahre nach consented_at (§630f Abs. 3 BGB), UPDATE nur auf
--   revoked_at/revoke_reason — jede Änderung an Text, Unterschrift, Patient
--   oder Zeitpunkt wirft check_violation.
--   Gegenstück zu prevent_belegliste_mod() (GoBD), nur für die DSGVO-Seite.


-- --- Termine / Mandant --------------------------------------------------
-- fn_check_booking_closed_day() -> trigger   Blockt Termine an geschlossenen Tagen.
-- set_business_id_default() -> trigger       Füllt business_id beim INSERT.
-- set_bookings_business_id_default() -> trigger  (Variante für bookings, mitarbeiterbewusst)
-- seed_default_groups_for_business() -> trigger  Legt Standard-Mitarbeitergruppen an.
-- confirm_referral_and_create_series(p_draft_id, p_lead_id, p_confirmed_by)  [SEC DEF]
--   -> TABLE(success boolean, message text, booking_series_id uuid)


-- --- Geodaten -----------------------------------------------------------
-- sync_leads_location() -> trigger            lat/lng -> geography(Point)
-- sync_profiles_clinic_location() -> trigger  dito für die Praxisadresse


-- --- Benachrichtigung ---------------------------------------------------
-- notify_feedback_telegram() -> trigger    pg_net -> Telegram
-- notify_new_referral_draft() -> trigger


-- --- Admin-Auswertung ---------------------------------------------------
-- admin_db_total_size() -> bigint                                     [SEC DEF]
-- admin_db_size_breakdown() -> TABLE(table_name, size_bytes, row_estimate)  [SEC DEF]
-- admin_top_tenants_by_rows() -> TABLE(owner_id, business_name, email, total_rows)  [SEC DEF]


-- --- Zeitstempel (austauschbare Varianten, historisch gewachsen) --------
-- set_updated_at() · set_updated_at_now() · touch_updated_at() · update_updated_at_column()
-- trg_billing_updated_at() · trg_prescriptions_updated_at() · aerzte_touch_updated_at()
-- update_attendance_updated_at() · set_warteliste_updated_at()
--   Alle tun dasselbe (NEW.updated_at = now()). Für neue Tabellen touch_updated_at() nehmen.


-- --- Tot / stillgelegt ---------------------------------------------------
-- business_lookup_for_twilio(p_to_number text)              [SEC DEF]
-- business_lookup_for_inbound(p_whatsapp_phone_number_id)   [SEC DEF]
--   ⛔ Reste des WhatsApp/Twilio-Strangs (2026-05-20 eingestellt). NICHT anfassen,
--      nicht als Vorlage nehmen. Die zugehörigen Tabellen sind gedroppt.
-- add_credits(p_user_id uuid, p_credits integer) -> void    [SEC DEF]
--   Gehört zu user_credits (Fremdkörper aus einem alten Projekt).


-- =====================================================================
-- 4. TRIGGER (58)
-- =====================================================================
-- Am häufigsten: trg_set_business_id BEFORE INSERT -> set_business_id_default()
--   auf: abrechnung, aerzte, anamnese, b2b_contacts, breaks, calendar_integrations,
--        chatbot_usage, custom_days, email_logs, employee_services, fahrten,
--        feedbacks, invoices, leads, patient_notes, prescriptions, referral_drafts,
--        scraper_data, services, terapeut_zertifikat, time_offs, ueberweisungen,
--        vehicles, working_hours, zuzahlung_befreiung
--   bookings nutzt die eigene Variante set_bookings_business_id_default().
--
-- Fachlich relevante Trigger:
--   bookings              trg_check_booking_closed_day   BEFORE INSERT/UPDATE OF start_time, business_id
--                         trg_normalize_booking_phone    BEFORE INSERT/UPDATE
--   leads                 trg_normalize_lead_phone       BEFORE INSERT/UPDATE
--                         trg_leads_patientennummer      BEFORE INSERT (Nummernvergabe)
--   prescriptions         trg_prescriptions_verordnungsnummer BEFORE INSERT/UPDATE OF patient_id
--   verordnungen          trg_verordnungen_verordnungsnummer  BEFORE INSERT/UPDATE OF lead_id
--                         trg_sync_leads_location        BEFORE INSERT/UPDATE OF lat, lng
--   profiles              trg_sync_profiles_clinic_location BEFORE INSERT/UPDATE OF clinic_lat, clinic_lng
--   businesses            trg_seed_default_groups        AFTER INSERT
--   patient_consents      trg_patient_consents_immutable BEFORE UPDATE/DELETE
--                         → fn_patient_consents_immutable(): DELETE erst nach
--                           10 Jahren (§630f Abs. 3 BGB), UPDATE nur auf
--                           revoked_at/revoke_reason. Art. 7 Abs. 1 DSGVO.
--   pat_fussbefund        pat_fussbefund_versionieren_trg BEFORE INSERT
--                         → pat_fussbefund_versionieren(): vergibt eintrag_id,
--                           serie_id, version und ist_aktuell und VERWIRFT, was
--                           der Client in version/ist_aktuell schickt. Grund:
--                           „alte Zeile abwählen + neue einfügen" ist im Client
--                           nicht atomar — ein abgebrochener INSERT ließe den
--                           Eintrag ohne gültige Fassung zurück. Setzt zusätzlich
--                           serie_farbe aus der Serie nach, falls sie fehlt.
--   belegliste            trg_prevent_belegliste_mod     BEFORE UPDATE/DELETE   (GoBD)
--                         trg_set_beleg_nr               BEFORE INSERT WHEN beleg_nr IS NULL OR 0
--   mahnungen             trg_set_mahnung_nr             BEFORE INSERT (analog)
--   ausfallrechnungen     trg_set_ausfallrechnung_nr     BEFORE INSERT
--   invoices              trg_invoice_nummer             BEFORE INSERT/UPDATE
--                         → set_invoice_nummer(): Nummer vergeben, dann einfrieren
--                         trg_invoice_festschreibung     BEFORE UPDATE          (GoBD)
--                         → invoice_festschreibung(): ab status <> 'draft' sind
--                           line_items, Summen, tax_summary, patient_id,
--                           issued_at und steuerhinweis_text gesperrt.
--   prescriptions         trg_prescriptions_set_befreit  BEFORE INSERT/UPDATE OF patient_id, ausstellungsdatum
--   zuzahlung_befreiung   trg_befreiung_backfill_prescriptions AFTER INSERT/UPDATE/DELETE
--   feedbacks             trg_feedback_telegram          AFTER INSERT
--   referral_drafts       trigger_notify_new_referral_draft AFTER INSERT
--
-- Reine updated_at-Trigger auf: abrechnung, aerzte, attendance,
--   businesses, kostentraeger, prescriptions, profiles, referral_drafts,
--   terapeut_zertifikat, vehicles, warteliste.


-- =====================================================================
-- 5. INDIZES (ohne die von PK/UNIQUE automatisch erzeugten)
-- =====================================================================
CREATE INDEX idx_abrechnung_business ON public.abrechnung USING btree (business_id);
CREATE INDEX idx_abrechnung_kostentraeger ON public.abrechnung USING btree (kostentraeger_ik, created_at DESC);
CREATE INDEX idx_abrechnung_owner_status ON public.abrechnung USING btree (owner_id, status, created_at DESC);
CREATE INDEX idx_aerzte_business ON public.aerzte USING btree (business_id);
CREATE INDEX idx_aerzte_lanr ON public.aerzte USING btree (owner_id, lanr) WHERE (lanr IS NOT NULL);
CREATE INDEX idx_aerzte_owner ON public.aerzte USING btree (owner_id);
CREATE UNIQUE INDEX uq_aerzte_owner_lanr ON public.aerzte USING btree (owner_id, lanr) WHERE (lanr IS NOT NULL);
CREATE UNIQUE INDEX uq_aerzte_owner_name_no_lanr ON public.aerzte USING btree (owner_id, lower(btrim(arzt_name))) WHERE (lanr IS NULL);
CREATE INDEX idx_ai_audit_task_created ON public.ai_audit_log USING btree (task, created_at DESC);
CREATE INDEX idx_ai_audit_tenant_created ON public.ai_audit_log USING btree (tenant_id, created_at DESC);
CREATE INDEX idx_anamnese_business ON public.anamnese USING btree (business_id);
CREATE INDEX idx_anamnese_patient ON public.anamnese USING btree (patient_id);
CREATE INDEX idx_attendance_business_date ON public.attendance USING btree (business_id, date DESC);
CREATE INDEX idx_attendance_employee_date ON public.attendance USING btree (employee_id, date DESC);
CREATE INDEX idx_attendance_owner_date ON public.attendance USING btree (owner_id, date DESC);
CREATE INDEX idx_ausfallrechnungen_booking ON public.ausfallrechnungen USING btree (booking_id);
CREATE INDEX idx_ausfallrechnungen_owner ON public.ausfallrechnungen USING btree (owner_id, status);
CREATE INDEX idx_b2b_contacts_business ON public.b2b_contacts USING btree (business_id);
CREATE INDEX idx_b2b_contacts_owner ON public.b2b_contacts USING btree (owner_id);
CREATE INDEX idx_belegliste_owner_time ON public.belegliste USING btree (owner_id, created_at DESC);
CREATE INDEX idx_bookings_business ON public.bookings USING btree (business_id);
CREATE INDEX idx_bookings_group_parent_id ON public.bookings USING btree (group_parent_id);
CREATE INDEX idx_bookings_lead_id ON public.bookings USING btree (lead_id);
CREATE INDEX idx_bookings_owner ON public.bookings USING btree (owner_id);
CREATE INDEX idx_bookings_owner_status ON public.bookings USING btree (owner_id, status);
CREATE INDEX idx_bookings_phone_norm ON public.bookings USING btree (customer_phone_normalized) WHERE (customer_phone_normalized IS NOT NULL);
CREATE INDEX idx_bookings_service ON public.bookings USING btree (service_id);
CREATE INDEX idx_bookings_start ON public.bookings USING btree (start_time);
CREATE INDEX idx_bookings_user ON public.bookings USING btree (user_id);
CREATE INDEX idx_bookings_user_start ON public.bookings USING btree (user_id, start_time);
CREATE INDEX idx_breaks_business ON public.breaks USING btree (business_id);
CREATE INDEX idx_breaks_user ON public.breaks USING btree (user_id);
CREATE INDEX idx_businesses_owner ON public.businesses USING btree (owner_id);
CREATE INDEX idx_businesses_slug ON public.businesses USING btree (booking_slug);
CREATE UNIQUE INDEX uniq_businesses_default_per_owner ON public.businesses USING btree (owner_id) WHERE (is_default = true);
CREATE INDEX idx_calendar_integrations_business ON public.calendar_integrations USING btree (business_id);
CREATE INDEX chatbot_usage_created_at_idx ON public.chatbot_usage USING btree (created_at DESC);
CREATE INDEX chatbot_usage_owner_id_idx ON public.chatbot_usage USING btree (owner_id) WHERE (owner_id IS NOT NULL);
CREATE INDEX idx_chatbot_usage_business ON public.chatbot_usage USING btree (business_id);
CREATE INDEX consent_log_pending_idx ON public.consent_log USING btree (pending_id);
CREATE INDEX consent_log_user_idx ON public.consent_log USING btree (user_id);
CREATE INDEX idx_custom_days_business ON public.custom_days USING btree (business_id);
CREATE INDEX idx_custom_days_owner ON public.custom_days USING btree (owner_id);
CREATE INDEX data_access_log_occurred_idx ON public.data_access_log USING btree (occurred_at DESC);
CREATE INDEX data_access_log_owner_idx ON public.data_access_log USING btree (owner_id, occurred_at DESC);
CREATE INDEX data_access_log_resource_idx ON public.data_access_log USING btree (resource, resource_id);
CREATE INDEX data_access_log_user_idx ON public.data_access_log USING btree (user_id, occurred_at DESC);
CREATE UNIQUE INDEX demo_bookings_slot_unique ON public.demo_bookings USING btree (booking_date, booking_time) WHERE (status = 'confirmed'::text);
CREATE UNIQUE INDEX demo_bookings_token_unique ON public.demo_bookings USING btree (reschedule_token);
CREATE INDEX diagnosegruppen_bereich ON public.diagnosegruppen USING btree (bereich);
CREATE UNIQUE INDEX diagnosegruppen_code_key ON public.diagnosegruppen USING btree (code);
CREATE INDEX diagnosegruppen_code_trgm ON public.diagnosegruppen USING gin (code gin_trgm_ops);
CREATE INDEX diagnosegruppen_label_trgm ON public.diagnosegruppen USING gin (label gin_trgm_ops);
CREATE UNIQUE INDEX uniq_default_vorlage ON public.document_vorlagen USING btree (owner_id, vorlage_type) WHERE (is_default = true);
CREATE INDEX idx_schluessel_bereich ON public.dta_schluessel USING btree (leistungsbereich) WHERE (leistungsbereich IS NOT NULL);
CREATE INDEX idx_schluessel_typ ON public.dta_schluessel USING btree (schluessel_typ, active);
CREATE INDEX idx_email_logs_business ON public.email_logs USING btree (business_id);
CREATE INDEX idx_email_logs_contact ON public.email_logs USING btree (contact_id);
CREATE INDEX idx_email_logs_owner ON public.email_logs USING btree (owner_id);
CREATE INDEX idx_eba_business ON public.employee_business_assignments USING btree (business_id);
CREATE INDEX idx_eba_employee ON public.employee_business_assignments USING btree (employee_id);
CREATE INDEX idx_employee_groups_business ON public.employee_groups USING btree (business_id);
CREATE INDEX idx_eso_lookup ON public.employee_scope_overrides USING btree (employee_id, business_id);
CREATE INDEX idx_employee_services_business ON public.employee_services USING btree (business_id);
CREATE INDEX idx_employee_services_employee ON public.employee_services USING btree (employee_id);
CREATE INDEX idx_employee_services_service ON public.employee_services USING btree (service_id);
CREATE INDEX idx_fahrten_business ON public.fahrten USING btree (business_id);
CREATE INDEX idx_fahrten_owner_user ON public.fahrten USING btree (owner_id, user_id, fahrt_started_at DESC);
CREATE INDEX idx_feedbacks_business ON public.feedbacks USING btree (business_id);
CREATE INDEX idx_feedbacks_owner ON public.feedbacks USING btree (owner_id);
CREATE INDEX idx_group_scopes_group ON public.group_scopes USING btree (group_id);
CREATE INDEX heilmittel_katalog_bereich ON public.heilmittel_katalog USING btree (bereich);
CREATE INDEX heilmittel_katalog_code ON public.heilmittel_katalog USING btree (code text_pattern_ops);
CREATE INDEX heilmittel_katalog_dg ON public.heilmittel_katalog USING gin (diagnosegruppen);
CREATE INDEX heilmittel_katalog_label ON public.heilmittel_katalog USING gin (label gin_trgm_ops);
CREATE INDEX idx_position_bereich ON public.heilmittel_position USING btree (heilmittel_bereich, active);
CREATE INDEX idx_position_template ON public.heilmittel_position USING btree (template_x);
CREATE INDEX idx_tarif_active ON public.heilmittel_tarif USING btree (bundesland, position_nr) WHERE (gueltig_bis IS NULL);
CREATE INDEX idx_tarif_lookup ON public.heilmittel_tarif USING btree (bundesland, kostentraeger_ik, position_nr, gueltig_ab DESC);
CREATE UNIQUE INDEX icd10_titles_code_key ON public.icd10_titles USING btree (code);
CREATE INDEX icd10_titles_code_pat ON public.icd10_titles USING btree (code text_pattern_ops);
CREATE INDEX icd10_titles_code_plain ON public.icd10_titles USING btree (code_plain text_pattern_ops);
CREATE INDEX icd10_titles_code_trgm ON public.icd10_titles USING gin (code gin_trgm_ops);
CREATE INDEX icd10_titles_titel_trgm ON public.icd10_titles USING gin (titel gin_trgm_ops);
CREATE INDEX idx_invoices_business ON public.invoices USING btree (business_id);
CREATE INDEX idx_invoices_invoice_type ON public.invoices USING btree (owner_id, invoice_type) WHERE (invoice_type IS NOT NULL);
CREATE INDEX idx_invoices_owner ON public.invoices USING btree (owner_id);
CREATE INDEX idx_invoices_patient ON public.invoices USING btree (patient_id);
CREATE INDEX idx_invoices_prescription ON public.invoices USING btree (prescription_id) WHERE (prescription_id IS NOT NULL);
CREATE INDEX idx_kostentraeger_active ON public.kostentraeger USING btree (active, payer_type) WHERE (active = true);
CREATE INDEX idx_kostentraeger_das ON public.kostentraeger USING btree (das_ik) WHERE (das_ik IS NOT NULL);
CREATE INDEX idx_leads_business ON public.leads USING btree (business_id);
CREATE INDEX idx_leads_handy_normalized ON public.leads USING btree (owner_id, handy_normalized) WHERE (handy_normalized IS NOT NULL);
CREATE UNIQUE INDEX leads_patientennummer_uniq ON public.leads USING btree (owner_id, patientennummer) WHERE (patientennummer IS NOT NULL);
CREATE UNIQUE INDEX prescriptions_verordnungsnummer_uniq ON public.prescriptions USING btree (owner_id, patient_id, verordnungsnummer) WHERE (verordnungsnummer IS NOT NULL);
CREATE UNIQUE INDEX verordnungen_verordnungsnummer_uniq ON public.verordnungen USING btree (owner_id, lead_id, verordnungsnummer) WHERE (verordnungsnummer IS NOT NULL);
CREATE INDEX idx_leads_insurance_type ON public.leads USING btree (insurance_type) WHERE (insurance_type IS NOT NULL);
CREATE INDEX idx_leads_location ON public.leads USING gist (location);
CREATE INDEX idx_leads_name_dob ON public.leads USING btree (owner_id, lower(COALESCE(first_name, ''::text)), lower(COALESCE(last_name, ''::text)), geburtsdatum);
CREATE INDEX idx_leads_owner ON public.leads USING btree (owner_id, created_at DESC);
CREATE INDEX idx_leads_owner_status ON public.leads USING btree (owner_id, status);
CREATE INDEX idx_leads_phone_norm ON public.leads USING btree (phone_normalized) WHERE (phone_normalized IS NOT NULL);
CREATE INDEX idx_leads_pii_not_encrypted ON public.leads USING btree (owner_id) WHERE (pii_encrypted = false);
CREATE INDEX idx_leads_status ON public.leads USING btree (status);
CREATE INDEX idx_mahnungen_owner_status ON public.mahnungen USING btree (owner_id, status, sent_at DESC);
CREATE INDEX idx_mahnungen_prescription ON public.mahnungen USING btree (prescription_id);
CREATE INDEX idx_mahnungen_ausfall ON public.mahnungen USING btree (ausfallrechnung_id);
CREATE INDEX idx_messreihen_lead ON public.messreihen USING btree (lead_id, gemessen_am);
CREATE INDEX idx_messreihen_owner ON public.messreihen USING btree (owner_id);
CREATE INDEX pat_fussbefund_lead_idx ON public.pat_fussbefund USING btree (lead_id, erstellt_am DESC);
CREATE INDEX pat_fussbefund_owner_idx ON public.pat_fussbefund USING btree (owner_id);
CREATE UNIQUE INDEX pat_fussbefund_booking_aktuell_uidx ON public.pat_fussbefund USING btree (booking_id) WHERE ((booking_id IS NOT NULL) AND ist_aktuell);
CREATE UNIQUE INDEX pat_fussbefund_eintrag_aktuell_uidx ON public.pat_fussbefund USING btree (eintrag_id) WHERE ist_aktuell;
CREATE UNIQUE INDEX pat_fussbefund_eintrag_version_uidx ON public.pat_fussbefund USING btree (eintrag_id, version);
-- 30.08.2026: pat_fussbefund_booking_uidx (nur booking_id) ist ENTFALLEN — er
-- schloss Versionen aus. Der Schutz gegen Doppelklick/zweiten Tab bleibt über
-- den ersten Index, gilt jetzt aber nur für die gültige Fassung. Die beiden
-- eintrag_*-Indizes sind neu und schärfer: sie greifen auch bei Befunden OHNE
-- Termin, die vorher gar keine Eindeutigkeit hatten.
CREATE INDEX patient_consents_patient_idx ON public.patient_consents USING btree (patient_id, consented_at DESC);
CREATE INDEX patient_consents_owner_idx ON public.patient_consents USING btree (owner_id, consented_at DESC);
CREATE INDEX patient_consents_type_idx ON public.patient_consents USING btree (patient_id, consent_type, consented_at DESC);
CREATE INDEX idx_patient_notes_business ON public.patient_notes USING btree (business_id);
CREATE INDEX idx_patient_notes_lead ON public.patient_notes USING btree (lead_id);
CREATE INDEX prescription_documents_owner_idx ON public.prescription_documents USING btree (owner_id, created_at DESC);
CREATE INDEX prescription_documents_rx_idx ON public.prescription_documents USING btree (prescription_id);
CREATE INDEX idx_prescription_sessions_prescription ON public.prescription_sessions USING btree (prescription_id, session_number);
-- Ein Termin = eine Sitzungszeile je Verordnung. Zweite Verteidigungslinie gegen
-- doppelte Abrechnungspositionen (Befund 12.08.2026): der Code füllt seit 16.08.
-- die leeren Sitzungszeilen per UPDATE, statt je Termin eine neue anzuhängen.
-- Partiell, weil leere Zeilen (booking_id IS NULL) Absicht sind — sie warten auf Termine.
CREATE UNIQUE INDEX uniq_prescription_sessions_booking ON public.prescription_sessions USING btree (prescription_id, booking_id) WHERE (booking_id IS NOT NULL);
CREATE INDEX idx_prescription_validations_prescription ON public.prescription_validations USING btree (prescription_id, created_at DESC);
CREATE INDEX idx_prescriptions_abrechnung ON public.prescriptions USING btree (abrechnung_id) WHERE (abrechnung_id IS NOT NULL);
CREATE INDEX idx_prescriptions_arzt ON public.prescriptions USING btree (owner_id, arzt_id) WHERE (arzt_id IS NOT NULL);
CREATE INDEX idx_prescriptions_bericht_status ON public.prescriptions USING btree (bericht_angefordert, bericht_status);
CREATE INDEX idx_prescriptions_billing_ready ON public.prescriptions USING btree (owner_id, abrechnung_status) WHERE (abrechnung_status = 'bereit'::text);
CREATE INDEX idx_prescriptions_business ON public.prescriptions USING btree (business_id);
CREATE INDEX idx_prescriptions_owner_status ON public.prescriptions USING btree (owner_id, status, created_at DESC);
CREATE INDEX idx_prescriptions_patient ON public.prescriptions USING btree (patient_id, created_at DESC);
CREATE INDEX idx_prescriptions_phi_not_encrypted ON public.prescriptions USING btree (owner_id) WHERE (phi_encrypted = false);
CREATE INDEX prescriptions_zuzahlung_offen ON public.prescriptions USING btree (patient_id) WHERE ((zuzahlung_kassiert_am IS NULL) AND (COALESCE(zuzahlung_befreit, false) = false));
-- ⚠️ Anderer Index als die Zeile darüber, trotz fast gleichem Namen:
--    dieser hier ist für die Monatsübersicht (statistik.routes.js).
CREATE INDEX idx_prescriptions_zuzahlung_offen ON public.prescriptions USING btree (owner_id, ausstellungsdatum) WHERE ((zuzahlung_eur > (0)::numeric) AND (zuzahlung_befreit = false));
CREATE INDEX idx_profiles_booking_slug ON public.profiles USING btree (booking_slug);
CREATE INDEX idx_profiles_clinic_location ON public.profiles USING gist (clinic_location);
CREATE INDEX idx_profiles_deletion_scheduled ON public.profiles USING btree (deletion_scheduled_at) WHERE (deletion_scheduled_at IS NOT NULL);
CREATE INDEX idx_profiles_is_active ON public.profiles USING btree (is_active);
CREATE INDEX idx_profiles_plan_status ON public.profiles USING btree (plan_status);
CREATE INDEX idx_profiles_sector ON public.profiles USING btree (sector);
CREATE INDEX idx_profiles_stripe_customer ON public.profiles USING btree (stripe_customer_id);
CREATE INDEX idx_profiles_stripe_subscription ON public.profiles USING btree (stripe_subscription_id);
CREATE INDEX idx_profiles_whatsapp_phone_number_id ON public.profiles USING btree (whatsapp_phone_number_id) WHERE (whatsapp_phone_number_id IS NOT NULL);
CREATE INDEX idx_referral_drafts_business ON public.referral_drafts USING btree (business_id);
CREATE INDEX idx_referral_drafts_created_at ON public.referral_drafts USING btree (created_at DESC);
CREATE INDEX idx_referral_drafts_lead_id ON public.referral_drafts USING btree (lead_id);
CREATE INDEX idx_referral_drafts_owner_id ON public.referral_drafts USING btree (owner_id);
CREATE INDEX idx_referral_drafts_status ON public.referral_drafts USING btree (status);
CREATE INDEX idx_scraper_data_business ON public.scraper_data USING btree (business_id);
CREATE INDEX idx_scraper_data_created ON public.scraper_data USING btree (created_at DESC);
CREATE INDEX idx_scraper_data_owner ON public.scraper_data USING btree (owner_id);
CREATE INDEX idx_services_business ON public.services USING btree (business_id);
CREATE INDEX idx_services_owner ON public.services USING btree (owner_id);
CREATE INDEX idx_services_user ON public.services USING btree (user_id);
CREATE INDEX idx_terapeut_zertifikat_business ON public.terapeut_zertifikat USING btree (business_id);
CREATE INDEX idx_zertifikat_expiring ON public.terapeut_zertifikat USING btree (cert_valid_to) WHERE (cert_valid_to IS NOT NULL);
CREATE INDEX idx_time_offs_business ON public.time_offs USING btree (business_id);
CREATE INDEX idx_time_offs_employee ON public.time_offs USING btree (employee_id);
CREATE INDEX idx_ueberweisungen_business ON public.ueberweisungen USING btree (business_id);
CREATE INDEX idx_ueberweisungen_lead ON public.ueberweisungen USING btree (lead_id);
CREATE INDEX idx_ueberweisungen_owner ON public.ueberweisungen USING btree (owner_id);
CREATE INDEX idx_user_preferences_user ON public.user_preferences USING btree (user_id);
CREATE INDEX idx_vehicles_business ON public.vehicles USING btree (business_id);
CREATE INDEX idx_vehicles_created_by ON public.vehicles USING btree (created_by);
CREATE INDEX idx_vehicles_owner_kind ON public.vehicles USING btree (owner_id, kind);
CREATE INDEX idx_verordnungen_abrechnung_id ON public.verordnungen USING btree (abrechnung_id) WHERE (abrechnung_id IS NOT NULL);
CREATE INDEX idx_verordnungen_arzt ON public.verordnungen USING btree (owner_id, arzt_id) WHERE (arzt_id IS NOT NULL);
CREATE INDEX idx_verordnungen_arzt_id ON public.verordnungen USING btree (arzt_id);
CREATE INDEX idx_verordnungen_lead_id ON public.verordnungen USING btree (lead_id);
CREATE INDEX idx_verordnungen_owner_status_lead ON public.verordnungen USING btree (owner_id, status, lead_id);
CREATE INDEX idx_warteliste_owner ON public.warteliste USING btree (owner_id);
CREATE INDEX idx_warteliste_status ON public.warteliste USING btree (owner_id, status);
CREATE INDEX idx_working_hours_business ON public.working_hours USING btree (business_id);
CREATE INDEX idx_working_hours_owner ON public.working_hours USING btree (owner_id);
CREATE INDEX idx_working_hours_user ON public.working_hours USING btree (user_id);
CREATE INDEX idx_zaa_fehler_abrechnung ON public.zaa_fehler USING btree (abrechnung_id, status);
CREATE INDEX idx_zaa_fehler_prescription ON public.zaa_fehler USING btree (prescription_id) WHERE (prescription_id IS NOT NULL);
CREATE INDEX idx_befreiung_patient_jahr ON public.zuzahlung_befreiung USING btree (patient_id, jahr);
CREATE INDEX idx_zuzahlung_befreiung_business ON public.zuzahlung_befreiung USING btree (business_id);
