-- =====================================================================
-- Praxura — Produktions-Datenbankschema (Supabase njvuclullotbksskpwgk)
-- =====================================================================
-- ERZEUGT AM:        2026-09-05 (zuletzt nachgezogen: prescriptions.krankenkasse_ik,
--                    FKT-Segment-Fix — Karten-IK der Krankenkasse getrennt von
--                    kostentraeger_ik gespeichert, siehe Spaltenkommentar unten)
--                    davor: 2026-09-04, prescriptions.nagel,
--                    Ops-Aufgabe 245) — Zusammenlegung der zwei Verordnungstöpfe:
--                    prescriptions (+11 Spalten aus `verordnungen`) wird der
--                    EINE Topf für Physio/Ergo/Logo UND Podologie. Details,
--                    Begründung und Spaltenübersetzung: module/verordnung-topf.js
--                    (Faz 1-3 dieser Datei: SCHEMA per Hand nachgezogen, KEIN
--                    voller Neu-Dump aller 80 Tabellen — "schema aktualisieren"
--                    für einen vollen Refresh steht noch aus)
--                    Faz 5 (04.09.2026, auf Nutzerwunsch vorgezogen aus der
--                    90-Tage-Frist): `verordnungen` GEDROPPT. Siehe Eintrag
--                    an der Stelle, wo die Tabelle frueher im Dump stand
--                    (nach `vehicles`, vor `visibility_reports`).
-- LETZTE MIGRATION:  20260905125546_prescriptions_krankenkasse_ik
--                    davor: verordnungstopf_faz5c_naechste_verordnungsnummer_fix
--                    davor: verordnungstopf_faz5b_verordnungen_droppen
--                    davor: 20260904085612_prescriptions_nagel_lokalisation
--                    davor: 20260903202143_verordnungstopf_faz3_fk_auf_prescriptions_umhaengen
--                    davor: 20260903202025_verordnungstopf_faz2_vier_zeilen_kopieren
--                    davor: 20260903201633_verordnungstopf_faz1_prescriptions_spalten
--                    davor: 20260903205029_bookings_dauer_quelle
--                    davor: 20260903170448_booking_leistungen
--                    davor: 20260903165452_verordnungen_podologie_behandlungen_team_select
--                    davor: 20260903132042_verordnungen_gobd_festschreibung
--                    davor: 20260903075503_pruefe_booking_verordnung_owner_execute_revoke
--                    davor: 20260903074810_bookings_verordnung_id_podologie_termin_bindung
--                    davor: 20260901094002_zuzahlung_korrektur_business_id_trigger
--                    davor: 20260901093344_zuzahlung_korrektur_search_path_haerten
--                    davor: 20260901093310_zuzahlung_korrektur
--                    (Zeitstempel stammen aus supabase_migrations.schema_migrations.
--                     Die Dateien im Repo heissen 20260831120000_zuzahlung_korrektur.sql,
--                     20260901093500_zuzahlung_korrektur_search_path_haerten.sql und
--                     20260901094500_zuzahlung_korrektur_business_id_trigger.sql —
--                     die DB ist die Wahrheit, die Dateinamen sind nur Ablage.)
--                    davor: pat_fussbefund_versionierung_und_serie
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
--                    (davor am 11.08. sql-melih/SUPABASE-JETZT-AUSFUEHREN.sql
--                     im SQL-Editor gelaufen — steht deshalb in KEINER
--                     Migrationszeile, ist in der DB aber vorhanden)
-- UMFANG:            83 Tabellen · 1231 Spalten · 158 RLS-Policies
--                    301 Indizes · 66 Trigger · 67 Funktionen · 4 Views
--                    (03.09.2026 abends: die Spaltenzahl stand auf 1219 und war
--                     um 12 zu niedrig — gegen die Live-DB nach der dokumentierten
--                     Zählweise nachgezählt, nicht fortgeschrieben.)
--                    (03.09.2026: die Triggerzahl stand hier auf 60 und war
--                     seit zwei Migrationen zu niedrig — gegen die Live-DB
--                     nachgezählt, nicht fortgeschrieben.)
-- ZÄHLWEISE:         Tabellen = BASE TABLE in `public` · Spalten =
--                    information_schema.columns in `public` (Views
--                    eingeschlossen) · Funktionen und Indizes OHNE die
--                    von Erweiterungen (postgis/pg_net) mitgebrachten ·
--                    Trigger ohne interne (FK-)Trigger.
--                    Am 28.08.2026 festgehalten, weil die Kopfzeilen
--                    dieser Datei und von SCHEMA-RLS.sql sich vorher bei
--                    Triggern und Funktionen widersprachen.
-- QUELLE:            Direkt aus der Live-DB introspiziert (kein Handentwurf)
--
-- ⚠️  DIES IST EINE MOMENTAUFNAHME, KEINE LIVE-VERBINDUNG.
--     Nach jeder Migration neu erzeugen — sonst schreibt jemand SQL
--     gegen ein Schema, das es nicht mehr gibt.
--     Regel + Ablauf: db/README.md
--
-- Diese Datei ist ZUM LESEN gedacht (Kontext für Menschen und KI),
-- nicht zum Ausführen. Sie enthält keine Daten, nur Struktur.
-- RLS-Policies, Funktionen und Trigger: db/SCHEMA-RLS.sql
-- =====================================================================
-- =====================================================================


-- =====================================================================
-- 1. TABELLEN
-- =====================================================================
-- RLS ist auf ALLEN Tabellen aktiv, mit einer Ausnahme:
--   spatial_ref_sys  (PostGIS-Systemtabelle, unkritisch)

CREATE TABLE abrechnung (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  kostentraeger_ik text NOT NULL
  dateiname text
  rechnungsnummer text
  total_eur numeric(10,2) DEFAULT 0
  zuzahlung_total numeric(10,2) DEFAULT 0
  status text NOT NULL DEFAULT 'erstellt'::text
  dta_file_size integer
  dta_segment_count integer
  prescription_count integer DEFAULT 0
  rejected_count integer DEFAULT 0
  storage_path text
  begleitzettel_path text
  zaa_uploaded_at timestamptz
  paid_at timestamptz
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  signed_storage_path text
  signed_at timestamptz
  signed_by_cert_thumbprint text
  business_id uuid
);
--   CHECK status IN (erstellt, heruntergeladen, gesendet, accepted, rejected, paid)
--   FK business_id -> businesses(id) ON DELETE CASCADE
--   FK kostentraeger_ik -> kostentraeger(ik)
--   FK owner_id -> auth.users(id) ON DELETE CASCADE
--   PK (id)

CREATE TABLE accommodations (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  user_id uuid
  name text NOT NULL
  address text
  location geography(Point,4326)
  is_active boolean DEFAULT true
  created_at timestamptz DEFAULT now()
);
--   FK user_id -> profiles(id) ON DELETE CASCADE
--   PK (id)
--   ⚠️ Fremdkörper: stammt aus einem alten Reise-/Trip-Projekt, nicht Praxura.

CREATE TABLE admin_users (
  user_id uuid NOT NULL
  created_at timestamptz NOT NULL DEFAULT now()
  notes text
);
--   FK user_id -> auth.users(id) ON DELETE CASCADE
--   PK (user_id)
--   Wird von is_admin() gelesen.

CREATE TABLE aerzte (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  arzt_name text NOT NULL
  arzt_nummer text
  fachrichtung text
  telefon text
  adresse text
  created_at timestamptz DEFAULT now()
  lanr text
  bsnr text
  business_id uuid
  praxis_name text
  fax text
  email text
  notizen text
  quelle text
  updated_at timestamptz DEFAULT now()
);
--   FK business_id -> businesses(id) ON DELETE CASCADE
--   FK owner_id -> auth.users(id)
--   PK (id) · UNIQUE (owner_id, arzt_name)
--   UNIQUE INDEX uq_aerzte_owner_lanr (owner_id, lanr) WHERE lanr IS NOT NULL
--   UNIQUE INDEX uq_aerzte_owner_name_no_lanr (owner_id, lower(trim(arzt_name))) WHERE lanr IS NULL

CREATE TABLE ai_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  tenant_id uuid NOT NULL
  user_id uuid
  task text NOT NULL
  model text
  deployment text
  prompt_tokens integer
  completion_tokens integer
  total_tokens integer
  latency_ms integer
  status text NOT NULL
  error text
  dry_run boolean DEFAULT false
  request_hash text
  created_at timestamptz DEFAULT now()
);
--   FK tenant_id -> auth.users(id) ON DELETE CASCADE
--   FK user_id -> auth.users(id) ON DELETE SET NULL
--   PK (id)

CREATE TABLE anamnese (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  patient_id uuid NOT NULL
  aufnahmedatum date DEFAULT CURRENT_DATE
  hauptbeschwerde text
  beschwerde_seit text
  beschwerde_verlauf text
  schmerz_skala smallint
  schmerz_art text
  vorerkrankungen text
  operationen text
  medikamente text
  allergien text
  beruf text
  sport text
  raucher boolean
  diagnose text
  arzt_name text
  arzt_nummer text
  rezept_sitzungen smallint
  hausbesuch boolean DEFAULT false
  besondere_wuensche text
  notizen text
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  created_by uuid
  updated_by uuid
  business_id uuid
);
--   CHECK beschwerde_verlauf IN (konstant, zunehmend, abnehmend, wechselnd)
--   CHECK schmerz_skala BETWEEN 0 AND 10
--   FK patient_id -> leads(id)          ⚠️ zeigt auf leads, NICHT auf patients
--   FK business_id -> businesses(id) ON DELETE CASCADE
--   FK owner_id / created_by / updated_by -> auth.users(id)
--   PK (id)

CREATE TABLE applications (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  user_id uuid
  job_text text NOT NULL
  cv_text text NOT NULL
  anschreiben text NOT NULL
  created_at timestamptz DEFAULT now()
);
--   FK user_id -> auth.users(id) ON DELETE CASCADE · PK (id)
--   ⚠️ Fremdkörper aus einem alten Bewerbungs-Projekt, nicht Praxura.

CREATE TABLE attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  employee_id uuid NOT NULL
  owner_id uuid NOT NULL
  business_id uuid
  date date NOT NULL
  check_in_at timestamptz
  check_out_at timestamptz
  check_in_valid boolean NOT NULL DEFAULT false
  status text NOT NULL DEFAULT 'present'::text
  note text
  created_at timestamptz NOT NULL DEFAULT now()
  updated_at timestamptz NOT NULL DEFAULT now()
);
--   CHECK status IN (present, late, incomplete, absent)
--   FK employee_id / owner_id -> profiles(id) ON DELETE CASCADE
--   FK business_id -> businesses(id) ON DELETE SET NULL
--   PK (id) · UNIQUE (employee_id, date)

CREATE TABLE ausfallrechnungen (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  business_id uuid
  booking_id uuid
  patient_id uuid
  rechnung_nr bigint NOT NULL
  reason text NOT NULL DEFAULT 'no_show'::text
  amount_eur numeric(10,2) NOT NULL
  leistung_datum timestamptz
  service_name text
  status text NOT NULL DEFAULT 'offen'::text
  notes text
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  created_by uuid
  bezahlt_at timestamptz
);
--   CHECK amount_eur > 0 · reason IN (no_show, late_cancel)
--   CHECK status IN (offen, bezahlt, storniert, abgeschrieben)
--   FK booking_id -> bookings(id) ON DELETE SET NULL
--   FK patient_id -> leads(id) ON DELETE SET NULL
--   PK (id) · rechnung_nr via TRIGGER set_next_ausfallrechnung_nr()

CREATE TABLE b2b_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  company_name text NOT NULL
  contact_name text
  phone text
  email text
  website text
  status text NOT NULL DEFAULT 'prospect'::text
  notes text
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  source text
  name text
  category text
  city text
  business_id uuid
);
--   CHECK status IN (prospect, contacted, partner, inactive)
--   PK (id)

CREATE TABLE belegliste (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  beleg_nr bigint NOT NULL
  type text NOT NULL
  amount_eur numeric(10,2) NOT NULL
  patient_id uuid
  prescription_id uuid
  abrechnung_id uuid
  reference_text text
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  created_by uuid
  storno_reason text
  zahlart text
);
--   CHECK type IN (zuzahlung, barverkauf, storno, ausfall)
--   CHECK belegliste_zahlart_check: zahlart IS NULL OR zahlart IN
--      (bar, ec, ueberweisung, sonstiges) — NULL = Altbeleg vor v32.
--   FK owner_id -> profiles(id) ON DELETE RESTRICT
--   FK patient_id -> leads(id) · prescription_id -> prescriptions(id) · abrechnung_id -> abrechnung(id)
--   PK (id) · UNIQUE (owner_id, beleg_nr)
--   ⚠️ GoBD: TRIGGER prevent_belegliste_mod() blockt UPDATE und DELETE.
--      Korrektur nur durch neuen Beleg mit type='storno'.

CREATE TABLE booking_leistungen (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  booking_id uuid NOT NULL
  service_id uuid NOT NULL
  owner_id uuid NOT NULL
  anzahl smallint NOT NULL DEFAULT 1
  sort_order smallint NOT NULL DEFAULT 0
  created_at timestamptz NOT NULL DEFAULT now()
);
--   CHECK anzahl BETWEEN 1 AND 20
--   FK booking_id -> bookings(id) ON DELETE CASCADE
--   FK service_id -> services(id) ON DELETE RESTRICT
--   FK owner_id   -> profiles(id)
--   PK (id) · UNIQUE (booking_id, service_id)
--   INDEX idx_booking_leistungen_booking (booking_id, sort_order) · _service (service_id)
--   TRIGGER: trg_booking_leistung_owner (Mandantenriegel)
--            trg_booking_hauptleistung  (spiegelt Zeile 0 nach bookings.service_id)
--   ★ Die Leistungen EINES Termins (seit 03.09.2026, Ops-Karte 235).
--     In der Podologie ist die Kombination der Normalfall — „Behandlung +
--     Eingangsbefundung" —, und `bookings.service_id` konnte genau eine
--     halten. Der Kalenderblock war deshalb systematisch zu kurz und die
--     zweite Leistung fiel aus der Abrechnung.
--     ⚠️ `bookings.service_id` ist ab jetzt ABGELEITET: der Trigger setzt
--        sie auf die Zeile mit sort_order 0. NICHT von Hand schreiben —
--        sonst gibt es zwei Wahrheiten. Sie bleibt, weil sieben Leser
--        daran haengen (Kalenderfarbe, ausfallSuggestedAmount(),
--        warteliste.routes.js, booking/from-request.js, rechnung-editor.js,
--        abrechnung.routes.js, idx_bookings_service).
--     ⚠️ KEIN zweiter Schreibweg in die Abrechnung: die Zeilen werden ueber
--        `services.gkv_position_nr` (= HPNR) in der Abrechnungsmaske nur
--        VORANGEKREUZT. Der einzige INSERT in `podologie_behandlungen`
--        bleibt der dortige — nur so laufen alle Sperren mit.
--     ⚠️ Gruppentermine: die Kind-Synchronisierung in dashboard.js laeuft
--        ueber `.eq(group_parent_id, …)` und kopiert diese Zeilen NICHT
--        mit. Wer hier schreibt, muss die Kinder mitnehmen.
--     ⚠️ ON DELETE RESTRICT auf service_id ist Absicht: eine geloeschte
--        Leistung darf keine Terminhistorie zerreissen.

CREATE TABLE booking_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  patient_id uuid
  employee_id uuid
  service_id uuid
  payment_type text NOT NULL
  preferred_date date
  preferred_time time
  session_count integer DEFAULT 1
  krankenkasse text
  arzt_name text
  verordnung_datum date
  icd10_diagnose text
  behandlungsart text
  verordnung_sitzungen integer
  frequenz text
  verordnung_typ text
  doppelbehandlung boolean DEFAULT false
  pkv_versicherung text
  arzt_ueberweisung boolean DEFAULT false
  arzt_ueberweisung_name text
  bg_aktenzeichen text
  bg_name text
  unfalldatum date
  durchgangsarzt text
  notizen text
  status text DEFAULT 'pending'::text
  auto_approved boolean DEFAULT false
  booking_id uuid
  dsgvo_consent boolean NOT NULL DEFAULT false
  consent_at timestamptz
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  diagnosegruppe text
  alternativ_termine jsonb
  alternativ_angeboten_at timestamptz
  booking_ids jsonb
);
--   CHECK payment_type IN (gkv, pkv, selbstzahler, bg)
--   CHECK status IN (pending, approved, declined, cancelled)
--   CHECK verordnung_typ IN (erst, folge) · char_length(notizen) <= 500
--   FK patient_id -> patients(id)   ⚠️ zeigt auf patients, NICHT auf leads
--   FK employee_id / owner_id -> profiles(id) · service_id -> services(id)
--   PK (id)

CREATE TABLE bookings (
  id uuid NOT NULL DEFAULT uuid_generate_v4()
  user_id uuid NOT NULL
  service_id uuid
  start_time timestamptz NOT NULL
  end_time timestamptz
  customer_name text NOT NULL
  customer_email text
  customer_phone text
  status text DEFAULT 'confirmed'::text
  meeting_link text
  created_at timestamptz DEFAULT now()
  owner_id uuid
  customer_phone_normalized text
  hausbesuch boolean DEFAULT false
  notes text
  fahrt_status text
  vehicle_id uuid
  start_km integer
  end_km integer
  fahrt_started_at timestamptz
  fahrt_arrived_at timestamptz
  fahrt_ended_at timestamptz
  business_id uuid
  is_group boolean DEFAULT false
  group_capacity integer DEFAULT 1
  group_parent_id uuid
  lead_id uuid
  no_show boolean NOT NULL DEFAULT false
  no_show_noted_at timestamptz
  cancellation_reason text
  rezeptart text
  payment_method text
  verordnung_id uuid
  dauer_quelle text
);
--   CHECK status IN (confirmed, cancelled, completed, pending, no_show)
--   CHECK dauer_quelle IS NULL OR IN (vorschlag, manuell, serie)
--   CHECK fahrt_status IN (fahrt_started, fahrt_arrived, fahrt_return_pending, fahrt_completed)
--   FK group_parent_id -> bookings(id) ON DELETE CASCADE (Gruppentermine)
--   FK lead_id -> leads(id) · vehicle_id -> vehicles(id) · service_id -> services(id)
--   FK verordnung_id -> prescriptions(id) ON DELETE SET NULL   (Podologie, 03.09.2026;
--      Ziel seit 04.09.2026 prescriptions — vorher eigene Tabelle `verordnungen`, ids unveraendert)
--   PK (id)
--   ★ EXCLUDE no_overlapping_bookings USING gist
--       (user_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)
--       WHERE status='confirmed' AND group_parent_id IS NULL
--     → Doppelbuchung ist auf DB-Ebene unmöglich. Nicht im Code nachbauen.
--   ★ In der Realtime-Publication (Übersicht aktualisiert sich ohne Reload).
--   ★ dauer_quelle — woher stammt die Dauer? (seit 03.09.2026)
--     NULL = nicht erfasst (Altbestand + alle Backend-Wege) · 'vorschlag' =
--     Vorschlag unverändert übernommen · 'manuell' = von Hand eingetippt ·
--     'serie' = aus einem Batch-Lauf.
--     ⚠️ Nur 'manuell' darf in gelernteDauer() (module/termin-dauer.js).
--        end_time - start_time ist als Lernquelle ZIRKULÄR: Termine werden nie
--        von Hand geschlossen, end_time ist immer genau der Wert, der beim
--        Anlegen im Dauer-Feld stand. Ein falscher Vorschlag bestätigt sich
--        sonst selbst.
--     ⚠️ NULL ist nicht 'vorschlag'. Sechs Wege schreiben in bookings; nur die
--        Terminmaske kennt die Spalte. Wer den Unterschied einebnet, verliert
--        genau die Information, wegen der die Spalte existiert.
--   TRIGGER: fn_check_booking_closed_day() · Telefon-Normalisierung · business_id-Default
--            · pruefe_booking_verordnung_owner() (Owner-Riegel, siehe unten)
--   ★ verordnung_id — PODOLOGIE-Zweig. Bindet den Termin an die podologische
--     Verordnung (seit 03.09.2026). Zeigt seit 04.09.2026 auf `prescriptions`
--     (Zusammenlegung der Verordnungstöpfe) — vorher eine eigene Tabelle
--     `verordnungen`, ids der migrierten Zeilen unveraendert.
--     ⚠️ Trotzdem gehoert hier NIE die id einer Physio/Ergo/Logo-Zeile hinein,
--        auch wenn dieselbe Tabelle jetzt beide traegt: Physio/Ergo/Logo
--        verknuepfen weiterhin ueber `prescription_sessions.booking_id`, weil
--        es dort ein Einheiten-Hauptbuch gibt und die Frage „welche der 18
--        Einheiten hat dieser Termin erfuellt?" an `bookings` gar nicht
--        ausdrueckbar waere. `pruefe_booking_verordnung_owner()` prueft nur
--        den Mandanten, nicht den Fachbereich — Anwendungscode muss
--        `therapie_bereich='podo'` selbst sicherstellen (siehe
--        module/verordnung-topf.js, module/verordnung-uebersicht.js).
--        Begruendung ausfuehrlich in db/REGISTER.md.
--     ⚠️ SET NULL ist Pflicht: api/dsgvo.js loescht `prescriptions` in der
--        Loeschkette; mit RESTRICT braeche sie.
--     ⚠️ Owner-Riegel noetig, weil ein Fremdschluessel KEINE RLS prueft:
--        trg_booking_verordnung_owner (Funktion pruefe_booking_verordnung_owner,
--        seit 04.09.2026 gegen `prescriptions.owner_id`) vergleicht mit
--        bookings.owner_id. Ohne ihn liesse sich die id einer fremden
--        Verordnung in einen eigenen Termin schreiben.
--     ⚠️ Sichtbarkeits-/Schreibasymmetrie AUFGELÖST (04.09.2026, Nutzerentscheidung):
--        vorher hatte `verordnungen` eine eigene, strengere RLS-Policy
--        (nur Owner darf schreiben). Seit der Zusammenlegung gilt fuer
--        podologische Zeilen dieselbe Policy wie fuer Physio/Ergo/Logo
--        (`prescriptions_owner_all` — Owner UND zugeordnete Angestellte
--        duerfen schreiben). Bewusst gewaehlt: die podologischen Angestellten
--        sollen ihre Alltagsarbeit (Verordnung anlegen/bearbeiten) behalten.

CREATE TABLE breaks (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  user_id uuid NOT NULL
  day_of_week integer NOT NULL
  start_time text NOT NULL
  end_time text NOT NULL
  created_at timestamptz DEFAULT now()
  business_id uuid
);
--   CHECK day_of_week BETWEEN 0 AND 6 · FK user_id -> profiles(id) · PK (id)
--   ⚠️ start_time/end_time sind text, nicht time (im Gegensatz zu working_hours).

-- CREATE TABLE business_services — am 28.08.2026 gedroppt.
--   Spiegel von `services`, den niemand las. Kein Fremdschlüssel zeigte
--   darauf, keine View hing daran, und weil die Policies `auth.uid() =
--   business_id` prüften, während in der Spalte eine `businesses.id`
--   stand, war keine ihrer 26 Zeilen für die jeweilige Praxis sichtbar.
--   Inhalt vor dem DROP außerhalb des Repos gesichert (Ops-Drive,
--   infra/db-sicherung/). Beschluss: konsey/tutanak/2026-08-28-business-services.md
--   Dieser Hinweis steht hier, damit niemand die Tabelle aus altem Code
--   oder aus onprem/schema/live_schema_2026-07-06.sql zurückschließt.

CREATE TABLE businesses (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  business_name text NOT NULL
  sector text
  street text
  house_number text
  zip text
  city text
  country text DEFAULT 'DE'::text
  phone text
  email text
  booking_slug text
  is_default boolean DEFAULT false
  ik_number text
  clinic_lat numeric
  clinic_lng numeric
  clinic_geocoded_at timestamptz
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  closed_days integer[] DEFAULT ARRAY[]::integer[]
  ausfall_enabled boolean NOT NULL DEFAULT false
  ausfall_mode text NOT NULL DEFAULT 'fixed'::text
  ausfall_amount_eur numeric(10,2)
  ausfall_percent numeric(5,2)
  ausfall_cutoff_hours integer NOT NULL DEFAULT 24
  ausfall_hinweis text
);
--   CHECK ausfall_mode IN (fixed, percent)
--   FK owner_id -> profiles(id) ON DELETE CASCADE
--   PK (id) · UNIQUE (booking_slug)
--   UNIQUE INDEX uniq_businesses_default_per_owner (owner_id) WHERE is_default
--   TRIGGER seed_default_groups_for_business() AFTER INSERT
--   ⚠️ Einzelstandort-Owner haben KEINEN businesses-Datensatz.
--      Owner-Einstellungen gehören nach `profiles` — siehe ausfall_* dort.

CREATE TABLE calendar_integrations (
  id uuid NOT NULL DEFAULT uuid_generate_v4()
  user_id uuid NOT NULL
  provider text NOT NULL
  access_token text
  refresh_token text
  calendar_id text
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  business_id uuid
);
--   CHECK provider IN (google, apple) · PK (id) · UNIQUE (user_id, provider)

CREATE TABLE chatbot_usage (
  id bigint NOT NULL
  created_at timestamptz NOT NULL DEFAULT now()
  owner_id uuid
  origin text
  session_id text
  model text
  deployment text
  prompt_tokens integer
  completion_tokens integer
  total_tokens integer
  cost_eur numeric(10,6)
  off_topic boolean
  status text
  error text
  business_id uuid
);
--   PK (id)

CREATE TABLE consent_log (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  user_id uuid
  pending_id uuid
  consent_type text NOT NULL
  version text NOT NULL
  ip_address inet
  user_agent text
  accepted_at timestamptz NOT NULL DEFAULT now()
  created_at timestamptz NOT NULL DEFAULT now()
);
--   FK user_id -> profiles(id) ON DELETE SET NULL · PK (id)
--   DSGVO-Nachweis für AVV/AGB-Zustimmung.

CREATE TABLE custom_days (
  id uuid NOT NULL DEFAULT uuid_generate_v4()
  owner_id uuid
  date date NOT NULL
  type text NOT NULL
  note text
  created_at timestamptz DEFAULT now()
  start_time time
  end_time time
  business_id uuid
);
--   CHECK type IN (closed, holiday, special)
--   PK (id) · UNIQUE (owner_id, date)
--   ⚠️ Policy custom_days_public_read erlaubt SELECT für alle (Booking-Seite).

CREATE TABLE data_access_log (
  id bigint NOT NULL DEFAULT nextval('data_access_log_id_seq')
  occurred_at timestamptz NOT NULL DEFAULT now()
  user_id uuid
  owner_id uuid
  business_id uuid
  ip inet
  user_agent text
  method text NOT NULL
  path text NOT NULL
  resource text
  resource_id text
  action text
  status_code integer
  duration_ms integer
  metadata jsonb
);
--   PK (id) — DSGVO-Zugriffsprotokoll.

CREATE TABLE data_sharing_settings (
  owner_id uuid NOT NULL
  patients boolean NOT NULL DEFAULT false
  services boolean NOT NULL DEFAULT false
  activities boolean NOT NULL DEFAULT false
  finance boolean NOT NULL DEFAULT false
  appointments boolean NOT NULL DEFAULT false
  network boolean NOT NULL DEFAULT false
  updated_at timestamptz NOT NULL DEFAULT now()
);
--   PK (owner_id) — steuert den bizScope-Helper (Datenteilung zwischen Standorten).
--   Termine sind bewusst NICHT teilbar.

CREATE TABLE demo_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  name text NOT NULL
  email text NOT NULL
  company text
  message text
  booking_date date NOT NULL
  booking_time text NOT NULL
  created_at timestamptz DEFAULT now()
  status text NOT NULL DEFAULT 'confirmed'::text
  reschedule_token uuid NOT NULL DEFAULT gen_random_uuid()
  google_event_id text
);
--   PK (id)
--   UNIQUE INDEX demo_bookings_slot_unique (booking_date, booking_time) WHERE status='confirmed'
--   UNIQUE INDEX demo_bookings_token_unique (reschedule_token)
--   anon darf INSERT (Demo-Formular auf der Marketing-Seite).

CREATE TABLE diagnosegruppen (
  code text NOT NULL
  label text NOT NULL
  untergruppen text[]
  icd10_codes text[]
  icd10_pflicht text
  befundung_erlaubt boolean DEFAULT true
  nagelspange_erlaubt boolean DEFAULT false
  lokalisation_pflicht boolean DEFAULT false
  bereich text
  indikation text
  leitsymptomatik text
  hoechstmenge integer
  icd_ranges text[]
  sort integer DEFAULT 0
  aktiv boolean DEFAULT true
  icd_accept jsonb NOT NULL DEFAULT '[]'::jsonb
  icd_exclude jsonb NOT NULL DEFAULT '[]'::jsonb
  icd_auto_select jsonb NOT NULL DEFAULT '[]'::jsonb
  icd_accept_unsicher jsonb NOT NULL DEFAULT '[]'::jsonb
  icd_enforcement text NOT NULL DEFAULT 'warn'::text
);
--   PK (code) · GIN-Trigram-Indizes auf code und label
--   Referenztabelle: SELECT für anon + authenticated.
--   icd_accept/exclude/auto_select steuern die ICD-Regeln je Diagnosegruppe.

CREATE TABLE document_vorlagen (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  business_id uuid
  vorlage_type text NOT NULL
  name text NOT NULL
  is_default boolean NOT NULL DEFAULT false
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb
  created_at timestamptz NOT NULL DEFAULT now()
  updated_at timestamptz NOT NULL DEFAULT now()
);
--   CHECK vorlage_type IN (quittung_zuzahlung, rechnung_bg, rechnung_privat,
--     rechnung_eigenanteil, rechnung_selbstzahler, rechnung_sonder,
--     rezeptvorderseite, rzg_quittung)
--   PK (id) · UNIQUE INDEX uniq_default_vorlage (owner_id, vorlage_type) WHERE is_default

CREATE TABLE dta_schluessel (
  id bigint NOT NULL DEFAULT nextval('dta_schluessel_id_seq')
  schluessel_typ text NOT NULL
  code text NOT NULL
  label text NOT NULL
  leistungsbereich text
  notes text
  source_version text NOT NULL DEFAULT 'Anlage 3 V22'::text
  valid_from date
  active boolean DEFAULT true
  created_at timestamptz DEFAULT now()
);
--   PK (id) · UNIQUE (schluessel_typ, code, source_version)
--   §302-Schlüsselverzeichnisse (Anlage 3).

CREATE TABLE email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  contact_id uuid
  to_email text NOT NULL
  to_name text
  subject text NOT NULL
  body text NOT NULL
  status text NOT NULL DEFAULT 'sent'::text
  gmail_thread_id text
  created_at timestamptz DEFAULT now()
  business_id uuid
);
--   CHECK status IN (draft, sent, failed) · FK contact_id -> b2b_contacts(id) · PK (id)

CREATE TABLE employee_business_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  employee_id uuid NOT NULL
  business_id uuid NOT NULL
  group_id uuid
  created_at timestamptz DEFAULT now()
);
--   FK employee_id -> profiles(id) · business_id -> businesses(id) · group_id -> employee_groups(id)
--   PK (id) · UNIQUE (employee_id, business_id)

CREATE TABLE employee_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  business_id uuid NOT NULL
  name text NOT NULL
  is_default boolean DEFAULT false
  created_at timestamptz DEFAULT now()
);
--   PK (id) · UNIQUE (business_id, name)

CREATE TABLE employee_scope_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  employee_id uuid NOT NULL
  business_id uuid NOT NULL
  module text NOT NULL
  has_access boolean NOT NULL
);
--   PK (id) · UNIQUE (employee_id, business_id, module)
--   Individuelle Rechte schlagen Gruppenrechte — siehe get_my_permissions().

CREATE TABLE employee_services (
  id uuid NOT NULL DEFAULT uuid_generate_v4()
  employee_id uuid NOT NULL
  service_id uuid NOT NULL
  business_id uuid
);
--   PK (id) · UNIQUE (employee_id, service_id)
--   ⚠️ Policy "Public read employee services" erlaubt SELECT für alle.

CREATE TABLE fahrten (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  user_id uuid NOT NULL
  booking_id uuid NOT NULL
  lead_id uuid
  vehicle_id uuid
  kennzeichen_snapshot text
  kind_snapshot text
  start_km integer
  end_km integer
  distance_km integer DEFAULT (CASE WHEN end_km IS NOT NULL AND end_km >= start_km
                                    THEN end_km - start_km ELSE NULL END)
  estimated_duration_min integer
  fahrt_started_at timestamptz NOT NULL DEFAULT now()
  fahrt_arrived_at timestamptz
  fahrt_ended_at timestamptz
  notes text
  created_at timestamptz DEFAULT now()
  business_id uuid
  zweck text
  abfahrtsort text
  zielort text
);
--   FK booking_id -> bookings(id) ON DELETE CASCADE
--   PK (id) · UNIQUE (booking_id) — genau eine Fahrt je Termin
--   Finanzamt-Felder: zweck, abfahrtsort, zielort.

CREATE TABLE feedbacks (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  user_id uuid
  owner_id uuid
  type text NOT NULL DEFAULT 'feedback'::text
  title text NOT NULL
  description text
  status text NOT NULL DEFAULT 'open'::text
  priority text NOT NULL DEFAULT 'medium'::text
  admin_notes text
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  business_id uuid
);
--   CHECK type IN (bug, feature_request, feedback, support)
--   CHECK status IN (open, in_progress, resolved, closed)
--   CHECK priority IN (low, medium, high, critical) · PK (id)
--   TRIGGER notify_feedback_telegram() AFTER INSERT (pg_net -> Telegram)

CREATE TABLE "fußstatus" (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid
  patient_name text
  aufnahmedatum date NOT NULL DEFAULT CURRENT_DATE
  wagner_grad smallint
  seite text
  befunde jsonb
  foto_urls text[]
  notizen text
  created_at timestamptz DEFAULT now()
  patient_id uuid
);
--   CHECK seite IN (links, rechts, beide) · wagner_grad BETWEEN 0 AND 5
--   FK patient_id -> leads(id) ON DELETE SET NULL · PK (id)
--   ⚠️ Tabellenname enthält ein Umlaut-ß — in SQL immer "fußstatus" quoten.
--   ⚠️ Nicht verwechseln mit pat_fussbefund (neuere Podologie-Befundtabelle).

CREATE TABLE group_scopes (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  group_id uuid NOT NULL
  module text NOT NULL
  has_access boolean NOT NULL DEFAULT true
);
--   PK (id) · UNIQUE (group_id, module)

CREATE TABLE heilmittel_catalog (
  hpnr text NOT NULL
  leistung text NOT NULL
  leistungsart text
  heilmittelbereich text NOT NULL DEFAULT 'Podologie'::text
  grundlage text
  verguetung_gkv numeric(8,2)
  gueltig_ab date NOT NULL
  gueltig_bis date NOT NULL DEFAULT '9999-12-31'::date
  aktiv boolean DEFAULT true
  created_at timestamptz DEFAULT now()
);
--   PK (hpnr) — Podologie-HPNR (78xxx).
--   ⚠️ DREI ähnliche Heilmittel-Tabellen, nicht verwechseln:
--      heilmittel_catalog  (alt, Podologie-HPNR)
--      heilmittel_katalog  (★ aktiv, vereinheitlicht, von search_heilmittel() genutzt)
--      heilmittel_position (§302-Abrechnungspositionen, Preise/Zuzahlung)

CREATE TABLE heilmittel_katalog (
  code text NOT NULL
  bereich text NOT NULL
  label text NOT NULL
  kuerzel text
  kategorie text
  diagnosegruppen text[]
  preis_eur numeric(10,2)
  zuzahlung_eur numeric(10,2)
  dauer text
  gueltig_ab date NOT NULL DEFAULT '1900-01-01'::date
  gueltig_bis date NOT NULL DEFAULT '9999-12-31'::date
  deprecated boolean NOT NULL DEFAULT false
  ungueltig_ab date
  ersetzt_durch text
  max_pro_tag integer
  max_pro_termin integer
  notiz text
  gruppe boolean NOT NULL DEFAULT false
  telemed boolean NOT NULL DEFAULT false
  sort integer NOT NULL DEFAULT 0
);
--   PK (bereich, code, gueltig_ab) — zeitversioniert!
--   ★ Aktive Katalogtabelle. Wird von search_heilmittel() gelesen.

CREATE TABLE heilmittel_position (
  positionsnummer text NOT NULL
  template_x text NOT NULL
  abrechnungscode text NOT NULL
  heilmittel_bereich text NOT NULL
  bezeichnung text NOT NULL
  kategorie text
  preis_eur numeric(8,2) NOT NULL
  zuzahlung_eur numeric(8,2)
  zuzahlung_pflicht boolean DEFAULT (zuzahlung_eur IS NOT NULL)
  behandlungsdauer text
  is_gruppe boolean DEFAULT false
  is_telemed boolean DEFAULT false
  is_hausbesuch boolean DEFAULT false
  notes text
  source_vertrag text NOT NULL
  gueltig_ab date NOT NULL
  gueltig_bis date
  active boolean DEFAULT true
  created_at timestamptz DEFAULT now()
);
--   PK (positionsnummer) — §302-Positionsnummern.

CREATE TABLE heilmittel_tarif (
  id bigint NOT NULL DEFAULT nextval('heilmittel_tarif_id_seq')
  bundesland text NOT NULL
  kostentraeger_ik text
  position_nr text NOT NULL
  heilmittel_code text
  preis_eur numeric(10,2) NOT NULL
  zuzahlung_pflicht boolean DEFAULT true
  gueltig_ab date NOT NULL
  gueltig_bis date
  created_at timestamptz DEFAULT now()
);
--   FK kostentraeger_ik -> kostentraeger(ik) ON DELETE CASCADE · PK (id)
--   Preise je Bundesland/Kasse.

CREATE TABLE icd10_titles (
  code text NOT NULL
  titel text NOT NULL
  kapitel smallint
  ebene smallint
  terminal boolean
  code_plain text
  gruppe text
);
--   PK (code) · Trigram- und text_pattern_ops-Indizes auf code, code_plain, titel
--   code_plain = code ohne Punkt (für Präfixsuche). Von search_diagnosen() genutzt.

CREATE TABLE icd_sector_ranges (
  bereich text NOT NULL
  gte text NOT NULL
  lt text NOT NULL
  label text
  sort integer DEFAULT 0
);
--   PK (bereich, gte, lt)
--   ★ Fachbereichsfilter: für alle vier Bereiche gefüllt. search_diagnosen()
--     setzt darüber in_sector. Der strict-Modus im Frontend wirft fachfremde
--     Codes ganz raus — aktuell nur in der Podologie aktiv.

CREATE TABLE invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  patient_id uuid
  patient_name text NOT NULL
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb
  subtotal numeric(10,2)
  eigenanteil_pct numeric(5,2) DEFAULT 0
  eigenanteil_eur numeric(10,2) DEFAULT 0
  kassenzuzahlung numeric(10,2) DEFAULT 0
  total_patient numeric(10,2)
  status text DEFAULT 'draft'::text
  invoice_number text
  issued_at date DEFAULT CURRENT_DATE
  notes text
  created_at timestamptz DEFAULT now()
  prescription_id uuid
  business_id uuid
  payment_status text DEFAULT 'pending'::text
  payment_method text
  paid_at timestamptz
  lead_id uuid
  invoice_type text
  verordnung_id uuid
  steuer_status text
  tax_summary jsonb NOT NULL DEFAULT '[]'::jsonb
  netto_gesamt numeric(10,2)
  steuer_gesamt numeric(10,2)
  brutto_gesamt numeric(10,2)
  steuerhinweis_text text
  steuernummer_snapshot text
  ust_id_snapshot text
  leistung_von date
  leistung_bis date
  rechnung_nr bigint
);
--   CHECK status IN (draft, sent, paid, cancelled)
--   CHECK payment_status IN (pending, paid, partial)
--   CHECK payment_method IN (bar, karte, lastschrift, ueberweisung, sonstiges)
--   CHECK invoice_type IN (gkv, privat, selbstzahler)
--   CHECK steuer_status IN (regel, kleinunternehmer)
--   CHECK invoices_ein_verordnungsbezug: prescription_id IS NULL OR verordnung_id IS NULL
--      (seit 04.09.2026 zeigen BEIDE Spalten auf prescriptions — die Tabelle
--      heisst nur noch verschieden, der CHECK besteht unveraendert fort)
--   FK patient_id -> leads(id) · lead_id -> leads(id) · prescription_id -> prescriptions(id)
--   FK verordnung_id -> prescriptions(id) ON DELETE SET NULL
--   PK (id) · UNIQUE (owner_id, invoice_number)
--   ★ ZWEI Verordnungsbezüge, weil es zwei Verordnungstöpfe gibt (Falle 2):
--      prescription_id → Physio/Ergo/Logo · verordnung_id → Podologie.
--      Höchstens einer ist gesetzt. Nicht zusammenlegen.
--   ★ USt: der Steuersatz sitzt PRO ZEILE in line_items
--      ({title, quantity, unit_price(brutto), ust_satz, ust_grund, leistungsdatum}),
--      weil § 14 Abs. 4 Nr. 7 UStG das nach Steuersätzen aufgeschlüsselte Entgelt
--      verlangt und eine Sitzung medizinische und kosmetische Positionen mischen
--      kann. `tax_summary` ist die eingefrorene Gruppensumme dazu.
--      Rechenlogik: module/rechnung-steuer.js (+ .test.js).
--   ⚠️ steuerhinweis_text / steuernummer_snapshot / ust_id_snapshot sind
--      SNAPSHOTS aus profiles zum Zeitpunkt der Rechnungsstellung. Beim Druck
--      NICHT wieder aus profiles lesen — sonst druckt dieselbe Rechnung nach
--      einer Einstellungsänderung anders (§ 146 Abs. 4 AO, GoBD Rz. 107 ff.).
--   ⚠️ GoBD: TRIGGER invoice_festschreibung() sperrt ab status <> 'draft' alle
--      inhaltlichen Felder. Offen bleiben status, payment_*, paid_at, notes
--      (daran hängt der Kassieren-Ablauf). Korrektur = Storno + Neuausstellung.
--   ⚠️ rechnung_nr/invoice_number kommen vom TRIGGER set_invoice_nummer(), das
--      Frontend zählt NICHT mehr selbst hoch. Einmal vergeben, nie geändert
--      (§ 14 Abs. 4 Nr. 4 UStG).

CREATE TABLE kostentraeger (
  ik text NOT NULL
  name text NOT NULL
  das_ik text
  payer_type text
  region text
  active boolean DEFAULT true
  valid_from date
  valid_to date
  updated_at timestamptz DEFAULT now()
);
--   CHECK payer_type IN (gkv, sonst, privat) · PK (ik)
--   ⚠️ Aktuell Mock-Daten. Echte IK-Nummern kommen erst mit der
--      Kostenträgerdatei (ITSG-Zugang steht aus).

CREATE TABLE krankenkassen (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  name text NOT NULL
  abbreviation text
  type text DEFAULT 'gesetzlich'::text
  created_at timestamptz DEFAULT now()
  ik_number text
);
--   PK (id) — 93 GKV-Kassen geseedet. Quelle für das UI-Dropdown.
--   ⚠️ Nicht dasselbe wie `kostentraeger` (das ist die §302-Seite).

CREATE TABLE kiosk_pins (
  user_id uuid NOT NULL
  pin_hash text NOT NULL
  failed_attempts integer NOT NULL DEFAULT 0
  locked_until timestamptz
  updated_at timestamptz NOT NULL DEFAULT now()
  created_at timestamptz NOT NULL DEFAULT now()
);
--   PK (user_id) · FK user_id -> profiles(id) ON DELETE CASCADE
--   Kiosk-PIN als scrypt-Hash (Node crypto.scrypt, keine externe Abhängigkeit).
--   ⚠️ RLS aktiv, aber BEWUSST OHNE POLICY + REVOKE ALL FROM anon, authenticated
--     → nur service_role kommt ran. Ein 4-stelliger PIN wäre im Client in
--     Millisekunden durchprobiert (10.000 Kandidaten); der Hash darf den Server
--     nie verlassen. Prüfung ausschließlich über POST /api/kiosk/pin/verify.
--   Ersetzt die gelöschte Klartext-Spalte `profiles.tablet_kiosk_pin`
--   (Konsey 2026-08-14, Art. 32 Abs. 1 TOM).

CREATE TABLE leads (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  title text NOT NULL
  total_score numeric
  reviews_count integer
  street text
  city text
  state text
  country_code text
  website text
  phone text
  categories text[]
  category_name text
  google_url text
  email text
  status text DEFAULT 'new'::text
  notes text
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  phone_normalized text
  handy text
  handy_normalized text
  patientennummer integer
  first_name text
  last_name text
  metadata jsonb DEFAULT '{}'::jsonb
  hausbesuch boolean DEFAULT false
  besondere_wuensche text
  arzt_id uuid
  geschlecht text                       -- m | f | d  (NULL = keine Angabe); NIE 'w'
  geburtsdatum date
  versichertennummer text
  krankenkasse text
  plz text
  location geography(Point,4326)
  distance_km numeric(6,2)
  duration_min integer
  route_calculated_at timestamptz
  lat numeric(9,6)
  lng numeric(9,6)
  business_id uuid
  insurance_type text
  versichertenstatus text
  first_name_enc bytea
  last_name_enc bytea
  phone_enc bytea
  geburtsdatum_enc bytea
  versichertennummer_enc bytea
  krankenkasse_enc bytea
  pii_encrypted boolean NOT NULL DEFAULT false
  ausfallvereinbarung_am date
);
--   CHECK geschlecht IN (m, f, d) · insurance_type IN (gkv, privat)
--   ★ `geschlecht`: m = männlich, f = weiblich, d = divers (§ 22 Abs. 3 PStG),
--      NULL = keine Angabe (der Normalfall). **Nicht `w`** — der CHECK weist es ab
--      und der INSERT scheitert. Bis 16.08.2026 schrieben zwei Pfade genau das:
--      die Schnellanlage ausgeschrieben („weiblich“) und die Rezept-OCR „w“.
--      Schreibpfade gehen jetzt durch module/geschlecht.js bzw.
--      api-backend/lib/geschlecht.js. Die Spalte trägt denselben Hinweis als
--      COMMENT in der DB.
--   CHECK status IN (new, contacted, booked, won, lost)
--   FK arzt_id -> aerzte(id) · PK (id)
--   ⚠️ `status` ist der ALTE CRM-Trichter und wird im Praxisablauf seit dem
--      14.08.2026 weder gesetzt noch angezeigt. Nur die alten B2B/B2C-Panels
--      lesen ihn noch (dashboard.html:988, :1079). Der Status, der zählt,
--      steht an der Verordnung (prescriptions.abrechnung_status, podologisch
--      übersetzt über module/verordnung-topf.js).
--   ⚠️ `phone` = Festnetz/Hauptnummer — der Buchungsabgleich hängt an
--      phone_normalized. `handy` ist die Zweitnummer (seit 14.08.2026).
--   ⚠️ `patientennummer` vergibt der Trigger vergebe_patientennummer() BEFORE
--      INSERT — je owner_id fortlaufend ab 1, mit Advisory Lock gegen doppelte
--      Vergabe bei gleichzeitigem Anlegen. NICHT im Client setzen.
--      UNIQUE (owner_id, patientennummer)
--   ★ DIES IST DIE HAUPT-PATIENTENTABELLE, trotz des Namens "leads".
--     Historisch als Akquise-Tabelle entstanden (title, google_url,
--     reviews_count stammen daher), heute die reale Patientenakte.
--     anamnese, prescriptions, invoices, messreihen, pat_fussbefund,
--     fahrten, ausfallrechnungen hängen alle hier dran.
--   ★ PII-Verschlüsselung: *_enc bytea + pii_encrypted-Flag
--     (api-backend/lib/phi-encrypt.js).

CREATE TABLE mahnungen (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  prescription_id uuid
  ausfallrechnung_id uuid
  patient_id uuid
  mahnung_nr bigint NOT NULL
  level smallint NOT NULL
  amount_eur numeric(10,2) NOT NULL
  original_faelligkeit date NOT NULL
  neue_faelligkeit date NOT NULL
  sent_at timestamptz DEFAULT timezone('utc', now())
  status text NOT NULL DEFAULT 'offen'::text
  notes text
);
--   CHECK level BETWEEN 1 AND 3 · status IN (offen, bezahlt, abgeschrieben)
--   PK (id) · UNIQUE (owner_id, mahnung_nr) · nr via TRIGGER
--   FK ausfallrechnung_id -> ausfallrechnungen(id) ON DELETE CASCADE
--   CHECK mahnungen_genau_eine_quelle:
--        num_nonnulls(prescription_id, ausfallrechnung_id) = 1
--      Eine Mahnung hängt an GENAU EINER Quelle — Rezept (offene Zuzahlung)
--      ODER Ausfallrechnung. Deshalb ist prescription_id nicht mehr NOT NULL.

CREATE TABLE messreihen (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  lead_id uuid NOT NULL
  prescription_id uuid
  typ text NOT NULL
  koerperteil text
  wert numeric(6,2) NOT NULL
  einheit text NOT NULL DEFAULT 'Punkte'::text
  gemessen_am timestamptz NOT NULL DEFAULT now()
  notiz text
  erfasst_von uuid
  created_at timestamptz NOT NULL DEFAULT now()
);
--   CHECK typ IN (VAS, ROM, kraft, custom) · PK (id)
--   Verlaufsmessung für Blankoverordnung.

CREATE TABLE module_visibility (
  module_id text NOT NULL
  sector text NOT NULL
  role text NOT NULL
  enabled boolean NOT NULL DEFAULT true
  updated_at timestamptz NOT NULL DEFAULT now()
  updated_by uuid
);
--   CHECK role IN (owner, employee) · PK (module_id, sector, role)
--   Gegenstück zu nav-registry.js. Schreiben nur is_admin().

CREATE TABLE nummernkreise (
  owner_id uuid NOT NULL
  kreis text NOT NULL
  jahr int NOT NULL
  last_nr bigint NOT NULL DEFAULT 0
);
--   FK owner_id -> profiles(id) ON DELETE CASCADE
--   PK (owner_id, kreis, jahr)
--   ★ Zählerzeile für lückenlose Rechnungsnummern. Vergabe ausschliesslich über
--     naechste_nummer(owner, kreis, jahr) — INSERT .. ON CONFLICT DO UPDATE ..
--     RETURNING sperrt die Zeile, zwei gleichzeitige Speicherungen bekommen
--     verschiedene Nummern (Konsey 2026-08-12 Kova 2).
--   ⚠️ RLS aktiv, absichtlich OHNE Policy: kein Client fasst den Zähler direkt
--     an, die Funktion läuft als SECURITY DEFINER.
--   Kreis heute: 'rechnung' (invoices). Die älteren Nummernkreise
--     (beleg_nr, mahnung_nr, ausfallrechnung_nr) zählen weiterhin per MAX+1
--     in ihren eigenen Triggern — bewusst nicht mitmigriert.

CREATE TABLE pat_fussbefund (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  lead_id uuid NOT NULL
  erstellt_am timestamptz NOT NULL DEFAULT now()
  befund jsonb NOT NULL DEFAULT '{}'::jsonb
  markierungen jsonb NOT NULL DEFAULT '[]'::jsonb
  notiz text
  erfasst_von uuid
  created_at timestamptz NOT NULL DEFAULT now()
  booking_id uuid                        -- Termin, zu dem der Befund gehört
  uebernommen_von uuid                   -- Herkunft der Übernahme (nur Doku)
  eintrag_id uuid NOT NULL               -- Korrekturkette: Versionen DESSELBEN Befunds
  version integer NOT NULL DEFAULT 1     -- Nummer im Eintrag — vergibt der Trigger
  ist_aktuell boolean NOT NULL DEFAULT true  -- gültige Fassung des Eintrags
  serie_id uuid NOT NULL                 -- Farbgruppe über Termine hinweg
  serie_farbe text                       -- deren Farbe, als KOPIE in der Zeile
);
--   FK lead_id -> leads(id) ON DELETE CASCADE · PK (id)
--   FK booking_id -> bookings(id) ON DELETE SET NULL
--   FK uebernommen_von -> pat_fussbefund(id) ON DELETE SET NULL
--   ★ UNIQUE (booking_id) WHERE booking_id IS NOT NULL AND ist_aktuell
--     → ein Termin trägt höchstens einen GÜLTIGEN Befund; dessen Vorversionen
--       dürfen daneben stehen.
--   ★ UNIQUE (eintrag_id) WHERE ist_aktuell · UNIQUE (eintrag_id, version)
--     → genau eine gültige Fassung je Eintrag, Nummern lückenlos eindeutig.
--       Gilt auch für Befunde OHNE Termin, die vorher gar nicht geschützt waren.
--   ★ Aktueller Podologie-Fußbefund (markierungen = Punkte auf der Fußgrafik).
--   ★ Jede Zeile ist ein VOLLSTÄNDIGER Schnappschuss. Ein Folgebefund wird als
--     Kopie des vorherigen angelegt (neue Zeile), nie als Verweis — sonst
--     änderte sich die Dokumentation eines vergangenen Termins rückwirkend.
--     `uebernommen_von` hält nur fest, wovon kopiert wurde.
--   ★ ZWEI ACHSEN, nicht verwechseln (30.08.2026):
--       eintrag_id  DERSELBE Befund, nochmal gespeichert. Statt UPDATE entsteht
--                   eine neue Zeile, version + 1, die alte wird ist_aktuell=false
--                   und bleibt lesbar. Vorher überschrieb das Modul — der Stand
--                   von letzter Woche war weg (§ 630f BGB: der ursprüngliche
--                   Inhalt muss erkennbar bleiben).
--       serie_id    Farbgruppe über Termine hinweg — was der Podologe als „ein
--                   Fußbefund und seine Fortschreibungen" sieht. Wird bei der
--                   Übernahme geerbt; ohne Übernahme beginnt eine neue Serie.
--     Ein Schlüssel für beides ginge nicht: eine spätere Sitzung setzte sonst
--     die Dokumentation des vergangenen Termins auf ist_aktuell=false, und
--     dieser Termin hätte gar keinen gültigen Befund mehr.
--   ⚠ version/ist_aktuell vergibt pat_fussbefund_versionieren_trg, NICHT der
--     Client — was der schickt, wird verworfen. „Alte Zeile abwählen + neue
--     einfügen" ist im Client nicht atomar; ein abgebrochener INSERT ließe den
--     Eintrag ohne gültige Fassung zurück.
--   ⚠ serie_farbe ist eine KOPIE (wie markierungen die Legende kopieren) und
--     NICHT aus LEGENDE_FARBEN: dort bedeutet Blau „Hyperkeratose".
--   ⚠ Lesende Abfragen brauchen `.eq('ist_aktuell', true)`, sonst erscheint
--     jede Korrektur als eigener Befund (Archiv, Patientenkarte, Terminknopf).
--   ⚠️ markierungen speichern symbol/color/label als KOPIE der Legende
--     (profiles.fussbefund_legende). Umbenennen der Legende deutet alte
--     Befunde deshalb nicht um.

CREATE TABLE patient_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  business_id uuid
  patient_id uuid NOT NULL
  consent_type text NOT NULL
  text_version text NOT NULL
  text_sha256 text NOT NULL
  text_snapshot text NOT NULL
  signature_path text
  signed_name text
  consented_at timestamptz NOT NULL DEFAULT now()
  captured_by_user_id uuid
  device_label text
  revoked_at timestamptz
  revoke_reason text
  created_at timestamptz NOT NULL DEFAULT now()
);
--   CHECK consent_type IN (behandlungsvertrag, datenschutz, selbstzahler, foto)
--   CHECK text_sha256 ~ '^[0-9a-f]{64}$'
--   PK (id) · FK owner_id -> profiles(id) ON DELETE RESTRICT
--   FK patient_id -> leads(id) ON DELETE RESTRICT   ⚠️ zeigt auf leads
--   FK business_id -> businesses(id) ON DELETE SET NULL
--   FK captured_by_user_id -> profiles(id) ON DELETE SET NULL
--   INDEX (patient_id, consented_at DESC) · (owner_id, consented_at DESC)
--         · (patient_id, consent_type, consented_at DESC)
--   Digitale Patienten-Einwilligung, einfache elektronische Signatur
--   (Konsey 2026-08-14 · compliance/LEGAL_DECISIONS.md).
--   ⚠️ NICHT mit `consent_log` verwechseln — das ist die B2B-Seite
--     (Praxisinhaber, AVV/AGB). Andere betroffene Person, andere Löschfrist.
--   ⚠️ BEWUSST OHNE ip_address: auf dem Praxis-Tablet ist die IP der
--     Praxis-Router → Beweiswert null → Art. 5 Abs. 1 lit. c. Das Muster aus
--     `consent_log.ip_address` wird hier absichtlich NICHT übernommen.
--   ⚠️ text_snapshot hält den VOLLEN unterschriebenen Text (Art. 7 Abs. 1
--     Nachweispflicht) — ein Häkchen genügt nicht. Änderungen an der Vorlage
--     dürfen den Nachweis nicht berühren.
--   ⚠️ Zwei Texte = zwei Zeilen (behandlungsvertrag §630d BGB / datenschutz
--     Art. 7 DSGVO). Zusammenlegen verboten — Koppelungsverbot.
--   ⚠️ Widerruf LÖSCHT nicht, er markiert (revoked_at/revoke_reason).
--   ⚠️ ON DELETE RESTRICT auf owner_id und patient_id: solange eine
--     Einwilligung existiert, sind Patient und Inhaber nicht löschbar
--     (§630f Abs. 3 BGB, 10 Jahre). Beim Bau eines Lösch-/Offboarding-Flows
--     einplanen — Trigger fn_patient_consents_immutable blockt zusätzlich.

CREATE TABLE patient_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  lead_id uuid NOT NULL
  doctor_notes text
  therapist_notes text
  ai_summary text
  status text DEFAULT 'draft'::text
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  business_id uuid
);
--   PK (id) · UNIQUE (owner_id, lead_id)

CREATE TABLE patients (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  vorname text NOT NULL
  nachname text NOT NULL
  geburtsdatum date NOT NULL
  email text
  telefon text
  created_at timestamptz DEFAULT now()
);
--   FK owner_id -> profiles(id) ON DELETE CASCADE
--   PK (id) · UNIQUE (owner_id, nachname, geburtsdatum)
--   ⚠️ NICHT die Hauptpatiententabelle — das ist `leads`.
--      `patients` wird nur vom Termin-Anfrage-Flow benutzt
--      (booking_requests.patient_id zeigt hierher). Beide Töpfe bestehen
--      bewusst nebeneinander; Zusammenlegen bricht laufende Flows.

CREATE TABLE pending_employee_registrations (
  email text NOT NULL
  owner_id uuid
  anrede text
  full_name text
  working_hours jsonb
  created_at timestamptz DEFAULT now()
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);
--   PK (email) · anon darf INSERT (Mitarbeiter-Registrierung).

CREATE TABLE pending_signups (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  email text NOT NULL
  onboarding_data jsonb NOT NULL DEFAULT '{}'::jsonb
  stripe_checkout_session_id text
  created_at timestamptz DEFAULT now()
  password_secret_id uuid
);
--   PK (id) · UNIQUE (email)
--   ★ password_secret_id zeigt in den Supabase Vault — der einzige verbliebene
--     Vault-Anwendungsfall. Zugriff nur über pending_signup_store/consume/delete.
--   ⚠️ Neue Onboarding-Felder landen als JSON in onboarding_data; das Schreiben
--      in echte Spalten passiert später im Webhook.

CREATE TABLE podologie_behandlungen (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid
  verordnung_id uuid
  behandlungsdatum date NOT NULL
  hpnr_codes text[]
  diagnosegruppe text
  lokalisation text
  notizen text
  betrag_gkv numeric(8,2)
  created_at timestamptz DEFAULT now()
  invoice_id uuid
);
--   FK verordnung_id -> prescriptions(id) ON DELETE SET NULL · PK (id)
--      (Ziel seit 04.09.2026 prescriptions, ids der migrierten Zeilen unveraendert)
--   FK invoice_id -> invoices(id) ON DELETE SET NULL
--   ★ Podologie-Behandlungstopf (Gegenstück zu prescription_sessions).
--   ★ invoice_id ist gesetzt, sobald die Sitzung auf einer Rechnung steht.
--     Ohne dieses Feld war „ist diese Behandlung schon abgerechnet?" nicht
--     beantwortbar und dieselbe Sitzung konnte zweimal berechnet werden.

CREATE TABLE prescription_documents (
  id bigint NOT NULL
  owner_id uuid NOT NULL
  business_id uuid
  prescription_id uuid NOT NULL
  patient_id uuid
  art text NOT NULL DEFAULT 'sonstiges'::text
  storage_path text NOT NULL
  dateiname text
  mime_type text
  groesse_bytes integer
  notiz text
  uploaded_by uuid
  created_at timestamptz NOT NULL DEFAULT now()
);
--   CHECK art IN (befreiungsausweis, lhb_genehmigung, korrigierte_verordnung,
--                 therapiebericht, sonstiges)
--   FK prescription_id -> prescriptions(id) ON DELETE CASCADE · PK (id)

CREATE TABLE prescription_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  prescription_id uuid NOT NULL
  booking_id uuid
  session_number integer NOT NULL
  status text NOT NULL DEFAULT 'planned'::text
  done_at timestamptz
  created_at timestamptz DEFAULT now()
  notes text
  heilmittel_index integer DEFAULT 0
);
--   CHECK status IN (planned, done, cancelled, no_show)
--   PK (id) · UNIQUE (prescription_id, session_number)
--   UNIQUE (prescription_id, booking_id) WHERE booking_id IS NOT NULL — ein Termin
--     hat je Verordnung genau eine Sitzungszeile. Leere Zeilen (booking_id NULL)
--     sind Absicht und bleiben mehrfach erlaubt: sie warten auf Termine.

CREATE TABLE prescription_validations (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  prescription_id uuid NOT NULL
  engine text NOT NULL
  input_snapshot jsonb NOT NULL
  result jsonb NOT NULL
  ok boolean NOT NULL
  warnings_count integer DEFAULT 0
  blockers_count integer DEFAULT 0
  proceeded_anyway boolean DEFAULT false
  validated_by uuid
  created_at timestamptz DEFAULT now()
  overridden_rules text[]
  proceed_reason text
);
--   PK (id) — Audit-Trail der Rezeptprüfung inkl. bewusster Übersteuerungen.

CREATE TABLE prescriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  patient_id uuid
  arzt_id uuid
  image_storage_path text
  image_uploaded_at timestamptz
  status text NOT NULL DEFAULT 'parsed'::text
  rezept_typ text NOT NULL DEFAULT 'standard'::text
  icd10 text
  diagnosegruppe text
  heilmittel text
  heilmittel_feld_text text
  anzahl_einheiten integer
  frequenz text
  ausstellungsdatum date
  behandlungsbeginn date
  is_dringend boolean DEFAULT false
  hausbesuch boolean DEFAULT false
  gueltig_bis date
  computed jsonb
  warnings jsonb
  blockers_overridden jsonb
  ocr_raw_response jsonb
  ocr_confidence numeric(3,2)
  confirmed_by uuid
  confirmed_at timestamptz
  proceed_anyway boolean DEFAULT false
  dmrz_exported_at timestamptz
  total_bonuses_eur numeric(8,2)
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  heilmittel_position text
  zuzahlung_eur numeric(10,2)
  zuzahlung_befreit boolean DEFAULT false
  is_blanko boolean DEFAULT false
  is_lhb_bvb boolean DEFAULT false
  doctor_lanr text
  doctor_bsnr text
  kostentraeger_ik text
  abrechnung_id uuid
  abrechnung_status text
  business_id uuid
  bericht_angefordert boolean NOT NULL DEFAULT false
  bericht_status text NOT NULL DEFAULT 'offen'::text
  leitsymptomatik text
  unterschrift_vorhanden boolean
  signature_confidence text
  deadline_reminders jsonb DEFAULT '{}'::jsonb
  heilmittel_typ_blanko text
  vorrangig_einheiten integer
  ergaenzend_einheiten integer
  heilmittel_items jsonb DEFAULT '[]'::jsonb
  evo_task_id text
  evo_access_code text
  quelle text DEFAULT 'papier'::text
  fhir_raw jsonb
  verordnungsnummer integer
  belegnummer text
  pat_leitsymptomatik text
  diagnose_freitext text
  ergaenzendes_heilmittel text
  therapie_bereich text
  hinweise text
  icd10_enc bytea
  ocr_raw_enc bytea
  phi_encrypted boolean NOT NULL DEFAULT false
  icd10_2 text
  zuzahlung_kassiert_am timestamptz
  zuzahlung_kassiert_von uuid
  zuzahlung_kassiert_eur numeric(10,2)
  zuzahlung_zahlart text
  patient_name text
  wagner_grad smallint
  versichertennummer text
  behandlungsanlass text
  absetzung_betrag numeric(10,2)
  absetzung_grund text
  absetzung_am date
  storno_grund text
  storno_am date
  rezeptart text
  nagel text
  krankenkasse_ik text
);
--   CHECK zuzahlung_zahlart IS NULL ODER IN (bar, ec, ueberweisung, sonstiges)
--   CHECK krankenkasse_ik IS NULL ODER MATCHES ^[0-9]{9}$
--   CHECK status IN (parsed, confirmed, in_therapy, completed, billed, cancelled)
--   CHECK rezept_typ IN (standard, blanko, lhb_bvb, kassen, privat)
--   CHECK abrechnung_status IN (bereit, in_abrechnung, gesendet, accepted, rejected, paid,
--                               teilabsetzung, storniert, archiviert)
--   CHECK bericht_status IN (offen, in_arbeit, erledigt)
--   CHECK quelle IN (papier, ocr, evo) · signature_confidence IN (high, medium, low)
--   CHECK wagner_grad IS NULL ODER BETWEEN 0 AND 5
--   CHECK rezeptart IS NULL ODER IN (kassen, privat, selbstzahler)
--   CHECK absetzung_betrag IS NULL ODER (> 0 AND abrechnung_status IN (teilabsetzung, rejected))
--   CHECK abrechnung_status <> 'teilabsetzung' ODER absetzung_betrag IS NOT NULL
--   CHECK nagel IS NULL ODER IN (U1..U5 links, U1..U5 rechts)  — zehn Werte
--   ★ nagel (04.09.2026): behandelter Zehennagel einer Nagelspangen-Verordnung.
--     Schreibweise aus § 3b Satz 5 der Aenderungsvereinbarung vom 16.06.2025
--     ("U1 links" .. "U5 rechts"). Nur bei diagnosegruppe UI1/UI2 gefuellt.
--     Er steht hier und nicht an `podologie_behandlungen`, weil eine Verordnung
--     sich laut § 3b Satz 3-4 auf GENAU EINEN Zehennagel bezieht — und weil die
--     Erstbefundungs-Serie (78110/78100) ueber mehrere Verordnungen laeuft und
--     allein vom Nagel zusammengehalten wird. Kein NOT NULL: eine Verordnung
--     entsteht zuerst aus dem OCR-Lauf, der Nagel kommt danach.
--   ★ krankenkasse_ik (05.09.2026): IK der Krankenkasse von der KV-Karte des
--     Versicherten (§302 SGB V, Anlage 1 TP5 V21 § 5.5.3.1) — NICHT dasselbe
--     wie `kostentraeger_ik`. Letztere kommt aus dem Namensabgleich mit der
--     Kassenliste (FK auf `kostentraeger`), Erstere ist bis zur Integration
--     einer echten Kostenträgerdatei (VKG-Segment) NICHT ermittelbar und bleibt
--     überall NULL — der DTA-Bau fällt dann bewusst auf `kostentraeger_ik`
--     zurück (`api-backend/billing/dta/builder.js:106,238,353`). Kein FK,
--     bewusst keine Rückbefüllung: NULL bedeutet "Karten-IK nicht erfasst",
--     das ist ein abfragbarer Zustand und würde beim Kopieren von
--     `kostentraeger_ik` unsichtbar. Migration: prescriptions_krankenkasse_ik.
--   FK patient_id -> leads(id) · arzt_id -> aerzte(id) · abrechnung_id -> abrechnung(id)
--   FK kostentraeger_ik -> kostentraeger(ik) · PK (id)
--   ★ SEIT 04.09.2026: EIN Verordnungstopf für ALLE Fachbereiche
--     (Physio/Ergo/Logo UND Podologie, `therapie_bereich` unterscheidet).
--     Die alte, separate `verordnungen`-Tabelle (Podologie-Topf) ist an diesem
--     Tag aufgegangen: ihre 4 Zeilen wurden mit UNVERÄNDERTEN ids hierher
--     kopiert, alle Fremdschlüssel (podologie_behandlungen, bookings, invoices,
--     zuzahlung_guthaben, zuzahlung_korrekturen) zeigen seither hierher.
--     `verordnungen` selbst wurde am 04.09.2026 GEDROPPT (Nutzerentscheidung,
--     vorgezogen aus der ursprünglich geplanten 90-Tage-Frist) — nicht mehr in
--     der DB, nicht mehr in api/dsgvo.js gelistet. Historischer Rest-Hinweis
--     an der Stelle, wo die Tabelle früher stand: siehe unten im Dump.
--     Grund der Wahl (statt umgekehrt: prescriptions → verordnungen migrieren):
--     9 statt 47 Spalten, 7 statt 242 Zeilen, 72 statt 168 Codestellen. Details
--     und Spaltenübersetzung: module/verordnung-topf.js.
--     Neun Spalten kamen dabei aus `verordnungen` dazu (patient_name,
--     wagner_grad, versichertennummer, behandlungsanlass, absetzung_*,
--     storno_*, rezeptart). `rezeptart` bewusst NICHT mit `rezept_typ` gefaltet
--     — unterschiedliche Achsen (Zahler vs. Formtyp), siehe module/
--     verordnung-topf.js Kopf. `status` (oben) bleibt die Bearbeitungsachse;
--     `abrechnung_status` ist das Podologie-Gegenstück zum alten
--     `verordnungen.status` (Wertetabelle: aktiv=NULL, abrechenbar=bereit,
--     abgerechnet=gesendet, abgesetzt=rejected, teilabsetzung/storniert/
--     archiviert unverändert).
--   ★ PHI-Verschlüsselung: icd10_enc, ocr_raw_enc, phi_encrypted.
--   TRIGGER fn_prescriptions_set_befreit() setzt zuzahlung_befreit automatisch.
--   ⚠️ `verordnungsnummer` / `belegnummer`: fortlaufend je Patient
--      (Trigger trg_prescriptions_verordnungsnummer), Belegnummer bei der
--      DTA-Erzeugung eingefroren.

CREATE TABLE profiles (
  id uuid NOT NULL                      -- = auth.users.id
  email text
  business_name text
  plan text DEFAULT 'starter'::text
  billing text DEFAULT 'monthly'::text
  airtable_link text
  whatsapp_number text
  language text DEFAULT 'de'::text
  created_at timestamptz DEFAULT now()
  activated_at timestamptz DEFAULT now()
  is_active boolean DEFAULT true
  sector text
  city text
  country text DEFAULT 'DE'::text
  booking_slug text
  whatsapp_phone_number_id text
  whatsapp_waba_id text
  whatsapp_access_token_secret_id uuid
  working_hours jsonb DEFAULT '{}'::jsonb
  faq jsonb DEFAULT '[]'::jsonb
  message_templates jsonb DEFAULT '{}'::jsonb
  system_prompt text
  onboarding_step text DEFAULT 'account'::text
  updated_at timestamptz DEFAULT now()
  plan_status text NOT NULL DEFAULT 'pending'::text
  trial_ends_at timestamptz
  stripe_customer_id text
  stripe_subscription_id text
  stripe_price_id text
  billing_interval text
  current_period_end timestamptz
  role text DEFAULT 'owner'::text
  company_code text
  owner_id uuid                          -- Mitarbeiter -> Inhaber
  b2b_sender_name text
  b2b_setup_done boolean DEFAULT false
  b2b_from_email text
  b2b_gmail_refresh_token text
  street text
  zip text
  house_number text
  owner_first_name text
  owner_last_name text
  accepts_bookings boolean DEFAULT true
  avatar_url text
  anrede text
  ik_number text
  plz text
  phone text
  iban text
  bic text
  bank_name text
  steuernummer text
  ust_id text
  tax_exempt_note text
  has_dta_pro boolean NOT NULL DEFAULT false
  dta_pro_subscription_item_id text
  clinic_location geography(Point,4326)
  clinic_geocoded_at timestamptz
  clinic_lat numeric(9,6)
  clinic_lng numeric(9,6)
  avv_accepted_at timestamptz
  agb_accepted_at timestamptz
  deletion_scheduled_at timestamptz
  deletion_consent_at timestamptz
  deletion_consent_ip text
  tablet_kiosk_pin_set boolean NOT NULL DEFAULT false
  praxis_logo_url text
  invoice_footer_text text
  urlaub_jahrestage integer DEFAULT 30
  booking_auto_approve boolean DEFAULT false
  booking_auto_approve_types text[] DEFAULT '{}'::text[]
  booking_request_link_enabled boolean DEFAULT true
  kim_adresse text
  telematik_id text
  ausfall_enabled boolean NOT NULL DEFAULT false
  ausfall_mode text NOT NULL DEFAULT 'fixed'::text
  ausfall_amount_eur numeric(10,2)
  ausfall_percent numeric(5,2)
  ausfall_cutoff_hours integer NOT NULL DEFAULT 24
  ausfall_hinweis text
  fussbefund_legende jsonb NOT NULL DEFAULT '[]'::jsonb   -- Podologie-Legende
);
--   CHECK plan IN (starter, professional, klinik, mitarbeiter, enterprise)
--   CHECK plan_status IN (pending, trial, active, past_due, canceled, expired)
--   CHECK role IN (owner, employee) · billing IN (monthly, annual)
--   CHECK billing_interval IN (month, year) OR NULL
--   CHECK anrede IN (Herr, Frau, Divers)
--   CHECK onboarding_step IN (account, business, billing, owner, services,
--                             hours, whatsapp, templates, plan, done)
--   CHECK sector IN (barber, beauty, nails, tattoo, spa, gym, massage,
--                    physiotherapy, praxis, other, podologie, logopaedie, ergotherapie)
--     ⚠️ Die Nicht-Praxis-Sektoren stammen aus der alten KMU-Ausrichtung und
--        werden im Onboarding nicht mehr angeboten. Constraint noch nicht bereinigt.
--   FK id -> auth.users(id) ON DELETE CASCADE · owner_id -> profiles(id)
--   PK (id) · UNIQUE (booking_slug) · UNIQUE (company_code)
--   ★ Zentrale Tenant-Tabelle. Owner-Einstellungen gehören HIERHER, nicht nach
--     businesses (Einzelstandort-Owner haben dort keinen Datensatz).
--   ⚠️ has_dta_pro / dta_pro_subscription_item_id sind tote Spalten
--      (Add-on 2026-06-08 abgeschafft, §302 ist in Professional enthalten).
--   ⚠️ whatsapp_* und system_prompt/faq/message_templates sind tot
--      (WhatsApp-Strang 2026-05-20 eingestellt).

CREATE TABLE referral_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  lead_id uuid
  raw_ai_data jsonb NOT NULL DEFAULT '{}'::jsonb
  patient_vorname text
  patient_nachname text
  patient_geburtsdatum date
  seans_sayisi integer
  tedavi_turu text
  hausbesuch boolean DEFAULT false
  diagnose text
  arzt_name text
  image_url text
  is_confirmed boolean DEFAULT false
  status text DEFAULT 'pending'::text
  confirmed_at timestamptz
  confirmed_by uuid
  booking_series_id uuid
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  business_id uuid
);
--   CHECK status IN (pending, approved, rejected) · PK (id)
--   ⚠️ Zwei Spalten tragen noch türkische Namen: seans_sayisi (Sitzungsanzahl),
--      tedavi_turu (Behandlungsart).

CREATE TABLE scraper_data (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  name text
  company_name text
  category text
  city text
  phone text
  email text
  website text
  notes text
  status text NOT NULL DEFAULT 'new'::text
  created_at timestamptz NOT NULL DEFAULT now()
  updated_at timestamptz NOT NULL DEFAULT now()
  business_id uuid
);
--   PK (id) — Apify-Suchergebnisse (B2B-Akquise).

CREATE TABLE services (
  id uuid NOT NULL DEFAULT uuid_generate_v4()
  user_id uuid
  title text NOT NULL
  duration_minutes integer
  price text
  description text
  is_online_meeting boolean DEFAULT false
  created_at timestamptz DEFAULT now()
  color text DEFAULT '#22c55e'::text
  owner_id uuid
  price_config jsonb
  code text
  is_internal boolean DEFAULT false
  business_id uuid
  is_group boolean DEFAULT false
  group_capacity integer DEFAULT 5
  required_certificate text
  gkv_position_nr text
);
--   CHECK required_certificate IN (MT, MLD, KGG) · PK (id)
--   ★ Die Leistungstabelle. Bis 28.08.2026 gab es daneben `business_services`;
--     jene Spiegeltabelle ist gedroppt, `services` ist seither die einzige.
--   ⚠️ Policy "Public read services" erlaubt SELECT für alle (Booking-Seite).
--   ⚠️ price ist text, nicht numeric. Struktur steckt in price_config jsonb.
--   ⏳ AUSSTEHEND: Spalte `kostentraeger_typ text` (CHECK: gkv/privat/
--     selbstzahler/bg, NULL erlaubt). Migration liegt fertig unter
--     supabase/migrations/20260902090000_services_kostentraeger_typ.sql,
--     war am 03.09.2026 noch nicht ausgefuehrt. Dieser Dump ist bis dahin
--     korrekt — die Spalte gibt es wirklich noch nicht. Nach dem Lauf:
--     „Schema aktualisieren" und diesen ganzen ⏳-Block loeschen.

CREATE TABLE spatial_ref_sys (
  srid integer NOT NULL
  auth_name varchar(256)
  auth_srid integer
  srtext varchar(2048)
  proj4text varchar(2048)
);
--   PostGIS-Systemtabelle. Einzige Tabelle OHNE RLS — unkritisch.

CREATE TABLE terapeut_zertifikat (
  owner_id uuid NOT NULL
  ik_nummer text NOT NULL
  cert_subject text
  cert_valid_from date
  cert_valid_to date
  cert_thumbprint text
  cert_serial text
  uploaded_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  business_id uuid
);
--   PK (owner_id) — §302-Signaturzertifikat (PKCS#7, Browser-Signatur).
--   ⚠️ Name ist türkisch ("terapeut"), nicht "therapeut". Nicht verwechseln
--      mit therapist_certificates (das sind MT/MLD/KGG-Qualifikationen).

CREATE TABLE therapist_certificates (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  profile_id uuid NOT NULL
  certificate text NOT NULL
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
--   CHECK certificate IN (MT, MLD, KGG)
--   PK (id) · UNIQUE (profile_id, certificate)

CREATE TABLE time_offs (
  id uuid NOT NULL DEFAULT uuid_generate_v4()
  employee_id uuid NOT NULL
  start_date timestamptz NOT NULL
  end_date timestamptz NOT NULL
  reason text
  created_at timestamptz DEFAULT now()
  business_id uuid
  type text DEFAULT 'urlaub'::text
  owner_id uuid
  note text
  approved_by uuid
  approved_at timestamptz
);
--   CHECK type IN (urlaub, krank, frei, elternzeit)
--   FK employee_id -> profiles(id) ON DELETE CASCADE · PK (id)
--   ⚠️ Policy "Public read time offs" erlaubt SELECT für alle.

CREATE TABLE trip_history (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  user_id uuid
  plan_id uuid
  started_at timestamptz
  completed_at timestamptz
  stops_visited integer DEFAULT 0
  total_stops integer DEFAULT 0
  created_at timestamptz DEFAULT now()
);
--   PK (id) · ⚠️ Fremdkörper aus dem alten Reise-Projekt, nicht Praxura.

CREATE TABLE trip_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  user_id uuid
  accommodation_id uuid
  title text
  city text
  country text
  duration_hours numeric
  transport_mode text
  status text DEFAULT 'draft'::text
  plan_data jsonb
  total_cost_min numeric
  total_cost_max numeric
  currency text DEFAULT 'EUR'::text
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
);
--   PK (id) · ⚠️ Fremdkörper aus dem alten Reise-Projekt, nicht Praxura.

CREATE TABLE ueberweisungen (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  lead_id uuid NOT NULL
  image_url text
  arzt_name text
  notiz text
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  business_id uuid
);
--   FK lead_id -> leads(id) · PK (id)

CREATE TABLE user_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  user_id uuid
  credits integer NOT NULL DEFAULT 2
  is_unlimited boolean NOT NULL DEFAULT false
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
);
--   PK (id) · UNIQUE (user_id) · ⚠️ Fremdkörper aus einem alten Projekt.

CREATE TABLE user_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  user_id uuid NOT NULL
  preference_key text NOT NULL
  preference_value text
  updated_at timestamptz DEFAULT now()
);
--   PK (id) · UNIQUE (user_id, preference_key)

CREATE TABLE vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  created_by uuid NOT NULL
  kind text NOT NULL
  kennzeichen text NOT NULL
  label text
  is_default boolean DEFAULT false
  is_active boolean DEFAULT true
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()
  business_id uuid
);
--   CHECK kind IN (privat, gewerblich) · PK (id)
--   RLS: private Fahrzeuge sieht nur, wer sie angelegt hat.

-- ★★★ `verordnungen` — GEDROPPT 04.09.2026, nicht wieder anlegen. ★★★
-- War der Podologie-Verordnungstopf, bis er in `prescriptions`
-- (therapie_bereich='podo') aufging (Kemal, 04.09.2026: "tek tablo olması
-- şart"). Erst 3 Tage stillgelegt (ids unverändert übernommen, FKs
-- umgehängt), dann auf Nutzerwunsch sofort gedroppt statt der ursprünglich
-- vorgesehenen 90-Tage-Frist. Die 4 historischen Zeilen liegen NICHT im
-- Repo (DSGVO) — lokale Sicherung ausserhalb der DB, ausserhalb des Repos.
-- `api/dsgvo.js` wurde entsprechend bereinigt (Tabelle nicht mehr gelistet).
-- Spaltenübersetzung + volle Begründung: `module/verordnung-topf.js`.
-- Für JEDE künftige Podologie- (oder sonstige Verordnungs-)Frage gilt: die
-- EINE Tabelle ist `prescriptions`. Kein zweiter Verordnungstopf wird
-- wieder eröffnet — vor jeder neuen Tabelle mit "Verordnung" im Namen erst
-- `db-ustasi` fragen und diesen Absatz zeigen.

CREATE TABLE visibility_reports (
  sector text NOT NULL
  role text NOT NULL
  module_id text NOT NULL
  rendered boolean NOT NULL
  dom_ok boolean NOT NULL
  hidden_reason text
  reported_at timestamptz NOT NULL DEFAULT now()
  reported_by uuid
);
--   PK (sector, role, module_id) — Telemetrie zur Modulsichtbarkeit.

CREATE TABLE warteliste (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  lead_id uuid
  service_id uuid
  preferred_days jsonb DEFAULT '[]'::jsonb
  preferred_time_from time
  preferred_time_to time
  notes text
  priority smallint DEFAULT 1
  status text NOT NULL DEFAULT 'waiting'::text
  matched_booking_id uuid
  notified_at timestamptz
  created_at timestamptz NOT NULL DEFAULT now()
  updated_at timestamptz NOT NULL DEFAULT now()
);
--   CHECK priority BETWEEN 1 AND 3 · status IN (waiting, matched, cancelled)
--   PK (id)

CREATE TABLE working_hours (
  id uuid NOT NULL DEFAULT uuid_generate_v4()
  user_id uuid NOT NULL
  day_of_week integer NOT NULL
  start_time time NOT NULL
  end_time time NOT NULL
  is_active boolean DEFAULT true
  created_at timestamptz DEFAULT now()
  owner_id uuid
  business_id uuid
);
--   CHECK day_of_week BETWEEN 0 AND 6
--   PK (id) · UNIQUE (user_id, day_of_week)
--   ⚠️ Policy "Public read working hours" erlaubt SELECT für alle (Booking-Seite).

CREATE TABLE zaa_fehler (
  id bigint NOT NULL DEFAULT nextval('zaa_fehler_id_seq')
  abrechnung_id uuid NOT NULL
  prescription_id uuid
  fehler_code text NOT NULL
  fehler_text text
  uebersetzung text
  loesung_hint text
  status text NOT NULL DEFAULT 'offen'::text
  resolved_at timestamptz
  created_at timestamptz DEFAULT now()
);
--   CHECK status IN (offen, in_bearbeitung, behoben, ignoriert)
--   FK abrechnung_id -> abrechnung(id) ON DELETE CASCADE · PK (id)
--   Kassenrückmeldungen (Absetzungen) aus der ZAA-Datei.

CREATE TABLE zuzahlung_befreiung (
  id bigint NOT NULL DEFAULT nextval('zuzahlung_befreiung_id_seq')
  owner_id uuid NOT NULL
  patient_id uuid NOT NULL
  jahr integer NOT NULL
  befreit_ab date NOT NULL
  befreit_bis date
  beleg_url text
  created_at timestamptz DEFAULT now()
  business_id uuid
  nachweis_art text DEFAULT 'bescheinigung'::text
  notiz text
);
--   FK patient_id -> leads(id) ON DELETE CASCADE
--   PK (id) · UNIQUE (patient_id, jahr)
--   TRIGGER fn_befreiung_backfill_prescriptions() aktualisiert bestehende Rezepte.

CREATE TABLE zuzahlung_guthaben (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  business_id uuid
  patient_id uuid NOT NULL
  quelle_prescription_id uuid
  quelle_verordnung_id uuid
  betrag_eur numeric(10,2) NOT NULL
  rest_eur numeric(10,2) NOT NULL
  status text NOT NULL DEFAULT 'offen'::text
  notiz text
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  created_by uuid
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
--   CHECK betrag_eur > 0 · rest_eur >= 0 · rest_eur <= betrag_eur
--   CHECK status IN (offen, teilweise_verrechnet, verrechnet, ausgezahlt, verfallen)
--   CHECK NOT (quelle_prescription_id IS NOT NULL AND quelle_verordnung_id IS NOT NULL)
--        Seit 04.09.2026 zeigen BEIDE Spalten auf prescriptions (EIN Topf) —
--        der CHECK besteht unveraendert fort, nur die Namen sind jetzt gleich-bedeutend.
--   FK owner_id -> profiles(id) ON DELETE RESTRICT
--   FK patient_id -> leads(id) ON DELETE CASCADE
--   FK quelle_prescription_id -> prescriptions(id) ON DELETE SET NULL
--   FK quelle_verordnung_id -> prescriptions(id) ON DELETE SET NULL
--   FK created_by -> auth.users(id) ON DELETE SET NULL
--   PK (id)
--   TRIGGER trg_zuzahlung_guthaben_status leitet status aus rest_eur ab. Was der
--     Client in status schickt, wird ueberschrieben — ausser 'ausgezahlt' und
--     'verfallen', das sind Endzustaende.
--   TRIGGER trg_set_business_id (BEFORE INSERT, set_business_id_default()) —
--     nachgezogen 01.09.2026. Greift nur, wenn business_id noch NULL ist; ein
--     von der Route explizit mitgegebener Wert bleibt unberuehrt.
--   Zuviel kassierte Zuzahlung als Patientenguthaben. Warum: db/REGISTER.md

CREATE TABLE zuzahlung_korrekturen (
  id uuid NOT NULL DEFAULT gen_random_uuid()
  owner_id uuid NOT NULL
  business_id uuid
  patient_id uuid
  prescription_id uuid
  verordnung_id uuid
  alt_betrag_eur numeric(10,2)
  neu_betrag_eur numeric(10,2) NOT NULL
  alt_einheiten integer
  neu_einheiten integer
  grund_code text NOT NULL
  grund text NOT NULL
  guthaben_id uuid
  erfasst_von uuid
  erfasst_am timestamptz NOT NULL DEFAULT timezone('utc', now())
);
--   CHECK grund_code IN (abbruch, korrektur_soll, guthaben_verrechnung,
--                        befreiung_nachgereicht, sonstiges)
--   CHECK length(btrim(grund)) >= 3 · neu_betrag_eur >= 0
--   CHECK neu_einheiten IS NULL OR neu_einheiten >= 0
--   CHECK NOT (prescription_id IS NOT NULL AND verordnung_id IS NOT NULL)
--        (seit 04.09.2026 zeigen beide Spalten auf prescriptions, CHECK bleibt)
--   FK owner_id -> profiles(id) ON DELETE RESTRICT
--   FK patient_id -> leads(id) ON DELETE SET NULL
--   FK prescription_id -> prescriptions(id) ON DELETE SET NULL
--   FK verordnung_id -> prescriptions(id) ON DELETE SET NULL
--   FK guthaben_id -> zuzahlung_guthaben(id) ON DELETE SET NULL
--   FK erfasst_von -> auth.users(id) ON DELETE SET NULL
--   PK (id)
--   ⚠️ UNVERAENDERLICH (GoBD): TRIGGER trg_prevent_zuzahlung_korrekturen_mod
--     blockt jedes UPDATE und DELETE, und es gibt bewusst KEINE UPDATE/DELETE-Policy.
--     Eine falsche Korrektur wird durch eine NEUE Korrektur richtiggestellt — genau
--     wie bei belegliste. Kein UPDATE in den Code schreiben, er bekommt eine Exception.
--   TRIGGER trg_set_business_id — wie zuzahlung_guthaben, nachgezogen 01.09.2026.



-- =====================================================================
-- 2. VIEWS
-- =====================================================================

CREATE VIEW profiles_public AS
  SELECT id, business_name, owner_first_name, owner_last_name,
         accepts_bookings, role, owner_id, booking_slug, avatar_url, anrede
  FROM profiles;
--   Öffentliche Buchungsseite. Sensible Spalten wurden 2026-06-03 bewusst entfernt.

CREATE VIEW fahrten_monthly_summary AS
  SELECT owner_id, user_id, vehicle_id, kennzeichen_snapshot, kind_snapshot,
         date_trunc('month', fahrt_started_at) AS month,
         count(*) AS trips,
         sum(COALESCE(distance_km, 0)) AS total_km,
         sum(CASE WHEN fahrt_ended_at IS NOT NULL AND fahrt_started_at IS NOT NULL
                  THEN EXTRACT(epoch FROM fahrt_ended_at - fahrt_started_at) / 60
                  ELSE 0 END)::integer AS total_minutes
  FROM fahrten f
  WHERE end_km IS NOT NULL
  GROUP BY owner_id, user_id, vehicle_id, kennzeichen_snapshot, kind_snapshot,
           date_trunc('month', fahrt_started_at);

-- geometry_columns, geography_columns → PostGIS-Systemviews, hier ausgelassen.
